-- Criação da tabela de Lembretes (Reminders)
CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  board_id uuid NOT NULL,
  text text NOT NULL,
  due timestamp with time zone NULL,
  advance integer NOT NULL DEFAULT 60,
  recur text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reminders_pkey PRIMARY KEY (id),
  CONSTRAINT reminders_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);

-- Para segurança (opcional): habilitar RLS (Row Level Security) 
-- se você for implementar autenticação no futuro.
-- ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
