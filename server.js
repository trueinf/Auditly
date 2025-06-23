import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";
import { ingest } from "./cli/lib/ingest.js";
import OpenAI from "openai";
import { encode } from "gpt-tokenizer";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CLONE_DIR = path.join(__dirname, "clones");

// Clone repo
app.post("/api/clone", (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });

  const repoName = repoUrl.split("/").pop().replace(".git", "");
  const repoPath = path.join(CLONE_DIR, repoName);

  try {
    if (fs.existsSync(repoPath)) fs.rmSync(repoPath, { recursive: true });
    execSync(`git clone --depth=1 ${repoUrl} ${repoPath}`);
    console.log("✅ Repo cloned to:", repoPath);
    res.json({ path: repoPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Non-streaming AI audit
app.post("/api/audit", async (req, res) => {
  const { path: repoPath } = req.body;
  if (!repoPath) return res.status(400).json({ error: "Missing path" });

  let files;
  try {
    files = await ingest(repoPath);
    files = files.filter(
      (f) =>
        !f.path.includes("node_modules") &&
        !f.path.includes(".git") &&
        f.content.length < 8000 // filter large files
    );
  } catch (err) {
    return res.status(500).json({ error: `Failed to ingest repo: ${err.message}` });
  }

  if (!files.length) {
    return res.status(400).json({ error: "No code files found to audit." });
  }

  const prompt = `
You are an expert software auditor. Analyze the following code and point out:
- Architecture flaws
- Security vulnerabilities
- Bad practices
- Suggestions for improvement

Use markdown bullet points. Give at least some feedback even for clean code.

${files
  .map((f) => `File: ${f.path}\nContent:\n${f.content}`)
  .join("\n\n")
  .slice(0, 24000)}
`;

  const tokens = encode(prompt);
  console.log(`🔍 Prompt tokens: ${tokens.length}`);

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o", // or "gpt-3.5-turbo"
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    console.log("📊 Token usage:");
    console.log("Prompt tokens:", result.usage.prompt_tokens);
    console.log("Completion tokens:", result.usage.completion_tokens);
    console.log("Total tokens:", result.usage.total_tokens);

    res.json({
      summary: result.choices[0].message.content,
      usage: result.usage,
    });
  } catch (err) {
    console.error("AI audit error:", err.message);
    res.status(500).json({ error: "AI audit failed", message: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "ui", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "ui", "dist", "index.html"));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
