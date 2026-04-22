// ════════════════════════
// LEMBRETES
// ════════════════════════
const ADVANCE_LABELS = {
  0: 'Na hora', 15: '15 min antes', 60: '1 hora antes',
  720: '12 horas antes', 1440: '1 dia antes', 10080: '1 semana antes',
};
const RECUR_LABELS = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' };

// ── SOM DE ALARME (Web Audio API — sem arquivos externos) ──
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Initialize audio context on first user interaction to bypass autoplay restrictions
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, initAudio, { once: true });
});

function playAlarm() {
  try {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    // Toque longo: estilo despertador digital (grupos de 4 bipes), repetido algumas vezes
    const beeps = [];
    const freq = 880; // Frequência do bipe
    
    // Cria 4 grupos de 4 bipes rápidos
    for (let i = 0; i < 4; i++) {
      const groupStart = i * 0.8; // Cada grupo a cada 0.8 segundos
      for (let j = 0; j < 4; j++) {
        beeps.push({
          freq: freq,
          start: groupStart + j * 0.12,
          dur: 0.08
        });
      }
    }

    beeps.forEach(({ freq, start, dur }) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + dur + 0.05);
    });
  } catch (e) {
    // Silencia silenciosamente se o navegador bloquear
    console.warn('playAlarm: Web Audio API indisponível', e);
  }
}

function saveRemindersLocal() {
  localStorage.setItem('fb_reminders', JSON.stringify(reminders));
  // Sync to Supabase (fire-and-forget, localStorage is the source of truth)
  syncRemindersToSupabase();
}

let _remSyncTimer = null;
function syncRemindersToSupabase() {
  clearTimeout(_remSyncTimer);
  _remSyncTimer = setTimeout(async () => {
    try {
      // Upsert all reminders for current board
      const boardRems = reminders.filter(r => r.board_id === activeBoardId);
      await sbFetch(`reminders?board_id=eq.${activeBoardId}`, 'DELETE', null, true);
      if (boardRems.length) {
        await sbFetch('reminders', 'POST', boardRems, true);
      }
    } catch (e) {
      // Falha silenciosa — localStorage continua funcionando
      console.warn('[Reminders Sync] Erro ao sincronizar com Supabase:', e.message);
    }
  }, 2000); // Debounce 2s para evitar requisições excessivas
}
function saveFired() { localStorage.setItem(firedKey, JSON.stringify([...firedSet])); }
function saveDueSoonFired() { localStorage.setItem(dueSoonKey, JSON.stringify([...dueSoonFired])); }
function boardReminders() { return reminders.filter(r => r.board_id === activeBoardId); }

function toggleSidebarRemForm(forceOpen) {
  const f = document.getElementById('d-rem-form');
  if (forceOpen === true) f.style.display = 'block';
  else f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') setTimeout(() => document.getElementById('d-rem-text').focus(), 50);
}
function toggleRemForm(forceOpen) { toggleSidebarRemForm(forceOpen); }

function saveReminder(prefix) {
  const textEl = document.getElementById(`${prefix}-rem-text`);
  const whenEl = document.getElementById(`${prefix}-rem-when`);
  const advEl = document.getElementById(`${prefix}-rem-advance`);
  const recurEl = document.getElementById(`${prefix}-rem-recur`);
  const text = textEl.value.trim();
  if (!text) return textEl.focus();
  if (!whenEl.value) { whenEl.focus(); toast('Escolha uma data e hora', '#f59e0b'); return; }
  const advanceMin = parseInt(advEl.value) || 0;
  const rem = {
    id: 'rem_' + Date.now(), board_id: activeBoardId, text,
    when: whenEl.value, advanceMin, recur: recurEl?.value || '', done: false,
    created: new Date().toISOString(),
  };
  reminders.unshift(rem);
  saveRemindersLocal();
  textEl.value = ''; whenEl.value = ''; advEl.value = '60'; if (recurEl) recurEl.value = '';
  renderReminders(prefix);
  toast('🔔 Lembrete adicionado!');
  scheduleReminderCheck();
  if (prefix === 'd') { const f = document.getElementById('d-rem-form'); if (f) f.style.display = 'none'; }
}

function toggleReminder(id) {
  const r = reminders.find(x => x.id === id); if (!r) return;
  r.done = !r.done;
  if (r.done && r.recur) setTimeout(() => { rescheduleRecurring(r); renderReminders(isMobile ? 'm' : 'd'); saveRemindersLocal(); }, 800);
  saveRemindersLocal();
  renderReminders(isMobile ? 'm' : 'd');
}

function deleteReminder(id) {
  reminders = reminders.filter(x => x.id !== id);
  firedSet.delete(id); saveFired();
  saveRemindersLocal();
  renderReminders(isMobile ? 'm' : 'd');
}

