import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";

import appCss from "../styles.css?url";
import faviconSvg from "../favicon.svg?url";
import manifestJson from "../manifest.json?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gestão Vendas Verdurão" },
      {
        name: "description",
        content: "Controle de vendas de frutas, verduras e legumes para secretarias da prefeitura.",
      },
      { property: "og:title", content: "Gestão Vendas Verdurão" },
      { name: "twitter:title", content: "Gestão Vendas Verdurão" },
      {
        property: "og:description",
        content: "Controle de vendas de frutas, verduras e legumes para secretarias da prefeitura.",
      },
      {
        name: "twitter:description",
        content: "Controle de vendas de frutas, verduras e legumes para secretarias da prefeitura.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#22c55e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: faviconSvg },
      { rel: "manifest", href: manifestJson },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <Toaster richColors position="top-center" />
    </>
  );
}
