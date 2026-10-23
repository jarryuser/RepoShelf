use serde::Serialize;
use std::{
    fs,
    io::Read,
    path::{Component, Path},
    process::{Command, Stdio},
    thread,
};

const MAX_BYTES: usize = 256 * 1024;
const MAX_LINES: usize = 4000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub patch: String,
    pub binary: bool,
    pub truncated: bool,
    pub new_file: bool,
}

pub fn read(directory: &Path, file: &str, staged: bool) -> Result<FileDiff, String> {
    if file.is_empty()
        || Path::new(file)
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("Некорректный путь файла".into());
    }
    let change = crate::git::changes(directory)?
        .into_iter()
        .find(|change| change.path == file)
        .ok_or("Файл больше не находится в списке изменений. Обновите репозиторий")?;
    if change.status == "??" {
        if staged {
            return Ok(result(Vec::new(), false, false));
        }
        return untracked(directory, file);
    }
    let mut command = Command::new("git");
    command
        .env("LC_ALL", "C")
        .args([
            "--no-optional-locks",
            "--literal-pathspecs",
            "-c",
            "diff.suppressBlankEmpty=false",
            "-C",
        ])
        .arg(directory)
        .args([
            "diff",
            "--no-color",
            "--no-ext-diff",
            "--no-textconv",
            "--find-renames",
            "--unified=3",
            "--output-indicator-new=+",
            "--output-indicator-old=-",
            "--output-indicator-context= ",
        ]);
    if staged {
        command.arg("--cached");
    }
    command.arg("--").arg(file);
    if let Some(original) = change.original_path {
        command.arg(original);
    }
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    let stderr = child.stderr.take().unwrap();
    let errors = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stderr.take(16 * 1024).read_to_end(&mut bytes);
        bytes
    });
    let mut bytes = Vec::new();
    let output = child
        .stdout
        .take()
        .unwrap()
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes);
    let truncated = bytes.len() > MAX_BYTES;
    if truncated || output.is_err() {
        let _ = child.kill();
    }
    let status = child.wait().map_err(|error| error.to_string())?;
    let errors = errors.join().unwrap_or_default();
    output.map_err(|error| error.to_string())?;
    if !truncated && !status.success() {
        return Err(String::from_utf8_lossy(&errors).trim().to_owned());
    }
    Ok(result(bytes, truncated, false))
}

fn untracked(directory: &Path, file: &str) -> Result<FileDiff, String> {
    let path = directory.join(file);
    let root = fs::canonicalize(directory).map_err(|error| error.to_string())?;
    let parent = fs::canonicalize(path.parent().unwrap()).map_err(|error| error.to_string())?;
    if !parent.starts_with(&root) {
        return Err("Файл находится за пределами репозитория".into());
    }
    let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
    let bytes = if metadata.file_type().is_symlink() {
        fs::read_link(path)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .as_bytes()
            .to_vec()
    } else if metadata.is_file() {
        let resolved = fs::canonicalize(&path).map_err(|error| error.to_string())?;
        if !resolved.starts_with(&root) {
            return Err("Файл находится за пределами репозитория".into());
        }
        let mut bytes = Vec::new();
        fs::File::open(path)
            .map_err(|error| error.to_string())?
            .take((MAX_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        bytes
    } else {
        return Err("Для этого типа файла предпросмотр недоступен".into());
    };
    let truncated = bytes.len() > MAX_BYTES;
    if bytes.contains(&0) {
        return Ok(FileDiff {
            patch: String::new(),
            binary: true,
            truncated,
            new_file: true,
        });
    }
    let text = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BYTES)]);
    let mut patch = format!(
        "--- /dev/null\n+++ b/{file}\n@@ -0,0 +1,{} @@\n",
        text.lines().count()
    );
    for line in text.split_inclusive('\n').take(MAX_LINES) {
        patch.push('+');
        patch.push_str(line);
    }
    if !text.is_empty() && !text.ends_with('\n') {
        patch.push_str("\n\\ No newline at end of file\n");
    }
    let mut diff = result(
        patch.into_bytes(),
        truncated || text.lines().count() > MAX_LINES,
        true,
    );
    if text.is_empty() {
        diff.patch.clear();
    }
    Ok(diff)
}

