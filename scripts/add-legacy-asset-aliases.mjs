import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const DIST_ASSETS = resolve(process.cwd(), "dist", "assets");

const JS_ALIASES = ["index-BME_6jBG.js", "index-dYLlDzTQ.js", "index--mb0bJp4.js"];
const CSS_ALIASES = ["index-Cr8F-fHi.css", "index-DO63v_NP.css"];

async function copyAliases(sourceFile, aliases) {
  for (const alias of aliases) {
    const sourcePath = resolve(DIST_ASSETS, sourceFile);
    const targetPath = resolve(DIST_ASSETS, alias);
    await copyFile(sourcePath, targetPath);
  }
}

async function main() {
  await copyAliases("app.js", JS_ALIASES);
  await copyAliases("app.css", CSS_ALIASES);
  console.log("Added legacy asset aliases for cached GitHub Pages HTML.");
}

main().catch((error) => {
  console.error("Failed to create legacy asset aliases:", error);
  process.exit(1);
});
