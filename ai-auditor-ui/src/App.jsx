import React, { useState } from "react";
import axios from "axios";

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const resetState = () => {
    setStatus("");
    setResult("");
    setError("");
  };

  const startAudit = async () => {
    if (!repoUrl.trim()) {
      setError("Please enter a repository URL");
      return;
    }

    if (!repoUrl.includes("github.com")) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }

    setIsLoading(true);
    resetState();

    try {
      // Step 1: Clone repository
      setStatus("📥 Cloning repository...");
      const cloneResponse = await axios.post("/api/clone", { repoUrl }, {
        headers: { "Content-Type": "application/json" },
        timeout: 45000 // 45 second timeout
      });

      if (cloneResponse.data.error) {
        throw new Error(cloneResponse.data.error);
      }

      // Step 2: Run AI audit
      setStatus("🤖 Running AI analysis...");
      const auditResponse = await axios.post("/api/audit", { 
        path: cloneResponse.data.path 
      }, {
        headers: { "Content-Type": "application/json" },
        timeout: 60000 // 60 second timeout
      });

      if (auditResponse.data.error) {
        throw new Error(auditResponse.data.error);
      }

      // Step 3: Display results
      setStatus("✅ Analysis completed successfully!");
      
      const { summary, usage, filesAnalyzed, analysisTime } = auditResponse.data;
      const statsText = `\n\n---\n📊 **Analysis Statistics:**\n• Files analyzed: ${filesAnalyzed}\n• Analysis time: ${analysisTime}ms\n• Tokens used: ${usage?.total_tokens || 'N/A'} (Prompt: ${usage?.prompt_tokens || 'N/A'}, Completion: ${usage?.completion_tokens || 'N/A'})`;
      
      setResult((summary || "No analysis results returned") + statsText);

    } catch (err) {
      console.error("Audit error:", err);
      setStatus("❌ Analysis failed");
      
      if (err.code === 'ECONNABORTED') {
        setError("Request timed out. The repository might be too large or the server is busy.");
      } else if (err.response?.status === 429) {
        setError("Rate limit exceeded. Please try again in a few minutes.");
      } else if (err.response?.data?.details) {
        setError(err.response.data.details);
      } else {
        setError(err.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      startAudit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
            🔍 AI Code Auditor
          </h1>
          <p className="text-gray-600">
            Analyze GitHub repositories for security vulnerabilities, code quality issues, and best practices
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Repository URL
            </label>
            <input
              id="repoUrl"
              type="text"
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <button
            onClick={startAudit}
            disabled={isLoading || !repoUrl.trim()}
            className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                🚀 Run Security Audit
              </>
            )}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-800 font-medium">{status}</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium">❌ {error}</div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">📋 Audit Results</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap text-gray-800 leading-relaxed">
                {result}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-4 border-t">
          <p>Powered by OpenAI GPT-4 • Analyze responsibly • Keep your API keys secure</p>
        </div>
      </div>
    </div>
  );
}

export default App;