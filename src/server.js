import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAnalysisCard, evaluateEntry, SafeJournal } from './simulator.js';

const port = Number(process.env.PORT ?? 3000);
const now = () => new Date();
const feed = (value) => ({ value, observedAt: now().toISOString(), source: 'local-demo' });
const input = () => ({
  instrument: 'XAUUSD+',
  price: feed({ current: 0, origin: 'Awaiting verified market data' }),
  volume: feed({ ratioToAverage: 'n/a' }),
  volatility: feed({ regime: 'unknown' }),
  calendar: feed({ importantEvents: [] }),
  news: feed({ summary: 'Awaiting verified public news feed' }),
  geopolitics: feed({ summary: 'Awaiting verified public news feed' }),
  scenario: { direction: 'none', probability: 0, invalidation: 'No verified signal' }
});
const journal = new SafeJournal();
const publicDir = fileURLToPath(new URL('../webUItest/', import.meta.url));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function sendJson(response, body) {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function getStatus() {
  const data = input();
  const decision = evaluateEntry(data, { now: now(), openPositions: 0, dailyLossPct: 0 });
  const card = buildAnalysisCard(data, now());
  journal.record({ at: now().toISOString(), decision: decision.allowed ? 'allowed' : 'blocked', reasons: decision.reasons, sources: ['local-demo'] });
  journal.entries.splice(50);
  return { card, decision, journal: journal.entries };
}

createServer(async (request, response) => {
  if (request.url === '/api/status') return sendJson(response, getStatus());
  const fileName = request.url === '/' ? 'index.html' : request.url?.replace(/^\//, '');
  if (!fileName || !/^(index\.html|app\.js|styles\.css)$/.test(fileName)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const file = await readFile(join(publicDir, fileName));
    response.writeHead(200, { 'Content-Type': contentTypes[extname(fileName)] ?? 'text/html; charset=utf-8' });
    response.end(file);
  } catch {
    response.writeHead(500).end('Could not load web interface');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local panel: http://127.0.0.1:${port}`));
