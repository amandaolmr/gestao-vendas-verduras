import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { UNIDADES, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Produto = { id: string; nome: string; unidade_padrao: string; preco_padrao: number };
type Secretaria = { id: string; nome: string; prefeitura_id: string | null };
type Prefeitura = { id: string; nome: string };
type Item = { produto_id: string; quantidade: string; unidade: string; preco_unitario: string };

export const Route = createFileRoute("/editar-venda/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    duplicado: search.duplicado === true || search.duplicado === "true",
    prefeitura: (search.prefeitura as string) ?? "todas",
    secretarias: (search.secretarias as string[]) ?? [],
    data: (search.data as string) ?? "",
  }),

  component: EditarVenda,
});

function EditarVenda() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { duplicado, prefeitura, secretarias, data } = useSearch({ from: "/editar-venda/$id" });
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [todasAsSecretarias, setTodasAsSecretarias] = useState<Secretaria[]>([]);
  const [secretariasDaPrefeitura, setSecretariasDaPrefeitura] = useState<Secretaria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prefeituraId, setPrefeituraId] = useState("");
  const [secretariaId, setSecretariaId] = useState("");
  const [dataVenda, setDataVenda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<Item[]>([
    { produto_id: "", quantidade: "", unidade: "kg", preco_unitario: "" },
  ]);
  const [openPopovers, setOpenPopovers] = useState<boolean[]>([false]);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from("prefeituras" as any)
      .select("id, nome")
      .order("nome")
      .then(({ data }: any) => setPrefeituras(data ?? []));
    supabase
      .from("secretarias" as any)
      .select("id, nome, prefeitura_id")
      .order("nome")
      .then(({ data }: any) => setTodasAsSecretarias((data ?? []) as Secretaria[]));
    supabase
      .from("produtos")
      .select("id, nome, unidade_padrao, preco_padrao")
      .order("nome")
      .then(({ data }) => setProdutos((data ?? []) as Produto[]));
  }, []);

  // Quando seleciona prefeitura, filtra as secretarias
  useEffect(() => {
    if (prefeituraId) {
      const secDaPref = todasAsSecretarias.filter((s) => s.prefeitura_id === prefeituraId);
      setSecretariasDaPrefeitura(secDaPref);
      // Não limpa a secretaria na edição se ela já estiver selecionada
    } else {
      setSecretariasDaPrefeitura([]);
    }
  }, [prefeituraId, todasAsSecretarias]);

  useEffect(() => {
    const carregarVenda = async () => {
      setCarregando(true);
      const { data: venda, error: e1 } = (await supabase
        .from("vendas" as any)
        .select(
          "prefeitura_id, secretaria_id, data_venda, observacao, itens_venda(produto_id, quantidade, unidade, preco_unitario)",
        )
        .eq("id", id)
        .single()) as any;

      if (e1 || !venda) {
        toast.error("Erro ao carregar venda");
        navigate({
          to: "/",
          search: {
            prefeitura,
            secretarias,
            data,
          },
        });
        return;
      }

      setPrefeituraId(venda.prefeitura_id);
      setSecretariaId(venda.secretaria_id || "");
      // Se for duplicação, limpa a data para forçar o usuário a escolher a data correta
      setDataVenda(duplicado ? "" : venda.data_venda);
      setObservacao(venda.observacao || "");

      if (venda.itens_venda && venda.itens_venda.length > 0) {
        const itensCarregados = venda.itens_venda.map((item: any) => ({
          produto_id: item.produto_id,
          quantidade: String(item.quantidade),
          unidade: item.unidade,
          preco_unitario: String(item.preco_unitario),
        }));
        setItens(itensCarregados);
        setOpenPopovers(new Array(itensCarregados.length).fill(false));
      }
      setCarregando(false);
      // Foca no campo de data após carregar quando for duplicação
      if (duplicado) {
        setTimeout(() => dataInputRef.current?.focus(), 50);
      }
    };

    carregarVenda();
  }, [id, navigate, duplicado]);

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
    if (!dataVenda) return toast.error("Informe a data da venda");

    // Se a prefeitura tem secretarias cadastradas, é obrigatório selecionar uma
    if (secretariasDaPrefeitura.length > 0 && !secretariaId) {
      return toast.error("Selecione a secretaria (esta prefeitura possui secretarias cadastradas)");
    }

    const itensValidos = itens.filter((it) => it.produto_id && Number(it.quantidade) > 0);
    if (itensValidos.length === 0) return toast.error("Adicione ao menos um item");

    setSalvando(true);

    // Atualizar dados da venda
    const { error: e1 } = await supabase
      .from("vendas" as any)
      .update({
        prefeitura_id: prefeituraId,
        secretaria_id: secretariaId || null,
        data_venda: dataVenda,
        observacao: observacao || null,
      })
      .eq("id", id);

    if (e1) {
      setSalvando(false);
      return toast.error(e1?.message ?? "Erro ao atualizar venda");
    }

    // Deletar itens antigos
    const { error: e2 } = await supabase.from("itens_venda").delete().eq("venda_id", id);

    if (e2) {
      setSalvando(false);
      return toast.error(e2.message);
    }

    // Inserir novos itens
    const { error: e3 } = await supabase.from("itens_venda").insert(
      itensValidos.map((it) => ({
        venda_id: id,
        produto_id: it.produto_id,
        quantidade: Number(it.quantidade),
        unidade: it.unidade,
        preco_unitario: Number(it.preco_unitario) || 0,
      })),
    );

    setSalvando(false);
    if (e3) return toast.error(e3.message);
    toast.success("Venda atualizada!");
    navigate({
      to: "/",
      search: {
        prefeitura,
        secretarias,
        data,
      },
    });
  };

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate({
                to: "/",
                search: {
                  prefeitura,
                  secretarias,
                  data,
                },
              })
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold">Editar Venda</h2>
        </div>
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate({
              to: "/",
              search: {
                prefeitura,
                secretarias,
                data,
              },
            })
          }
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold">Editar Venda</h2>
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
          <Label>
            Data{" "}
            {duplicado && (
              <span className="text-destructive">* (obrigatório para venda duplicada)</span>
            )}
          </Label>
          <Input
            ref={dataInputRef}
            type="date"
            value={dataVenda}
            onChange={(e) => setDataVenda(e.target.value)}
            className={!dataVenda && duplicado ? "border-destructive" : ""}
          />
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
              setOpenPopovers((a) => [false, ...a]);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Item
          </Button>
        </div>

        {itens.map((it, i) => (
          <Card key={i} className="p-3 bg-muted/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
              {itens.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setItens((a) => a.filter((_, idx) => idx !== i));
                    setOpenPopovers((a) => a.filter((_, idx) => idx !== i));
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
                setOpenPopovers((prev) => {
                  const next = [...prev];
                  next[i] = open;
                  return next;
                });
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openPopovers[i]}
                  className="w-full justify-between"
                >
                  {it.produto_id
                    ? produtos.find((p) => p.id === it.produto_id)?.nome
                    : "Selecione o produto..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar produto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtos.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.nome}
                          onSelect={() => {
                            onProdutoChange(i, p.id);
                            setOpenPopovers((prev) => {
                              const next = [...prev];
                              next[i] = false;
                              return next;
                            });
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
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={it.preco_unitario}
                  onChange={(e) => updateItem(i, { preco_unitario: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <p className="text-right text-sm font-medium text-primary">
              Subtotal:{" "}
              {formatCurrency((Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0))}
            </p>
          </Card>
        ))}

        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </Card>

      <Button onClick={salvar} disabled={salvando} size="lg" className="w-full gap-2">
        <Save className="h-5 w-5" /> {salvando ? "Salvando…" : "Salvar Alterações"}
      </Button>
    </div>
  );
}
