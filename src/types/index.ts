/**
 * Shared type definitions for the test framework.
 * Rebuilt by Ankur Pratap — strong typing across all layers.
 */

// ─── Test result types ───────────────────────────────────────────────
export interface TestStepResult {
  stepName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface TestCaseResult {
  testName: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  steps: TestStepResult[];
  duration: number;
  timestamp: string;
}

export interface TestRunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  duration: number;
  timestamp: string;
  environment: string;
  results: TestCaseResult[];
}

// ─── Page object base ────────────────────────────────────────────────
export interface PageObject {
  readonly page: any;
  goto(): Promise<void>;
}

// ─── API types ───────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
  duration: number;
}

export interface ApiAssertionOptions {
  expectedStatus?: number;
  requiredKeys?: string[];
  requiredHeaders?: string[];
}

// ─── MCP tool types ──────────────────────────────────────────────────
export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

export interface BrowserPageInfo {
  url: string;
  title: string;
}

// ─── AI agent types ──────────────────────────────────────────────────
export interface AgentAction {
  tool: string;
  params: Record<string, unknown>;
  result?: McpToolResult;
  timestamp: string;
}

export interface AgentRunReport {
  goal: string;
  model: string;
  actions: AgentAction[];
  status: 'completed' | 'failed' | 'timeout';
  duration: number;
  timestamp: string;
}

// ─── Data provider types ─────────────────────────────────────────────
export type CsvRow = Record<string, string>;

export interface LoginTestData {
  testName: string;
  username: string;
  password: string;
  expected: 'success' | 'failure';
}
