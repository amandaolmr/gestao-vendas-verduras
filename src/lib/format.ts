export const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatNumber = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const todayIso = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const UNIDADES = ["kg", "un", "cx", "dz", "g", "L"] as const;
