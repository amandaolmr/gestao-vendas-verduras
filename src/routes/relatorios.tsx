import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Building2, Download, FileText } from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Item = {
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  produto: { nome: string } | null;
};
type Row = {
  data_venda: string;
  observacao: string | null;
  secretaria: { nome: string } | null;
  itens_venda: Item[];
};

export const Route = createFileRoute("/relatorios")({
  component: Relatorios,
});

function Relatorios() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [secretarias, setSecretarias] = useState<{ id: string; nome: string }[]>([]);
  const [secId, setSecId] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("secretarias")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => {
        setSecretarias(data ?? []);
      });
  }, []);

  const carregar = async () => {
    setLoading(true);
    let q = supabase
      .from("vendas")
      .select(
        "data_venda, observacao, secretaria:secretarias(nome), itens_venda(quantidade, unidade, preco_unitario, produto:produtos(nome))",
      )
      .order("data_venda", { ascending: true });
    if (from) q = q.gte("data_venda", from);
    if (to) q = q.lte("data_venda", to);
    if (secId !== "all") q = q.eq("secretaria_id", secId);
    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [from, to, secId]);

  const totalVenda = (v: Row) =>
    v.itens_venda.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0);

  const grupos = useMemo(() => {
    const map = new Map<string, { vendas: Row[]; total: number }>();
    for (const v of rows) {
      const nome = v.secretaria?.nome ?? "—";
      const g = map.get(nome) ?? { vendas: [], total: 0 };
      g.vendas.push(v);
      g.total += totalVenda(v);
      map.set(nome, g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // Consolidado por produtos (para nota fiscal)
  const consolidado = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { quantidade: number; unidade: string; preco_unitario: number; total: number }>
    >();

    for (const v of rows) {
      const secNome = v.secretaria?.nome ?? "—";
      if (!map.has(secNome)) {
        map.set(secNome, new Map());
      }
      const prodMap = map.get(secNome)!;

      for (const it of v.itens_venda) {
        const prodNome = it.produto?.nome ?? "—";
        const existing = prodMap.get(prodNome);

        if (existing) {
          existing.quantidade += Number(it.quantidade);
          existing.total += Number(it.quantidade) * Number(it.preco_unitario);
        } else {
          prodMap.set(prodNome, {
            quantidade: Number(it.quantidade),
            unidade: it.unidade,
            preco_unitario: Number(it.preco_unitario),
            total: Number(it.quantidade) * Number(it.preco_unitario),
          });
        }
      }
    }

    return [...map.entries()]
      .map(([sec, prods]) => ({
        secretaria: sec,
        produtos: [...prods.entries()]
          .map(([nome, dados]) => ({ nome, ...dados }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        total: [...prods.values()].reduce((s, p) => s + p.total, 0),
      }))
      .sort((a, b) => a.secretaria.localeCompare(b.secretaria));
  }, [rows]);

  const totalGeral = useMemo(() => grupos.reduce((s, [, g]) => s + g.total, 0), [grupos]);

  const exportarPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const periodo =
      from || to
        ? `Período: ${from ? formatDate(from) : "…"} a ${to ? formatDate(to) : "…"}`
        : "Período: todos";

    // Cabeçalho do estabelecimento
    doc.setFontSize(18);
    doc.text("Verdurão Miranda", 14, 14);
    doc.setFontSize(10);
    doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);

    doc.setFontSize(16);
    doc.text("Relatório de Vendas por Secretaria", 14, 30);
    doc.setFontSize(10);
    doc.text(periodo, 14, 37);

    let y = 44;

    for (const [nome, g] of grupos) {
      // Cabeçalho da secretaria
      doc.setFillColor(34, 139, 67);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.rect(14, y, pageW - 28, 8, "F");
      doc.text(nome, 16, y + 5.5);
      doc.text(`Total: ${formatCurrency(g.total)}`, pageW - 16, y + 5.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Linhas: cada item de cada venda
      const body: string[][] = [];
      for (const v of g.vendas) {
        for (const it of v.itens_venda) {
          const sub = Number(it.quantidade) * Number(it.preco_unitario);
          body.push([
            formatDate(v.data_venda),
            it.produto?.nome ?? "—",
            `${formatNumber(Number(it.quantidade), 3)} ${it.unidade}`,
            formatCurrency(Number(it.preco_unitario)),
            formatCurrency(sub),
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        head: [["Data", "Produto", "Qtd", "Preço Un.", "Subtotal"]],
        body,
        headStyles: { fillColor: [220, 230, 220], textColor: 20, fontStyle: "bold" },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
        foot: [["", "", "", "Total", formatCurrency(g.total)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
      });

      // @ts-expect-error lastAutoTable injected by autotable
      y = doc.lastAutoTable.finalY + 8;

      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        // Cabeçalho da nova página
        doc.setFontSize(14);
        doc.text("Verdurão Miranda", 14, 14);
        doc.setFontSize(9);
        doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
        y = 28;
      }
    }

    // Total geral
    doc.setFillColor(34, 139, 67);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.rect(14, y, pageW - 28, 10, "F");
    doc.text("TOTAL GERAL", 16, y + 6.5);
    doc.text(formatCurrency(totalGeral), pageW - 16, y + 6.5, { align: "right" });

    doc.save(`relatorio-vendas-${Date.now()}.pdf`);
  };

  const exportarNotaFiscal = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const periodo =
      from || to
        ? `Período: ${from ? formatDate(from) : "…"} a ${to ? formatDate(to) : "…"}`
        : "Período: todos";

    // Cabeçalho do estabelecimento
    doc.setFontSize(18);
    doc.text("Verdurão Miranda", 14, 14);
    doc.setFontSize(10);
    doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);

    doc.setFontSize(16);
    doc.text("Relatório Consolidado - Nota Fiscal", 14, 30);
    doc.setFontSize(10);
    doc.text(periodo, 14, 37);

    let y = 44;

    for (const item of consolidado) {
      // Cabeçalho da secretaria
      doc.setFillColor(34, 139, 67);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.rect(14, y, pageW - 28, 8, "F");
      doc.text(item.secretaria, 16, y + 5.5);
      doc.text(`Total: ${formatCurrency(item.total)}`, pageW - 16, y + 5.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Tabela de produtos consolidados
      const body = item.produtos.map((p) => [
        p.nome,
        `${formatNumber(p.quantidade, 3)} ${p.unidade}`,
        formatCurrency(p.preco_unitario),
        formatCurrency(p.total),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Produto", "Quantidade", "Preço Un.", "Total"]],
        body,
        headStyles: { fillColor: [220, 230, 220], textColor: 20, fontStyle: "bold" },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
        foot: [["", "", "Total", formatCurrency(item.total)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
      });

      // @ts-expect-error lastAutoTable injected by autotable
      y = doc.lastAutoTable.finalY + 8;

      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        // Cabeçalho da nova página
        doc.setFontSize(14);
        doc.text("Verdurão Miranda", 14, 14);
        doc.setFontSize(9);
        doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
        y = 28;
      }
    }

    // Total geral
    const totalGeralConsolidado = consolidado.reduce((s, c) => s + c.total, 0);
    doc.setFillColor(34, 139, 67);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.rect(14, y, pageW - 28, 10, "F");
    doc.text("TOTAL GERAL", 16, y + 6.5);
    doc.text(formatCurrency(totalGeralConsolidado), pageW - 16, y + 6.5, { align: "right" });

    doc.save(`nota-fiscal-consolidada-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Relatórios</h2>

      <Card className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Secretaria</Label>
          <Select value={secId} onValueChange={setSecId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as secretarias</SelectItem>
              {secretarias.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4" style={{ background: "var(--gradient-primary)", color: "white" }}>
          <div className="flex items-center gap-2 text-sm opacity-90">
            <TrendingUp className="h-4 w-4" /> Total geral
          </div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalGeral)}</p>
          <p className="text-xs opacity-80 mt-1">{rows.length} vendas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" /> Secretarias
          </div>
          <p className="text-2xl font-bold mt-1 text-primary">{grupos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">no relatório</p>
        </Card>
      </div>

      <Tabs defaultValue="vendas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vendas">Por Vendas</TabsTrigger>
          <TabsTrigger value="consolidado">Nota Fiscal</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarPDF}
              className="gap-2"
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-12">Carregando…</p>
          ) : grupos.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Sem dados no período.</p>
          ) : (
            <div className="space-y-4">
              {grupos.map(([nome, g]) => (
                <Card key={nome} className="overflow-hidden">
                  <div
                    className="p-3 flex items-center justify-between"
                    style={{ background: "var(--gradient-primary)", color: "white" }}
                  >
                    <p className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {nome}
                    </p>
                    <p className="font-bold">{formatCurrency(g.total)}</p>
                  </div>
                  <ul className="divide-y">
                    {g.vendas.map((v, idx) => (
                      <li key={idx} className="p-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{formatDate(v.data_venda)}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.itens_venda.length} {v.itens_venda.length === 1 ? "item" : "itens"}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          {formatCurrency(totalVenda(v))}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="consolidado" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarNotaFiscal}
              className="gap-2"
              disabled={rows.length === 0}
            >
              <FileText className="h-4 w-4" /> Gerar Nota Fiscal
            </Button>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-12">Carregando…</p>
          ) : consolidado.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Sem dados no período.</p>
          ) : (
            <div className="space-y-4">
              {consolidado.map((item) => (
                <Card key={item.secretaria} className="overflow-hidden">
                  <div
                    className="p-3 flex items-center justify-between"
                    style={{ background: "var(--gradient-primary)", color: "white" }}
                  >
                    <p className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {item.secretaria}
                    </p>
                    <p className="font-bold">{formatCurrency(item.total)}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Produto</th>
                          <th className="text-right p-3 font-medium">Quantidade</th>
                          <th className="text-right p-3 font-medium">Preço Un.</th>
                          <th className="text-right p-3 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {item.produtos.map((p) => (
                          <tr key={p.nome} className="hover:bg-muted/30">
                            <td className="p-3 font-medium">{p.nome}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatNumber(p.quantidade, 3)} {p.unidade}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(p.preco_unitario)}
                            </td>
                            <td className="p-3 text-right font-semibold text-primary">
                              {formatCurrency(p.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50 font-bold">
                        <tr>
                          <td colSpan={3} className="p-3 text-right">
                            TOTAL
                          </td>
                          <td className="p-3 text-right text-primary text-lg">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