fn result(mut bytes: Vec<u8>, truncated: bool, new_file: bool) -> FileDiff {
    let byte_limit = bytes.len() > MAX_BYTES;
    bytes.truncate(MAX_BYTES);
    let text = String::from_utf8_lossy(&bytes);
    let binary = text
        .lines()
        .any(|line| line.starts_with("Binary files ") || line == "GIT binary patch");
    let lines: Vec<_> = text.split_inclusive('\n').take(MAX_LINES).collect();
    let length: usize = lines.iter().map(|line| line.len()).sum();
    FileDiff {
        patch: lines.concat(),
        binary,
        truncated: truncated || byte_limit || length < text.len(),
        new_file,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Project(std::path::PathBuf);
    impl Project {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "reposhelf-diff-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            let project = Self(path);
            project.git(&["init", "-b", "main"]);
            project
        }
        fn git(&self, args: &[&str]) {
            let output = Command::new("git")
                .arg("-C")
                .arg(&self.0)
                .args(args)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        fn commit(&self) {
            self.git(&["add", "."]);
            self.git(&[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.org",
                "commit",
                "-m",
                "Initial",
            ]);
        }
    }
    impl Drop for Project {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn separates_index_and_worktree_changes_and_handles_deletion() {
        let project = Project::new();
        let file = project.0.join("hello.txt");
        fs::write(&file, "original\n").unwrap();
        project.commit();
        fs::write(&file, "staged\n").unwrap();
        project.git(&["add", "."]);
        fs::write(&file, "working\n").unwrap();
        let staged = read(&project.0, "hello.txt", true).unwrap();
        assert!(staged.patch.contains("-original\n+staged"));
        assert!(!staged.patch.contains("working"));
        assert!(read(&project.0, "hello.txt", false)
            .unwrap()
            .patch
            .contains("-staged\n+working"));
        fs::remove_file(file).unwrap();
        assert!(read(&project.0, "hello.txt", false)
            .unwrap()
            .patch
            .contains("deleted file mode"));
    }

    #[test]
    fn supports_unborn_index_and_individual_untracked_files() {
        let project = Project::new();
        fs::create_dir_all(project.0.join("new directory")).unwrap();
        fs::write(project.0.join("new directory/a.txt"), "new content\n").unwrap();
        assert_eq!(
            crate::git::changes(&project.0).unwrap()[0].path,
            "new directory/a.txt"
        );
        let diff = read(&project.0, "new directory/a.txt", false).unwrap();
        assert!(diff.new_file);
        assert!(diff.patch.contains("+new content"));
        project.git(&["add", "."]);
        assert!(read(&project.0, "new directory/a.txt", true)
            .unwrap()
            .patch
            .contains("+new content"));
    }

    #[test]
    fn preserves_renames_and_treats_pathspec_characters_literally() {
        let project = Project::new();
        fs::write(project.0.join("original name.txt"), "hello\n").unwrap();
        fs::write(project.0.join("[x].txt"), "first\n").unwrap();
        fs::write(project.0.join("x.txt"), "unrelated\n").unwrap();
        project.commit();
        project.git(&["mv", "original name.txt", "new name.txt"]);
        assert!(read(&project.0, "new name.txt", true)
            .unwrap()
            .patch
            .contains("rename from original name.txt"));
        fs::write(project.0.join("[x].txt"), "second\n").unwrap();
        fs::write(project.0.join("x.txt"), "do not include\n").unwrap();
        let diff = read(&project.0, "[x].txt", false).unwrap();
        assert!(diff.patch.contains("+second"));
        assert!(!diff.patch.contains("do not include"));
        assert!(read(&project.0, "../outside", false).is_err());
        assert!(read(&project.0, ".git/config", false).is_err());
    }

    #[test]
    fn bounds_large_previews_and_handles_binary_and_empty_files() {
        let project = Project::new();
        fs::write(project.0.join("large.txt"), "x".repeat(MAX_BYTES * 2)).unwrap();
        fs::write(project.0.join("binary.bin"), [1, 0, 255]).unwrap();
        fs::write(project.0.join("empty.txt"), "").unwrap();
        let diff = read(&project.0, "large.txt", false).unwrap();
        assert!(diff.truncated);
        assert!(diff.patch.len() <= MAX_BYTES);
        assert!(read(&project.0, "binary.bin", false).unwrap().binary);
        assert!(read(&project.0, "empty.txt", false)
            .unwrap()
            .patch
            .is_empty());
        project.git(&["add", "binary.bin"]);
        assert!(read(&project.0, "binary.bin", true).unwrap().binary);
    }

    #[cfg(unix)]
    #[test]
    fn previews_symlink_target_without_reading_the_external_file() {
        let project = Project::new();
        std::os::unix::fs::symlink("/etc/passwd", project.0.join("link")).unwrap();
        let diff = read(&project.0, "link", false).unwrap();
        assert!(diff.patch.contains("+/etc/passwd"));
        assert!(!diff.patch.contains("root:"));
    }
}
