import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, existsSync } from "fs";

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

const { default: handler } = await import(workerEntryPath);

// Cria servidor HTTP
const server = createServer(async (req, res) => {
  try {
    // Converte requisição Node.js para Request Web API
    const url = `http://${req.headers.host}${req.url}`;
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

    // Chama o handler do TanStack Start
    const response = await handler(request, {});

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
