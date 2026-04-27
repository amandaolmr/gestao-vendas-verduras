import { Link, useLocation } from "@tanstack/react-router";
import { Home, Package, Building2, BarChart3, Plus, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Vendas", icon: Home },
  { to: "/nova-venda", label: "Nova", icon: Plus },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/secretarias", label: "Secretarias", icon: Building2 },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-foreground">Gestão Vendas Verdurão</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
