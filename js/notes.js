// ══════════════════════════
// ANOTAÇÕES — Visualizador read-only do vault do Obsidian
// ══════════════════════════
// O usuário seleciona a pasta do vault via <input webkitdirectory>;
// os .md são lidos lazy e renderizados em preview. Toda edição
// continua acontecendo no Obsidian. Estado vive em memória até reload.

const VAULT_ATTACHMENT_EXTS = ['png','jpg','jpeg','gif','webp','svg','bmp','pdf'];

// ── Carga do vault ──
function pickVault() {
  const input = document.getElementById('vault-picker');
  if (!input) return;
  input.value = '';
  input.click();
}

function onVaultFolderPicked(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  // Limpa estado anterior
  for (const att of vaultAttachments.values()) { if (att.url) URL.revokeObjectURL(att.url); }
  vaultFiles.clear();
  vaultAttachments.clear();
  vaultOpenTabs = [];
  activeVaultPath = null;
  vaultExpandedFolders = new Set();
  vaultSearchQuery = '';

  // Infere nome do vault e popula maps
  let firstSeg = '';
  for (const f of files) {
    const rel = f.webkitRelativePath || f.name;
    if (!firstSeg) firstSeg = rel.split('/')[0];
    const path = rel.split('/').slice(1).join('/'); // remove pasta-raiz
    if (!path) continue;
    if (path.split('/').some(seg => seg.startsWith('.'))) continue; // ignora pastas/arquivos ocultos (ex: .obsidian)
    const lower = path.toLowerCase();
    if (lower.endsWith('.md')) {
      vaultFiles.set(path, { file: f, content: null });
    } else {
      const ext = lower.split('.').pop();
      if (VAULT_ATTACHMENT_EXTS.includes(ext)) {
        vaultAttachments.set(path, { file: f, url: null });
      }
    }
  }
  vaultName = firstSeg || 'vault';

  if (typeof toast === 'function') toast(`Vault "${vaultName}" carregado: ${vaultFiles.size} notas`, '#4ade80');
  const closeBtn = document.getElementById('vault-close-btn');
  if (closeBtn) closeBtn.style.display = '';
  renderNotes();
}

function closeVault() {
  for (const att of vaultAttachments.values()) { if (att.url) URL.revokeObjectURL(att.url); }
  vaultFiles.clear();
  vaultAttachments.clear();
  vaultName = '';
  vaultOpenTabs = [];
  activeVaultPath = null;
  vaultExpandedFolders = new Set();
  vaultSearchQuery = '';
  const closeBtn = document.getElementById('vault-close-btn');
  if (closeBtn) closeBtn.style.display = 'none';
  const search = document.getElementById('d-notes-search');
  if (search) search.value = '';
  renderNotes();
}

// ── Leitura lazy ──
async function readVaultFile(path) {
  const entry = vaultFiles.get(path);
  if (!entry) return '';
  if (entry.content === null) {
    try { entry.content = await entry.file.text(); }
    catch (e) { entry.content = ''; }
  }
  return entry.content;
}

function getAttachmentURL(path) {
  // Lookup case-insensitive por nome (Obsidian permite ![[img]] sem path completo)
  let entry = vaultAttachments.get(path);
  if (!entry) {
    const lower = path.toLowerCase();
    const baseName = lower.split('/').pop();
    for (const [k, v] of vaultAttachments.entries()) {
      const kLower = k.toLowerCase();
      if (kLower === lower || kLower.endsWith('/' + baseName) || kLower === baseName) { entry = v; break; }
    }
  }
  if (!entry) return '';
  if (!entry.url) entry.url = URL.createObjectURL(entry.file);
  return entry.url;
}

