import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri, listen } from './desktop';
import {
  Check, ChevronRight, Clock3, Code2, Command, Folder, FolderGit2,
  GitBranch, LayoutGrid, Plus, RefreshCw, Search, Settings2, Terminal, X,
} from 'lucide-react';
import { demoRepositories } from './demo';
import type { LogEntry, Repository, Settings } from './types';
import RepositoryCard from './components/RepositoryCard';
import RepositoryDetails from './components/RepositoryDetails';
const desktop = isTauri();
const initialSettings: Settings = {
  root: '',
  editor: 'code',
  commands: {},
  recent: {}
};
const editors = {
  code: 'Visual Studio Code',
  cursor: 'Cursor',
  zed: 'Zed',
  idea: 'IntelliJ IDEA'
};
type Filter = 'all' | 'dirty' | 'recent' | 'running';
export default function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [repositories, setRepositories] = useState<Repository[]>(desktop ? [] : demoRepositories);
  const [selectedPath, setSelectedPath] = useState<string | null>(desktop ? null : demoRepositories[0].path);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('activity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [command, setCommand] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [tab, setTab] = useState<'changes' | 'logs'>('changes');
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const scanning = useRef(false);
  const rootRef = useRef('');
  const queuedScan = useRef(false);
  const [ready, setReady] = useState(!desktop);
  const selected = repositories.find(repo => repo.path === selectedPath);
  const scan = useCallback(async (root: string) => {
    if (!root || !desktop) return;
    if (scanning.current) {
      queuedScan.current = true;
      return;
    }
    scanning.current = true;
    setBusy(true);
    try {
      const result = await invoke<{
        repositories: Repository[];
        warnings: string[];
      }>('scan_repositories', {
        root
      });
      setRepositories(result.repositories);
      setWarnings(result.warnings);
      setSelectedPath(previous => result.repositories.some(repo => repo.path === previous) ? previous : result.repositories[0]?.path ?? null);
      const saved = await invoke<Settings>('get_settings');
      setSettings(saved);
      rootRef.current = saved.root;
      setLastScan(new Date());
      setError('');
    } catch (error) {
      setError(String(error));
    } finally {
      scanning.current = false;
      setBusy(false);
      if (queuedScan.current) {
        queuedScan.current = false;
        void scan(rootRef.current);
      }
    }
  }, []);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const subscriptions = [listen('workspace-changed', () => {
      clearTimeout(timer);
      timer = setTimeout(() => void scan(rootRef.current), 900);
    }), listen<LogEntry>('process-log', event => {
      setLogs(previous => ({
        ...previous,
        [event.payload.path]: [...(previous[event.payload.path] ?? []), event.payload].slice(-2000)
      }));
    }), listen<LogEntry>('process-exit', event => {
      setRunning(previous => ({
        ...previous,
        [event.payload.path]: false
      }));
      setLogs(previous => ({
        ...previous,
        [event.payload.path]: [...(previous[event.payload.path] ?? []), event.payload].slice(-2000)
      }));
    })];
    void Promise.all(subscriptions).then(async () => {
      if (disposed) return;
      const [saved, active] = await Promise.all([invoke<Settings>('get_settings'), invoke<string[]>('get_running')]);
      if (disposed) return;
      setRunning(Object.fromEntries(active.map(path => [path, true])));
      setSettings(saved);
      rootRef.current = saved.root;
      setReady(true);
      if (saved.root) await scan(saved.root);
    }).catch(error => setError(String(error)));
    return () => {
      disposed = true;
      clearTimeout(timer);
      subscriptions.forEach(subscription => void subscription.then(unlisten => unlisten()));
    };
  }, [scan]);
  const savedCommand = selectedPath ? settings.commands[selectedPath] ?? '' : '';
  useEffect(() => {
    setCommand(savedCommand);
  }, [selectedPath, savedCommand]);
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight
    });
  }, [logs, tab, selectedPath]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && document.querySelector('[aria-modal="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); setShowSettings(true); }
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  async function chooseFolder() {
    try {
      const root = await invoke<string | null>('pick_folder');
      if (root) await scan(root);
    } catch (error) {
      setError(String(error));
    }
  }
  async function saveCommand() {
    if (!selected) return;
    setSaving(true);
    try {
      if (desktop) await invoke('save_command', {
        path: selected.path,
        command
      });
      setSettings(previous => ({
        ...previous,
        commands: {
          ...previous.commands,
          [selected.path]: command
        }
      }));
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  }
  async function launch() {
    if (!selected || !desktop) return;
    const path = selected.path;
    setPending(previous => ({
      ...previous,
      [path]: true
    }));
    try {
      if (running[path]) {
        await invoke('stop_command', {
          path
        });
      } else {
        await invoke('save_command', {
          path,
          command
        });
        setSettings(previous => ({
          ...previous,
          commands: {
            ...previous.commands,
            [path]: command
          }
        }));
        setLogs(previous => ({
          ...previous,
          [path]: [{
            path,
            line: `$ ${command}`,
            stream: 'system'
          }]
        }));
        setRunning(previous => ({
          ...previous,
          [path]: true
        }));
        setTab('logs');
        await invoke('start_command', {
          path
        });
      }
    } catch (error) {
      setRunning(previous => ({
        ...previous,
        [path]: false
      }));
      setError(String(error));
    } finally {
      setPending(previous => ({
        ...previous,
        [path]: false
      }));
    }
  }
  async function openEditor() {
    if (!selected || !desktop) return;
    try {
      await invoke('open_editor', {
        path: selected.path
      });
      setSettings(await invoke<Settings>('get_settings'));
    } catch (error) {
      setError(String(error));
    }
  }
  const dirty = repositories.filter(repo => repo.changes.length > 0).length;
  const runningCount = Object.values(running).filter(Boolean).length;
  const visible = repositories.filter(repo => {
    const matches = `${repo.name} ${repo.branch} ${repo.path}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === 'all' || filter === 'dirty' && repo.changes.length > 0 || filter === 'running' && running[repo.path] || filter === 'recent' && Boolean(settings.recent[repo.path]));
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : filter === 'recent' ? (settings.recent[b.path] ?? 0) - (settings.recent[a.path] ?? 0) : (b.commit?.timestamp ?? 0) - (a.commit?.timestamp ?? 0));
  const navItems: {
    key: Filter;
    label: string;
    icon: typeof LayoutGrid;
    count?: number;
  }[] = [{
    key: 'all',
    label: 'Все репозитории',
    icon: LayoutGrid,
    count: repositories.length
  }, {
    key: 'dirty',
    label: 'С изменениями',
    icon: GitBranch,
    count: dirty
  }, {
    key: 'recent',
    label: 'Недавно открытые',
    icon: Clock3
  }, {
    key: 'running',
    label: 'Запущенные',
    icon: Terminal,
    count: runningCount
  }];
  return <div className="app-shell">
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={event => {
          event.preventDefault();
          setFilter('all');
        }}
      >
        <span className="brand-icon">
          <FolderGit2 size={23} />
        </span>RepoShelf<span className="version">BETA</span>
      </a>
      <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Репозитории">{navItems.map(item => <button
        key={item.key}
        className={`nav-item ${filter === item.key ? 'active' : ''}`}
        onClick={() => setFilter(item.key)}
      >
        <item.icon size={17} />
        <span>{item.label}</span>{item.count !== undefined && <span className="nav-count">{item.count}</span>}</button>)}</nav>
      <div className="sidebar-folder">
        <div className="workspace-label">ПАПКА ПРОЕКТОВ</div>
        <div className="folder-location">
          <Folder size={16} />
          <span title={settings.root}>{settings.root ? settings.root.split(/[\\/]/).pop() : desktop ? 'Не выбрана' : 'workspace'}</span>
          <span className="local-dot" />
        </div>
        <p>{settings.root || (desktop ? 'Добавьте папку, чтобы начать' : '/workspace · демо')}</p>
        <button
          className="text-button"
          onClick={desktop ? chooseFolder : undefined}
          disabled={!desktop || busy}
        >
          <Plus size={14} />Выбрать папку</button>
      </div>
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-dot" />
          <span>Локально. На вашем устройстве</span>
        </div>
        <button className="nav-item" onClick={() => setShowSettings(true)}>
          <Settings2 size={17} />Настройки<span className="shortcut">⌘ ,</span>
        </button>
        <div className="sidebar-footer">
          <span>RepoShelf</span>
          <span>v0.1.0</span>
        </div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">
          <FolderGit2 size={16} />
          <span>Рабочее пространство</span>
          <ChevronRight size={14} />
          <strong>{navItems.find(item => item.key === filter)?.label}</strong>
        </div>
        <div className="topbar-right">
          <span className="local-dot" />{desktop ? 'Локальное подключение' : 'Демонстрация интерфейса'}</div>
      </header>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВАШ КОД, В ОДНОМ МЕСТЕ</div>
          <h1>{navItems.find(item => item.key === filter)?.label}<span className="heading-dot">.</span>
          </h1>
          <p>Меньше переключений. Больше времени на код.</p>
        </div>
        <button
          className="button primary"
          onClick={desktop ? chooseFolder : undefined}
          disabled={!desktop || busy}
        >
          <Plus size={16} />{settings.root ? 'Сменить папку' : 'Выбрать папку'}</button>
      </div>
      {!desktop && <div className="demo-banner">
        <Code2 size={16} />
        <span>Демо с примерами данных. Запустите <code>npm run desktop</code> для работы с локальными репозиториями.</span>
      </div>}
      {error && <div className="error-banner" role="alert">
        <span>{error}</span>
        <button aria-label="Закрыть ошибку" onClick={() => setError('')}>
          <X size={16} />
        </button>
      </div>}
      {warnings.length > 0 && <details className="warnings">
        <summary>Не удалось прочитать некоторые файлы ({warnings.length})</summary>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
      <section className="stats" aria-label="Обзор">
        <div className="stat">
          <span className="stat-icon">
            <FolderGit2 size={20} />
          </span>
          <div>
            <span className="stat-label">Всего проектов</span>
            <div className="stat-value">{repositories.length}<span>в рабочей папке</span>
            </div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon amber">
            <GitBranch size={20} />
          </span>
          <div>
            <span className="stat-label">Есть изменения</span>
            <div className="stat-value">{dirty}<span>ждут коммита</span>
            </div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon mint">
            <Check size={20} />
          </span>
          <div>
            <span className="stat-label">Чистые репозитории</span>
            <div className="stat-value">{repositories.length - dirty}<span>всё сохранено</span>
            </div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon violet">
            <Terminal size={20} />
          </span>
          <div>
            <span className="stat-label">Сейчас запущено</span>
            <div className="stat-value">{runningCount}<span>активных процессов</span>
            </div>
          </div>
        </div>
      </section>
      <div className="content-grid">
        <section className="repository-section">
          <div className="list-toolbar">
            <div className="search">
              <Search size={16} />
              <input
                ref={searchRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Найти репозиторий..."
                aria-label="Поиск репозиториев"
              />
              <kbd>⌘ K</kbd>
            </div>
            <button
              className={`icon-button ${busy ? 'spinning' : ''}`}
              title="Обновить"
              aria-label="Обновить репозитории"
              onClick={() => void scan(settings.root)}
              disabled={busy || !desktop || !settings.root}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="list-meta">
            <span>{visible.length} репозиториев</span>
            <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Сортировка">
              <option value="activity">По активности</option>
              <option value="name">По названию</option>
            </select>
          </div>
          <div className="repository-list">{visible.map(repo => <RepositoryCard
            key={repo.path}
            repo={repo}
            selected={selectedPath === repo.path}
            running={Boolean(running[repo.path])}
            onSelect={() => {
              setSelectedPath(repo.path);
              setTab('changes');
            }}
          />)}</div>
          {!visible.length && <div className="empty-state">
            <FolderGit2 size={38} />
            <h3>{busy ? 'Ищем репозитории' : !settings.root && desktop ? 'Здесь будут ваши проекты' : 'Ничего не найдено'}</h3>
            <p>{!settings.root && desktop ? 'Выберите папку, в которой хранятся Git-репозитории' : 'Попробуйте другой запрос или фильтр'}</p>{!settings.root && desktop && <button className="button primary" onClick={chooseFolder} disabled={!ready || busy}>
              <Plus size={16} />Выбрать папку</button>}</div>}
          <div className="scan-note">
            <span className={busy ? 'scan-indicator busy' : 'scan-indicator'} />{busy ? 'Обновляем Git-статус...' : lastScan ? `Обновлено в ${lastScan.toLocaleTimeString('ru', {
              hour: '2-digit',
              minute: '2-digit'
            })} · наблюдение за файлами` : desktop ? 'Статус обновляется при изменении файлов' : 'Пример рабочего пространства'}<span>Глубина: 5 уровней</span>
          </div>
        </section>

        <RepositoryDetails
          selected={selected}
          desktop={desktop}
          command={command}
          savedCommand={selected ? settings.commands[selected.path] ?? '' : ''}
          saving={saving}
          running={Boolean(selected && running[selected.path])}
          pending={Boolean(selected && pending[selected.path])}
          lastOpened={selected ? settings.recent[selected.path] ?? 0 : 0}
          logs={selected ? logs[selected.path] ?? [] : []}
          logRef={logRef}
          tab={tab}
          setTab={setTab}
          setCommand={setCommand}
          saveCommand={saveCommand}
          openEditor={openEditor}
          launch={launch}
          clearLogs={() => {
            if (selected) setLogs(previous => ({
              ...previous,
              [selected.path]: []
            }));
          }}
        />
      </div>
      <footer className="page-footer">
        <span>Соберите свои проекты на одной полке</span>
        <span>
          <Command size={12} /> K <span>быстрый поиск</span>
        </span>
      </footer>
    </main>
    {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="section-title">
          <h2 id="settings-title">Настройки</h2>
          <button
            className="icon-button"
            aria-label="Закрыть настройки"
            onClick={() => setShowSettings(false)}
            autoFocus
          >
            <X size={18} />
          </button>
        </div>
        <label htmlFor="editor">Редактор проектов</label>
        <select
          id="editor"
          value={settings.editor || 'code'}
          onChange={async event => {
            const editor = event.target.value;
            try {
              if (desktop) await invoke('save_editor', {
                editor
              });
              setSettings(previous => ({
                ...previous,
                editor
              }));
            } catch (error) {
              setError(String(error));
            }
          }}
        >{Object.entries(editors).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
        <p>Команда редактора должна быть доступна в PATH: <code>{settings.editor || 'code'}</code>
        </p>
        <label>Рабочая папка</label>
        <div className="settings-root">{settings.root || 'Папка не выбрана'}</div>
        <button className="button" disabled={!desktop || busy} onClick={chooseFolder}>
          <Folder size={15} />Изменить папку</button>
        <div className="settings-note">Команды запуска сохраняются для каждого репозитория отдельно. Одновременно можно запускать несколько проектов. При выходе из приложения процессы останавливаются.</div>
      </section>
    </div>}
  </div>;
}
