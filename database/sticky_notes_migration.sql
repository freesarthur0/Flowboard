-- ════════════════════════════════════════════════════════════════
-- Migração: Quadro de Post-its (Anotações) — sticky_notes
-- ════════════════════════════════════════════════════════════════
-- Rode este script no SQL Editor do Supabase do projeto FlowBoard.
-- Cria a tabela usada por js/notes.js + js/realtime.js e habilita
-- o Realtime para sincronização entre abas/dispositivos.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id          text PRIMARY KEY,
  x           double precision NOT NULL DEFAULT 0,
  y           double precision NOT NULL DEFAULT 0,
  w           double precision NOT NULL DEFAULT 220,
  h           double precision NOT NULL DEFAULT 180,
  color       text             NOT NULL DEFAULT 'yellow',
  content     text             NOT NULL DEFAULT '',
  z_index     integer          NOT NULL DEFAULT 0,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now()
);

-- Mantém updated_at fresco em cada UPDATE
CREATE OR REPLACE FUNCTION public._sticky_notes_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sticky_notes_touch_updated_at ON public.sticky_notes;
CREATE TRIGGER sticky_notes_touch_updated_at
  BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public._sticky_notes_touch_updated_at();

-- ── Realtime ────────────────────────────────────────────────────
-- Adiciona a tabela à publication usada pelo Supabase Realtime,
-- para que o canal de js/realtime.js receba INSERT/UPDATE/DELETE.
-- (No-op se a tabela já estiver na publication.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sticky_notes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_notes';
  END IF;
END $$;

-- ── RLS (opcional) ──────────────────────────────────────────────
-- O FlowBoard hoje não usa autenticação; deixamos RLS desligado
-- para que o anon-key consiga ler/gravar (mesmo padrão dos outros
-- migrations do projeto). Se for adicionar auth no futuro, habilite
-- RLS aqui e crie políticas equivalentes às de cards_rls_migration.sql.
-- ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
