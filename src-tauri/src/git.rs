use serde::Serialize;
use std::{path::Path, process::Command};
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub changes: Vec<Change>,
    pub commit: Option<Commit>,
    pub ahead: usize,
    pub behind: usize,
    pub kind: String,
    pub launch_commands: Vec<crate::commands::LaunchCommand>,
    pub command_warnings: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub status: String,
    pub path: String,
    pub original_path: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct Commit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

fn git(path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("--no-optional-locks")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| format!("Не удалось запустить Git: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn changes(path: &Path) -> Result<Vec<Change>, String> {
    let status = git(
        path,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let mut records = status.split('\0').filter(|s| !s.is_empty());
    let mut changes = Vec::new();
    while let Some(record) = records.next() {
        if record.len() < 3 {
            continue;
        }
        let code = &record[..2];
        let file = record[3..].to_owned();
        let original_path = if code.contains('R') || code.contains('C') {
            records.next().map(str::to_owned)
        } else {
            None
        };
        changes.push(Change {
            status: code.to_owned(),
            path: file,
            original_path,
        });
    }
    Ok(changes)
}

pub fn inspect(path: &Path) -> Result<Repository, String> {
    let changes = changes(path)?;
    let branch = git(path, &["symbolic-ref", "--short", "HEAD"])
        .or_else(|_| git(path, &["rev-parse", "--short", "HEAD"]))?
        .trim()
        .to_owned();
    let commit = git(path, &["log", "-1", "--format=%h%x00%s%x00%an%x00%ct"])
        .ok()
        .and_then(|log| {
            let parts: Vec<_> = log.trim().split('\0').collect();
            if parts.len() != 4 {
                return None;
            }
            Some(Commit {
                hash: parts[0].into(),
                message: parts[1].into(),
                author: parts[2].into(),
                timestamp: parts[3].parse().ok()?,
            })
        });
    let counts = git(
        path,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )
    .unwrap_or_default();
    let mut counts = counts
        .split_whitespace()
        .map(|s| s.parse::<usize>().unwrap_or(0));
    let kind = if path.join("src-tauri").exists() {
        "Tauri"
    } else if path.join("Cargo.toml").exists() {
        "Rust"
    } else if path.join("package.json").exists() {
        "JavaScript"
    } else if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        "Python"
    } else {
        "Git"
    };
    let (launch_commands, command_warnings) = crate::commands::detect(path);
    Ok(Repository {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        branch,
        changes,
        commit,
        ahead: counts.next().unwrap_or(0),
        behind: counts.next().unwrap_or(0),
        kind: kind.into(),
        launch_commands,
        command_warnings,
    })
}

pub fn scan(root: &Path) -> Result<(Vec<Repository>, Vec<String>), String> {
    if !root.is_dir() {
        return Err("Директория не существует".into());
    }
    let mut repos = Vec::new();
    let mut warnings = Vec::new();
    let entries = WalkDir::new(root)
        .max_depth(5)
        .into_iter()
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            entry.depth() == 0
                || (!matches!(
                    name.as_ref(),
                    ".git" | "node_modules" | "target" | ".venv" | "dist" | "vendor"
                ) && !entry
                    .path()
                    .parent()
                    .is_some_and(|parent| parent.join(".git").exists()))
        });
    for entry in entries {
        match entry {
            Ok(entry) if entry.file_type().is_dir() && entry.path().join(".git").exists() => {
                match inspect(entry.path()) {
                    Ok(repo) => repos.push(repo),
                    Err(error) => warnings.push(format!("{}: {error}", entry.path().display())),
                }
            }
            Err(error) => warnings.push(error.to_string()),
            _ => {}
        }
    }
    repos.sort_by(|a, b| {
        b.commit
            .as_ref()
            .map(|c| c.timestamp)
            .cmp(&a.commit.as_ref().map(|c| c.timestamp))
            .then(a.name.cmp(&b.name))
    });
    Ok((repos, warnings))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn scans_unborn_dirty_and_committed_repositories() {
        let root = std::env::temp_dir().join(format!("reposhelf-test-{}", std::process::id()));
        fs::create_dir_all(root.join("project")).unwrap();
        let path = root.join("project");
        git(&path, &["init", "-b", "main"]).unwrap();
        fs::write(path.join("hello.txt"), "hello").unwrap();
        let (repos, _) = scan(&root).unwrap();
        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].branch, "main");
        assert_eq!(repos[0].changes[0].status, "??");
        assert!(repos[0].commit.is_none());
        git(&path, &["add", "."]).unwrap();
        git(
            &path,
            &[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.org",
                "commit",
                "-m",
                "First commit",
            ],
        )
        .unwrap();
        let repo = inspect(&path).unwrap();
        assert!(repo.changes.is_empty());
        assert_eq!(repo.commit.unwrap().message, "First commit");
        fs::write(path.join("hello.txt"), "changed").unwrap();
        assert_eq!(inspect(&path).unwrap().changes[0].status, " M");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn handles_worktrees_renames_and_ignored_dependency_folders() {
        let root =
            std::env::temp_dir().join(format!("reposhelf-worktree-test-{}", std::process::id()));
        let project = root.join("project");
        fs::create_dir_all(&project).unwrap();
        git(&project, &["init", "-b", "main"]).unwrap();
        fs::write(project.join("original name.txt"), "hello").unwrap();
        git(&project, &["add", "."]).unwrap();
        git(
            &project,
            &[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.org",
                "commit",
                "-m",
                "Initial",
            ],
        )
        .unwrap();
        git(&project, &["mv", "original name.txt", "renamed file.txt"]).unwrap();
        fs::write(project.join("another file.txt"), "untracked").unwrap();
        let repo = inspect(&project).unwrap();
        assert_eq!(repo.changes.len(), 2);
        assert!(repo
            .changes
            .iter()
            .any(|change| change.path == "renamed file.txt" && change.status == "R "));
        assert!(repo
            .changes
            .iter()
            .any(|change| change.path == "another file.txt" && change.status == "??"));

        let linked = root.join("linked");
        git(
            &project,
            &["worktree", "add", "-b", "linked", linked.to_str().unwrap()],
        )
        .unwrap();
        let dependency = root.join("node_modules/ignored");
        fs::create_dir_all(&dependency).unwrap();
        git(&dependency, &["init"]).unwrap();
        let (repos, warnings) = scan(&root).unwrap();
        assert!(warnings.is_empty());
        assert_eq!(repos.len(), 2);
        assert!(repos
            .iter()
            .any(|repo| repo.name == "linked" && repo.branch == "linked"));
        fs::remove_dir_all(root).unwrap();
    }
}
