import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, ArrowLeft, Save, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { todayIso, UNIDADES, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Produto = { id: string; nome: string; unidade_padrao: string; preco_padrao: number };
type Secretaria = { id: string; nome: string; prefeitura_id: string | null };
type Prefeitura = { id: string; nome: string };
type Item = { produto_id: string; quantidade: string; unidade: string; preco_unitario: string };

export const Route = createFileRoute("/nova-venda")({
  component: NovaVenda,
});

function NovaVenda() {
  const navigate = useNavigate();
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [secretariasDaPrefeitura, setSecretariasDaPrefeitura] = useState<Secretaria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prefeituraId, setPrefeituraId] = useState("");
  const [secretariaId, setSecretariaId] = useState("");
  const [dataVenda, setDataVenda] = useState(todayIso());
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<Item[]>([
    { produto_id: "", quantidade: "", unidade: "kg", preco_unitario: "" },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [openPopovers, setOpenPopovers] = useState<boolean[]>([false]);

  useEffect(() => {
    supabase
      .from("prefeituras")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setPrefeituras(data ?? []));
    supabase
      .from("secretarias")
      .select("id, nome, prefeitura_id")
      .order("nome")
      .then(({ data }) => setSecretarias((data ?? []) as Secretaria[]));
    supabase
      .from("produtos")
      .select("id, nome, unidade_padrao, preco_padrao")
      .order("nome")
      .then(({ data }) => setProdutos((data ?? []) as Produto[]));
  }, []);

  // Quando seleciona prefeitura, filtra as secretarias
  useEffect(() => {
    if (prefeituraId) {
      const secDaPref = secretarias.filter((s) => s.prefeitura_id === prefeituraId);
      setSecretariasDaPrefeitura(secDaPref);
      setSecretariaId(""); // Limpa a secretaria selecionada
    } else {
      setSecretariasDaPrefeitura([]);
      setSecretariaId("");
    }
  }, [prefeituraId, secretarias]);

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const onProdutoChange = (i: number, produtoId: string) => {
    const p = produtos.find((x) => x.id === produtoId);
    updateItem(i, {
      produto_id: produtoId,
      unidade: p?.unidade_padrao ?? "kg",
      preco_unitario: p ? String(p.preco_padrao ?? 0) : "",
    });
  };

  const total = itens.reduce(
    (s, it) => s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
    0,
  );

  const salvar = async () => {
    if (!prefeituraId) return toast.error("Selecione a prefeitura");

    // Se a prefeitura tem secretarias cadastradas, é obrigatório selecionar uma
    if (secretariasDaPrefeitura.length > 0 && !secretariaId) {
      return toast.error("Selecione a secretaria (esta prefeitura possui secretarias cadastradas)");
    }

    const itensValidos = itens.filter((it) => it.produto_id && Number(it.quantidade) > 0);
    if (itensValidos.length === 0) return toast.error("Adicione ao menos um item");

    setSalvando(true);
    const { data: venda, error: e1 } = await supabase
      .from("vendas")
      .insert({
        prefeitura_id: prefeituraId,
        secretaria_id: secretariaId || null,
        data_venda: dataVenda,
        observacao: observacao || null,
      })
      .select("id")
      .single();
    if (e1 || !venda) {
      setSalvando(false);
      return toast.error(e1?.message ?? "Erro");
    }

    const { error: e2 } = await supabase.from("itens_venda").insert(
      itensValidos.map((it) => ({
        venda_id: venda.id,
        produto_id: it.produto_id,
        quantidade: Number(it.quantidade),
        unidade: it.unidade,
        preco_unitario: Number(it.preco_unitario) || 0,
      })),
    );
    setSalvando(false);
    if (e2) return toast.error(e2.message);
    toast.success("Venda registrada!");
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold">Nova Venda</h2>
      </div>

      {prefeituras.length === 0 && (
        <Card className="p-4 bg-accent/30 border-accent">
          Cadastre uma prefeitura primeiro na aba <strong>Prefeituras</strong>.
        </Card>
      )}
      {produtos.length === 0 && (
        <Card className="p-4 bg-accent/30 border-accent">
          Cadastre produtos primeiro na aba <strong>Produtos</strong>.
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div>
          <Label>Prefeitura *</Label>
          <Select value={prefeituraId} onValueChange={setPrefeituraId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a prefeitura..." />
            </SelectTrigger>
            <SelectContent>
              {prefeituras.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {prefeituraId && secretariasDaPrefeitura.length > 0 && (
          <div>
            <Label>Secretaria *</Label>
            <Select value={secretariaId} onValueChange={setSecretariaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a secretaria..." />
              </SelectTrigger>
              <SelectContent>
                {secretariasDaPrefeitura.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {prefeituraId && secretariasDaPrefeitura.length === 0 && (
          <Card className="p-3 bg-muted text-sm text-muted-foreground">
            Esta prefeitura não possui secretarias cadastradas. A venda será registrada apenas na
            prefeitura.
          </Card>
        )}
        <div>
          <Label>Data</Label>
          <Input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
        </div>
        <div>
          <Label>Observação</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            rows={2}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Itens</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setItens((a) => [
                { produto_id: "", quantidade: "", unidade: "kg", preco_unitario: "" },
                ...a,
              ]);
              setOpenPopovers((p) => [false, ...p]);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Item
          </Button>
        </div>

        {itens.map((it, i) => {
          const produtoSelecionado = produtos.find((p) => p.id === it.produto_id);

          return (
            <Card key={i} className="p-3 bg-muted/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                {itens.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setItens((a) => a.filter((_, idx) => idx !== i));
                      setOpenPopovers((p) => p.filter((_, idx) => idx !== i));
                    }}
                    className="text-destructive h-7 w-7"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Popover
                open={openPopovers[i]}
                onOpenChange={(open) => {
                  setOpenPopovers((p) => p.map((val, idx) => (idx === i ? open : val)));
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openPopovers[i]}
                    className="w-full justify-between"
                  >
                    {produtoSelecionado ? produtoSelecionado.nome : "Selecione o produto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar produto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtos.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.nome}
                            onSelect={() => {
                              onProdutoChange(i, p.id);
                              setOpenPopovers((pop) =>
                                pop.map((val, idx) => (idx === i ? false : val)),
                              );
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                it.produto_id === p.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {p.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Qtde</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={it.quantidade}
                    onChange={(e) => updateItem(i, { quantidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Un.</Label>
                  <Select value={it.unidade} onValueChange={(v) => updateItem(i, { unidade: v })}>
                    <SelectTrigger disabled className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Preço un.</Label>
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={it.preco_unitario ? formatCurrency(Number(it.preco_unitario)) : "—"}
                    className="bg-muted"
                  />
                </div>
              </div>
              <p className="text-right text-sm font-medium text-primary">
                Subtotal:{" "}
                {formatCurrency((Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0))}
              </p>
            </Card>
          );
        })}

        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </Card>

      <Button onClick={salvar} disabled={salvando} size="lg" className="w-full gap-2">
        <Save className="h-5 w-5" /> {salvando ? "Salvando…" : "Salvar Venda"}
      </Button>
    </div>
  );
}
