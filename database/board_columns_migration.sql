-- ────────────────────────────────────────────────
-- FlowBoard — Migração: colunas customizáveis
-- Execute no SQL Editor do Supabase Dashboard
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_columns (
  id        text PRIMARY KEY,
  board_id  text NOT NULL,
  col_id    text NOT NULL,
  label     text NOT NULL,
  color     text NOT NULL,
  position  integer NOT NULL DEFAULT 0,
  is_done   boolean NOT NULL DEFAULT false
);

-- Permite leitura/escrita anônima (mesmo nível das tabelas boards e cards)
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON board_columns FOR ALL USING (true) WITH CHECK (true);

-- Índice para buscas por board
CREATE INDEX IF NOT EXISTS idx_board_columns_board_id ON board_columns(board_id);
