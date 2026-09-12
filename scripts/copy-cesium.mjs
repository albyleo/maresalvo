// Copia gli asset statici di Cesium (Workers, Assets, Widgets, ThirdParty)
// in public/cesium, così il viewer 3D li carica a runtime via CESIUM_BASE_URL=/cesium.
// Eseguito automaticamente da `npm install` (postinstall).
import { cp, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(src))) {
    console.warn(
      "[copy-cesium] node_modules/cesium non trovato — salto la copia degli asset. " +
        "Esegui di nuovo dopo `npm install`."
    );
    return;
  }
  await mkdir(dest, { recursive: true });
  for (const dir of ["Workers", "Assets", "Widgets", "ThirdParty"]) {
    const from = join(src, dir);
    if (await exists(from)) {
      await cp(from, join(dest, dir), { recursive: true });
    }
  }
  console.log("[copy-cesium] asset Cesium copiati in public/cesium");
}

main().catch((e) => {
  console.warn("[copy-cesium] errore non bloccante:", e?.message ?? e);
});
