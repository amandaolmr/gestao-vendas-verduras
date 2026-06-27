-- LOTE DE FATURAMENTO
CREATE TABLE IF NOT EXISTS public.lote_faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  data_fechamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_vendas INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lote_faturamento ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lote_faturamento'
      AND policyname = 'Acesso público leitura lote_faturamento'
  ) THEN
    CREATE POLICY "Acesso público leitura lote_faturamento"
      ON public.lote_faturamento FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lote_faturamento'
      AND policyname = 'Acesso público insert lote_faturamento'
  ) THEN
    CREATE POLICY "Acesso público insert lote_faturamento"
      ON public.lote_faturamento FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lote_faturamento'
      AND policyname = 'Acesso público update lote_faturamento'
  ) THEN
    CREATE POLICY "Acesso público update lote_faturamento"
      ON public.lote_faturamento FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lote_faturamento'
      AND policyname = 'Acesso público delete lote_faturamento'
  ) THEN
    CREATE POLICY "Acesso público delete lote_faturamento"
      ON public.lote_faturamento FOR DELETE USING (true);
  END IF;
END
$$;

-- Adicionar coluna lote_faturamento_id em vendas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS lote_faturamento_id UUID REFERENCES public.lote_faturamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_lote ON public.vendas(lote_faturamento_id);
