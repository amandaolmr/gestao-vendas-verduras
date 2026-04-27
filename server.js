import { preview } from "vite";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "10000", 10);

const server = await preview({
  preview: {
    port: PORT,
    host: "0.0.0.0",
    strictPort: true,
  },
  root: __dirname,
});

console.log(`Server running on http://0.0.0.0:${PORT}`);
