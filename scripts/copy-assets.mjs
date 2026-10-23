import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist/client", { recursive: true });
await copyFile("src/client/styles.css", "dist/client/styles.css");
