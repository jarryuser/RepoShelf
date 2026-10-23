use crate::{authorized, Workspace};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Read},
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{Emitter, Manager, State};

#[derive(Default)]
pub struct Processes(Mutex<HashMap<String, Child>>);

impl Processes {
    pub fn is_running(&self) -> bool {
        !self.0.lock().unwrap().is_empty()
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    path: String,
    line: String,
    stream: String,
}

fn pipe(app: tauri::AppHandle, path: String, stream: &str, reader: impl Read + Send + 'static) {
    let stream = stream.to_owned();
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = Vec::new();
        loop {
            buffer.clear();
            // Cap individual chunks so a process without newlines cannot exhaust memory.
            match reader.by_ref().take(8192).read_until(b'\n', &mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buffer)
                        .trim_end_matches(['\r', '\n'])
                        .to_owned();
                    let _ = app.emit(
                        "process-log",
                        LogEvent {
                            path: path.clone(),
                            line,
                            stream: stream.clone(),
                        },
                    );
                }
            }
        }
    });
}

#[tauri::command]
pub fn get_running(processes: State<Processes>) -> Vec<String> {
    processes.0.lock().unwrap().keys().cloned().collect()
}

#[tauri::command(async)]
pub fn start_command(
    app: tauri::AppHandle,
    workspace: State<Workspace>,
    processes: State<Processes>,
    path: String,
) -> Result<(), String> {
    let directory = authorized(&workspace, &path)?;
    let command = workspace
        .settings
        .lock()
        .unwrap()
        .commands
        .get(&path)
        .cloned()
        .filter(|s| !s.trim().is_empty())
        .ok_or("Сначала сохраните команду запуска")?;
    let mut children = processes.0.lock().unwrap();
    if children.contains_key(&path) {
        return Err("Процесс уже запущен".into());
    }
    let mut child = spawn_command(&directory, &command)?;
    let pid = child.id();
    pipe(
        app.clone(),
        path.clone(),
        "stdout",
        child.stdout.take().unwrap(),
    );
    pipe(
        app.clone(),
        path.clone(),
        "stderr",
        child.stderr.take().unwrap(),
    );
    children.insert(path.clone(), child);
    drop(children);
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(150));
        let state = app.state::<Processes>();
        let mut children = state.0.lock().unwrap();
        let Some(child) = children.get_mut(&path) else {
            break;
        };
        if child.id() != pid {
            break;
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                terminate(child);
                children.remove(&path);
                let _ = app.emit(
                    "process-exit",
                    LogEvent {
                        path,
                        line: format!("Процесс завершён: {status}"),
                        stream: "system".into(),
                    },
                );
                break;
            }
            Err(error) => {
                terminate(child);
                children.remove(&path);
                let _ = app.emit(
                    "process-exit",
                    LogEvent {
                        path,
                        line: error.to_string(),
                        stream: "stderr".into(),
                    },
                );
                break;
            }
            Ok(None) => {}
        }
    });
    Ok(())
}

fn spawn_command(directory: &Path, command: &str) -> Result<Child, String> {
    #[cfg(unix)]
    let mut process = {
        use std::os::unix::process::CommandExt;
        let mut process = Command::new("/bin/sh");
        process.args(["-c", command]).process_group(0);
        process
    };
    #[cfg(windows)]
    let mut process = {
        let mut process = Command::new("cmd");
        process.args(["/C", command]);
        process
    };
    process
        .current_dir(directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())
}

fn terminate(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[tauri::command]
pub fn stop_command(
    app: tauri::AppHandle,
    processes: State<Processes>,
    path: String,
) -> Result<(), String> {
    if let Some(mut child) = processes.0.lock().unwrap().remove(&path) {
        terminate(&mut child);
        let _ = app.emit(
            "process-exit",
            LogEvent {
                path,
                line: "Процесс остановлен".into(),
                stream: "system".into(),
            },
        );
    }
    Ok(())
}

pub fn stop_all(processes: &Processes) {
    for (_, mut child) in processes.0.lock().unwrap().drain() {
        terminate(&mut child);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn captures_both_streams_working_directory_and_exit_code() {
        let directory = std::env::temp_dir();
        let mut child = spawn_command(
            &directory,
            "printf '%s' \"$PWD\"; printf 'failure' >&2; exit 7",
        )
        .unwrap();
        let mut stdout = String::new();
        let mut stderr = String::new();
        child
            .stdout
            .take()
            .unwrap()
            .read_to_string(&mut stdout)
            .unwrap();
        child
            .stderr
            .take()
            .unwrap()
            .read_to_string(&mut stderr)
            .unwrap();
        assert_eq!(child.wait().unwrap().code(), Some(7));
        assert_eq!(
            std::fs::canonicalize(stdout).unwrap(),
            std::fs::canonicalize(directory).unwrap()
        );
        assert_eq!(stderr, "failure");
    }

    #[cfg(unix)]
    #[test]
    fn stopping_a_command_also_stops_its_children() {
        let directory =
            std::env::temp_dir().join(format!("reposhelf-process-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let mut child = spawn_command(
            &directory,
            "(sleep 0.3; printf leaked > leaked.txt) & printf 'ready\\n'; wait",
        )
        .unwrap();
        let mut ready = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut ready)
            .unwrap();
        assert_eq!(ready.trim(), "ready");
        terminate(&mut child);
        assert!(child.try_wait().unwrap().is_some());
        thread::sleep(Duration::from_millis(450));
        assert!(!directory.join("leaked.txt").exists());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
