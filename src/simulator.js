const REQUIRED_FEEDS = ['price', 'volume', 'volatility', 'calendar', 'news', 'geopolitics'];
const MAX_AGE_MS = 15 * 60 * 1000;
const SECRET_KEYS = /key|secret|token|password|authorization/i;

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function feedProblems(input, now) {
  return REQUIRED_FEEDS.flatMap((name) => {
    const feed = input[name];
    if (!feed) return [`${name} is unavailable`];
    const observedAt = parseDate(feed.observedAt);
    if (!observedAt || now.getTime() - observedAt.getTime() > MAX_AGE_MS) return [`${name} is stale`];
    return [];
  });
}

function isInMacroGuard(calendar, now) {
  const events = calendar?.value?.importantEvents ?? [];
  return events.find((event) => {
    const eventTime = parseDate(event.startsAt);
    return event.country === 'US' && event.importance === 'high' && eventTime &&
      now >= new Date(eventTime.getTime() - 30 * 60 * 1000) && now <= new Date(eventTime.getTime() + 15 * 60 * 1000);
  });
}

export function buildAnalysisCard(input, now = new Date()) {
  if (input.instrument !== 'XAUUSD+') throw new Error('Only XAUUSD+ is supported');
  const { price, volume, volatility, news, geopolitics, scenario } = input;
  return {
    generatedAt: now.toISOString(),
    instrument: input.instrument,
    priceOrigin: price?.value?.origin ?? 'Unavailable: no price-origin evidence',
    currentRegime: volatility?.value?.regime ?? 'unknown',
    reactionFactors: [
      `Volume: ${volume?.value?.ratioToAverage ?? 'unavailable'}x average`,
      `News: ${news?.value?.summary ?? 'unavailable'}`,
      `Geopolitics: ${geopolitics?.value?.summary ?? 'unavailable'}`,
      `Volatility: ${volatility?.value?.regime ?? 'unavailable'}`
    ],
    scenario: {
      direction: scenario?.direction ?? 'none',
      probability: scenario?.probability ?? 0,
      invalidation: scenario?.invalidation ?? 'No scenario: do not trade'
    }
  };
}

export function evaluateEntry(input, state, now = state.now ?? new Date()) {
  const reasons = feedProblems(input, now);
  if (!input.scenario || input.scenario.probability < 0.7) reasons.push('scenario probability below 70%');
  if (!['long', 'short'].includes(input.scenario?.direction)) reasons.push('scenario direction is invalid');
  const guardedEvent = isInMacroGuard(input.calendar, now);
  if (guardedEvent) reasons.push(`macro-event guard active for ${guardedEvent.country} ${guardedEvent.importance} event`);
  if (state.openPositions >= 2) reasons.push('maximum open positions reached');
  if (state.dailyLossPct <= -2) reasons.push('daily loss circuit breaker reached');
  return { allowed: reasons.length === 0, reasons };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SECRET_KEYS.test(key))
    .map(([key, child]) => [key, redact(child)]));
}

export class SafeJournal {
  entries = [];

  record(entry) {
    const safeEntry = redact(entry);
    this.entries.push(safeEntry);
    return safeEntry;
  }
}

export function formatTelegramNotification({ decision, card, reasons = [] }) {
  const status = decision === 'allowed' ? 'Paper signal ready' : 'Entry blocked';
  const reasonText = reasons.length ? `\nReasons: ${reasons.join('; ')}` : '';
  return `${status}\n${card.instrument} ${card.scenario.direction} ${(card.scenario.probability * 100).toFixed(0)}%\nInvalidation: ${card.scenario.invalidation}${reasonText}`;
}
