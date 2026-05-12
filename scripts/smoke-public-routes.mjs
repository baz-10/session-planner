import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const publicRoutes = ['/privacy/', '/terms/', '/login/', '/join/?role=parent'];
const nextBin = resolve(process.cwd(), 'node_modules/next/dist/bin/next');

if (!existsSync(resolve(process.cwd(), '.next'))) {
  throw new Error('Missing .next build output. Run npm run build before smoke:public-routes.');
}

if (!existsSync(nextBin)) {
  throw new Error('Missing local Next.js binary. Run npm ci before smoke:public-routes.');
}

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  server.close();
  await once(server, 'close');
  return port;
}

async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
    }
  }

  throw lastError ?? new Error(`Timed out fetching ${url}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  const timeout = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }, 3000);

  try {
    await once(child, 'exit');
  } finally {
    clearTimeout(timeout);
  }
}

const port = Number(process.env.SMOKE_PORT) || await getAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';

server.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

try {
  await fetchWithRetry(`${baseUrl}/login/`, { redirect: 'manual' });

  for (const route of publicRoutes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (response.status !== 200) {
      throw new Error(`${route} expected 200, received ${response.status}`);
    }
  }

  const dashboardResponse = await fetch(`${baseUrl}/dashboard/`, { redirect: 'manual' });
  const location = dashboardResponse.headers.get('location') ?? '';

  if (![307, 308].includes(dashboardResponse.status) || !location.startsWith('/login/')) {
    throw new Error(
      `/dashboard/ expected 307/308 redirect to /login/, received ${dashboardResponse.status} ${location}`
    );
  }

  if (!location.includes('redirect=%2Fdashboard%2F')) {
    throw new Error(`/dashboard/ redirect did not preserve target path: ${location}`);
  }

  console.log('Public route smoke test passed.');
} catch (error) {
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  throw error;
} finally {
  await stopServer(server);
}
