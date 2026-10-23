export interface Repository {
  path: string;
  name: string;
  branch: string;
  changes: { status: string; path: string; originalPath?: string | null }[];
  commit: { hash: string; message: string; author: string; timestamp: number } | null;
  ahead: number;
  behind: number;
  kind: string;
  launchCommands: { label: string; command: string; source: string }[];
  commandWarnings: string[];
}

export interface Settings {
  root: string;
  editor: string;
  commands: Record<string, string>;
  recent: Record<string, number>;
}

export interface LogEntry {
  path: string;
  line: string;
  stream: string;
}

export interface FileDiff {
  patch: string;
  binary: boolean;
  truncated: boolean;
  newFile: boolean;
}