// ── Tree ──
function buildVaultTree() {
  const root = { name: vaultName || 'vault', path: '', children: {}, files: [] };
  const q = vaultSearchQuery.trim().toLowerCase();
  const paths = Array.from(vaultFiles.keys());
  const filtered = q ? paths.filter(p => p.toLowerCase().includes(q)) : paths;
  for (const path of filtered) {
    const segs = path.split('/');
    const fileName = segs.pop();
    let node = root;
    let acc = '';
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (!node.children[seg]) node.children[seg] = { name: seg, path: acc, children: {}, files: [] };
      node = node.children[seg];
    }
    node.files.push({ name: fileName, path });
  }
  return root;
}

function toggleFolder(path) {
  if (vaultExpandedFolders.has(path)) vaultExpandedFolders.delete(path);
  else vaultExpandedFolders.add(path);
  renderTreeOnly();
}

function collapseAllFolders() {
  vaultExpandedFolders = new Set();
  renderTreeOnly();
}

function expandFolderPath(path) {
  // Garante que toda pasta-pai do path esteja expandida (usado ao abrir nota via wiki-link)
  const segs = path.split('/');
  segs.pop();
  let acc = '';
  for (const seg of segs) {
    acc = acc ? `${acc}/${seg}` : seg;
    vaultExpandedFolders.add(acc);
  }
}

function treeNodeHTML(node, depth) {
  const pad = depth * 12;
  // Subpastas primeiro (alfabético)
  const subs = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  // Arquivos depois
  const files = node.files.slice().sort((a, b) => a.name.localeCompare(b.name));
  let html = '';
  for (const sub of subs) {
    const expanded = vaultExpandedFolders.has(sub.path) || (vaultSearchQuery && hasMatch(sub));
    const childCount = countNotesInFolder(sub);
    html += `<div class="obsd-tree-row obsd-tree-folder" style="padding-left:${pad + 4}px" onclick="toggleFolder('${escAttr(sub.path)}')">
      <span class="obsd-tree-caret">${expanded ? '▾' : '▸'}</span>
      <span class="obsd-tree-icon">${expanded
        ? '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h8a2 2 0 0 1 2 2v9z"/></svg>'
        : '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'}</span>
      <span class="obsd-tree-label">${esc(sub.name)} <span style="color:var(--text3);font-size:10px">(${childCount})</span></span>
    </div>`;
    if (expanded) html += `<div class="obsd-tree-children">${treeNodeHTML(sub, depth + 1)}</div>`;
  }
  for (const f of files) {
    const active = activeVaultPath === f.path ? ' active' : '';
    const display = f.name.replace(/\.md$/i, '');
    html += `<div class="obsd-tree-row obsd-tree-file${active}" style="padding-left:${pad + 22}px" onclick="selectVaultNote('${escAttr(f.path)}')">
      <span class="obsd-tree-icon"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
      <span class="obsd-tree-label">${esc(display)}</span>
    </div>`;
  }
  return html;
}

function hasMatch(node) {
  // Para busca: expande automaticamente pastas que contém matches
  if (node.files && node.files.length) return true;
  for (const sub of Object.values(node.children || {})) if (hasMatch(sub)) return true;
  return false;
}

function countNotesInFolder(node) {
  let n = node.files ? node.files.length : 0;
  for (const sub of Object.values(node.children || {})) n += countNotesInFolder(sub);
  return n;
}

