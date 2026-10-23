interface DesktopApi {
  core: {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
  event: {
    listen: <T>(name: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
  };
}

declare global {
  interface Window {
    __TAURI__?: DesktopApi;
  }
}

export function isTauri() {
  return Boolean(window.__TAURI__);
}

function api() {
  if (!window.__TAURI__) throw new Error('Действие доступно только в desktop-приложении');
  return window.__TAURI__;
}

export function invoke<T = void>(command: string, args?: Record<string, unknown>) {
  return api().core.invoke<T>(command, args);
}

export function listen<T = unknown>(name: string, handler: (event: { payload: T }) => void) {
  return api().event.listen(name, handler);
}
