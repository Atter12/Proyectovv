const fs = require("fs");
const path = require("path");

function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (b && typeof b === "object") {
    const out = { ...(a && typeof a === "object" ? a : {}) };
    for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
    return out;
  }
  return b;
}

const patchEs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "phase4-patch-es.json"), "utf8"),
);
const patchEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "phase4-patch-en.json"), "utf8"),
);
const patchPt = JSON.parse(
  fs.readFileSync(path.join(__dirname, "phase4-patch-pt.json"), "utf8"),
);

for (const [file, patch] of [
  ["es.json", patchEs],
  ["en.json", patchEn],
  ["pt-BR.json", patchPt],
]) {
  const p = path.join(__dirname, "..", "messages", file);
  const cur = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify(deepMerge(cur, patch), null, 2) + "\n");
  console.log("ok", file);
}
