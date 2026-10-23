import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const assets = await readdir(new URL('../dist/assets/', import.meta.url));
const bundle = await readFile(new URL(`../dist/assets/${assets.find(name => name.endsWith('.js'))}`, import.meta.url), 'utf8');

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

async function waitFor(condition) {
  const deadline = Date.now() + 1500;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for the interface');
    await settle();
  }
}

async function render(setup) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(`<div id="root"></div><script>${bundle.replaceAll('</script', '<\\/script')}</script>`, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: console,
    beforeParse(window) {
      window.HTMLElement.prototype.scrollTo = () => {};
      setup?.(window);
    },
  });
  await settle();
  return { dom, document: dom.window.document, errors };
}

function button(document, text) {
  const result = [...document.querySelectorAll('button')].find(button => button.textContent.includes(text));
  assert.ok(result, `Button not found: ${text}`);
  return result;
}

test('filters repositories, searches branches and selects project details', async () => {
  const { dom, document, errors } = await render();
  try {
    assert.equal(document.querySelectorAll('.repo-card').length, 6);
    button(document, 'С изменениями').click();
    await settle();
    assert.equal(document.querySelectorAll('.repo-card').length, 3);
    button(document, 'Все репозитории').click();
    await settle();
    const input = document.querySelector('[aria-label="Поиск репозиториев"]');
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    setValue.call(input, 'feat/auth');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await settle();
    assert.equal(document.querySelectorAll('.repo-card').length, 1);
    document.querySelector('.repo-card').click();
    await settle();
    assert.equal(document.querySelector('.detail-panel h2').textContent, 'api-service');
    assert.match(document.querySelector('.changes-list').textContent, /src\/auth.rs/);
    setValue.call(input, 'does-not-exist');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await settle();
    assert.equal(document.querySelectorAll('.repo-card').length, 0);
    assert.match(document.querySelector('.empty-state').textContent, /Ничего не найдено/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('opens settings with a shortcut and keeps native actions disabled in browser mode', async () => {
  const { dom, document, errors } = await render();
  try {
    assert.equal(button(document, 'Открыть в редакторе').disabled, true);
    assert.equal(button(document, 'Запустить проект').disabled, true);
    document.defaultView.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ',', ctrlKey: true }));
    await settle();
    assert.ok(document.querySelector('[role="dialog"]'));
    const editor = document.querySelector('#editor');
    editor.value = 'zed';
    editor.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await settle();
    assert.equal(document.querySelector('#editor').value, 'zed');
    document.defaultView.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    button(document, 'Логи').click();
    await settle();
    assert.match(document.querySelector('[role="log"]').textContent, /Вывод команды/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});


test('selects a detected command without executing it and saves it per repository', async () => {
  const { dom, document, errors } = await render();
  try {
    const selector = document.querySelector('#detected-command');
    selector.value = 'npm run build';
    selector.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await settle();
    assert.equal(document.querySelector('[aria-label="Команда запуска"]').value, 'npm run build');
    assert.equal(button(document, 'Запустить проект').disabled, true);
    document.querySelector('[aria-label="Сохранить команду"]').click();
    await settle();
    document.querySelectorAll('.repo-card')[1].click();
    await settle();
    assert.equal(document.querySelector('[aria-label="Команда запуска"]').value, '');
    document.querySelectorAll('.repo-card')[0].click();
    await settle();
    assert.equal(document.querySelector('[aria-label="Команда запуска"]').value, 'npm run build');
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('restores running projects after reload and handles process output and exit', async () => {
  const events = new Map();
  const calls = [];
  const path = '/workspace/service';
  const { dom, document, errors } = await render(window => {
    window.__TAURI__ = {
      event: {
        async listen(name, handler) {
          events.set(name, handler);
          return () => events.delete(name);
        },
      },
      core: {
        async invoke(command) {
          calls.push(command);
          if (command === 'get_settings') return { root: '/workspace', editor: 'code', commands: { [path]: 'npm run dev' }, recent: {} };
          if (command === 'get_running') return [path];
          if (command === 'scan_repositories') return { warnings: [], repositories: [{ path, name: 'service', branch: 'main', changes: [], commit: null, ahead: 0, behind: 0, kind: 'JavaScript', launchCommands: [], commandWarnings: [] }] };
          if (command === 'stop_command') {
            events.get('process-exit')({ payload: { path, stream: 'system', line: 'Stopped' } });
            return;
          }
          throw new Error(`Unexpected command: ${command}`);
        },
      },
    };
  });
  try {
    await waitFor(() => document.querySelector('.run-button')?.textContent.includes('Остановить процесс') && !document.querySelector('.run-button').disabled);
    assert.equal(button(document, 'Остановить процесс').disabled, false);
    assert.equal(document.querySelector('[aria-label="Команда запуска"]').disabled, true);
    events.get('process-log')({ payload: { path, stream: 'stdout', line: 'Server ready' } });
    button(document, 'Логи').click();
    await settle();
    assert.match(document.querySelector('[role="log"]').textContent, /Server ready/);
    button(document, 'Остановить процесс').click();
    await settle();
    assert.ok(calls.includes('stop_command'));
    assert.equal(button(document, 'Запустить проект').disabled, false);
    assert.match(document.querySelector('[role="log"]').textContent, /Stopped/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});


async function diffWorkspace(readDiff, changes = [{ status: 'MM', path: 'src/file.ts' }]) {
  const path = '/workspace/project';
  const calls = [];
  const rendered = await render(window => {
    window.__TAURI__ = {
      event: { listen: async () => () => {} },
      core: {
        async invoke(command, args) {
          if (command === 'get_settings') return { root: '/workspace', editor: 'code', commands: {}, recent: {} };
          if (command === 'get_running') return [];
          if (command === 'scan_repositories') return { warnings: [], repositories: [{ path, name: 'project', branch: 'main', changes, commit: null, ahead: 0, behind: 0, kind: 'Git', launchCommands: [], commandWarnings: [] }] };
          if (command === 'get_file_diff') { calls.push(args); return readDiff(args); }
          throw new Error(`Unexpected command: ${command}`);
        },
      },
    };
  });
  await waitFor(() => rendered.document.querySelector('.changed-file'));
  rendered.document.querySelector('.changed-file').click();
  return { ...rendered, calls };
}

test('shows numbered diff lines, switches index/worktree and closes with Escape', async () => {
  const { dom, document, calls, errors } = await diffWorkspace(({ staged }) => ({
    patch: `diff --git a/file b/file\n--- a/file\n+++ b/file\n@@ -10,2 +20,2 @@\n-old\n+${staged ? 'indexed' : 'working'}\n context\n`,
    binary: false, truncated: staged, newFile: false,
  }));
  try {
    await waitFor(() => document.querySelector('.diff-line.added'));
    assert.match(document.querySelector('.diff-line.added').textContent, /working/);
    assert.equal(document.querySelector('.diff-line.removed .line-number').textContent, '10');
    assert.equal(document.querySelector('.diff-line.added .line-number:nth-child(2)').textContent, '20');
    assert.equal(document.querySelector('.diff-count').textContent, '+1−1');
    button(document, 'В индексе').click();
    await waitFor(() => document.querySelector('.diff-line.added')?.textContent.includes('indexed'));
    assert.equal(calls.at(-1).staged, true);
    assert.match(document.querySelector('.diff-footer').textContent, /Показана часть/);
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    assert.equal(document.querySelector('.diff-dialog'), null);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('ignores an older diff response after switching modes', async () => {
  let resolveWorking;
  const { dom, document, errors } = await diffWorkspace(({ staged }) => staged
    ? { patch: '@@ -1 +1 @@\n+indexed\n', binary: false, truncated: false, newFile: false }
    : new Promise(resolve => { resolveWorking = resolve; }));
  try {
    await waitFor(() => resolveWorking);
    button(document, 'В индексе').click();
    await waitFor(() => document.querySelector('.diff-line.added'));
    resolveWorking({ patch: '@@ -1 +1 @@\n+outdated\n', binary: false, truncated: false, newFile: false });
    await settle();
    assert.match(document.querySelector('.diff-code').textContent, /indexed/);
    assert.doesNotMatch(document.querySelector('.diff-code').textContent, /outdated/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('reports diff errors, retries, and explains binary and empty files', async () => {
  let attempt = 0;
  const { dom, document, errors } = await diffWorkspace(() => {
    attempt += 1;
    if (attempt === 1) throw new Error('File unavailable');
    return { patch: '', binary: attempt === 2, truncated: false, newFile: true };
  }, [{ status: '??', path: 'new.txt' }]);
  try {
    await waitFor(() => document.querySelector('.diff-message[role="alert"]'));
    assert.match(document.querySelector('.diff-message').textContent, /File unavailable/);
    assert.equal(button(document, 'В индексе').disabled, true);
    document.querySelector('[aria-label="Обновить diff"]').click();
    await waitFor(() => document.querySelector('.diff-message')?.textContent.includes('Бинарный файл'));
    document.querySelector('[aria-label="Обновить diff"]').click();
    await waitFor(() => document.querySelector('.diff-message')?.textContent.includes('Новый пустой файл'));
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});
