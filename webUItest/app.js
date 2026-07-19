const el = (id) => document.getElementById(id);
const formatTime = (iso) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));

function render(data) {
  const { card, decision, journal } = data;
  const isAllowed = decision.allowed;
  el('decision-card').classList.toggle('allowed', isAllowed);
  el('decision').textContent = isAllowed ? 'Вход разрешён' : 'Вход заблокирован';
  el('decision-detail').textContent = isAllowed ? 'Все защитные условия выполнены.' : `${decision.reasons.length} защитных условия не выполнены.`;
  const probability = Math.round(card.scenario.probability * 100);
  el('probability').textContent = probability;
  el('progress').style.width = `${probability}%`;
  el('regime').textContent = card.currentRegime;
  el('updated').textContent = `Обновлено ${formatTime(card.generatedAt)}`;
  el('instrument').textContent = card.instrument;
  el('direction').textContent = card.scenario.direction === 'none' ? 'Нет подтверждённого сценария' : card.scenario.direction.toUpperCase();
  el('origin').textContent = card.priceOrigin;
  el('invalidation').textContent = card.scenario.invalidation;
  el('factors').replaceChildren(...card.reactionFactors.map((factor) => {
    const item = document.createElement('li');
    item.textContent = factor;
    return item;
  }));
  el('journal').replaceChildren(...journal.slice().reverse().map((entry) => {
    const row = document.createElement('tr');
    const reason = entry.reasons?.join('; ') || '—';
    [formatTime(entry.at), entry.decision === 'allowed' ? 'Разрешён' : 'Заблокирован', reason, entry.sources?.join(', ') || '—'].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
}

async function refresh() {
  const button = el('refresh');
  button.disabled = true;
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status unavailable');
    render(await response.json());
  } catch {
    el('decision').textContent = 'Нет соединения';
    el('decision-detail').textContent = 'Локальный сервер недоступен.';
  } finally {
    button.disabled = false;
  }
}

el('refresh').addEventListener('click', refresh);
refresh();
setInterval(refresh, 30_000);
