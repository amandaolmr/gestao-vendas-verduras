import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { UNIDADES, formatCurrency } from "@/lib/format";

type Produto = { id: string; nome: string; unidade_padrao: string; preco_padrao: number };

export const Route = createFileRoute("/produtos")({
  component: ProdutosPage,
});

function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [preco, setPreco] = useState("");
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");
    if (error) toast.error(error.message);
    else setProdutos((data ?? []) as Produto[]);
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = () => {
    setEditing(null);
    setNome("");
    setUnidade("kg");
    setPreco("");
    setOpen(true);
  };
  const abrirEdit = (p: Produto) => {
    setEditing(p);
    setNome(p.nome);
    setUnidade(p.unidade_padrao);
    setPreco(String(p.preco_padrao ?? ""));
    setOpen(true);
  };

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    const precoNum = Number(preco) || 0;
    if (editing) {
      const { error } = await supabase
        .from("produtos")
        .update({ nome: nome.trim(), unidade_padrao: unidade, preco_padrao: precoNum })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      const { error } = await supabase
        .from("produtos")
        .insert({ nome: nome.trim(), unidade_padrao: unidade, preco_padrao: precoNum });
      if (error) return toast.error(error.message);
      toast.success("Produto adicionado");
    }
    setOpen(false);
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!produtoParaExcluir) return;
    const { error } = await supabase.from("produtos").delete().eq("id", produtoParaExcluir.id);
    if (error) toast.error("Não foi possível excluir (produto pode estar em vendas)");
    else {
      toast.success("Excluído");
      carregar();
    }
    setProdutoParaExcluir(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Produtos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2" onClick={abrirNovo}>
              <Plus className="h-5 w-5" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Cebola"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Unidade padrão</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger>
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
                  <Label>Preço unitário</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
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

      {produtos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Nenhum produto. Toque em <strong>Novo</strong>.
        </Card>
      ) : (
        <div className="space-y-2">
          {produtos.map((p) => (
            <Card key={p.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(Number(p.preco_padrao) || 0)} / {p.unidade_padrao}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => abrirEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setProdutoParaExcluir(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!produtoParaExcluir} onOpenChange={() => setProdutoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{produtoParaExcluir?.nome}</strong>?
              Esta ação não pode ser desfeita.
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
