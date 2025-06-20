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

// Initialize OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is required in .env file");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CLONE_DIR = path.join(__dirname, "clones");

// Ensure clones directory exists
if (!fs.existsSync(CLONE_DIR)) {
  fs.mkdirSync(CLONE_DIR, { recursive: true });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Clone repository endpoint
app.post("/api/clone", (req, res) => {
  const { repoUrl } = req.body;
  
  if (!repoUrl) {
    return res.status(400).json({ error: "Repository URL is required" });
  }

  // Validate GitHub URL
  if (!repoUrl.includes("github.com")) {
    return res.status(400).json({ error: "Please provide a valid GitHub repository URL" });
  }

  const repoName = repoUrl.split("/").pop().replace(".git", "");
  const timestamp = Date.now();
  const repoPath = path.join(CLONE_DIR, `${repoName}-${timestamp}`);

  try {
    console.log(`🔄 Cloning repository: ${repoUrl}`);
    
    // Clone with shallow depth for faster cloning
    execSync(`git clone --depth=1 "${repoUrl}" "${repoPath}"`, { 
      stdio: 'pipe',
      timeout: 30000 // 30 second timeout
    });
    
    console.log(`✅ Repository cloned to: ${repoPath}`);
    res.json({ 
      message: "Repository cloned successfully",
      path: repoPath,
      repoName: repoName
    });
  } catch (err) {
    console.error(`❌ Clone failed: ${err.message}`);
    res.status(500).json({ 
      error: "Failed to clone repository",
      details: err.message.includes("not found") ? "Repository not found or not accessible" : "Clone operation failed"
    });
  }
});

// AI audit endpoint
app.post("/api/audit", async (req, res) => {
  const { path: repoPath } = req.body;
  
  if (!repoPath) {
    return res.status(400).json({ error: "Repository path is required" });
  }

  if (!fs.existsSync(repoPath)) {
    return res.status(400).json({ error: "Repository path does not exist" });
  }

  let files;
  try {
    console.log(`🔍 Analyzing repository at: ${repoPath}`);
    files = await ingest(repoPath);
    
    // Filter and limit files for analysis
    files = files.filter(f => {
      // Skip large files and common non-essential files
      if (f.content.length > 10000) return false;
      if (f.path.includes("node_modules")) return false;
      if (f.path.includes(".git")) return false;
      if (f.path.includes("dist/") || f.path.includes("build/")) return false;
      if (f.path.includes("coverage/")) return false;
      return true;
    }).slice(0, 20); // Limit to first 20 files to avoid token limits

  } catch (err) {
    console.error(`❌ Failed to analyze repository: ${err.message}`);
    return res.status(500).json({ 
      error: "Failed to analyze repository structure",
      details: err.message
    });
  }

  if (!files.length) {
    return res.status(400).json({ 
      error: "No analyzable code files found in the repository"
    });
  }

  // Create comprehensive audit prompt
  const fileContents = files
    .map(f => `### File: ${f.path.replace(repoPath, '')}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are an expert software security auditor and code reviewer. Analyze the following codebase and provide a comprehensive audit report.

Focus on:
🔒 **Security Vulnerabilities** - Authentication flaws, input validation, SQL injection, XSS, etc.
🏗️ **Architecture Issues** - Code organization, separation of concerns, scalability
⚡ **Performance Problems** - Inefficient algorithms, memory leaks, blocking operations  
🧹 **Code Quality** - Best practices, maintainability, error handling
📋 **Dependencies** - Outdated packages, security advisories

Provide specific, actionable recommendations with code examples where helpful.

**Repository Analysis:**
${fileContents.slice(0, 20000)}

Please structure your response with clear sections and bullet points for easy reading.`;

  const tokens = encode(prompt);
  console.log(`📊 Prompt contains ${tokens.length} tokens`);

  if (tokens.length > 25000) {
    return res.status(400).json({ 
      error: "Repository is too large for analysis",
      details: "Please try with a smaller repository or contact support"
    });
  }

  try {
    console.log(`🤖 Starting AI analysis...`);
    const startTime = Date.now();
    
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using mini for cost efficiency
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ AI analysis completed in ${duration}ms`);
    console.log(`📊 Token usage - Prompt: ${result.usage.prompt_tokens}, Completion: ${result.usage.completion_tokens}, Total: ${result.usage.total_tokens}`);

    // Clean up cloned repository after analysis
    setTimeout(() => {
      try {
        if (fs.existsSync(repoPath)) {
          fs.rmSync(repoPath, { recursive: true, force: true });
          console.log(`🧹 Cleaned up: ${repoPath}`);
        }
      } catch (cleanupErr) {
        console.warn(`⚠️ Failed to cleanup: ${cleanupErr.message}`);
      }
    }, 5000); // Cleanup after 5 seconds

    res.json({
      summary: result.choices[0].message.content,
      usage: result.usage,
      filesAnalyzed: files.length,
      analysisTime: duration
    });

  } catch (err) {
    console.error(`❌ AI analysis failed: ${err.message}`);
    res.status(500).json({ 
      error: "AI analysis failed",
      details: err.message.includes("rate_limit") ? "Rate limit exceeded. Please try again later." : "Analysis service temporarily unavailable"
    });
  }
});

// Serve static files from React build
const uiBuildPath = path.join(__dirname, "ai-auditor-ui", "dist");
if (fs.existsSync(uiBuildPath)) {
  app.use(express.static(uiBuildPath));
  
  // Handle React routing
  app.get("*", (req, res) => {
    res.sendFile(path.join(uiBuildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ 
      message: "AI Code Auditor API",
      endpoints: {
        health: "GET /api/health",
        clone: "POST /api/clone",
        audit: "POST /api/audit"
      },
      note: "Frontend not built. Run 'npm run build-ui' to build the React frontend."
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AI Code Auditor server running at http://localhost:${PORT}`);
  console.log(`📁 Clone directory: ${CLONE_DIR}`);
  console.log(`🔑 OpenAI API configured: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
});