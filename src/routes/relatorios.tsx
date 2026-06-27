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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Building2,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { formatCurrency, formatNumber, formatDate, todayIso } from "@/lib/format";
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

type PendingVendaSimples = {
  id: string;
  data_venda: string;
  secretaria_id: string;
  itens_venda: { quantidade: number; preco_unitario: number }[];
};

type LoteFaturamento = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  data_fechamento: string;
  valor_total: number;
  quantidade_vendas: number;
  observacao: string | null;
  created_at: string;
};

export const Route = createFileRoute("/relatorios")({
  component: Relatorios,
});

function Relatorios() {
  // ---- Pendentes ----
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [prefeituras, setPrefeituras] = useState<{ id: string; nome: string }[]>([]);
  const [secretarias, setSecretarias] = useState<{ id: string; nome: string }[]>([]);
  const [filtroPrefeitura, setFiltroPrefeitura] = useState<string>("");
  const [secretariasSelecionadas, setSecretariasSelecionadas] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsExpandidos, setCardsExpandidos] = useState<Set<string>>(new Set());
  const [vendasExpandidas, setVendasExpandidas] = useState<Set<string>>(new Set());
  const MAX_PRODUTOS_VISIVEL = 5;

  // ---- Modal Fechamento ----
  const [modalFechamento, setModalFechamento] = useState(false);
  const [pendingTodos, setPendingTodos] = useState<PendingVendaSimples[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [dataEmissao, setDataEmissao] = useState(todayIso());
  const [observacaoFechamento, setObservacaoFechamento] = useState("");
  const [fechando, setFechando] = useState(false);

  // ---- Histórico ----
  const [tabAtiva, setTabAtiva] = useState<"pendentes" | "historico">("pendentes");
  const [lotes, setLotes] = useState<LoteFaturamento[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [loteSelected, setLoteSelected] = useState<LoteFaturamento | null>(null);
  const [loteNumero, setLoteNumero] = useState(0);
  const [loteVendas, setLoteVendas] = useState<Row[]>([]);
  const [loadingLoteVendas, setLoadingLoteVendas] = useState(false);

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
      .is("lote_faturamento_id", null)
      .order("data_venda", { ascending: false });
    if (from) q = q.gte("data_venda", from);
    if (to) q = q.lte("data_venda", to);
    if (filtroPrefeitura) q = q.eq("prefeitura_id", filtroPrefeitura);
    if (secretariasSelecionadas.length > 0) q = q.in("secretaria_id", secretariasSelecionadas);
    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [from, to, filtroPrefeitura, secretariasSelecionadas]);

  const carregarLotes = async () => {
    setLoadingLotes(true);
    const { data } = await (supabase as any)
      .from("lote_faturamento")
      .select("*")
      .order("data_fechamento", { ascending: false });
    setLotes((data as LoteFaturamento[]) ?? []);
    setLoadingLotes(false);
  };

  const carregarLoteVendas = async (loteId: string) => {
    setLoadingLoteVendas(true);
    const { data } = await supabase
      .from("vendas" as any)
      .select(
        "data_venda, observacao, prefeitura:prefeituras(nome), secretaria:secretarias(nome), itens_venda(quantidade, unidade, preco_unitario, produto:produtos(nome))",
      )
      .eq("lote_faturamento_id", loteId)
      .order("data_venda", { ascending: false });
    setLoteVendas((data as any) ?? []);
    setLoadingLoteVendas(false);
  };

  const abrirModalFechamento = async () => {
    setDataEmissao(todayIso());
    setObservacaoFechamento("");
    setPendingTodos([]);
    setModalFechamento(true);
    setLoadingPending(true);
    const { data } = await supabase
      .from("vendas" as any)
      .select("id, data_venda, secretaria_id, itens_venda(quantidade, preco_unitario)")
      .is("lote_faturamento_id", null);
    setPendingTodos((data as any) ?? []);
    setLoadingPending(false);
  };

  const confirmarFechamento = async () => {
    if (pendingTodos.length === 0 || fechando) return;
    setFechando(true);

    const datas = pendingTodos.map((v) => v.data_venda).sort();
    const periodoInicio = datas[0];
    const periodoFim = datas[datas.length - 1];
    const valorTotal = pendingTodos.reduce(
      (acc, v) =>
        acc +
        v.itens_venda.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0),
      0,
    );

    const { data: loteData, error } = await (supabase as any)
      .from("lote_faturamento")
      .insert({
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        data_fechamento: dataEmissao,
        valor_total: valorTotal,
        quantidade_vendas: pendingTodos.length,
        observacao: observacaoFechamento.trim() || null,
      })
      .select("id")
      .single();

    if (error || !loteData) {
      setFechando(false);
      return;
    }

    const ids = pendingTodos.map((v) => v.id);

    const { error: updateError } = await supabase
      .from("vendas")
      .update({
        lote_faturamento_id: loteData.id,
      })
      .in("id", ids);

    if (updateError) {
      console.error(updateError);
      setFechando(false);
      return;
    }

    setFechando(false);
    setModalFechamento(false);
    setPendingTodos([]);

    await carregar();
    await carregarLotes();

    setTabAtiva("historico");
  };

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

  // ---- Computados: Modal ----
  const pendingTotalValor = useMemo(
    () =>
      pendingTodos.reduce(
        (acc, v) =>
          acc +
          v.itens_venda.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0),
        0,
      ),
    [pendingTodos],
  );
  const pendingDatas = useMemo(() => pendingTodos.map((v) => v.data_venda).sort(), [pendingTodos]);
  const pendingPeriodoInicio = pendingDatas[0] ?? "";
  const pendingPeriodoFim = pendingDatas[pendingDatas.length - 1] ?? "";
  const pendingSecretariasCount = useMemo(
    () => new Set(pendingTodos.map((v) => v.secretaria_id)).size,
    [pendingTodos],
  );

  // ---- Computados: Lote detalhe ----
  const loteGrupos = useMemo(() => {
    const map = new Map<string, { vendas: Row[]; total: number }>();
    for (const v of loteVendas) {
      const prefNome = v.prefeitura?.nome ?? "—";
      const nome = v.secretaria ? `${prefNome} - ${v.secretaria.nome}` : prefNome;
      const g = map.get(nome) ?? { vendas: [], total: 0 };
      g.vendas.push(v);
      g.total += totalVenda(v);
      map.set(nome, g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [loteVendas]);

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

  // ---- PDF: Histórico ----
  const gerarLotePDF = (lote: LoteFaturamento, abrir: boolean) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const periodo = `${formatDate(lote.periodo_inicio)} a ${formatDate(lote.periodo_fim)}`;

    doc.setFontSize(18);
    doc.text("Verdurão Miranda", 14, 14);
    doc.setFontSize(10);
    doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
    doc.setFontSize(16);
    doc.text("Histórico de Faturamento", 14, 30);
    doc.setFontSize(10);
    doc.text(`Período: ${periodo}`, 14, 37);
    doc.text(`Fechamento: ${formatDate(lote.data_fechamento)}`, 14, 43);

    let y = 50;

    for (const [nome, g] of loteGrupos) {
      doc.setFillColor(34, 139, 67);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.rect(14, y, pageW - 28, 8, "F");
      doc.text(nome, 16, y + 5.5);
      doc.text(`Total: ${formatCurrency(g.total)}`, pageW - 16, y + 5.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 10;

      for (let vendaIdx = 0; vendaIdx < g.vendas.length; vendaIdx++) {
        const v = g.vendas[vendaIdx];
        const totalVendaAtual = totalVenda(v);

        doc.setFillColor(220, 230, 220);
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.rect(14, y, pageW - 28, 6, "F");
        doc.text(`Venda ${vendaIdx + 1} - ${formatDate(v.data_venda)}`, 16, y + 4);
        doc.text(`${formatCurrency(totalVendaAtual)}`, pageW - 16, y + 4, { align: "right" });
        doc.setTextColor(0, 0, 0);
        y += 6;

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

        if (v.observacao) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const obsText = `Obs: ${v.observacao}`;
          const lines = doc.splitTextToSize(obsText, pageW - 32);
          doc.text(lines, 16, y);
          y += lines.length * 3 + 2;
          doc.setTextColor(0, 0, 0);
        }

        y += 2;

        if (y > doc.internal.pageSize.getHeight() - 50 && vendaIdx < g.vendas.length - 1) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Verdurão Miranda", 14, 14);
          doc.setFontSize(9);
          doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
          y = 28;
        }
      }

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
        doc.setFontSize(14);
        doc.text("Verdurão Miranda", 14, 14);
        doc.setFontSize(9);
        doc.text("Cliente: Prefeitura Municipal de São José de Piranhas", 14, 20);
        y = 28;
      }
    }

    doc.setFillColor(34, 139, 67);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.rect(14, y, pageW - 28, 10, "F");
    doc.text("TOTAL GERAL", 16, y + 6.5);
    doc.text(formatCurrency(lote.valor_total), pageW - 16, y + 6.5, { align: "right" });

    if (abrir) {
      doc.output("dataurlnewwindow");
    } else {
      doc.save(`fechamento-${lote.data_fechamento}.pdf`);
    }
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Relatórios</h2>

      <Tabs
        value={tabAtiva}
        onValueChange={(v) => {
          setTabAtiva(v as "pendentes" | "historico");
          if (v === "historico") {
            setLoteSelected(null);
            carregarLotes();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pendentes">Pendentes de Faturamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ===== PENDENTES ===== */}
        <TabsContent value="pendentes" className="space-y-4">
          <Card className="p-3 space-y-3">
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
                <TrendingUp className="h-4 w-4" /> Total Pendente
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalGeral)}</p>
              <p className="text-xs opacity-80 mt-1">{rows.length} vendas pendentes</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" /> Grupos
              </div>
              <p className="text-2xl font-bold mt-1 text-primary">{grupos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Set(rows.map((r) => r.secretaria?.nome).filter(Boolean)).size} Secretarias
              </p>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={abrirModalFechamento} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Fechar Faturamento
            </Button>
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
                <p className="text-center text-muted-foreground py-12">Sem vendas pendentes.</p>
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
                                                {formatNumber(Number(it.quantidade), 3)}{" "}
                                                {it.unidade}
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
                <p className="text-center text-muted-foreground py-12">Sem vendas pendentes.</p>
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
                                  Mostrar mais {item.produtos.length - MAX_PRODUTOS_VISIVEL}{" "}
                                  produtos
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
        </TabsContent>

        {/* ===== HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          {loteSelected ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoteSelected(null)}
                className="gap-2 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao histórico
              </Button>

              <h3 className="text-lg font-bold">Fechamento #{loteNumero}</h3>

              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Período</p>
                    <p className="font-medium">
                      {formatDate(loteSelected.periodo_inicio)} até{" "}
                      {formatDate(loteSelected.periodo_fim)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data do fechamento</p>
                    <p className="font-medium">{formatDate(loteSelected.data_fechamento)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p className="font-semibold text-primary text-lg">
                      {formatCurrency(loteSelected.valor_total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quantidade de vendas</p>
                    <p className="font-medium">{loteSelected.quantidade_vendas}</p>
                  </div>
                </div>
                {loteSelected.observacao && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground">Observação</p>
                      <p className="text-sm mt-1">{loteSelected.observacao}</p>
                    </div>
                  </>
                )}
              </Card>

              {loadingLoteVendas ? (
                <p className="text-center text-muted-foreground py-8">Carregando detalhes…</p>
              ) : (
                <>
                  <Card className="p-4">
                    <p className="text-sm font-semibold mb-3">Secretarias</p>
                    <div className="space-y-1">
                      {loteGrupos.map(([nome]) => (
                        <p key={nome} className="text-sm text-muted-foreground">
                          {nome}
                        </p>
                      ))}
                    </div>
                  </Card>

                  <Card className="overflow-hidden">
                    <div
                      className="p-3"
                      style={{ background: "var(--gradient-primary)", color: "white" }}
                    >
                      <p className="font-semibold text-sm">Resumo por Secretaria</p>
                    </div>
                    <div className="divide-y">
                      {loteGrupos.map(([nome, g]) => (
                        <div key={nome} className="p-3 flex items-center justify-between text-sm">
                          <span>{nome}</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(g.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={loteVendas.length === 0}
                      onClick={() => gerarLotePDF(loteSelected, true)}
                    >
                      <Eye className="h-4 w-4" /> Visualizar PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={loteVendas.length === 0}
                      onClick={() => gerarLotePDF(loteSelected, false)}
                    >
                      <Download className="h-4 w-4" /> Baixar PDF
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {loadingLotes ? (
                <p className="text-center text-muted-foreground py-12">Carregando…</p>
              ) : lotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  Nenhum fechamento realizado ainda.
                </p>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Data</th>
                          <th className="text-left p-3 font-medium">Período</th>
                          <th className="text-right p-3 font-medium">Vendas</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lotes.map((lote, idx) => (
                          <tr
                            key={lote.id}
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setLoteSelected(lote);
                              setLoteNumero(lotes.length - idx);
                              setLoteVendas([]);
                              carregarLoteVendas(lote.id);
                            }}
                          >
                            <td className="p-3 font-medium">{formatDate(lote.data_fechamento)}</td>

                            <td className="p-3 text-muted-foreground">
                              {formatDate(lote.periodo_inicio)} – {formatDate(lote.periodo_fim)}
                            </td>

                            <td className="p-3 text-right">{lote.quantidade_vendas}</td>

                            <td className="p-3 text-right font-semibold text-primary">
                              {formatCurrency(lote.valor_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== MODAL FECHAR FATURAMENTO ===== */}
      <Dialog open={modalFechamento} onOpenChange={setModalFechamento}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Fechamento</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Todas as vendas pendentes serão marcadas como faturadas e deixarão de aparecer no
            relatório principal.
          </p>

          {loadingPending ? (
            <p className="text-center text-muted-foreground py-4">Carregando dados…</p>
          ) : pendingTodos.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Não há vendas pendentes para fechar.
            </p>
          ) : (
            <div className="space-y-3">
              <Separator />

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {pendingPeriodoInicio ? formatDate(pendingPeriodoInicio) : "—"} até{" "}
                    {pendingPeriodoFim ? formatDate(pendingPeriodoFim) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Secretarias</p>
                  <p className="font-medium">{pendingSecretariasCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Geral</p>
                  <p className="font-semibold text-primary">{formatCurrency(pendingTotalValor)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantidade de vendas</p>
                  <p className="font-medium">{pendingTodos.length}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Data da emissão</Label>
                  <Input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Observação (opcional)</Label>
                  <Textarea
                    placeholder="Informe uma observação se necessário…"
                    value={observacaoFechamento}
                    onChange={(e) => setObservacaoFechamento(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={confirmarFechamento}
              disabled={fechando || loadingPending || pendingTodos.length === 0}
              className="w-full gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {fechando ? "Fechando…" : "Confirmar Fechamento"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalFechamento(false)}
              disabled={fechando}
              className="w-full"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
