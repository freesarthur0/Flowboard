// ══════════════════════════
// QUADRO DE POST-ITS (global, sincronizado via Supabase)
// ══════════════════════════
// Tabela esperada no Supabase:
//   sticky_notes(id text pk, x double, y double, w double, h double,
//                color text, content text, z_index int,
//                created_at timestamptz, updated_at timestamptz)

const STICKY_W = 220, STICKY_H = 180;
const STICKY_MIN_W = 140, STICKY_MIN_H = 110;
const STICKY_MAX_W = 600, STICKY_MAX_H = 600;

function _stickyId() {
  return 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function _stickyColor(id) {
  return STICKY_COLORS.find(c => c.id === id) || STICKY_COLORS[0];
}
function _sanitizeStickyHTML(html) {
  if (!html) return '';
  const allowed = new Set(['B','I','U','BR','DIV','P','UL','OL','LI','A','STRONG','EM','SPAN']);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walk = (node) => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 1) {
        if (!allowed.has(child.tagName)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        [...child.attributes].forEach(a => {
          if (child.tagName === 'A' && a.name === 'href') {
            if (!/^https?:|^mailto:/i.test(a.value)) child.removeAttribute('href');
          } else {
            child.removeAttribute(a.name);
          }
        });
        if (child.tagName === 'A') {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener');
        }
        walk(child);
      } else if (child.nodeType === 8) {
        node.removeChild(child);
      }
    });
  };
  walk(tmp);
  return tmp.innerHTML;
}

// ── Sync ──
async function loadStickyNotes() {
  try {
    const data = await sbFetch('sticky_notes?select=*&order=z_index.asc');
    if (Array.isArray(data)) {
      stickyNotes = data;
      maxNoteZ = stickyNotes.reduce((m, n) => Math.max(m, n.z_index || 0), 0);
    }
  } catch (e) {
    console.warn('[FlowBoard] sticky_notes load failed:', e?.message || e);
    stickyNotes = [];
  }
  if (typeof dView !== 'undefined' && (dView === 'notes' || mView === 'notes')) renderStickyBoard();
}

const _stickySaveTimers = {};
function _scheduleSaveSticky(note) {
  clearTimeout(_stickySaveTimers[note.id]);
  _stickySaveTimers[note.id] = setTimeout(() => _persistSticky(note), 350);
}
async function _persistSticky(note) {
  const payload = {
    id: note.id,
    x: note.x, y: note.y, w: note.w, h: note.h,
    color: note.color, content: note.content || '',
    z_index: note.z_index || 0
  };
  try {
    const res = await sbFetch(`sticky_notes?id=eq.${note.id}`, 'PATCH', payload, true);
    if (!res || (Array.isArray(res) && !res.length)) {
      await sbFetch('sticky_notes', 'POST', payload, true);
    }
  } catch (e) {
    console.warn('[FlowBoard] sticky save failed:', e?.message || e);
  }
}
async function _deleteStickyRemote(id) {
  try { await sbFetch(`sticky_notes?id=eq.${id}`, 'DELETE', null, true); }
  catch (e) { console.warn('[FlowBoard] sticky delete failed:', e?.message || e); }
}

// ── CRUD ──
function addStickyNote(opts = {}) {
  const wrap = document.getElementById('sticky-canvas-wrap');
  let cx = 80, cy = 80;
  if (wrap && stickyCanvas.zoom) {
    const r = wrap.getBoundingClientRect();
    cx = (r.width / 2 - stickyCanvas.panX) / stickyCanvas.zoom - STICKY_W / 2;
    cy = (r.height / 2 - stickyCanvas.panY) / stickyCanvas.zoom - STICKY_H / 2;
  }
  cx += (Math.random() - 0.5) * 30;
  cy += (Math.random() - 0.5) * 30;
  maxNoteZ += 1;
  const note = {
    id: _stickyId(),
    x: Math.round(cx), y: Math.round(cy),
    w: STICKY_W, h: STICKY_H,
    color: opts.color || STICKY_COLORS[Math.floor(Math.random() * 3)].id,
    content: '',
    z_index: maxNoteZ
  };
  stickyNotes.push(note);
  if (isMobile) renderMSticky(); else renderStickyBoard();
  _scheduleSaveSticky(note);
  setTimeout(() => {
    const sel = isMobile
      ? `.m-sticky-card .m-sticky-body`
      : `.sticky-note[data-id="${note.id}"] .sticky-body`;
    const body = document.querySelector(sel);
    if (body) { body.focus(); placeCursorAtEnd(body); }
  }, 30);
}