function escAttr(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ── Tabs ──
function selectVaultNote(path) {
  if (!vaultFiles.has(path)) return;
  if (!vaultOpenTabs.includes(path)) vaultOpenTabs.push(path);
  activeVaultPath = path;
  expandFolderPath(path);
  renderNotes();
}

function closeVaultTab(path, ev) {
  if (ev) ev.stopPropagation();
  const idx = vaultOpenTabs.indexOf(path);
  if (idx === -1) return;
  vaultOpenTabs.splice(idx, 1);
  if (activeVaultPath === path) {
    activeVaultPath = vaultOpenTabs[idx] || vaultOpenTabs[idx - 1] || null;
  }
  renderNotes();
}

function renderTabs() {
  const el = document.getElementById('d-notes-tabs');
  if (!el) return;
  if (!vaultOpenTabs.length) { el.innerHTML = '<div class="obsd-tabs-empty"></div>'; return; }
  el.innerHTML = vaultOpenTabs.map(path => {
    const name = path.split('/').pop().replace(/\.md$/i, '');
    const active = path === activeVaultPath ? ' active' : '';
    return `<div class="obsd-tab${active}" onclick="activateVaultTab('${escAttr(path)}')" title="${esc(path)}">
      <span class="obsd-tab-title">${esc(name)}</span>
      <span class="obsd-tab-close" onclick="closeVaultTab('${escAttr(path)}', event)">×</span>
    </div>`;
  }).join('');
}

function activateVaultTab(path) {
  if (!vaultFiles.has(path)) return;
  activeVaultPath = path;
  renderNotes();
}

// ── Render principal ──
function renderNotes() {
  if (dView !== 'notes' && mView !== 'notes') return;
  if (isMobile) { renderMobileEmpty(); return; }
  renderTreeOnly();
  renderTabs();
  renderEditor();
  renderStatusbar();
}

function renderMobileEmpty() {
  const el = document.getElementById('m-notes-view');
  if (el) el.innerHTML = `<div class="obsd-m-empty">📵 Visualizador de vault disponível somente no desktop.</div>`;
}

function renderTreeOnly() {
  const el = document.getElementById('d-notes-tree');
  if (!el) return;
  if (!vaultName) { el.innerHTML = ''; return; }
  if (vaultFiles.size === 0) {
    el.innerHTML = `<div class="obsd-tree-empty">Nenhum .md encontrado.</div>`;
    return;
  }
  const tree = buildVaultTree();
  const html = treeNodeHTML(tree, 0);
  el.innerHTML = html || `<div class="obsd-tree-empty">Sem resultados.</div>`;
}

async function renderEditor() {
  const el = document.getElementById('d-notes-editor');
  const outline = document.getElementById('d-notes-outline');
  const tagcloud = document.getElementById('d-notes-tagcloud');
  if (!el) return;
  if (!vaultName) {
    el.innerHTML = `<div class="obsd-vault-empty">
      <div style="font-size:38px;opacity:0.7;">📁</div>
      <div style="font-size:15px;font-weight:600;color:var(--text);">Nenhum vault carregado</div>
      <button onclick="pickVault()">Selecionar pasta do vault…</button>
      <div class="obsd-vault-hint">Escolha a pasta-raiz do seu vault do Obsidian. As notas são lidas em memória só nesta sessão — nada é enviado para nenhum servidor.</div>
    </div>`;
    if (outline) outline.innerHTML = '';
    if (tagcloud) tagcloud.innerHTML = '';
    return;
  }
  if (!activeVaultPath) {
    el.innerHTML = `<div class="obsd-editor-empty">Selecione uma nota na árvore.</div>`;
    if (outline) outline.innerHTML = '';
    if (tagcloud) tagcloud.innerHTML = '';
    return;
  }
  const path = activeVaultPath;
  const content = await readVaultFile(path);
  // Se mudou de nota durante o await, ignora
  if (path !== activeVaultPath) return;
  const fileName = path.split('/').pop().replace(/\.md$/i, '');
  const folderBread = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
  const processed = processObsidianSyntax(content);
  const md = renderObsdMarkdown(processed);
  el.innerHTML = `
    <div class="obsd-editor-head">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:18px;font-weight:700;color:var(--text);">${esc(fileName)}</div>
        <span class="obsd-readonly-badge">📖 READ-ONLY</span>
      </div>
      ${folderBread ? `<div style="font-size:11px;color:var(--text3);">${esc(folderBread)}</div>` : ''}
    </div>
    <div class="obsd-editor-body mode-preview">
      <div class="obsd-preview"><div class="obsd-md">${md}</div></div>
    </div>`;
  renderOutline(content);
  renderTagCloud();
}

// ── Pós-processamento Obsidian-específico ──
function processObsidianSyntax(content) {
  if (!content) return '';
  let out = content;
  // ![[image.png]] ou ![[Nota.md]]
  out = out.replace(/!\[\[([^\]]+?)\]\]/g, (_, target) => {
    const [rawPath, alias] = target.split('|');
    const path = rawPath.trim();
    const lower = path.toLowerCase();
    const ext = lower.includes('.') ? lower.split('.').pop() : '';
    if (VAULT_ATTACHMENT_EXTS.includes(ext)) {
      const url = getAttachmentURL(path);
      if (!url) return `<span class="obsd-wikilink-broken" title="Anexo não encontrado">![[${esc(path)}]]</span>`;
      if (ext === 'pdf') return `<a href="${url}" target="_blank" class="obsd-wikilink">📄 ${esc(alias || path)}</a>`;
      return `<img src="${url}" alt="${esc(alias || path)}" style="max-width:100%;border-radius:6px;">`;
    }
    // Embed de nota: link estilizado (preview inline pode ser feito v2)
    const resolved = resolveWikiLink(path);
    if (resolved) return `<a class="obsd-wikilink obsd-wikilink-embed" data-vaultpath="${escAttr(resolved)}" onclick="selectVaultNote('${escAttr(resolved)}');return false;" href="#">📎 ${esc(alias || path)}</a>`;
    return `<span class="obsd-wikilink-broken">![[${esc(path)}]]</span>`;
  });
  // [[Nota|alias]] ou [[Nota]]
  out = out.replace(/\[\[([^\]]+?)\]\]/g, (_, target) => {
    const [rawPath, alias] = target.split('|');
    const path = rawPath.trim();
    const display = (alias || path).trim();
    const resolved = resolveWikiLink(path);
    if (resolved) return `<a class="obsd-wikilink" data-vaultpath="${escAttr(resolved)}" onclick="selectVaultNote('${escAttr(resolved)}');return false;" href="#">${esc(display)}</a>`;
    return `<span class="obsd-wikilink-broken" title="Nota não encontrada">${esc(display)}</span>`;
  });
  return out;
}

