// ══════════════════════════
// CUSTOM DIALOGS — substitui prompt() e confirm() nativos
// ══════════════════════════
let _dialogResolve = null;

function resolveDialog(value) {
  document.querySelectorAll('.cdialog-bg').forEach(el => el.style.display = 'none');
  if (_dialogResolve) { _dialogResolve(value); _dialogResolve = null; }
}

/**
 * showConfirm('Título', 'Mensagem detalhada')
 * Retorna Promise<boolean>
 */
function showConfirm(title, msg) {
  return new Promise(resolve => {
    _dialogResolve = resolve;
    document.getElementById('cdialog-confirm-title').textContent = title || 'Confirmar';
    document.getElementById('cdialog-confirm-msg').innerHTML = msg ? msg.replace(/\n/g, '<br>') : '';
    document.getElementById('cdialog-confirm').style.display = 'flex';
  });
}

/**
 * showPrompt('Título', 'Mensagem', 'valor padrão')
 * Retorna Promise<string|null>
 */
function showPrompt(title, msg, defaultVal) {
  return new Promise(resolve => {
    _dialogResolve = resolve;
    document.getElementById('cdialog-prompt-title').textContent = title || 'Entrada';
    document.getElementById('cdialog-prompt-msg').innerHTML = msg ? msg.replace(/\n/g, '<br>') : '';
    const input = document.getElementById('cdialog-prompt-input');
    input.value = defaultVal || '';
    document.getElementById('cdialog-prompt').style.display = 'flex';
    setTimeout(() => input.focus(), 80);
  });
}