function deleteStickyNote(id) {
  const idx = stickyNotes.findIndex(n => n.id === id);
  if (idx === -1) return;
  stickyNotes.splice(idx, 1);
  if (isMobile) renderMSticky(); else renderStickyBoard();
  _deleteStickyRemote(id);
}

function setStickyColor(id, colorId) {
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  n.color = colorId;
  if (isMobile) renderMSticky(); else renderStickyBoard();
  _scheduleSaveSticky(n);
}

function bringStickyToFront(id) {
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  maxNoteZ += 1;
  n.z_index = maxNoteZ;
  const el = document.querySelector(`.sticky-note[data-id="${id}"]`);
  if (el) el.style.zIndex = n.z_index;
}

function placeCursorAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Render ──
function _renderStickyToolbarColors() {
  const wrap = document.getElementById('sticky-colors');
  if (!wrap) return;
  wrap.innerHTML = STICKY_COLORS.map(c => `
    <button class="sticky-color-pill" data-color="${c.id}"
      style="background:${c.bg};border-color:${c.edge};"
      title="Cor ${c.id}"
      onclick="event.stopPropagation();onStickyColorPill('${c.id}')"></button>
  `).join('');
}

function onStickyColorPill(colorId) {
  if (selectedNoteId) {
    setStickyColor(selectedNoteId, colorId);
  } else {
    addStickyNote({ color: colorId });
  }
}

function renderStickyBoard() {
  const canvas = document.getElementById('sticky-canvas');
  const empty = document.getElementById('sticky-empty');
  if (!canvas) return;
  _renderStickyToolbarColors();

  if (!stickyNotes.length) {
    canvas.innerHTML = '';
    if (empty) empty.style.display = 'flex';
  } else {
    if (empty) empty.style.display = 'none';
    canvas.innerHTML = stickyNotes.map(n => {
      const c = _stickyColor(n.color);
      const sel = n.id === selectedNoteId ? ' selected' : '';
      return `<div class="sticky-note${sel}" data-id="${n.id}"
        style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;
               --note-bg:${c.bg};--note-edge:${c.edge};z-index:${n.z_index || 0};">
        <div class="sticky-head" onmousedown="onStickyDragStart(event,'${n.id}')">
          <div class="sticky-grip"></div>
          <button class="sticky-del" onclick="event.stopPropagation();deleteStickyNote('${n.id}')" title="Excluir">×</button>
        </div>
        <div class="sticky-body" contenteditable="true" spellcheck="false"
          onfocus="onStickyEditFocus('${n.id}')"
          onblur="onStickyEditBlur('${n.id}',this)"
          oninput="onStickyEditInput('${n.id}',this)"
          onkeydown="onStickyEditKey(event,'${n.id}')">${n.content || ''}</div>
        <div class="sticky-resize" onmousedown="onStickyResizeStart(event,'${n.id}')"></div>
      </div>`;
    }).join('');
  }
  _applyCanvasTransform();
}

function _applyCanvasTransform() {
  const canvas = document.getElementById('sticky-canvas');
  const bg = document.getElementById('sticky-bg');
  if (canvas) {
    canvas.style.transform = `translate(${stickyCanvas.panX}px,${stickyCanvas.panY}px) scale(${stickyCanvas.zoom})`;
  }
  if (bg) {
    const gridSize = 28 * stickyCanvas.zoom;
    bg.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    bg.style.backgroundPosition = `${stickyCanvas.panX}px ${stickyCanvas.panY}px`;
  }
  const lbl = document.getElementById('sticky-zoom-label');
  if (lbl) lbl.textContent = Math.round(stickyCanvas.zoom * 100) + '%';
}

