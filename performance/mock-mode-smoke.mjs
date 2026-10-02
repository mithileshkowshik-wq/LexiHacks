#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const API = process.env.LEXIPATH_PERF_API_URL ?? 'http://127.0.0.1:5000/api';
const ITERATIONS = Number(process.env.LEXIPATH_PERF_ITERATIONS ?? 20);
const CONCURRENCY = Number(process.env.LEXIPATH_PERF_CONCURRENCY ?? 4);
const STUDENT_ID = '64b000000000000000000001';
const SAMPLE_ID = '64b000000000000000000101';

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function request(name, url, options = {}) {
  const start = performance.now();
  const response = await fetch(url, options);
  const body = await response.text();
  const durationMs = performance.now() - start;
  if (!response.ok) {
    throw new Error(`${name} returned HTTP ${response.status}: ${body.slice(0, 160)}`);
  }
  return durationMs;
}

async function waitForApi() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API}/students`);
      if (response.status === 401 || response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${API}`);
}

async function login() {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Synthetic@DAS', password: 'Pass@123' }),
  });
  if (!response.ok) throw new Error(`Login returned HTTP ${response.status}`);
  const session = await response.json();
  return session.token;
}

async function runPool(tasks) {
  const queue = [...tasks];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

async function main() {
  const server = spawn('node', ['test-support/e2eServer.js'], {
    cwd: new URL('../server/', import.meta.url),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  const logs = [];
  server.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  try {
    await waitForApi();
    const token = await login();
    const auth = { authorization: `Bearer ${token}` };

    const scenarios = [
      ['login', `${API}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'Synthetic@DAS', password: 'Pass@123' }),
      }],
      ['students list', `${API}/students`, { headers: auth }],
      ['student detail', `${API}/students/${STUDENT_ID}`, { headers: auth }],
      ['sample report', `${API}/samples/${SAMPLE_ID}`, { headers: auth }],
      ['student samples', `${API}/students/${STUDENT_ID}/samples`, { headers: auth }],
      ['trends', `${API}/students/${STUDENT_ID}/trends`, { headers: auth }],
      ['latest recommendations', `${API}/students/${STUDENT_ID}/recommendations/latest`, { headers: auth }],
    ];

    const results = new Map(scenarios.map(([name]) => [name, []]));
    const tasks = [];
    for (let i = 0; i < ITERATIONS; i += 1) {
      for (const [name, url, options] of scenarios) {
        tasks.push(async () => results.get(name).push(await request(name, url, options)));
      }
    }

    await runPool(tasks);

    console.log(`LexiPath mock-mode performance smoke (${ITERATIONS} iterations, concurrency ${CONCURRENCY})`);
    console.log('| Scenario | p50 ms | p95 ms | max ms |');
    console.log('|---|---:|---:|---:|');
    for (const [name, values] of results) {
      console.log(
        `| ${name} | ${percentile(values, 50).toFixed(1)} | ${percentile(values, 95).toFixed(1)} | ${Math.max(...values).toFixed(1)} |`
      );
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
    if (process.env.LEXIPATH_PERF_DEBUG === 'true') console.error(logs.join(''));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
