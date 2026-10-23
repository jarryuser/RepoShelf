import { useEffect, useState, type RefObject } from 'react';
import { ArrowUpRight, Check, Circle, Code2, FolderGit2, GitBranch, GitCommitHorizontal, LoaderCircle, Play, Square, Terminal, Trash2 } from 'lucide-react';
import type { LogEntry, Repository } from '../types';
import { relative } from '../format';
import FileDiffDialog from './FileDiffDialog';
interface Props {
  selected?: Repository;
  desktop: boolean;
  command: string;
  savedCommand: string;
  saving: boolean;
  running: boolean;
  pending: boolean;
  lastOpened: number;
  logs: LogEntry[];
  logRef: RefObject<HTMLDivElement>;
  tab: 'changes' | 'logs';
  setTab: (tab: 'changes' | 'logs') => void;
  setCommand: (command: string) => void;
  saveCommand: () => Promise<void>;
  openEditor: () => Promise<void>;
  launch: () => Promise<void>;
  clearLogs: () => void;
}
export default function RepositoryDetails({
  selected,
  desktop,
  command,
  savedCommand,
  saving,
  running,
  pending,
  lastOpened,
  logs,
  logRef,
  tab,
  setTab,
  setCommand,
  saveCommand,
  openEditor,
  launch,
  clearLogs
}: Props) {
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const activeChange = selected?.changes.find(change => change.path === diffFile);
  useEffect(() => { setDiffFile(null); }, [selected?.path]);

  return <aside className="detail-panel">{selected ? <>
    <div className="detail-heading">
      <span className="eyebrow">РЕПОЗИТОРИЙ</span>
      <span className="detail-square">
        <FolderGit2 size={15} />
      </span>
    </div>
    <h2>{selected.name}</h2>
    <p className="detail-path" title={selected.path}>{selected.path}</p>
    <div className="detail-tags">
      <span className="branch-tag">
        <GitBranch size={13} />{selected.branch}</span>
      <span className="language-tag">
        <i className={selected.kind.toLowerCase()} />{selected.kind}</span>
    </div>
    <button className="button editor-button" onClick={openEditor} disabled={!desktop}>
      <Code2 size={16} />Открыть в редакторе<ArrowUpRight size={15} />
    </button>
    <div className="detail-divider" />
    <div className="section-title">
      <span>Последний коммит</span>
      <GitCommitHorizontal size={16} />
    </div>{selected.commit ? <div className="last-commit">
      <p>{selected.commit.message}</p>
      <div>
        <span className="avatar">{selected.commit.author.slice(0, 1).toUpperCase()}</span>
        <span>{selected.commit.author}</span>
        <span className="commit-time">{relative(selected.commit.timestamp)}</span>
      </div>
      <code>{selected.commit.hash}</code>
    </div> : <p className="muted">В репозитории ещё нет коммитов</p>}
    <div className="detail-divider" />
    <div className="section-title">
      <span>Команда запуска</span>
      <Terminal size={15} />
    </div>
    {selected.launchCommands.length > 0 && <div className="command-suggestions">
      <label htmlFor="detected-command">Команды проекта</label>
      <select
        id="detected-command"
        value=""
        disabled={running || pending}
        onChange={event => setCommand(event.target.value)}
      >
        <option value="" disabled>Выбрать из проекта...</option>
        {selected.launchCommands.map(suggestion => <option key={suggestion.command} value={suggestion.command}>
          {suggestion.command} · {suggestion.source}
        </option>)}
      </select>
    </div>}
    {selected.commandWarnings.map((warning, index) => <p className="command-warning" key={index}>{warning}</p>)}
    <div className="command-field">
      <span>$</span>
      <input
        aria-label="Команда запуска"
        placeholder="npm run dev"
        value={command}
        disabled={Boolean(running)}
        onChange={event => setCommand(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') void saveCommand();
        }}
      />
      <button
        className="icon-button"
        title="Сохранить команду"
        aria-label="Сохранить команду"
        onClick={saveCommand}
        disabled={saving || command === (savedCommand ?? '')}
      >
        <Check size={15} />
      </button>
    </div>
    <p className="command-hint">Выполняется в папке проекта через системную оболочку</p>
    <button
      className={`button run-button ${running ? 'stop-button' : ''}`}
      onClick={launch}
      disabled={!desktop || !command.trim() || pending}
    >{pending ? <LoaderCircle size={15} className="spin" /> : running ? <Square size={13} /> : <Play size={14} />} {running ? 'Остановить процесс' : 'Запустить проект'}<span>{running ? 'STOP' : 'RUN'}</span>
    </button>
    <div className="detail-tabs">
      <button className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Изменения <span>{selected.changes.length}</span>
      </button>
      <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Логи {running && <span className="local-dot" />}</button>{tab === 'logs' && <button
        className="clear-logs"
        aria-label="Очистить логи"
        title="Очистить логи"
        onClick={() => clearLogs()}
      >
        <Trash2 size={14} />
      </button>}</div>
    {tab === 'changes' ? <div className="changes-list">{selected.changes.length ? selected.changes.map(change => <button
      className="changed-file"
      key={change.path}
      onClick={() => setDiffFile(change.path)}
      disabled={!desktop}
      title={desktop ? 'Посмотреть diff' : 'Просмотр diff доступен в desktop-приложении'}
      aria-label={`Посмотреть diff: ${change.path}`}
    >
      <span className={change.status === '??' ? 'untracked' : change.status.includes('D') ? 'deleted' : 'modified'}>{change.status === '??' ? 'U' : change.status.trim()}</span>
      <span title={change.path}>{change.path}</span>
    </button>) : <div className="clean-state">
      <Check size={22} />
      <p>Все изменения сохранены</p>
    </div>}</div> : <div className="log-output" ref={logRef} role="log" aria-label="Логи процесса">{logs?.length ? logs.map((log, index) => <div className={log.stream} key={index}>{log.line}</div>) : <div className="log-placeholder">Вывод команды появится здесь после запуска</div>}</div>}
    {desktop && activeChange && <FileDiffDialog
      key={`${selected.path}:${activeChange.path}`}
      repository={selected}
      change={activeChange}
      onClose={() => setDiffFile(null)}
    />}
    <div className="detail-bottom">
      <Circle size={10} />{lastOpened ? `Открывали ${relative(lastOpened)}` : 'Ваш следующий коммит начинается здесь'}</div>
  </> : <div className="detail-empty">
    <Code2 size={32} />
    <h3>Место для вашего проекта</h3>
    <p>Выберите репозиторий, чтобы увидеть подробности и настроить запуск</p>
  </div>}</aside>;
}