function resolveWikiLink(target) {
  // target pode ser "Nome", "Pasta/Nome", com ou sem .md
  let t = target.trim();
  if (!/\.md$/i.test(t)) t = t + '.md';
  if (vaultFiles.has(t)) return t;
  // Match case-insensitive por path completo
  const lower = t.toLowerCase();
  for (const k of vaultFiles.keys()) if (k.toLowerCase() === lower) return k;
  // Match por nome de arquivo (sem path)
  const baseName = lower.split('/').pop();
  for (const k of vaultFiles.keys()) {
    const kLower = k.toLowerCase();
    if (kLower === baseName || kLower.endsWith('/' + baseName)) return k;
  }
  return null;
}

// ── Outline ──
function renderOutline(content) {
  const el = document.getElementById('d-notes-outline');
  if (!el) return;
  if (!content) { el.innerHTML = '<div class="obsd-outline-empty">—</div>'; return; }
  const lines = content.split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)$/);
    if (m) items.push({ level: m[1].length, text: m[2].trim(), idx: items.length });
  }
  if (!items.length) { el.innerHTML = '<div class="obsd-outline-empty">Sem cabeçalhos</div>'; return; }
  el.innerHTML = items.map(h =>
    `<div class="obsd-outline-item obsd-outline-h${h.level}" onclick="scrollToHeading(${h.idx})">${esc(h.text)}</div>`
  ).join('');
}

