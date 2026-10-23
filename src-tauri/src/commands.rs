use serde::Serialize;
use serde_json::Value;
use std::{collections::BTreeSet, fs, path::Path};

#[derive(Clone, Serialize)]
pub struct LaunchCommand {
    pub label: String,
    pub command: String,
    pub source: String,
}

pub fn detect(path: &Path) -> (Vec<LaunchCommand>, Vec<String>) {
    let mut commands = Vec::new();
    let mut warnings = Vec::new();
    if path.join("package.json").is_file() {
        match javascript_commands(path) {
            Ok((found, skipped)) => {
                commands.extend(found);
                warnings.extend(skipped);
            }
            Err(error) => warnings.push(format!("package.json: {error}")),
        }
    }
    if path.join("Cargo.toml").is_file() {
        match rust_commands(path) {
            Ok(found) => commands.extend(found),
            Err(error) => warnings.push(format!("Cargo.toml: {error}")),
        }
    }
    (commands, warnings)
}

fn safe_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('-')
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_:./".contains(&byte))
}

fn javascript_commands(path: &Path) -> Result<(Vec<LaunchCommand>, Vec<String>), String> {
    let manifest: Value =
        serde_json::from_slice(&fs::read(path.join("package.json")).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let declared = manifest
        .get("packageManager")
        .and_then(Value::as_str)
        .and_then(|manager| manager.split('@').next())
        .filter(|manager| matches!(*manager, "npm" | "pnpm" | "yarn" | "bun"));
    let manager = declared.unwrap_or_else(|| {
        if path.join("pnpm-lock.yaml").exists() {
            "pnpm"
        } else if path.join("yarn.lock").exists() {
            "yarn"
        } else if path.join("bun.lock").exists() || path.join("bun.lockb").exists() {
            "bun"
        } else {
            "npm"
        }
    });
    let mut commands = Vec::new();
    let mut warnings = Vec::new();
    if let Some(scripts) = manifest.get("scripts").and_then(Value::as_object) {
        for (name, script) in scripts {
            if !script
                .as_str()
                .is_some_and(|value| !value.trim().is_empty())
            {
                continue;
            }
            if !safe_name(name) {
                warnings.push(format!(
                    "Скрипт {name:?} пропущен: имя содержит специальные символы"
                ));
                continue;
            }
            commands.push(LaunchCommand {
                label: name.clone(),
                command: format!("{manager} run {name}"),
                source: "package.json".into(),
            });
        }
    }
    let priority = |name: &str| match name {
        "dev" => 0,
        "start" => 1,
        "serve" => 2,
        "desktop" => 3,
        _ => 4,
    };
    commands.sort_by(|a, b| {
        priority(&a.label)
            .cmp(&priority(&b.label))
            .then(a.label.cmp(&b.label))
    });
    Ok((commands, warnings))
}

fn rust_commands(path: &Path) -> Result<Vec<LaunchCommand>, String> {
    let manifest: toml::Value =
        toml::from_str(&fs::read_to_string(path.join("Cargo.toml")).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let mut commands = Vec::new();
    let mut add = |command: String| {
        commands.push(LaunchCommand {
            label: command.clone(),
            command,
            source: "Cargo.toml".into(),
        })
    };
    if let Some(package) = manifest.get("package") {
        let mut binaries = BTreeSet::new();
        let explicit_paths: BTreeSet<_> = manifest
            .get("bin")
            .and_then(toml::Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|target| target.get("path").and_then(toml::Value::as_str))
            .map(|target| path.join(target))
            .collect();
        if package.get("autobins").and_then(toml::Value::as_bool) != Some(false) {
            if path.join("src/main.rs").is_file()
                && !explicit_paths.contains(&path.join("src/main.rs"))
            {
                if let Some(name) = package.get("name").and_then(toml::Value::as_str) {
                    binaries.insert(name.to_owned());
                }
            }
            if let Ok(entries) = fs::read_dir(path.join("src/bin")) {
                for entry in entries.flatten() {
                    let target = entry.path();
                    if explicit_paths.contains(&target)
                        || explicit_paths.contains(&target.join("main.rs"))
                    {
                        continue;
                    }
                    if target.is_file()
                        && target
                            .extension()
                            .is_some_and(|extension| extension == "rs")
                    {
                        if let Some(name) = target.file_stem().and_then(|name| name.to_str()) {
                            binaries.insert(name.to_owned());
                        }
                    } else if target.join("main.rs").is_file() {
                        binaries.insert(entry.file_name().to_string_lossy().into_owned());
                    }
                }
            }
        }
        if let Some(targets) = manifest.get("bin").and_then(toml::Value::as_array) {
            for target in targets {
                if let Some(name) = target.get("name").and_then(toml::Value::as_str) {
                    binaries.insert(name.to_owned());
                }
            }
        }
        if let Some(default) = package
            .get("default-run")
            .and_then(toml::Value::as_str)
            .filter(|name| safe_name(name))
        {
            add(format!("cargo run --bin {default}"));
            binaries.remove(default);
        }
        for name in binaries.into_iter().filter(|name| safe_name(name)) {
            add(format!("cargo run --bin {name}"));
        }
    }
    for action in ["build", "test", "check"] {
        add(format!("cargo {action}"));
    }
    Ok(commands)
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
                "reposhelf-commands-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Project {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn detects_package_manager_and_skips_shell_syntax_in_names() {
        let project = Project::new();
        fs::write(project.0.join("package.json"), r#"{"packageManager":"pnpm@10.0.0","scripts":{"build":"vite build","dev":"vite","test; touch bad":"oops","--help":"oops","empty":"","invalid":false}}"#).unwrap();
        fs::write(project.0.join("yarn.lock"), "").unwrap();
        let (commands, warnings) = detect(&project.0);
        assert_eq!(
            commands
                .iter()
                .map(|command| command.command.as_str())
                .collect::<Vec<_>>(),
            ["pnpm run dev", "pnpm run build"]
        );
        assert_eq!(warnings.len(), 2);
    }

    #[test]
    fn falls_back_to_lockfiles_and_reports_invalid_manifests() {
        let project = Project::new();
        fs::write(
            project.0.join("package.json"),
            r#"{"scripts":{"start":"node index.js"}}"#,
        )
        .unwrap();
        for (lock, manager) in [
            ("bun.lock", "bun"),
            ("yarn.lock", "yarn"),
            ("pnpm-lock.yaml", "pnpm"),
        ] {
            fs::write(project.0.join(lock), "").unwrap();
            assert_eq!(
                detect(&project.0).0[0].command,
                format!("{manager} run start")
            );
        }
        fs::write(project.0.join("package.json"), "broken").unwrap();
        let (commands, warnings) = detect(&project.0);
        assert!(commands.is_empty());
        assert_eq!(warnings.len(), 1);
    }

    #[test]
    fn distinguishes_rust_libraries_from_multiple_binary_targets() {
        let project = Project::new();
        fs::write(
            project.0.join("Cargo.toml"),
            "[package]\nname = 'service'\nversion = '0.1.0'\n",
        )
        .unwrap();
        assert_eq!(detect(&project.0).0.len(), 3);
        fs::create_dir_all(project.0.join("src/bin/worker")).unwrap();
        fs::write(project.0.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(project.0.join("src/bin/worker/main.rs"), "fn main() {}").unwrap();
        let (commands, warnings) = detect(&project.0);
        assert!(warnings.is_empty());
        assert_eq!(commands[0].command, "cargo run --bin service");
        assert_eq!(commands[1].command, "cargo run --bin worker");
    }

    #[test]
    fn respects_explicit_binary_paths_and_disabled_autodiscovery() {
        let project = Project::new();
        fs::create_dir_all(project.0.join("src")).unwrap();
        fs::write(project.0.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(project.0.join("Cargo.toml"), "[package]\nname = 'service'\nversion = '0.1.0'\n[[bin]]\nname = 'server'\npath = 'src/main.rs'\n").unwrap();
        let (commands, _) = detect(&project.0);
        assert_eq!(
            commands
                .iter()
                .filter(|command| command.command.starts_with("cargo run"))
                .map(|command| command.command.as_str())
                .collect::<Vec<_>>(),
            ["cargo run --bin server"]
        );
        fs::write(
            project.0.join("Cargo.toml"),
            "[package]\nname = 'service'\nversion = '0.1.0'\nautobins = false\n",
        )
        .unwrap();
        assert!(!detect(&project.0)
            .0
            .iter()
            .any(|command| command.command.starts_with("cargo run")));
    }
}
