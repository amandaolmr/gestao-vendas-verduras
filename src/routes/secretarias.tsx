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
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

type Sec = { id: string; nome: string; observacao: string | null };

export const Route = createFileRoute("/secretarias")({
  component: SecretariasPage,
});

function SecretariasPage() {
  const [items, setItems] = useState<Sec[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sec | null>(null);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [secretariaParaExcluir, setSecretariaParaExcluir] = useState<Sec | null>(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("secretarias").select("*").order("nome");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
  };
  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = () => {
    setEditing(null);
    setNome("");
    setObs("");
    setOpen(true);
  };
  const abrirEdit = (s: Sec) => {
    setEditing(s);
    setNome(s.nome);
    setObs(s.observacao ?? "");
    setOpen(true);
  };

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    const payload = { nome: nome.trim(), observacao: obs.trim() || null };
    const { error } = editing
      ? await supabase.from("secretarias").update(payload).eq("id", editing.id)
      : await supabase.from("secretarias").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizada" : "Cadastrada");
    setOpen(false);
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!secretariaParaExcluir) return;
    const { error } = await supabase
      .from("secretarias")
      .delete()
      .eq("id", secretariaParaExcluir.id);
    if (error) toast.error("Não foi possível excluir (pode haver vendas vinculadas)");
    else {
      toast.success("Excluída");
      carregar();
    }
    setSecretariaParaExcluir(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Secretarias</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2" onClick={abrirNovo}>
              <Plus className="h-5 w-5" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Secretaria" : "Nova Secretaria"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Secretaria de Saúde"
                />
              </div>
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Nenhuma secretaria cadastrada.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <Card key={s.id} className="p-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{s.nome}</p>
                {s.observacao && <p className="text-xs text-muted-foreground">{s.observacao}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => abrirEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setSecretariaParaExcluir(s)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