function scrollToHeading(idx) {
  const preview = document.querySelector('#d-notes-editor .obsd-md');
  if (!preview) return;
  const headings = preview.querySelectorAll('h1, h2, h3, h4');
  const target = headings[idx];
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Tag cloud (extrai #tags do conteúdo da nota ativa) ──
function renderTagCloud() {
  const el = document.getElementById('d-notes-tagcloud');
  if (!el) return;
  if (!activeVaultPath) { el.innerHTML = ''; return; }
  const entry = vaultFiles.get(activeVaultPath);
  if (!entry || entry.content == null) { el.innerHTML = ''; return; }
  const tags = new Set();
  const re = /(?:^|\s)#([a-zA-Z0-9][\w\-/]*)/g;
  let m;
  while ((m = re.exec(entry.content)) !== null) tags.add(m[1]);
  if (!tags.size) { el.innerHTML = '<div class="obsd-outline-empty">—</div>'; return; }
  el.innerHTML = Array.from(tags).sort().map(t => `<span class="obsd-tag">#${esc(t)}</span>`).join('');
}

// ── Statusbar ──
function renderStatusbar() {
  const el = document.getElementById('d-notes-statusbar');
  if (!el) return;
  if (!vaultName) { el.innerHTML = ''; return; }
  const active = activeVaultPath ? activeVaultPath : '—';
  el.innerHTML = `
    <span style="opacity:0.85;">📁 ${esc(vaultName)}</span>
    <span style="opacity:0.6;">·</span>
    <span style="opacity:0.7;">${vaultFiles.size} notas · ${vaultAttachments.size} anexos</span>
    <span style="flex:1;"></span>
    <span style="opacity:0.6;font-size:10px;">${esc(active)}</span>
    <button class="obsd-status-btn" onclick="pickVault()" title="Recarregar vault">↻</button>
    <button class="obsd-status-btn" onclick="closeVault()" title="Fechar vault">×</button>`;
}

// ── Busca ──
function onVaultSearch(q) {
  vaultSearchQuery = q || '';
  renderTreeOnly();
}

// ── Markdown render Obsidian-like (preservado do código anterior) ──
function renderObsdMarkdown(text) {
  if (!text) return '';
  // Escape HTML primeiro, MAS preserva tags HTML que injetamos (wiki-links, imgs)
  // Estratégia: substituir nossos <a>/<img>/<span class="obsd-wikilink…"> por placeholders, escapar resto, restaurar.
  const placeholders = [];
  const PH = (s) => { placeholders.push(s); return `\u0000${placeholders.length - 1}\u0000`; };
  let html = text
    .replace(/<a\b[^>]*?>[\s\S]*?<\/a>/g, PH)
    .replace(/<img\b[^>]*?>/g, PH)
    .replace(/<span class="obsd-wikilink[^"]*"[^>]*>[\s\S]*?<\/span>/g, PH);
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Code blocks ```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code.replace(/\n$/, '')}</code></pre>`);
  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
             .replace(/^### (.+)$/gm, '<h3>$1</h3>')
             .replace(/^## (.+)$/gm, '<h2>$1</h2>')
             .replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Lists
  html = html.replace(/^(\s*)[-*] (.+)$/gm, '<li>$2</li>');
  html = html.replace(/^(\s*)\d+\. (.+)$/gm, '<li class="ol">$2</li>');
  html = html.replace(/(<li class="ol">.*?<\/li>(\n|$))+/gs, m => `<ol>${m.replace(/ class="ol"/g, '')}</ol>`);
  html = html.replace(/(<li>(?!<\/).*?<\/li>(\n|$))+/gs, m => `<ul>${m}</ul>`);
  // Inline
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Parágrafos
  html = html.split(/\n{2,}/).map(block => {
    if (/^\s*<(h\d|pre|ul|ol|blockquote|hr)/.test(block)) return block;
    if (!block.trim()) return '';
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
  // Restaura placeholders
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[+i] || '');
  return html;
}

// ── Atalhos ──
document.addEventListener('keydown', e => {
  if (dView !== 'notes' && mView !== 'notes') return;
  const inEditable = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  // Ctrl+W: fecha tab ativa
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !inEditable) {
    if (activeVaultPath) { e.preventDefault(); closeVaultTab(activeVaultPath); }
    return;
  }
  // Ctrl+Tab: próxima tab
  if (e.ctrlKey && e.key === 'Tab' && vaultOpenTabs.length > 1) {
    e.preventDefault();
    const idx = vaultOpenTabs.indexOf(activeVaultPath);
    const next = vaultOpenTabs[(idx + 1) % vaultOpenTabs.length];
    if (next) { activeVaultPath = next; renderNotes(); }
  }
});
