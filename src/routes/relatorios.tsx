import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Building2, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
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
  prefeitura: { nome: string } | null;
  secretaria: { nome: string } | null;
  itens_venda: Item[];
};

export const Route = createFileRoute("/relatorios")({
  component: Relatorios,
});

function Relatorios() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [prefeituras, setPrefeituras] = useState<{ id: string; nome: string }[]>([]);
  const [secretarias, setSecretarias] = useState<{ id: string; nome: string }[]>([]);
  const [filtroPrefeitura, setFiltroPrefeitura] = useState<string>("todas");
  const [secretariasSelecionadas, setSecretariasSelecionadas] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsExpandidos, setCardsExpandidos] = useState<Set<string>>(new Set());
  const [vendasExpandidas, setVendasExpandidas] = useState<Set<string>>(new Set());
  const MAX_PRODUTOS_VISIVEL = 5;

  useEffect(() => {
    supabase
      .from("prefeituras" as any)
      .select("id, nome")
      .order("nome")
      .then(({ data }: any) => {
        setPrefeituras(data ?? []);
      });
  }, []);

  useEffect(() => {
    if (filtroPrefeitura !== "todas") {
      supabase
        .from("secretarias" as any)
        .select("id, nome")
        .eq("prefeitura_id", filtroPrefeitura)
        .order("nome")
        .then(({ data }: any) => {
          setSecretarias(data ?? []);
        });
    } else {
      setSecretarias([]);
    }
    setSecretariasSelecionadas([]);
  }, [filtroPrefeitura]);

  const carregar = async () => {
    setLoading(true);
    let q = supabase
      .from("vendas" as any)
      .select(
        "data_venda, observacao, prefeitura:prefeituras(nome), secretaria:secretarias(nome), itens_venda(quantidade, unidade, preco_unitario, produto:produtos(nome))",
      )
      .order("data_venda", { ascending: false });
    if (from) q = q.gte("data_venda", from);
    if (to) q = q.lte("data_venda", to);
    if (filtroPrefeitura !== "todas") q = q.eq("prefeitura_id", filtroPrefeitura);
    if (secretariasSelecionadas.length > 0) q = q.in("secretaria_id", secretariasSelecionadas);
    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [from, to, filtroPrefeitura, secretariasSelecionadas]);

  const totalVenda = (v: Row) =>
    v.itens_venda.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0);

  const grupos = useMemo(() => {
    const map = new Map<string, { vendas: Row[]; total: number }>();
    for (const v of rows) {
      const prefNome = v.prefeitura?.nome ?? "—";
      const nome = v.secretaria ? `${prefNome} - ${v.secretaria.nome}` : prefNome;
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
      const prefNome = v.prefeitura?.nome ?? "—";
      const nome = v.secretaria ? `${prefNome} - ${v.secretaria.nome}` : prefNome;
      if (!map.has(nome)) {
        map.set(nome, new Map());
      }
      const prodMap = map.get(nome)!;

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

      // Agrupar por venda
      for (let vendaIdx = 0; vendaIdx < g.vendas.length; vendaIdx++) {
        const v = g.vendas[vendaIdx];
        const totalVendaAtual = totalVenda(v);

        // Cabeçalho da venda
        doc.setFillColor(220, 230, 220);
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.rect(14, y, pageW - 28, 6, "F");
        doc.text(`Venda ${vendaIdx + 1} - ${formatDate(v.data_venda)}`, 16, y + 4);
        doc.text(`${formatCurrency(totalVendaAtual)}`, pageW - 16, y + 4, { align: "right" });
        doc.setTextColor(0, 0, 0);
        y += 6;

        // Tabela de itens da venda
        const body: string[][] = [];
        for (const it of v.itens_venda) {
          const sub = Number(it.quantidade) * Number(it.preco_unitario);
          body.push([
            it.produto?.nome ?? "—",
            `${formatNumber(Number(it.quantidade), 3)} ${it.unidade}`,
            formatCurrency(Number(it.preco_unitario)),
            formatCurrency(sub),
          ]);
        }

        autoTable(doc, {
          startY: y,
          head: [["Produto", "Qtd", "Preço Un.", "Subtotal"]],
          body,
          headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
          foot: [["", "", "Subtotal", formatCurrency(totalVendaAtual)]],
          footStyles: { fillColor: [250, 250, 250], textColor: 20, fontStyle: "bold", fontSize: 8 },
        });

        // @ts-expect-error lastAutoTable injected by autotable
        y = doc.lastAutoTable.finalY + 4;

        // Observação da venda (se houver)
        if (v.observacao) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const obsText = `Obs: ${v.observacao}`;
          const lines = doc.splitTextToSize(obsText, pageW - 32);
          doc.text(lines, 16, y);
          y += lines.length * 3 + 2;
          doc.setTextColor(0, 0, 0);
        }

        // Espaço entre vendas
        y += 2;

        // Verificar se precisa de nova página
        if (y > doc.internal.pageSize.getHeight() - 50 && vendaIdx < g.vendas.length - 1) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Verdurão Miranda", 14, 14);
          doc.setFontSize(9);
          doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
          y = 28;
        }
      }

      // Total da secretaria
      doc.setFillColor(200, 220, 200);
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.rect(14, y, pageW - 28, 7, "F");
      doc.text(`TOTAL ${nome}`, 16, y + 4.5);
      doc.text(formatCurrency(g.total), pageW - 16, y + 4.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 10;

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
          <Label className="text-xs">Prefeitura</Label>
          <Select value={filtroPrefeitura} onValueChange={setFiltroPrefeitura}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {prefeituras.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <Building2 className="h-4 w-4" /> Grupos
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
                    {g.vendas.map((v, idx) => {
                      const vendaId = `${nome}-${idx}`;
                      const expandido = vendasExpandidas.has(vendaId);

                      const toggleVenda = () => {
                        const novoSet = new Set(vendasExpandidas);
                        if (expandido) {
                          novoSet.delete(vendaId);
                        } else {
                          novoSet.add(vendaId);
                        }
                        setVendasExpandidas(novoSet);
                      };

                      return (
                        <li key={idx} className="text-sm">
                          <div
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                            onClick={toggleVenda}
                          >
                            <div className="flex items-center gap-2">
                              {expandido ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-medium">{formatDate(v.data_venda)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {v.itens_venda.length}{" "}
                                  {v.itens_venda.length === 1 ? "item" : "itens"}
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold text-primary">
                              {formatCurrency(totalVenda(v))}
                            </p>
                          </div>
                          {expandido && (
                            <div className="px-3 pb-3">
                              <div className="bg-muted/30 rounded-md overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left p-2 font-medium">Produto</th>
                                      <th className="text-right p-2 font-medium">Quantidade</th>
                                      <th className="text-right p-2 font-medium">Preço Un.</th>
                                      <th className="text-right p-2 font-medium">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.itens_venda.map((it, itIdx) => {
                                      const subtotal =
                                        Number(it.quantidade) * Number(it.preco_unitario);
                                      return (
                                        <tr key={itIdx} className="border-t border-muted">
                                          <td className="p-2">{it.produto?.nome ?? "—"}</td>
                                          <td className="p-2 text-right text-muted-foreground">
                                            {formatNumber(Number(it.quantidade), 3)} {it.unidade}
                                          </td>
                                          <td className="p-2 text-right text-muted-foreground">
                                            {formatCurrency(Number(it.preco_unitario))}
                                          </td>
                                          <td className="p-2 text-right font-medium">
                                            {formatCurrency(subtotal)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {v.observacao && (
                                  <div className="p-2 border-t border-muted bg-muted/20">
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Observação:</span>{" "}
                                      {v.observacao}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
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
              {consolidado.map((item) => {
                const expandido = cardsExpandidos.has(item.secretaria);
                const produtosVisiveis = expandido
                  ? item.produtos
                  : item.produtos.slice(0, MAX_PRODUTOS_VISIVEL);
                const temMais = item.produtos.length > MAX_PRODUTOS_VISIVEL;

                const toggleExpansao = () => {
                  const novoSet = new Set(cardsExpandidos);
                  if (expandido) {
                    novoSet.delete(item.secretaria);
                  } else {
                    novoSet.add(item.secretaria);
                  }
                  setCardsExpandidos(novoSet);
                };

                return (
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
                          {produtosVisiveis.map((p) => (
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
                    {temMais && (
                      <div className="p-3 border-t flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleExpansao}
                          className="gap-2 text-xs"
                        >
                          {expandido ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Mostrar menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Mostrar mais {item.produtos.length - MAX_PRODUTOS_VISIVEL} produtos
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
