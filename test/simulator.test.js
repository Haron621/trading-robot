import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalysisCard, evaluateEntry, SafeJournal, formatTelegramNotification } from '../src/simulator.js';

const now = new Date('2026-07-19T10:00:00.000Z');
const fresh = (value) => ({ value, observedAt: '2026-07-19T09:58:00.000Z', source: 'fixture' });

const validInput = () => ({
  instrument: 'XAUUSD+',
  price: fresh({ current: 3350, previousClose: 3325, origin: 'breakout above 3325 resistance' }),
  volume: fresh({ ratioToAverage: 1.4 }),
  volatility: fresh({ regime: 'normal' }),
  calendar: fresh({ importantEvents: [] }),
  news: fresh({ summary: 'No adverse headline', sentiment: 'supportive' }),
  geopolitics: fresh({ summary: 'Risk premium stable', sentiment: 'supportive' }),
  scenario: { direction: 'long', probability: 0.74, invalidation: '4h close below 3325' }
});

test('creates a complete analysis card for the selected instrument', () => {
  const card = buildAnalysisCard(validInput(), now);
  assert.equal(card.instrument, 'XAUUSD+');
  assert.equal(card.currentRegime, 'normal');
  assert.equal(card.scenario.direction, 'long');
  assert.equal(card.scenario.probability, 0.74);
  assert.match(card.priceOrigin, /3325/);
  assert.equal(card.reactionFactors.length, 4);
});

test('allows only a fresh, complete >=70% signal outside a macro-event guard window', () => {
  const result = evaluateEntry(validInput(), { now, openPositions: 0, dailyLossPct: -0.2 });
  assert.deepEqual(result, { allowed: true, reasons: [] });
});

test('fails closed when a mandatory input is stale or missing', () => {
  const input = validInput();
  input.news.observedAt = '2026-07-19T08:00:00.000Z';
  input.geopolitics = undefined;
  const result = evaluateEntry(input, { now, openPositions: 0, dailyLossPct: 0 });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('news is stale'));
  assert.ok(result.reasons.includes('geopolitics is unavailable'));
});

test('blocks entries from 30 minutes before through 15 minutes after an important US event', () => {
  const input = validInput();
  input.calendar = fresh({ importantEvents: [{ startsAt: '2026-07-19T10:20:00.000Z', country: 'US', importance: 'high' }] });
  const result = evaluateEntry(input, { now, openPositions: 0, dailyLossPct: 0 });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((reason) => reason.startsWith('macro-event guard')));
});

test('blocks sub-threshold scenarios and M3 circuit breakers', () => {
  const input = validInput();
  input.scenario.probability = 0.69;
  const result = evaluateEntry(input, { now, openPositions: 2, dailyLossPct: -2 });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('scenario probability below 70%'));
  assert.ok(result.reasons.includes('maximum open positions reached'));
  assert.ok(result.reasons.includes('daily loss circuit breaker reached'));
});

test('journal and Telegram formatting redact secrets', () => {
  const journal = new SafeJournal();
  journal.record({ decision: 'blocked', apiKey: 'secret', nested: { token: 'also-secret' } });
  assert.deepEqual(journal.entries[0], { decision: 'blocked', nested: {} });
  const message = formatTelegramNotification({ decision: 'blocked', apiSecret: 'hidden', card: buildAnalysisCard(validInput(), now) });
  assert.doesNotMatch(message, /hidden|apiSecret/i);
  assert.match(message, /XAUUSD\+/);
});
