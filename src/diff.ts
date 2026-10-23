export interface DiffLine {
  kind: 'added' | 'removed' | 'context' | 'hunk' | 'meta';
  text: string;
  oldNumber?: number;
  newNumber?: number;
}

export function parseDiff(patch: string): DiffLine[] {
  let oldNumber = 0;
  let newNumber = 0;
  let inHunk = false;
  const lines = patch.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.map(text => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      inHunk = true;
      return { kind: 'hunk', text };
    }
    if (text.startsWith('diff --git ')) inHunk = false;
    if (inHunk) {
      if (text.startsWith('+')) return { kind: 'added', text, newNumber: newNumber++ };
      if (text.startsWith('-')) return { kind: 'removed', text, oldNumber: oldNumber++ };
      if (text.startsWith(' ')) return { kind: 'context', text, oldNumber: oldNumber++, newNumber: newNumber++ };
    }
    return { kind: 'meta', text };
  });
}
