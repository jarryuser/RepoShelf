import { ArrowDown, ArrowUp, Check, ChevronRight, FolderGit2, GitBranch, GitCommitHorizontal } from 'lucide-react';
import type { Repository } from '../types';
import { relative } from '../format';
interface Props {
  repo: Repository;
  selected: boolean;
  running: boolean;
  onSelect: () => void;
}
export default function RepositoryCard({
  repo,
  selected,
  running,
  onSelect
}: Props) {
  return <button className={`repo-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="repo-card-top">
      <span className={`project-icon ${repo.kind.toLowerCase()}`}>
        <FolderGit2 size={20} />
      </span>
      <div className="repo-title">
        <h3>{repo.name}</h3>
        <span>{repo.kind}</span>
      </div>{running ? <span className="status running">
        <span className="local-dot" />Запущен</span> : repo.changes.length ? <span className="status dirty">{repo.changes.length} изменений</span> : <span className="status clean">
          <Check size={12} />Чисто</span>}</div>
    <div className="repo-branch">
      <GitBranch size={13} />
      <span>{repo.branch}</span>{repo.ahead > 0 && <span className="sync-count">
        <ArrowUp size={11} />{repo.ahead}</span>}{repo.behind > 0 && <span className="sync-count">
          <ArrowDown size={11} />{repo.behind}</span>}</div>
    <div className="repo-commit">
      <GitCommitHorizontal size={14} />
      <span>{repo.commit?.message || 'Пока нет коммитов'}</span>
    </div>
    <div className="repo-card-footer">
      <code>{repo.commit?.hash || 'новый репозиторий'}</code>
      <span>{repo.commit ? relative(repo.commit.timestamp) : 'Нет истории'}<ChevronRight size={13} />
      </span>
    </div>
  </button>;
}
