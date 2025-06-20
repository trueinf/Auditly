import fs from "fs";
import path from "path";

const IGNORED_DIRS = [
  "node_modules", 
  ".git", 
  "dist", 
  "build", 
  "coverage",
  ".next",
  ".nuxt",
  "vendor",
  "target",
  "bin",
  "obj"
];

const IGNORED_FILES = [
  ".test.js", 
  ".spec.js", 
  ".config.js",
  ".min.js",
  ".bundle.js",
  "package-lock.json",
  "yarn.lock",
  ".DS_Store"
];

const ALLOWED_EXTS = [
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".java", ".py", ".rb", ".php", ".go", ".rs",
  ".c", ".cpp", ".h", ".hpp",
  ".json", ".yml", ".yaml", ".xml",
  ".sql", ".md", ".txt"
];

function walk(dir, fileList = [], maxDepth = 5, currentDepth = 0) {
  if (currentDepth > maxDepth) return fileList;

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filepath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(filepath);

        if (stat.isDirectory()) {
          // Skip ignored directories
          if (IGNORED_DIRS.some(d => file === d || filepath.includes(d))) {
            continue;
          }
          walk(filepath, fileList, maxDepth, currentDepth + 1);
        } else {
          const ext = path.extname(file).toLowerCase();
          const shouldIgnore = IGNORED_FILES.some(suffix => file.endsWith(suffix));

          if (ALLOWED_EXTS.includes(ext) && !shouldIgnore && stat.size < 100000) { // Skip files > 100KB
            try {
              const content = fs.readFileSync(filepath, "utf-8");
              // Skip binary files that might have been misidentified
              if (content.includes('\0')) continue;
              
              fileList.push({ 
                path: filepath, 
                content: content.slice(0, 10000) // Limit content to 10KB per file
              });
            } catch (readErr) {
              console.warn(`⚠️ Could not read file: ${filepath}`);
            }
          }
        }
      } catch (statErr) {
        console.warn(`⚠️ Could not stat: ${filepath}`);
      }
    }
  } catch (dirErr) {
    console.warn(`⚠️ Could not read directory: ${dir}`);
  }

  return fileList;
}

export async function ingest(basePath = "./") {
  console.log(`🔍 Ingesting files from: ${basePath}`);
  
  if (!fs.existsSync(basePath)) {
    throw new Error(`Directory does not exist: ${basePath}`);
  }

  const files = walk(basePath);
  console.log(`📁 Found ${files.length} files to analyze`);
  
  return files;
}