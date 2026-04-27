import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverJsContent = `// Auto-generated compatibility file
export * from './index.js';
`;

const targetPath = join(__dirname, "dist", "server", "server.js");

writeFileSync(targetPath, serverJsContent);

console.log("✓ Created dist/server/server.js for compatibility");
