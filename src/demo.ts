import type { Repository } from './types';
const now = Math.floor(Date.now() / 1000);
export const demoRepositories: Repository[] = [{
  name: 'reposhelf',
  kind: 'Tauri',
  branch: 'feature/project-dashboard',
  changes: [{
    status: ' M',
    path: 'src/App.tsx'
  }, {
    status: ' M',
    path: 'src/styles.css'
  }, {
    status: '??',
    path: 'src/components/RepositoryCard.tsx'
  }],
  commit: {
    hash: 'c82a4f1',
    message: 'Add repository scanning and status updates',
    author: 'Dmytro',
    timestamp: now - 2100
  }
}, {
  name: 'personal-website',
  kind: 'JavaScript',
  branch: 'main',
  changes: [],
  commit: {
    hash: 'e3b10d7',
    message: 'Update projects section and typography',
    author: 'Dmytro',
    timestamp: now - 7600
  }
}, {
  name: 'api-service',
  kind: 'Rust',
  branch: 'feat/auth',
  changes: [{
    status: ' M',
    path: 'src/auth.rs'
  }, {
    status: ' M',
    path: 'Cargo.toml'
  }],
  commit: {
    hash: 'f41d80b',
    message: 'Implement token refresh endpoint',
    author: 'Dmytro',
    timestamp: now - 19000
  }
}, {
  name: 'data-toolkit',
  kind: 'Python',
  branch: 'main',
  changes: [],
  commit: {
    hash: 'a9c20e4',
    message: 'Improve CSV import performance',
    author: 'Dmytro',
    timestamp: now - 86400
  }
}, {
  name: 'notes-app',
  kind: 'JavaScript',
  branch: 'develop',
  changes: [{
    status: '??',
    path: 'src/editor.ts'
  }],
  commit: {
    hash: '07b38f2',
    message: 'Add markdown preview',
    author: 'Dmytro',
    timestamp: now - 172800
  }
}, {
  name: 'dotfiles',
  kind: 'Git',
  branch: 'main',
  changes: [],
  commit: {
    hash: 'b6209d1',
    message: 'Refine terminal configuration',
    author: 'Dmytro',
    timestamp: now - 345600
  }
}].map(repo => ({
  ...repo,
  path: `/workspace/${repo.name}`,
  ahead: repo.name === 'reposhelf' ? 2 : 0,
  behind: 0,
  launchCommands: repo.kind === 'JavaScript' || repo.kind === 'Tauri'
    ? [{ label: 'dev', command: 'npm run dev', source: 'package.json' }, { label: 'build', command: 'npm run build', source: 'package.json' }]
    : repo.kind === 'Rust' ? [{ label: 'cargo run', command: 'cargo run', source: 'Cargo.toml' }] : [],
  commandWarnings: []
}));
