// ══════════════════════════
// SUPABASE REALTIME
// ══════════════════════════
// Requer: Realtime habilitado no dashboard Supabase para as tabelas `cards` e `boards`
// (Database → Replication → supabase_realtime publication → adicionar as tabelas)

let _realtimeChannel = null;

function initRealtime() {
  if (typeof window.supabase === 'undefined') {
    console.warn('[FlowBoard Realtime] Supabase JS não encontrado. Realtime desativado.');
    return;
  }

  const client = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  _realtimeChannel = client.channel('flowboard-db')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' }, ({ new: card }) => {
      if (cards.find(c => c.id === card.id)) return; // já existe localmente
      cards.push(card);
      render();
      toast('Nova tarefa adicionada', '#6366f1');
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards' }, ({ new: card }) => {
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx === -1) { cards.push(card); }
      else {
        // Preserva campos locais que o servidor não armazena (ex: deps)
        cards[idx] = { ...cards[idx], ...card };
      }
      render();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cards' }, ({ old: card }) => {
      const existed = cards.some(c => c.id === card.id);
      if (!existed) return;
      cards = cards.filter(c => c.id !== card.id);
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boards' }, ({ new: board }) => {
      if (boards.find(b => b.id === board.id)) return;
      boards.push(board);
      render();
      toast(`Quadro "${board.name}" criado`, '#6366f1');
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'boards' }, ({ new: board }) => {
      const idx = boards.findIndex(b => b.id === board.id);
      if (idx !== -1) { boards[idx] = { ...boards[idx], ...board }; render(); }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'boards' }, ({ old: board }) => {
      if (!boards.find(b => b.id === board.id)) return;
      boards = boards.filter(b => b.id !== board.id);
      cards = cards.filter(c => c.board_id !== board.id);
      if (activeBoardId === board.id) activeBoardId = boards[0]?.id || null;
      render();
    })
    .subscribe(status => {
      const dot = document.getElementById(isMobile ? 'm-sync-dot' : 'd-sync-dot');
      if (status === 'SUBSCRIBED') {
        console.log('[FlowBoard Realtime] Conectado ✓');
        if (dot) dot.title = 'Realtime ativo';
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[FlowBoard Realtime] Erro de conexão:', status);
        if (dot) dot.classList.add('error');
      }
    });
}
