import { createServer } from 'node:http';
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

function sendJson(response, body) {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

createServer((request, response) => {
  const data = input();
  const decision = evaluateEntry(data, { now: now(), openPositions: 0, dailyLossPct: 0 });
  const card = buildAnalysisCard(data, now());
  journal.record({ at: now().toISOString(), decision: decision.allowed ? 'allowed' : 'blocked', reasons: decision.reasons, sources: ['local-demo'] });
  if (request.url === '/api/status') return sendJson(response, { card, decision, journal: journal.entries });
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><meta charset="utf-8"><title>XAUUSD+ simulator</title><h1>XAUUSD+ local simulator</h1><p>Fail-closed. No exchange or Telegram request is made.</p><pre>${JSON.stringify({ card, decision }, null, 2)}</pre>`);
}).listen(port, '127.0.0.1', () => console.log(`Local panel: http://127.0.0.1:${port}`));
