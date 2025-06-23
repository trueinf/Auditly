// cli/AIOrchestrator.js
import { ingest } from "./lib/ingest.js";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function auditWithAI(inputPath = "./") {
  const files = await ingest(inputPath);

  const prompt = `
You are an expert software auditor. Review the following code files and point out:
- Architecture issues
- Security flaws
- Best practice violations
- Suggestions for improvements

Respond in bullet points.

${files.map(f => `File: ${f.path}\nContent:\n${f.content}`).join("\n\n")}
`;

  const result = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o",
  });

  return result.choices[0].message.content;
}