// ── Pan / Zoom ──
function stickyZoom(delta, anchorX, anchorY) {
  const wrap = document.getElementById('sticky-canvas-wrap');
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  const ax = (anchorX != null ? anchorX : r.width / 2);
  const ay = (anchorY != null ? anchorY : r.height / 2);
  const oldZoom = stickyCanvas.zoom;
  let newZoom = Math.min(2, Math.max(0.3, oldZoom + delta));
  if (newZoom === oldZoom) return;
  const wx = (ax - stickyCanvas.panX) / oldZoom;
  const wy = (ay - stickyCanvas.panY) / oldZoom;
  stickyCanvas.zoom = newZoom;
  stickyCanvas.panX = ax - wx * newZoom;
  stickyCanvas.panY = ay - wy * newZoom;
  _applyCanvasTransform();
}

function stickyResetView() {
  stickyCanvas.panX = 0;
  stickyCanvas.panY = 0;
  stickyCanvas.zoom = 1;
  _applyCanvasTransform();
}

// ── Interações: drag, resize, pan ──
let _stickyDrag = null;

function onStickyDragStart(ev, id) {
  if (ev.button !== 0) return;
  if (ev.target.classList.contains('sticky-del')) return;
  ev.preventDefault();
  ev.stopPropagation();
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  selectedNoteId = id;
  bringStickyToFront(id);
  document.querySelectorAll('.sticky-note.selected').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.sticky-note[data-id="${id}"]`)?.classList.add('selected');
  _stickyDrag = {
    type: 'move', id,
    startX: ev.clientX, startY: ev.clientY,
    origX: n.x, origY: n.y
  };
  document.body.style.userSelect = 'none';
}

function onStickyResizeStart(ev, id) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  selectedNoteId = id;
  bringStickyToFront(id);
  _stickyDrag = {
    type: 'resize', id,
    startX: ev.clientX, startY: ev.clientY,
    origW: n.w, origH: n.h
  };
  document.body.style.userSelect = 'none';
}

function onStickyCanvasMouseDown(ev) {
  if (ev.button !== 0 && ev.button !== 1) return;
  if (ev.target.closest('.sticky-note')) return;
  ev.preventDefault();
  selectedNoteId = null;
  document.querySelectorAll('.sticky-note.selected').forEach(el => el.classList.remove('selected'));
  _stickyDrag = {
    type: 'pan',
    startX: ev.clientX, startY: ev.clientY,
    origPanX: stickyCanvas.panX, origPanY: stickyCanvas.panY
  };
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
}

function _onStickyMouseMove(ev) {
  if (!_stickyDrag) return;
  const dx = ev.clientX - _stickyDrag.startX;
  const dy = ev.clientY - _stickyDrag.startY;
  if (_stickyDrag.type === 'move') {
    const n = stickyNotes.find(x => x.id === _stickyDrag.id);
    if (!n) return;
    n.x = Math.round(_stickyDrag.origX + dx / stickyCanvas.zoom);
    n.y = Math.round(_stickyDrag.origY + dy / stickyCanvas.zoom);
    const el = document.querySelector(`.sticky-note[data-id="${n.id}"]`);
    if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  } else if (_stickyDrag.type === 'resize') {
    const n = stickyNotes.find(x => x.id === _stickyDrag.id);
    if (!n) return;
    n.w = Math.max(STICKY_MIN_W, Math.min(STICKY_MAX_W, Math.round(_stickyDrag.origW + dx / stickyCanvas.zoom)));
    n.h = Math.max(STICKY_MIN_H, Math.min(STICKY_MAX_H, Math.round(_stickyDrag.origH + dy / stickyCanvas.zoom)));
    const el = document.querySelector(`.sticky-note[data-id="${n.id}"]`);
    if (el) { el.style.width = n.w + 'px'; el.style.height = n.h + 'px'; }
  } else if (_stickyDrag.type === 'pan') {
    stickyCanvas.panX = _stickyDrag.origPanX + dx;
    stickyCanvas.panY = _stickyDrag.origPanY + dy;
    _applyCanvasTransform();
  }
}

function _onStickyMouseUp() {
  if (!_stickyDrag) return;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  if (_stickyDrag.type === 'move' || _stickyDrag.type === 'resize') {
    const n = stickyNotes.find(x => x.id === _stickyDrag.id);
    if (n) _scheduleSaveSticky(n);
  }
  _stickyDrag = null;
}

function _onStickyWheel(ev) {
  if (!ev.ctrlKey && !ev.metaKey) return;
  ev.preventDefault();
  const wrap = document.getElementById('sticky-canvas-wrap');
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  stickyZoom(ev.deltaY > 0 ? -0.1 : 0.1, ev.clientX - r.left, ev.clientY - r.top);
}

// ── Edição de texto ──
function onStickyEditFocus(id) {
  editingNoteId = id;
  selectedNoteId = id;
  bringStickyToFront(id);
  document.querySelectorAll('.sticky-note.selected').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.sticky-note[data-id="${id}"]`)?.classList.add('selected');
}
function onStickyEditBlur(id, el) {
  editingNoteId = null;
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  const clean = _sanitizeStickyHTML(el.innerHTML);
  if (clean !== el.innerHTML) el.innerHTML = clean;
  n.content = clean;
  _scheduleSaveSticky(n);
}
function onStickyEditInput(id, el) {
  const n = stickyNotes.find(x => x.id === id);
  if (!n) return;
  n.content = el.innerHTML;
  _scheduleSaveSticky(n);
}
function onStickyEditKey(ev, id) {
  if (ev.key === 'Escape') { ev.target.blur(); return; }
  if (!(ev.ctrlKey || ev.metaKey)) return;
  const k = ev.key.toLowerCase();
  if (k === 'b') { ev.preventDefault(); document.execCommand('bold'); }
  else if (k === 'i') { ev.preventDefault(); document.execCommand('italic'); }
  else if (k === 'u') { ev.preventDefault(); document.execCommand('underline'); }
}