function fmtRemWhen(when) {
  if (!when) return 'Sem data';
  let d;
  if (typeof when === 'string' && when.length === 16 && when.includes('T')) {
    const [datePart, timePart] = when.split('T');
    const [y, mo, da] = datePart.split('-').map(Number);
    const [h, mi] = timePart.split(':').map(Number);
    d = new Date(y, mo - 1, da, h, mi);
  } else { d = new Date(when); }
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts = sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleDateString('pt-BR', opts);
}

function remWhenClass(when, done) {
  if (!when || done) return '';
  const d = new Date(when); const now = new Date();
  if (d < now) return 'overdue-rem';
  if (d.toDateString() === now.toDateString()) return 'today-rem';
  return '';
}

function renderReminders(prefix) {
  const el = document.getElementById(`${prefix}-rem-list`); if (!el) return;
  const boardRems = boardReminders();
  const pending = boardRems.filter(r => !r.done);
  const done = boardRems.filter(r => r.done);
  let html = '';
  const boardName = boards.find(b => b.id === activeBoardId)?.name || '';
  if (boardRems.length === 0) {
    html = `<div class="rem-sidebar-empty">🔔 Sem lembretes em<br><strong>${esc(boardName)}</strong></div>`;
  } else {
    if (pending.length) {
      html += `<div class="rem-section-label">Pendentes · ${esc(boardName)} (${pending.length})</div><div class="rem-list">`;
      html += pending.map(r => remItemHTML(r)).join('');
      html += `</div>`;
    }
    if (done.length) {
      html += `<div class="rem-section-label" style="margin-top:16px;opacity:0.6">Concluídos (${done.length})</div><div class="rem-list">`;
      html += done.map(r => remItemHTML(r)).join('');
      html += `</div>`;
    }
  }
  el.innerHTML = html;
}

function remItemHTML(r) {
  const wc = remWhenClass(r.when, r.done);
  const advLabel = ADVANCE_LABELS[r.advanceMin] !== undefined ? ADVANCE_LABELS[r.advanceMin] : `${r.advanceMin} min antes`;
  const notifTime = r.when ? (() => {
    const t = new Date(r.when.length === 16 ? (() => {
      const [dp, tp] = r.when.split('T'); const [y, mo, da] = dp.split('-').map(Number); const [h, mi] = tp.split(':').map(Number);
      return new Date(y, mo - 1, da, h, mi);
    })() : new Date(r.when));
    t.setMinutes(t.getMinutes() - (r.advanceMin || 0));
    const now = new Date(); const sameDay = t.toDateString() === now.toDateString();
    const opts = sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
    return t.toLocaleDateString('pt-BR', opts);
  })() : null;
  return `<div class="rem-item${r.done ? ' done-rem' : ''}">
    <input type="checkbox" class="rem-check" ${r.done ? 'checked' : ''} onchange="toggleReminder('${r.id}')">
    <div class="rem-item-body">
      <div class="rem-item-text">${esc(r.text)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center">
        <span class="rem-item-when ${wc}">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${fmtRemWhen(r.when)}
        </span>
        ${r.advanceMin > 0 && notifTime ? `<span class="rem-advance-tag">🔔 ${advLabel} · ${notifTime}</span>` : (r.advanceMin === 0 && r.when ? `<span class="rem-advance-tag">🔔 Na hora</span>` : '')}
        ${r.recur ? `<span class="rem-recur-tag">↻ ${RECUR_LABELS[r.recur] || r.recur}</span>` : ''}
      </div>
    </div>
    <button class="rem-del" onclick="deleteReminder('${r.id}')">✕</button>
  </div>`;
}

