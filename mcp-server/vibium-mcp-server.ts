/**
 * Vibium MCP Server — enhanced with more browser tools.
 * Rebuilt by Ankur Pratap — adds screenshot, evaluate, wait, and type tools.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { browser } from "vibium";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const require = createRequire(import.meta.url);

function ensureVibiumBinaryPath() {
  if (process.env.VIBIUM_BIN_PATH) return;
  try {
    const pkgPath = require.resolve("@vibium/win32-x64/package.json");
    process.env.VIBIUM_BIN_PATH = path.join(path.dirname(pkgPath), "bin", "vibium.exe");
  } catch { /* let Vibium handle it */ }
}

ensureVibiumBinaryPath();

const server = new McpServer({ name: "vibium-mcp-server", version: "2.0.0" });

let bro: any;
let page: any;

async function ensurePage() {
  if (!bro) bro = await browser.start();
  if (!page) page = typeof bro.newPage === "function" ? await bro.newPage() : await bro.page();
  return page;
}

async function safePageInfo() {
  const p = await ensurePage();
  return { url: await p.url(), title: await p.title() };
}

// ─── navigate ───
server.registerTool("navigate", {
  description: "Open a URL in the Vibium-controlled browser.",
  inputSchema: { url: z.string().url().describe("The URL to navigate to.") },
}, async ({ url }) => {
  const p = await ensurePage();
  await p.go(url);
  const info = await safePageInfo();
  return { content: [{ type: "text", text: `Navigated to ${info.url} (${info.title})` }], structuredContent: info };
});

// ─── get_page_info ───
server.registerTool("get_page_info", {
  description: "Get the current page URL and title.",
  inputSchema: {},
}, async () => {
  const info = await safePageInfo();
  return { content: [{ type: "text", text: `URL: ${info.url}\nTitle: ${info.title}` }], structuredContent: info };
});

// ─── read_page_text ───
server.registerTool("read_page_text", {
  description: "Read visible text from the current page.",
  inputSchema: { maxChars: z.number().int().min(200).max(8000).default(2000).describe("Max characters.") },
}, async ({ maxChars }) => {
  const p = await ensurePage();
  const text = await p.evaluate(`(() => (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, ${maxChars}))()`);
  return { content: [{ type: "text", text: String(text || "") }], structuredContent: { text: String(text || "") } };
});

// ─── click_selector ───
server.registerTool("click_selector", {
  description: "Click an element by CSS selector.",
  inputSchema: { selector: z.string().min(1).describe("CSS selector to click.") },
}, async ({ selector }) => {
  const p = await ensurePage();
  const el = await p.find(selector, { timeout: 5000 });
  await el.click();
  const info = await safePageInfo();
  return { content: [{ type: "text", text: `Clicked '${selector}'. Now at ${info.url}` }], structuredContent: { selector, ...info } };
});

// ─── type_text ───
server.registerTool("type_text", {
  description: "Type text into a focused element or a specific selector.",
  inputSchema: {
    text: z.string().describe("Text to type."),
    selector: z.string().optional().describe("Optional CSS selector to focus first."),
  },
}, async ({ text, selector }) => {
  const p = await ensurePage();
  if (selector) {
    const el = await p.find(selector, { timeout: 5000 });
    await el.click();
    await el.clear();
  }
  await p.keyboard.type(text);
  return { content: [{ type: "text", text: `Typed "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"${selector ? ` into ${selector}` : ''}` }] };
});

// ─── screenshot ───
server.registerTool("screenshot", {
  description: "Take a screenshot of the current page.",
  inputSchema: { fullPage: z.boolean().default(false).describe("Capture the full scrollable page.") },
}, async ({ fullPage }) => {
  const p = await ensurePage();
  const buffer = await p.screenshot({ fullPage });
  const base64 = Buffer.from(buffer).toString("base64");
  return { content: [{ type: "text", text: `Screenshot captured (${Math.round(buffer.length / 1024)}KB, fullPage=${fullPage})` }], structuredContent: { size: buffer.length, base64Preview: base64.slice(0, 100) + "..." } };
});

// ─── evaluate ───
server.registerTool("evaluate", {
  description: "Run arbitrary JavaScript in the browser page and return the result.",
  inputSchema: { expression: z.string().describe("JavaScript expression to evaluate.") },
}, async ({ expression }) => {
  const p = await ensurePage();
  const result = await p.evaluate(expression);
  const text = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
  return { content: [{ type: "text", text }], structuredContent: { result } };
});

// ─── wait_for_selector ───
server.registerTool("wait_for_selector", {
  description: "Wait for a CSS selector to appear on the page.",
  inputSchema: {
    selector: z.string().describe("CSS selector to wait for."),
    timeout: z.number().int().min(500).max(30000).default(5000).describe("Timeout in ms."),
  },
}, async ({ selector, timeout }) => {
  const p = await ensurePage();
  await p.find(selector, { timeout });
  return { content: [{ type: "text", text: `Element '${selector}' found within ${timeout}ms.` }] };
});

// ─── go_back ───
server.registerTool("go_back", {
  description: "Navigate back in browser history.",
  inputSchema: {},
}, async () => {
  const p = await ensurePage();
  await p.back();
  const info = await safePageInfo();
  return { content: [{ type: "text", text: `Navigated back to ${info.url}` }], structuredContent: info };
});

// ─── Start server ───
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[vibium-mcp-server] v2.0.0 ready on stdio");
}

main().catch(console.error);
