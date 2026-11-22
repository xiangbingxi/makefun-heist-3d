import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

await mkdir(out, { recursive: true });
await cp(join(root, "game"), join(out, "game"), { recursive: true });
await cp(join(root, "screenshots"), join(out, "screenshots"), { recursive: true });
const bytes = await buildDossier(out, caps);
await writeFile(join(out, "dossier.json"), bytes);
console.log("wrote dossier.json (" + bytes.byteLength + " bytes)");
