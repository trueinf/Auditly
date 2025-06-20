// cli/lib/ingest.js
import fs from "fs";
import path from "path";

const IGNORED_DIRS = ["node_modules", ".git", "dist", "build"];
const IGNORED_FILES = [".test.js", ".spec.js", ".config.js"];
const ALLOWED_EXTS = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".java",".yml",".py",".json"];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);

    // Skip ignored directories
    if (stat.isDirectory()) {
      if (IGNORED_DIRS.some(d => filepath.includes(d))) continue;
      walk(filepath, fileList);
    } else {
      const ext = path.extname(file);
      const shouldIgnore = IGNORED_FILES.some(suffix => file.endsWith(suffix));

      if (ALLOWED_EXTS.includes(ext) && !shouldIgnore) {
        const content = fs.readFileSync(filepath, "utf-8");
        fileList.push({ path: filepath, content });
      }
    }
  }

  return fileList;
}

export async function ingest(basePath = "./") {
  console.log(`🔍 Ingesting from: ${basePath}`);
  if (!fs.existsSync(basePath)) {
    throw new Error(`Directory does not exist: ${basePath}`);
  }
  return walk(basePath);
}
