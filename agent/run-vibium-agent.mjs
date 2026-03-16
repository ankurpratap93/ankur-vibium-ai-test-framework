/**
 * AI Agent using Claude (Anthropic) + MCP for browser automation.
 * Rebuilt by Ankur Pratap — swaps OpenAI for Claude, adds structured reporting.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const agentReportsDir = path.join(repoRoot, "reports", "ai-agent");

// ─── Env loader ──────────────────────────────────────────────────────
function loadEnvFile() {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf("=");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = line.slice(sep + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile();

const debugEnabled = process.env.K11_DEBUG === "true" || process.env.AGENT_DEBUG === "true";
function debugLog(...args) { if (debugEnabled) console.log("[agent-debug]", ...args); }

// ─── Claude API call ─────────────────────────────────────────────────
async function callClaude(messages, tools = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set. Add it to your .env file.");
    console.error("Get one at: https://console.anthropic.com/");
    process.exit(1);
  }

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
  const body = {
    model,
    max_tokens: 4096,
    system: `You are an expert QA automation agent. You control a real browser through MCP tools.
Your job is to accomplish the user's goal by navigating, clicking, typing, and verifying page content.
Always verify your actions by reading page text or checking URLs after navigation.
When the goal is achieved, clearly state what you verified and found.`,
    messages,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description || "",
      input_schema: t.inputSchema || { type: "object", properties: {} },
    }));
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  return response.json();
}

// ─── MCP client setup ────────────────────────────────────────────────
async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join(repoRoot, "mcp-server", "vibium-mcp-server.ts")],
    env: { ...process.env },
  });

  const client = new Client({ name: "vibium-agent", version: "2.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

// ─── Tool execution ──────────────────────────────────────────────────
async function executeTool(mcpClient, toolName, toolInput) {
  debugLog(`Calling tool: ${toolName}`, JSON.stringify(toolInput));
  const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
  debugLog(`Tool result:`, JSON.stringify(result).slice(0, 500));
  return result;
}

// ─── Report generation ───────────────────────────────────────────────
function saveReport(goal, actions, status, startTime) {
  if (!fs.existsSync(agentReportsDir)) fs.mkdirSync(agentReportsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    goal,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    status,
    actions,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  const jsonPath = path.join(agentReportsDir, `agent-run-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const htmlPath = path.join(agentReportsDir, `agent-run-${ts}.html`);
  const actionsHtml = actions.map((a, i) => `
    <div style="margin:8px 0;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid ${a.error ? '#dc3545' : '#28a745'}">
      <strong>Step ${i + 1}: ${a.tool}</strong><br/>
      <code>${JSON.stringify(a.params).slice(0, 200)}</code><br/>
      <em>${a.resultText?.slice(0, 300) || ''}</em>
    </div>`).join("");

  fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Agent Run Report</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:20px;color:#333}
h1{color:#1a1a2e}code{background:#e9ecef;padding:2px 6px;border-radius:4px;font-size:0.85em}
.badge{display:inline-block;padding:4px 12px;border-radius:12px;color:#fff;font-weight:600}
.passed{background:#28a745}.failed{background:#dc3545}</style></head><body>
<h1>Agent Run Report</h1>
<p><strong>Goal:</strong> ${goal}</p>
<p><strong>Model:</strong> ${report.model}</p>
<p><strong>Status:</strong> <span class="badge ${status}">${status}</span></p>
<p><strong>Duration:</strong> ${(report.duration / 1000).toFixed(1)}s</p>
<h2>Actions (${actions.length})</h2>${actionsHtml}</body></html>`);

  console.log(`\nReports saved:\n  ${jsonPath}\n  ${htmlPath}`);
}

// ─── Main agent loop ─────────────────────────────────────────────────
async function main() {
  const goal = process.argv.slice(2).join(" ") || "Open https://k11softwaresolutions.com and verify the homepage loads.";
  console.log(`\n🤖 Vibium AI Agent (Claude)\n📎 Goal: ${goal}\n`);

  const startTime = Date.now();
  const mcpClient = await createMcpClient();
  const toolsList = await mcpClient.listTools();
  const tools = toolsList.tools || [];
  debugLog(`Available tools: ${tools.map(t => t.name).join(", ")}`);

  const messages = [{ role: "user", content: goal }];
  const actions = [];
  const MAX_TURNS = 15;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await callClaude(messages, tools);
      const assistantContent = response.content || [];

      // Check if Claude wants to use tools
      const toolUses = assistantContent.filter(b => b.type === "tool_use");
      const textBlocks = assistantContent.filter(b => b.type === "text");

      if (toolUses.length === 0) {
        // No more tool calls — agent is done
        const finalText = textBlocks.map(b => b.text).join("\n");
        console.log(`\n✅ Agent completed:\n${finalText}`);
        messages.push({ role: "assistant", content: assistantContent });
        saveReport(goal, actions, "passed", startTime);
        return;
      }

      // Push assistant message with tool_use blocks
      messages.push({ role: "assistant", content: assistantContent });

      // Execute each tool
      const toolResults = [];
      for (const toolUse of toolUses) {
        console.log(`  🔧 ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 100)})`);
        try {
          const result = await executeTool(mcpClient, toolUse.name, toolUse.input);
          const resultText = (result.content || []).map(c => c.text || "").join("\n");
          console.log(`     → ${resultText.slice(0, 120)}`);
          actions.push({ tool: toolUse.name, params: toolUse.input, resultText, timestamp: new Date().toISOString() });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: resultText });
        } catch (err) {
          const errMsg = `Tool error: ${err.message}`;
          console.error(`     ❌ ${errMsg}`);
          actions.push({ tool: toolUse.name, params: toolUse.input, error: errMsg, timestamp: new Date().toISOString() });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: errMsg, is_error: true });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    console.log("\n⚠️ Max turns reached.");
    saveReport(goal, actions, "failed", startTime);
  } catch (err) {
    console.error(`\n💥 Agent error: ${err.message}`);
    saveReport(goal, actions, "failed", startTime);
  } finally {
    await mcpClient.close().catch(() => {});
  }
}

main().catch(console.error);
