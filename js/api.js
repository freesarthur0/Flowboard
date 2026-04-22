// ── SYNC / API ──
// ⚠️ SEGURANÇA: A SUPA_KEY está exposta no client-side. Para produção,
// configure Row Level Security (RLS) com autenticação no Supabase para
// proteger os dados. A chave pública (anon key) com RLS ativo é segura.

async function sbFetch(path, method = 'GET', body = null, silent = false, _retries = 0) {
  setSyncing(true);
  try {
    const res = await fetch(SUPA_URL + '/rest/v1/' + path, {
      method, headers: H,
      body: body ? JSON.stringify(body) : null
    });
    const t = await res.text();
    setSyncing(false);
    if (!res.ok) {
      // Retry em erros 5xx (servidor) com backoff exponencial
      if (res.status >= 500 && _retries < 3) {
        const delay = Math.pow(2, _retries) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        return sbFetch(path, method, body, silent, _retries + 1);
      }
      throw new Error(t);
    }
    return t ? JSON.parse(t) : null;
  } catch (e) {
    const msg = String(e?.message || '');
    // Compatibilidade com bancos antigos sem as colunas `deps` ou `assignees` em `cards`.
    // Detecta tanto o erro do PostgreSQL direto quanto o PGRST204 do PostgREST (schema cache).
    const isSchemaCacheMiss = /PGRST204/.test(msg)
      || /Could not find the '[^']+' column of '?cards'?/i.test(msg)
      || /column\s+"?[a-z_]+"?\s+of relation\s+"?cards"?\s+does not exist/i.test(msg);

    const missingDepsColumn = !!body && typeof body === 'object'
      && 'deps' in body
      && isSchemaCacheMiss
      && /['"\s]deps['"\s]/i.test(msg);

    const missingAssigneesColumn = !!body && typeof body === 'object'
      && 'assignees' in body
      && isSchemaCacheMiss
      && /assignees/i.test(msg);

    if (missingDepsColumn || missingAssigneesColumn) {
      let fallbackBody = { ...body };
      if (missingDepsColumn) delete fallbackBody.deps;
      if (missingAssigneesColumn) {
        // Fallback: salva apenas o primeiro responsável como string na coluna antiga `assignee`
        fallbackBody.assignee = (body.assignees && body.assignees.length) ? body.assignees[0] : '';
        delete fallbackBody.assignees;
      }
      return sbFetch(path, method, fallbackBody, silent);
    }

    // Retry em erros de rede (fetch failed) com backoff
    if (!msg.includes('HTTP') && _retries < 3 && method !== 'GET') {
      const delay = Math.pow(2, _retries) * 1000;
      await new Promise(r => setTimeout(r, delay));
      return sbFetch(path, method, body, silent, _retries + 1);
    }

    setSyncing(false, true);
    if (!silent) {
      console.error('Sync Error:', e);
      toast('Erro Sync: ' + msg.substring(0, 100), '#ef4444');
    }
    throw e;
  }
}

function setSyncing(active, error = false) {
  ['d-sync-dot', 'm-sync-dot'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.className = 'sync-dot' + (error ? ' error' : active ? ' syncing' : '');
  });
}
