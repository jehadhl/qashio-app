// test/fakeNest.ts - a tiny HTTP server that stands in for the NestJS API in
// server-side tests, recording every request and answering with queued responses.
import { createServer, IncomingHttpHeaders, Server } from 'http';
import { AddressInfo } from 'net';

export interface RecordedRequest {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

interface QueuedResponse {
  status: number;
  body?: unknown;
}

export interface FakeNest {
  url: string;
  requests: RecordedRequest[];
  // Queue the next response; unqueued requests get 200 { success: true, data: null }.
  respond: (status: number, body?: unknown) => void;
  reset: () => void;
  // A URL on a port nothing listens on, for "backend is down" tests.
  closedUrl: () => Promise<string>;
  close: () => Promise<void>;
}

export async function startFakeNest(): Promise<FakeNest> {
  const requests: RecordedRequest[] = [];
  const queue: QueuedResponse[] = [];

  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body: unknown = raw;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // keep raw text
      }
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });

      const next = queue.shift() ?? { status: 200, body: { success: true, data: null } };
      if (next.body === undefined) {
        res.writeHead(next.status);
        res.end();
        return;
      }
      res.writeHead(next.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(next.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    respond: (status, body) => queue.push({ status, body }),
    reset: () => {
      requests.length = 0;
      queue.length = 0;
    },
    closedUrl: async () => {
      const probe = createServer();
      await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
      const closedPort = (probe.address() as AddressInfo).port;
      await new Promise<void>((resolve) => probe.close(() => resolve()));
      return `http://127.0.0.1:${closedPort}`;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// An unsigned JWT whose payload has `exp` set `secondsFromNow` ahead. The app only
// reads exp (to size cookies); NestJS does the real verification.
export function fakeJwt(secondsFromNow: number, extra: Record<string, unknown> = {}): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'user-1', exp, ...extra })}.signature`;
}