// ── Mobile (lista vertical) ──
function renderMSticky() {
  const list = document.getElementById('m-sticky-list');
  const colors = document.getElementById('m-sticky-colors');
  if (colors) {
    colors.innerHTML = STICKY_COLORS.map(c => `
      <button class="sticky-color-pill" style="background:${c.bg};border-color:${c.edge}"
        onclick="addStickyNote({color:'${c.id}'})" title="Nova nota ${c.id}"></button>`).join('');
  }
  if (!list) return;
  if (!stickyNotes.length) {
    list.innerHTML = `<div class="m-sticky-empty">Nenhuma nota ainda. Toque em <b>+ Nova nota</b>.</div>`;
    return;
  }
  const sorted = [...stickyNotes].sort((a,b) => (b.z_index||0) - (a.z_index||0));
  list.innerHTML = sorted.map(n => {
    const c = _stickyColor(n.color);
    return `<div class="m-sticky-card" style="background:${c.bg};border-color:${c.edge}">
      <div class="m-sticky-actions">
        ${STICKY_COLORS.map(cc => `<button class="m-sticky-color" style="background:${cc.bg}" onclick="setStickyColor('${n.id}','${cc.id}')"></button>`).join('')}
        <button class="m-sticky-del" onclick="deleteStickyNote('${n.id}')">×</button>
      </div>
      <div class="m-sticky-body" contenteditable="true"
        onblur="onStickyEditBlur('${n.id}',this)"
        oninput="onStickyEditInput('${n.id}',this)">${n.content || ''}</div>
    </div>`;
  }).join('');
}

// ── Init ──
function initStickyBoard() {
  document.addEventListener('mousemove', _onStickyMouseMove);
  document.addEventListener('mouseup', _onStickyMouseUp);
  const wrap = document.getElementById('sticky-canvas-wrap');
  if (wrap) {
    wrap.addEventListener('mousedown', onStickyCanvasMouseDown);
    wrap.addEventListener('wheel', _onStickyWheel, { passive: false });
  }
  document.addEventListener('keydown', (e) => {
    if (typeof dView === 'undefined') return;
    if (dView !== 'notes' && mView !== 'notes') return;
    if (editingNoteId) return;
    if (e.target && (e.target.isContentEditable || /input|textarea/i.test(e.target.tagName))) return;
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      addStickyNote();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
      e.preventDefault();
      deleteStickyNote(selectedNoteId);
      selectedNoteId = null;
    }
  });
  loadStickyNotes();
}
