// Servidor de produção para TanStack Start no Render
const PORT = parseInt(process.env.PORT || "10000", 10);
const HOST = "0.0.0.0";

// Importa e inicia o servidor TanStack Start
const startServer = (await import("./dist/server/index.js")).default;

await startServer({
  port: PORT,
  host: HOST,
});

console.log(`Server running on http://${HOST}:${PORT}`);
