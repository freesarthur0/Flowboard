-- ────────────────────────────────────────────────────────────────
-- FlowBoard — Migração: RLS + colunas ausentes em cards e boards
-- Execute no SQL Editor do Supabase Dashboard
-- ────────────────────────────────────────────────────────────────

-- 1. Garante colunas position e done_at na tabela cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS done_at  timestamptz;

-- 2. Habilita RLS (seguro executar mesmo que já esteja habilitado)
ALTER TABLE cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acesso total (mesma abordagem da board_columns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cards' AND policyname = 'allow_all'
  ) THEN
    EXECUTE 'CREATE POLICY "allow_all" ON cards FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'allow_all'
  ) THEN
    EXECUTE 'CREATE POLICY "allow_all" ON boards FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 4. Índice para acelerar buscas por board
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
