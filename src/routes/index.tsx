import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Trash2, Calendar, Building2, Edit } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

type Venda = {
  id: string;
  data_venda: string;
  observacao: string | null;
  secretaria: { nome: string } | null;
  itens_venda: { quantidade: number; preco_unitario: number }[];
};

export const Route = createFileRoute("/")({
  component: VendasIndex,
});

function VendasIndex() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [secretarias, setSecretarias] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroSec, setFiltroSec] = useState<string>("todas");
  const [filtroData, setFiltroData] = useState<string>("");
  const [vendaParaExcluir, setVendaParaExcluir] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    let q = supabase
      .from("vendas")
      .select(
        "id, data_venda, observacao, secretaria:secretarias(nome), itens_venda(quantidade, preco_unitario)",
      )
      .order("data_venda", { ascending: false })
      .order("created_at", { ascending: false });
    if (filtroSec !== "todas") q = q.eq("secretaria_id", filtroSec);
    if (filtroData) q = q.eq("data_venda", filtroData);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setVendas((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from("secretarias")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => {
        setSecretarias(data ?? []);
      });
  }, []);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroSec, filtroData]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Vendas</h2>
        <Link to="/nova-venda">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" /> Nova
          </Button>
        </Link>
      </div>

      <Card className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Secretaria</Label>
          <Select value={filtroSec} onValueChange={setFiltroSec}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {secretarias.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data</Label>
          <div className="flex gap-2">
            <Input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
            {filtroData && (
              <Button variant="outline" size="icon" onClick={() => setFiltroData("")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Carregando…</p>
      ) : vendas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma venda encontrada. Toque em <strong>Nova</strong> para registrar.
        </Card>
      ) : (
        <div className="space-y-3">
          {vendas.map((v) => {
            const total = v.itens_venda.reduce(
              (s, i) => s + Number(i.quantidade) * Number(i.preco_unitario),
              0,
            );
            return (
              <Card key={v.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(v.data_venda)}</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="truncate">{v.secretaria?.nome ?? "—"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{v.itens_venda.length} itens</Badge>
                      <Badge style={{ background: "var(--gradient-primary)", color: "white" }}>
                        {formatCurrency(total)}
                      </Badge>
                    </div>
                    {v.observacao && (
                      <p className="text-sm text-muted-foreground">{v.observacao}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
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
    </div>
  );
}
