
-- Função utilitária de timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- SECRETARIAS
CREATE TABLE public.secretarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público leitura secretarias" ON public.secretarias FOR SELECT USING (true);
CREATE POLICY "Acesso público insert secretarias" ON public.secretarias FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update secretarias" ON public.secretarias FOR UPDATE USING (true);
CREATE POLICY "Acesso público delete secretarias" ON public.secretarias FOR DELETE USING (true);
CREATE TRIGGER trg_secretarias_updated BEFORE UPDATE ON public.secretarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUTOS
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  unidade_padrao TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público leitura produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Acesso público insert produtos" ON public.produtos FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update produtos" ON public.produtos FOR UPDATE USING (true);
CREATE POLICY "Acesso público delete produtos" ON public.produtos FOR DELETE USING (true);
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VENDAS
CREATE TABLE public.vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público leitura vendas" ON public.vendas FOR SELECT USING (true);
CREATE POLICY "Acesso público insert vendas" ON public.vendas FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update vendas" ON public.vendas FOR UPDATE USING (true);
CREATE POLICY "Acesso público delete vendas" ON public.vendas FOR DELETE USING (true);
CREATE INDEX idx_vendas_secretaria ON public.vendas(secretaria_id);
CREATE INDEX idx_vendas_data ON public.vendas(data_venda);
CREATE TRIGGER trg_vendas_updated BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ITENS DA VENDA
CREATE TABLE public.itens_venda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade NUMERIC(10,3) NOT NULL CHECK (quantidade > 0),
  unidade TEXT NOT NULL DEFAULT 'kg',
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público leitura itens" ON public.itens_venda FOR SELECT USING (true);
CREATE POLICY "Acesso público insert itens" ON public.itens_venda FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update itens" ON public.itens_venda FOR UPDATE USING (true);
CREATE POLICY "Acesso público delete itens" ON public.itens_venda FOR DELETE USING (true);
CREATE INDEX idx_itens_venda ON public.itens_venda(venda_id);
CREATE INDEX idx_itens_produto ON public.itens_venda(produto_id);
