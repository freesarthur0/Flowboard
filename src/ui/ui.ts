// ══════════════════════════════════════
// UI CONTROLS — Sidebar Pin & Right Panel
// ══════════════════════════════════════

function toggleSidebarPin() {
  const sidebar = document.getElementById('d-sidebar');
  if (!sidebar) return;
  const isPinned = sidebar.classList.toggle('pinned');
  const btn = document.getElementById('sidebar-pin-btn');
  if (btn) btn.classList.toggle('active', isPinned);
  localStorage.setItem('fb_sidebar_pinned', isPinned ? '1' : '0');
}

function toggleRightPanel() {
  const panel = document.getElementById('right-panel');
  const btn = document.getElementById('rp-toggle');
  if (!panel || !btn) return;
  const isCollapsed = panel.classList.toggle('collapsed');
  btn.textContent = isCollapsed ? '›' : '‹';
  btn.title = isCollapsed ? 'Expandir painel' : 'Recolher painel';
  localStorage.setItem('fb_rp_collapsed', isCollapsed ? '1' : '0');
}

function initPanelState() {
  // Restaura estado da sidebar (pinada ou não)
  const sidebar = document.getElementById('d-sidebar');
  const pinBtn = document.getElementById('sidebar-pin-btn');
  if (sidebar && localStorage.getItem('fb_sidebar_pinned') === '1') {
    sidebar.classList.add('pinned');
    if (pinBtn) pinBtn.classList.add('active');
  }

  // Restaura estado do painel direito (recolhido ou não)
  const panel = document.getElementById('right-panel');
  const rptBtn = document.getElementById('rp-toggle');
  if (panel && rptBtn && localStorage.getItem('fb_rp_collapsed') === '1') {
    panel.classList.add('collapsed');
    rptBtn.textContent = '›';
    rptBtn.title = 'Expandir painel';
  }
}

document.addEventListener('DOMContentLoaded', initPanelState);
