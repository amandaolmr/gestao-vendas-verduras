import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "10000", 10);
const HOST = "0.0.0.0";

console.log("🚀 Starting production server...");

// Importa o worker entry do TanStack Start
const workerEntryPath = join(__dirname, "dist/server/index.js");

if (!existsSync(workerEntryPath)) {
  console.error("❌ Error: dist/server/index.js not found!");
  console.error('Run "npm run build" first.');
  process.exit(1);
}

// Importa o módulo do servidor
const serverModule = await import(workerEntryPath);
const workerHandler = serverModule.default;

console.log("📦 Server module loaded:", typeof workerHandler);

// Cria servidor HTTP
const server = createServer(async (req, res) => {
  try {
    // Monta URL completa
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const url = `${protocol}://${host}${req.url}`;

    // Cria objeto de ambiente para o handler
    const env = {
      ASSETS: {
        fetch: async (request) => {
          // Para assets estáticos, retorna 404
          return new Response("Not Found", { status: 404 });
        },
      },
    };

    // Cria contexto de execução
    const ctx = {
      waitUntil: (promise) => {},
      passThroughOnException: () => {},
    };

    // Cria Request Web API
    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => acc.append(key, v));
        } else if (value) {
          acc.append(key, value);
        }
        return acc;
      }, new Headers()),
    });

    // Chama o handler com os parâmetros corretos
    const response = await workerHandler.fetch(request, env, ctx);

    // Converte Response Web API para resposta Node.js
    res.statusCode = response.status;

    // Define headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Envia body
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }

    res.end();
  } catch (error) {
    console.error("❌ Server error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📝 Environment: production`);
  console.log(`🌐 Ready to accept connections`);
});

// Tratamento de erros
server.on("error", (error) => {
  console.error("❌ Server error:", error);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("📡 SIGTERM received, closing server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("📡 SIGINT received, closing server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
