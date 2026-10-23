import { useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { invoke } from '../desktop';
import { parseDiff } from '../diff';
import type { FileDiff, Repository } from '../types';

interface Props {
  repository: Repository;
  change: Repository['changes'][number];
  onClose: () => void;
}

export default function FileDiffDialog({ repository, change, onClose }: Props) {
  const hasStaged = change.status[0] !== ' ' && change.status[0] !== '?';
  const hasWorking = change.status[1] !== ' ';
  const [staged, setStaged] = useState(hasStaged && !hasWorking);
  const [revision, setRevision] = useState(0);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;

  useEffect(() => {
    if (staged && !hasStaged && hasWorking) setStaged(false);
    if (!staged && !hasWorking && hasStaged) setStaged(true);
  }, [staged, hasStaged, hasWorking]);

  useEffect(() => {
    let disposed = false;
    setDiff(null);
    setError('');
    void invoke<FileDiff>('get_file_diff', { path: repository.path, file: change.path, staged })
      .then(result => { if (!disposed) setDiff(result); })
      .catch(error => { if (!disposed) setError(String(error)); });
    return () => { disposed = true; };
  }, [repository, change.path, staged, revision]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeHandler.current();
      }
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const lines = useMemo(() => parseDiff(diff?.patch ?? ''), [diff?.patch]);
  const added = lines.filter(line => line.kind === 'added').length;
  const removed = lines.filter(line => line.kind === 'removed').length;

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="diff-dialog" role="dialog" aria-modal="true" aria-labelledby="diff-title" ref={dialogRef} onClick={event => event.stopPropagation()}>
      <header className="diff-heading">
        <FileCode2 size={19} />
        <div>
          <h2 id="diff-title">{change.path}</h2>
          <p>{repository.name}{change.originalPath ? ` · ${change.originalPath} → ${change.path}` : ''}</p>
        </div>
        <button className="icon-button" aria-label="Обновить diff" title="Обновить diff" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /></button>
        <button className="icon-button" aria-label="Закрыть diff" ref={closeRef} onClick={onClose}><X size={18} /></button>
      </header>
      <div className="diff-toolbar">
        <div className="diff-modes" role="group" aria-label="Источник изменений">
          <button aria-pressed={!staged} disabled={!hasWorking} onClick={() => setStaged(false)}>Рабочая папка</button>
          <button aria-pressed={staged} disabled={!hasStaged} onClick={() => setStaged(true)}>В индексе</button>
        </div>
        {diff && !diff.binary && <span className="diff-count"><span>+{added}</span><span>−{removed}</span>{diff.truncated ? ' (частично)' : ''}</span>}
      </div>
      {error ? <div className="diff-message" role="alert">{error}</div>
        : !diff ? <div className="diff-message" role="status"><LoaderCircle size={20} className="spin" />Загрузка изменений...</div>
        : diff.binary ? <div className="diff-message">Бинарный файл: текстовый diff недоступен</div>
        : !diff.patch ? <div className="diff-message">{diff.newFile ? 'Новый пустой файл' : 'В выбранном источнике нет изменений'}</div>
        : <div className="diff-code" tabIndex={0} aria-label="Содержимое diff">
          {lines.map((line, index) => <div className={`diff-line ${line.kind}`} key={index}>
            <span className="line-number" aria-hidden="true">{line.oldNumber ?? ''}</span>
            <span className="line-number" aria-hidden="true">{line.newNumber ?? ''}</span>
            <code>{line.text || ' '}</code>
          </div>)}
        </div>}
      <footer className="diff-footer">{diff?.truncated ? 'Показана часть diff: лимит 256 КиБ или 4000 строк' : 'Просмотр изменений · файлы и индекс не изменяются'}</footer>
    </section>
  </div>;
}
