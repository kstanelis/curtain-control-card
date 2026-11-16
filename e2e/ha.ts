// Small Home Assistant client for the e2e suite: onboarding/login over REST, commands over the
// websocket API. Uses Node's built-in fetch and WebSocket.
import { readFileSync } from 'node:fs';

export const USER = { name: 'Dev', username: 'dev', password: 'devdevdev', language: 'en' };

export interface Target {
  /** Playwright project name, e.g. `ha-2024.8.0`. */
  name: string;
  version: string;
  url: string;
}

/** `HA_TARGETS="2024.8.0=http://localhost:8124,stable=http://localhost:8125"` */
export function targets(): Target[] {
  const raw =
    process.env.HA_TARGETS ?? '2024.8.0=http://localhost:8124,stable=http://localhost:8125';
  return raw.split(',').map((pair) => {
    const [version, url] = pair.split('=') as [string, string];
    return { name: `ha-${version}`, version, url: url.replace(/\/$/, '') };
  });
}

export const authFile = (t: Target): string => `.e2e-auth/${t.name}.json`;

export interface Auth {
  /** Long-lived token for the test process. */
  token: string;
  /** HA version reported by the instance (`stable` resolved). */
  version: string;
}

export const readAuth = (t: Target): Auth =>
  JSON.parse(readFileSync(`${authFile(t)}.token`, 'utf8')) as Auth;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

const clientId = (url: string): string => `${url}/`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url}: ${String(res.status)} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Onboard a fresh instance (or log in to an onboarded one) and return browser tokens. */
export async function signIn(url: string): Promise<Tokens> {
  const steps = await json<{ step: string; done: boolean }[]>(await fetch(`${url}/api/onboarding`));
  const done = (step: string) => steps.find((s) => s.step === step)?.done ?? true;
  let code: string;
  if (!done('user')) {
    ({ auth_code: code } = await json<{ auth_code: string }>(
      await fetch(`${url}/api/onboarding/users`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId(url), ...USER }),
      }),
    ));
  } else {
    code = await loginFlow(url);
  }
  const tokens = await exchange(url, code);
  const post = (path: string, body: unknown = {}) =>
    fetch(`${url}/api/onboarding/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      body: JSON.stringify(body),
    }).then(json);
  if (!done('core_config')) await post('core_config');
  if (!done('analytics')) await post('analytics');
  if (!done('integration')) {
    await post('integration', {
      client_id: clientId(url),
      redirect_uri: `${url}/?auth_callback=1`,
    });
  }
  return tokens;
}

async function loginFlow(url: string): Promise<string> {
  const flow = await json<{ flow_id: string }>(
    await fetch(`${url}/auth/login_flow`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId(url),
        handler: ['homeassistant', null],
        redirect_uri: `${url}/?auth_callback=1`,
      }),
    }),
  );
  const result = await json<{ result?: string }>(
    await fetch(`${url}/auth/login_flow/${flow.flow_id}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId(url),
        username: USER.username,
        password: USER.password,
      }),
    }),
  );
  if (!result.result) throw new Error(`login failed on ${url}`);
  return result.result;
}

async function exchange(url: string, code: string): Promise<Tokens> {
  return json<Tokens>(
    await fetch(`${url}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId(url),
      }),
    }),
  );
}

/** What the HA frontend keeps in localStorage after a login. */
export function hassTokens(url: string, t: Tokens): string {
  return JSON.stringify({
    ...t,
    hassUrl: url,
    clientId: clientId(url),
    expires: Date.now() + t.expires_in * 1000,
  });
}

export interface HaState {
  state: string;
  attributes: Record<string, unknown>;
}

export interface HaEvent {
  event_type: string;
  data: Record<string, unknown>;
}

/** Websocket connection with request/response matching and event subscriptions. */
export class HaSocket {
  private id = 0;
  private readonly pending = new Map<number, (msg: Record<string, unknown>) => void>();
  private readonly listeners = new Map<number, (e: HaEvent) => void>();

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      const id = msg.id as number;
      if (msg.type === 'event') this.listeners.get(id)?.(msg.event as HaEvent);
      else this.pending.get(id)?.(msg);
    });
  }

  static async open(url: string, token: string): Promise<HaSocket> {
    const ws = new WebSocket(`${url.replace(/^http/, 'ws')}/api/websocket`);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('error', () => {
        reject(new Error(`websocket to ${url} failed`));
      });
      ws.addEventListener('message', function auth(ev) {
        const msg = JSON.parse(String(ev.data)) as { type: string };
        if (msg.type === 'auth_required')
          ws.send(JSON.stringify({ type: 'auth', access_token: token }));
        else if (msg.type === 'auth_ok') {
          ws.removeEventListener('message', auth);
          resolve();
        } else if (msg.type === 'auth_invalid') reject(new Error('auth_invalid'));
      });
    });
    return new HaSocket(ws);
  }

  call<T = unknown>(msg: Record<string, unknown>): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, (res) => {
        this.pending.delete(id);
        if (res.success === false)
          reject(new Error(`${String(msg.type)}: ${JSON.stringify(res.error)}`));
        else resolve(res.result as T);
      });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  async subscribe(eventType: string, fn: (e: HaEvent) => void): Promise<void> {
    const id = this.id + 1;
    this.listeners.set(id, fn);
    await this.call({ type: 'subscribe_events', event_type: eventType });
  }

  service(domain: string, service: string, data: Record<string, unknown>): Promise<unknown> {
    return this.call({ type: 'call_service', domain, service, service_data: data });
  }

  async states(): Promise<Partial<Record<string, HaState>>> {
    const list = await this.call<
      { entity_id: string; state: string; attributes: Record<string, unknown> }[]
    >({
      type: 'get_states',
    });
    return Object.fromEntries(list.map((s) => [s.entity_id, s]));
  }

  close(): void {
    this.ws.close();
  }
}
