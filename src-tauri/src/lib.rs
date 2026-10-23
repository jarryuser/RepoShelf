mod commands;
mod diff;
mod git;
mod runner;

use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct Settings {
    root: String,
    editor: String,
    commands: HashMap<String, String>,
    recent: HashMap<String, u64>,
}

#[derive(Default)]
struct Workspace {
    settings: Mutex<Settings>,
    repositories: Mutex<Vec<String>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
    generation: AtomicU64,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("settings.json"))
        .map_err(|e| e.to_string())
}

fn persist(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let path = config_path(app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temporary, path).map_err(|e| e.to_string())
}

fn authorized(workspace: &Workspace, path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if workspace
        .repositories
        .lock()
        .unwrap()
        .iter()
        .any(|p| Path::new(p) == path)
    {
        Ok(path)
    } else {
        Err("Репозиторий не принадлежит текущей рабочей папке".into())
    }
}

#[tauri::command(async)]
fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .set_title("Выберите папку с репозиториями")
        .blocking_pick_folder()
        .map(|path| {
            path.into_path()
                .map(|p| p.to_string_lossy().into_owned())
                .map_err(|e| e.to_string())
        })
        .transpose()
}

#[tauri::command]
fn get_settings(state: State<Workspace>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[derive(Serialize)]
struct ScanResult {
    repositories: Vec<git::Repository>,
    warnings: Vec<String>,
}

#[tauri::command(async)]
fn scan_repositories(
    app: tauri::AppHandle,
    state: State<Workspace>,
    root: String,
) -> Result<ScanResult, String> {
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let changed_root = state.settings.lock().unwrap().root != root.to_string_lossy();
    if changed_root && app.state::<runner::Processes>().is_running() {
        return Err("Остановите запущенные проекты перед сменой рабочей папки".into());
    }
    let (repositories, warnings) = git::scan(&root)?;
    *state.repositories.lock().unwrap() = repositories.iter().map(|r| r.path.clone()).collect();
    if changed_root || state.watcher.lock().unwrap().is_none() {
        let generation = state.generation.fetch_add(1, Ordering::Relaxed) + 1;
        let handle = app.clone();
        let mut watcher =
            notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
                if let Ok(event) = event {
                    if matches!(event.kind, notify::EventKind::Access(_)) {
                        return;
                    }
                    if event.paths.iter().all(|p| {
                        p.components().any(|c| {
                            matches!(
                                c.as_os_str().to_str(),
                                Some("node_modules" | "target" | ".venv" | "dist")
                            )
                        })
                    }) {
                        return;
                    }
                    if handle
                        .state::<Workspace>()
                        .generation
                        .load(Ordering::Relaxed)
                        == generation
                    {
                        let _ = handle.emit("workspace-changed", ());
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
        *state.watcher.lock().unwrap() = Some(watcher);
    }
    let mut settings = state.settings.lock().unwrap();
    settings.root = root.to_string_lossy().into_owned();
    persist(&app, &settings)?;
    Ok(ScanResult {
        repositories,
        warnings,
    })
}

#[tauri::command(async)]
fn get_file_diff(
    state: State<Workspace>,
    path: String,
    file: String,
    staged: bool,
) -> Result<diff::FileDiff, String> {
    let directory = authorized(&state, &path)?;
    diff::read(&directory, &file, staged)
}

#[tauri::command]
fn save_command(
    app: tauri::AppHandle,
    state: State<Workspace>,
    path: String,
    command: String,
) -> Result<(), String> {
    let path = authorized(&state, &path)?.to_string_lossy().into_owned();
    let mut settings = state.settings.lock().unwrap();
    settings.commands.insert(path, command);
    persist(&app, &settings)
}

#[tauri::command]
fn save_editor(
    app: tauri::AppHandle,
    state: State<Workspace>,
    editor: String,
) -> Result<(), String> {
    if !matches!(editor.as_str(), "code" | "cursor" | "zed" | "idea") {
        return Err("Неизвестный редактор".into());
    }
    let mut settings = state.settings.lock().unwrap();
    settings.editor = editor;
    persist(&app, &settings)
}

#[tauri::command(async)]
fn open_editor(app: tauri::AppHandle, state: State<Workspace>, path: String) -> Result<(), String> {
    let path = authorized(&state, &path)?;
    let mut settings = state.settings.lock().unwrap();
    let editor = if settings.editor.is_empty() {
        "code"
    } else {
        &settings.editor
    };
    let status = std::process::Command::new(editor)
        .arg(&path)
        .status()
        .map_err(|e| {
            format!("Не удалось открыть редактор. Проверьте, что его CLI доступен в PATH: {e}")
        })?;
    if !status.success() {
        return Err("Редактор завершился с ошибкой".into());
    }
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    settings
        .recent
        .insert(path.to_string_lossy().into_owned(), timestamp);
    persist(&app, &settings)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Workspace::default())
        .manage(runner::Processes::default())
        .setup(|app| {
            if let Ok(path) = config_path(app.handle()) {
                if path.exists() {
                    let settings: Settings = serde_json::from_slice(&fs::read(path)?)?;
                    *app.state::<Workspace>().settings.lock().unwrap() = settings;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            get_settings,
            scan_repositories,
            get_file_diff,
            save_command,
            save_editor,
            open_editor,
            runner::get_running,
            runner::start_command,
            runner::stop_command
        ])
        .build(tauri::generate_context!())
        .expect("Не удалось запустить RepoShelf")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                runner::stop_all(&app.state::<runner::Processes>());
            }
        });
}
