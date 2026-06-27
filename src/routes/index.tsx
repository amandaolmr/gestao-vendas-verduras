import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Calendar, Building2, Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

type Venda = {
  id: string;
  data_venda: string;
  lote_faturamento_id: string | null;
  observacao: string | null;
  prefeitura: { nome: string } | null;
  secretaria: { nome: string } | null;
  itens_venda: { quantidade: number; preco_unitario: number }[];
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    prefeitura: (search.prefeitura as string) ?? "",
    secretarias: (search.secretarias as string[]) ?? [],
    data: (search.data as string) ?? "",
  }),
  component: VendasIndex,
});

function VendasIndex() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [prefeituras, setPrefeituras] = useState<{ id: string; nome: string }[]>([]);
  const [secretarias, setSecretarias] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroPrefeitura, setFiltroPrefeitura] = useState<string>(search.prefeitura ?? "");
  const [secretariasSelecionadas, setSecretariasSelecionadas] = useState<string[]>(
    search.secretarias ?? [],
  );
  const [filtroData, setFiltroData] = useState<string>(search.data ?? "");
  const [vendaParaExcluir, setVendaParaExcluir] = useState<string | null>(null);
  const [vendaParaDuplicar, setVendaParaDuplicar] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    let q = supabase
      .from("vendas")
      .select(
        "id, data_venda, lote_faturamento_id, observacao, prefeitura:prefeituras(nome), secretaria:secretarias(nome), itens_venda(quantidade, preco_unitario)",
      )
      .order("data_venda", { ascending: false })
      .order("created_at", { ascending: false });
    if (filtroPrefeitura) q = q.eq("prefeitura_id", filtroPrefeitura);
    if (secretariasSelecionadas.length > 0) q = q.in("secretaria_id", secretariasSelecionadas);
    if (filtroData) q = q.eq("data_venda", filtroData);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setVendas((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from("prefeituras" as any)
      .select("id, nome")
      .order("nome")
      .then(({ data }: any) => {
        const lista = (data ?? []) as { id: string; nome: string }[];
        setPrefeituras(lista);
        if (lista.length === 0) return;

        setFiltroPrefeitura((atual) => {
          const existeNoFiltro = lista.some((p) => p.id === atual);
          if (!atual || atual === "todas" || !existeNoFiltro) {
            return lista[0].id;
          }
          return atual;
        });
      });
  }, []);

  useEffect(() => {
    if (filtroPrefeitura) {
      supabase
        .from("secretarias")
        .select("id, nome")
        .eq("prefeitura_id", filtroPrefeitura)
        .order("nome")
        .then(({ data }) => {
          setSecretarias(data ?? []);
        });
    } else {
      setSecretarias([]);
      setSecretariasSelecionadas([]);
    }
  }, [filtroPrefeitura]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPrefeitura, secretariasSelecionadas, filtroData]);

  // Sincroniza filtros na URL para persistir ao voltar
  useEffect(() => {
    navigate({
      to: "/",
      search: {
        prefeitura: filtroPrefeitura,
        secretarias: secretariasSelecionadas,
        data: filtroData,
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPrefeitura, secretariasSelecionadas, filtroData]);

  const temFiltrosAtivos = () => {
    const prefeituraPadrao = prefeituras[0]?.id ?? "";
    return (
      (filtroPrefeitura !== "" && filtroPrefeitura !== prefeituraPadrao) ||
      secretariasSelecionadas.length > 0 ||
      filtroData !== ""
    );
  };

  const limparFiltros = () => {
    setFiltroPrefeitura(prefeituras[0]?.id ?? "");
    setSecretariasSelecionadas([]);
    setFiltroData("");
  };

  const confirmarExclusao = async () => {
    if (!vendaParaExcluir) return;
    const { error } = await supabase.from("vendas").delete().eq("id", vendaParaExcluir);
    if (error) toast.error(error.message);
    else {
      toast.success("Venda excluída");
      carregar();
    }
    setVendaParaExcluir(null);
  };

  const confirmarDuplicacao = async () => {
    if (!vendaParaDuplicar) return;
    try {
      // Buscar a venda completa com todos os itens
      const { data: vendaOriginal, error: errorVenda } = await supabase
        .from("vendas")
        .select(
          "data_venda, observacao, prefeitura_id, secretaria_id, itens_venda(produto_id, quantidade, unidade, preco_unitario)",
        )
        .eq("id", vendaParaDuplicar)
        .single();

      if (errorVenda) {
        toast.error("Erro ao buscar venda: " + errorVenda.message);
        return;
      }

      // Criar nova venda com a mesma data
      const { data: novaVenda, error: errorNovaVenda } = await supabase
        .from("vendas")
        .insert({
          data_venda: vendaOriginal.data_venda,
          observacao: vendaOriginal.observacao,
          prefeitura_id: vendaOriginal.prefeitura_id,
          secretaria_id: vendaOriginal.secretaria_id,
        })
        .select("id")
        .single();

      if (errorNovaVenda) {
        toast.error("Erro ao criar venda: " + errorNovaVenda.message);
        return;
      }

      // Criar os itens da nova venda
      const itensParaInserir = (vendaOriginal.itens_venda as any[]).map((item) => ({
        venda_id: novaVenda.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        unidade: item.unidade,
        preco_unitario: item.preco_unitario,
      }));

      const { error: errorItens } = await supabase.from("itens_venda").insert(itensParaInserir);

      if (errorItens) {
        toast.error("Erro ao criar itens: " + errorItens.message);
        return;
      }

      toast.success("Venda duplicada com sucesso!");
      setVendaParaDuplicar(null);

      // Navegar para a tela de edição da venda duplicada
      navigate({
        to: "/editar-venda/$id",
        params: { id: novaVenda.id },
        search: {
          duplicado: true,
          prefeitura: filtroPrefeitura,
          secretarias: secretariasSelecionadas,
          data: filtroData,
        },
      });
    } catch (error) {
      toast.error("Erro ao duplicar venda");
      console.error(error);
    } finally {
      setVendaParaDuplicar(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Vendas</h2>
        <Link
          to="/nova-venda"
          search={{
            prefeitura: filtroPrefeitura,
            secretarias: secretariasSelecionadas,
            data: filtroData,
          }}
        >
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" /> Nova
          </Button>
        </Link>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Filtros</h3>
          {temFiltrosAtivos() && (
            <Button variant="outline" size="sm" onClick={limparFiltros} className="text-xs">
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Prefeitura</Label>
            <Select value={filtroPrefeitura} onValueChange={setFiltroPrefeitura}>
              <SelectTrigger>
                <SelectValue />
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
          <div>
            <Label className="text-xs">Data</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
              />
              {filtroData && (
                <Button variant="outline" size="icon" onClick={() => setFiltroData("")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {secretarias.length > 0 && (
          <div>
            <Label className="text-xs mb-2 block">Secretarias</Label>
            <div className="flex flex-wrap gap-3">
              {secretarias.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={secretariasSelecionadas.includes(s.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSecretariasSelecionadas([...secretariasSelecionadas, s.id]);
                      } else {
                        setSecretariasSelecionadas(
                          secretariasSelecionadas.filter((id) => id !== s.id),
                        );
                      }
                    }}
                  />
                  <span className="text-sm">{s.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Carregando…</p>
      ) : vendas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma venda encontrada. Toque em <strong>Nova</strong> para registrar.
        </Card>
      ) : (
        <div className="space-y-3">
          {vendas.map((v, index) => {
            const numeroVenda = vendas.length - index;
            const total = v.itens_venda.reduce(
              (s, i) => s + Number(i.quantidade) * Number(i.preco_unitario),
              0,
            );
            return (
              <Card key={v.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        Venda #{numeroVenda}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(v.data_venda)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="truncate">{v.prefeitura?.nome ?? "—"}</span>
                      </div>
                      {v.secretaria && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate">{v.secretaria.nome}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{v.itens_venda.length} itens</Badge>
                      <Badge style={{ background: "var(--gradient-primary)", color: "white" }}>
                        {formatCurrency(total)}
                      </Badge>
                      {v.lote_faturamento_id && (
                        <Badge variant="outline" className="text-primary border-primary/40">
                          Faturada
                        </Badge>
                      )}
                    </div>
                    {v.observacao && (
                      <p className="text-sm text-muted-foreground">{v.observacao}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setVendaParaDuplicar(v.id)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Duplicar venda"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Link to="/editar-venda/$id" params={{ id: v.id }}>
                      <Button variant="ghost" size="icon" className="text-primary">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setVendaParaExcluir(v.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!vendaParaExcluir} onOpenChange={() => setVendaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!vendaParaDuplicar} onOpenChange={() => setVendaParaDuplicar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar venda</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja criar uma cópia desta venda? Todos os dados, incluindo data e itens, serão
              duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDuplicacao}>Duplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
