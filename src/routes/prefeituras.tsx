import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, Building, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Prefeitura = { id: string; nome: string; observacao: string | null };
type Secretaria = {
  id: string;
  nome: string;
  observacao: string | null;
  prefeitura_id: string | null;
};

export const Route = createFileRoute("/prefeituras")({
  component: PrefeiturasPage,
});

function PrefeiturasPage() {
  const [items, setItems] = useState<Prefeitura[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [openPrefeitura, setOpenPrefeitura] = useState(false);
  const [openSecretaria, setOpenSecretaria] = useState(false);
  const [editing, setEditing] = useState<Prefeitura | null>(null);
  const [editingSecretaria, setEditingSecretaria] = useState<Secretaria | null>(null);
  const [prefeituraAtual, setPrefeituraAtual] = useState<string>("");
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [nomeSecretaria, setNomeSecretaria] = useState("");
  const [obsSecretaria, setObsSecretaria] = useState("");
  const [prefeituraParaExcluir, setPrefeituraParaExcluir] = useState<Prefeitura | null>(null);
  const [secretariaParaExcluir, setSecretariaParaExcluir] = useState<Secretaria | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const carregar = async () => {
    const { data, error } = await (supabase
      .from("prefeituras" as any)
      .select("*")
      .order("nome") as any);
    if (error) toast.error(error.message);
    else setItems(data ?? []);
  };

  const carregarSecretarias = async () => {
    const { data, error } = await (supabase.from("secretarias").select("*").order("nome") as any);
    if (error) toast.error(error.message);
    else setSecretarias(data ?? []);
  };

  useEffect(() => {
    carregar();
    carregarSecretarias();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSecretariasDaPrefeitura = (prefeituraId: string) => {
    return secretarias.filter((s) => s.prefeitura_id === prefeituraId);
  };

  const abrirNovo = () => {
    setEditing(null);
    setNome("");
    setObs("");
    setOpenPrefeitura(true);
  };

  const abrirEdit = (p: Prefeitura) => {
    setEditing(p);
    setNome(p.nome);
    setObs(p.observacao ?? "");
    setOpenPrefeitura(true);
  };

  const abrirNovaSecretaria = (prefeituraId: string) => {
    setEditingSecretaria(null);
    setPrefeituraAtual(prefeituraId);
    setNomeSecretaria("");
    setObsSecretaria("");
    setOpenSecretaria(true);
  };

  const abrirEditSecretaria = (s: Secretaria) => {
    setEditingSecretaria(s);
    setPrefeituraAtual(s.prefeitura_id ?? "");
    setNomeSecretaria(s.nome);
    setObsSecretaria(s.observacao ?? "");
    setOpenSecretaria(true);
  };

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    const payload = { nome: nome.trim(), observacao: obs.trim() || null };
    const { error } = editing
      ? await (supabase
          .from("prefeituras" as any)
          .update(payload)
          .eq("id", editing.id) as any)
      : await (supabase.from("prefeituras" as any).insert(payload) as any);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizada" : "Cadastrada");
    setOpenPrefeitura(false);
    carregar();
  };

  const salvarSecretaria = async () => {
    if (!nomeSecretaria.trim()) return toast.error("Nome obrigatório");
    const payload = {
      nome: nomeSecretaria.trim(),
      observacao: obsSecretaria.trim() || null,
      prefeitura_id: prefeituraAtual,
    };
    const { error } = editingSecretaria
      ? await (supabase
          .from("secretarias")
          .update(payload as any)
          .eq("id", editingSecretaria.id) as any)
      : await (supabase.from("secretarias").insert(payload as any) as any);
    if (error) return toast.error(error.message);
    toast.success(editingSecretaria ? "Atualizada" : "Cadastrada");
    setOpenSecretaria(false);
    carregarSecretarias();
  };

  const confirmarExclusao = async () => {
    if (!prefeituraParaExcluir) return;
    const { error } = await (supabase
      .from("prefeituras" as any)
      .delete()
      .eq("id", prefeituraParaExcluir.id) as any);
    if (error)
      toast.error("Não foi possível excluir (pode haver secretarias ou vendas vinculadas)");
    else {
      toast.success("Excluída");
      carregar();
    }
    setPrefeituraParaExcluir(null);
  };

  const confirmarExclusaoSecretaria = async () => {
    if (!secretariaParaExcluir) return;
    const { error } = await supabase
      .from("secretarias")
      .delete()
      .eq("id", secretariaParaExcluir.id);
    if (error) toast.error("Não foi possível excluir (pode haver vendas vinculadas)");
    else {
      toast.success("Excluída");
      carregarSecretarias();
    }
    setSecretariaParaExcluir(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Prefeituras</h2>
        <Dialog open={openPrefeitura} onOpenChange={setOpenPrefeitura}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2" onClick={abrirNovo}>
              <Plus className="h-5 w-5" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Prefeitura" : "Nova Prefeitura"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Prefeitura Municipal"
                />
              </div>
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenPrefeitura(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Building className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Nenhuma prefeitura cadastrada.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const secretariasDaPrefeitura = getSecretariasDaPrefeitura(p.id);
            const isExpanded = expandidas.has(p.id);

            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {secretariasDaPrefeitura.length > 0 && (
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{p.nome}</p>
                        {p.observacao && (
                          <p className="text-xs text-muted-foreground">{p.observacao}</p>
                        )}
                        {secretariasDaPrefeitura.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {secretariasDaPrefeitura.length} secretaria(s)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirNovaSecretaria(p.id)}
                      title="Adicionar secretaria"
                    >
                      <Building2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => abrirEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setPrefeituraParaExcluir(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && secretariasDaPrefeitura.length > 0 && (
                  <div className="border-t bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">SECRETARIAS:</p>
                    {secretariasDaPrefeitura.map((s) => (
                      <Card
                        key={s.id}
                        className="p-2 bg-background flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s.nome}</p>
                          {s.observacao && (
                            <p className="text-xs text-muted-foreground">{s.observacao}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => abrirEditSecretaria(s)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setSecretariaParaExcluir(s)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog para Secretarias */}
      <Dialog open={openSecretaria} onOpenChange={setOpenSecretaria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSecretaria ? "Editar Secretaria" : "Nova Secretaria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={nomeSecretaria}
                onChange={(e) => setNomeSecretaria(e.target.value)}
                placeholder="Ex: Secretaria de Saúde"
              />
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={obsSecretaria}
                onChange={(e) => setObsSecretaria(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSecretaria(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarSecretaria}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Prefeituras */}
      <AlertDialog
        open={!!prefeituraParaExcluir}
        onOpenChange={() => setPrefeituraParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a prefeitura{" "}
              <strong>{prefeituraParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
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

      {/* AlertDialog para Secretarias */}
      <AlertDialog
        open={!!secretariaParaExcluir}
        onOpenChange={() => setSecretariaParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a secretaria{" "}
              <strong>{secretariaParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusaoSecretaria}
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