// ── RECORRÊNCIA ──
function nextRecurDate(when, recur) {
  if (!when || !recur) return null;
  const d = new Date(when);
  if (recur === 'daily') d.setDate(d.getDate() + 1);
  else if (recur === 'weekly') d.setDate(d.getDate() + 7);
  else if (recur === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function rescheduleRecurring(r) {
  if (!r.recur || !r.when) return;
  r.done = false;
  r.when = nextRecurDate(r.when, r.recur);
  firedSet.delete(r.id); saveFired();
  saveRemindersLocal();
}

// ── NOTIFICAÇÃO ENGINE ──
function getFireTime(r) {
  if (!r.when) return null;
  const t = new Date(r.when);
  t.setMinutes(t.getMinutes() - (r.advanceMin || 0));
  return t;
}
function fireKey(r) { return r.id; }

function showNotification(r) {
  const overlay = document.getElementById('notif-overlay'); if (!overlay) return;
  const boardName = boards.find(b => b.id === r.board_id)?.name || '';
  const advLabel = ADVANCE_LABELS[r.advanceMin] !== undefined ? ADVANCE_LABELS[r.advanceMin] : `${r.advanceMin} min antes`;
  const card = document.createElement('div');
  card.className = 'notif-card'; card.id = 'notif-' + r.id;
  card.innerHTML = `
    <div class="notif-head">
      <div class="notif-icon">🔔</div>
      <div class="notif-title">Lembrete · ${esc(boardName)}</div>
      <button class="notif-close" onclick="dismissNotif('${r.id}')">✕</button>
    </div>
    <div class="notif-body">${esc(r.text)}</div>
    <div class="notif-meta">${r.advanceMin > 0 ? `${advLabel} · ` : ''}${fmtRemWhen(r.when)}</div>
    <div class="notif-actions">
      <button class="notif-btn notif-btn-dismiss" onclick="dismissNotif('${r.id}')">Dispensar</button>
      <button class="notif-btn notif-btn-done" onclick="doneFromNotif('${r.id}')">✓ Marcar como feito</button>
    </div>`;
  overlay.appendChild(card);
  playAlarm();
  setTimeout(() => dismissNotif(r.id), 30000);
  if (Notification && Notification.permission === 'granted') {
    new Notification(`FlowBoard · ${boardName}`, { body: r.text, icon: '' });
  }
}

function dismissNotif(id) {
  const card = document.getElementById('notif-' + id); if (!card) return;
  card.classList.add('notif-out');
  setTimeout(() => card.remove(), 220);
}

function doneFromNotif(id) {
  const r = reminders.find(x => x.id === id);
  if (r) { r.done = true; saveRemindersLocal(); renderReminders(isMobile ? 'm' : 'd'); }
  dismissNotif(id);
  toast('Lembrete concluído ✓');
}

function checkReminderAlerts() {
  const now = new Date();
  reminders.filter(r => !r.done && r.when).forEach(r => {
    const fireAt = getFireTime(r); if (!fireAt) return;
    const diff = now - fireAt;
    const fk = fireKey(r);
    if (diff >= 0 && diff < 65000 && !firedSet.has(fk)) {
      firedSet.add(fk); saveFired(); showNotification(r);
    }
  });
}

function checkDueSoon() {
  const now = new Date();
  cards.filter(c => !isDoneCol(c.col) && c.due).forEach(c => {
    const due = new Date(c.due + 'T23:59:00');
    const diff = due - now;
    [48 * 60 * 60 * 1000, 24 * 60 * 60 * 1000].forEach(threshold => {
      const key = `${c.id}_${threshold}`;
      if (diff > 0 && diff < threshold && !dueSoonFired.has(key)) {
        dueSoonFired.add(key); saveDueSoonFired();
        const label = threshold === 24 * 60 * 60 * 1000 ? 'vence hoje' : 'vence em 48h';
        const board = boards.find(b => b.id === c.board_id);
        showDueSoonNotif(c, label, board?.name || '');
      }
    });
  });
}

function showDueSoonNotif(c, label, boardName) {
  const overlay = document.getElementById('notif-overlay'); if (!overlay) return;
  const card = document.createElement('div');
  card.className = 'notif-card due-soon'; card.id = 'notif-due-' + c.id;
  card.innerHTML = `<div class="notif-head">
    <div class="notif-icon">📅</div>
    <div class="notif-title">${esc(boardName)} · ${label}</div>
    <button class="notif-close" onclick="dismissNotif('due-${c.id}')">✕</button>
  </div>
  <div class="notif-body">${esc(c.title)}</div>
  <div class="notif-meta">Prazo: ${fmtDateFull(c.due + 'T00:00:00')}${(() => {
    const assigs = (c.assignees || (c.assignee ? [c.assignee] : []));
    return assigs.length ? ' · ' + esc(assigs.join(', ')) : '';
  })()}</div>
  <div class="notif-actions">
    <button class="notif-btn notif-btn-dismiss" onclick="dismissNotif('due-${c.id}')">Ok</button>
    <button class="notif-btn notif-btn-done" onclick="editCard('${c.id}');dismissNotif('due-${c.id}')">Ver tarefa</button>
  </div>`;
  overlay.appendChild(card);
  playAlarm();
  setTimeout(() => dismissNotif('due-' + c.id), 20000);
}

let _remCheckInterval = null;
function scheduleReminderCheck() {
  if (_remCheckInterval) clearInterval(_remCheckInterval);
  _remCheckInterval = setInterval(() => { checkReminderAlerts(); checkDueSoon(); }, 15000);
  checkReminderAlerts();
  setTimeout(checkDueSoon, 3000);
}

function requestNotifPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
