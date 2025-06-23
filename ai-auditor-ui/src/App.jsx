import React, { useState } from "react";
import axios from "axios";

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");

  const startAudit = async () => {
    setStatus("⏳ Cloning repository...");
    setResult("");

    try {
      const cloneRes = await axios.post("http://localhost:3000/api/clone", { repoUrl }, {
        headers: { "Content-Type": "application/json" }
      });
      if (cloneRes.data.error) throw new Error(cloneRes.data.error);

      setStatus("🔍 Running AI audit...");

   
      const auditRes = await axios.post("http://localhost:3000/api/audit", { path: cloneRes.data.path }, {
        headers: { "Content-Type": "application/json" },
      });
  
      if (auditRes.data.error) throw new Error(auditRes.data.error);
  
      setStatus("✅ Audit completed");
      //setResult(auditRes.data.summary || "No summary returned");
      setResult(
        (auditRes.data.summary || "No summary returned") +
        `\n\n---\n📊 Token Usage:\nPrompt: ${auditRes.data.usage?.prompt_tokens}\nCompletion: ${auditRes.data.usage?.completion_tokens}\nTotal: ${auditRes.data.usage?.total_tokens}`
      );
      
    } catch (err) {
      setStatus("❌ Error occurred");
      setResult(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">🔎 AI Code Auditor</h1>
        <input
          type="text"
          placeholder="Enter GitHub repo URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="w-full p-3 border rounded-lg"
        />
        <button
          onClick={startAudit}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Run Audit
        </button>
        <div className="text-sm text-gray-600">{status}</div>
        <pre className="bg-gray-100 p-4 text-sm whitespace-pre-wrap">{result}</pre>
      </div>
    </div>
  );
}

export default App;
