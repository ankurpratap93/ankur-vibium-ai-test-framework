/**
 * Enhanced API utility with typed assertions and timing.
 * Rebuilt by Ankur Pratap — generic, reusable, strongly typed.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ApiResponse, ApiAssertionOptions } from '../types';

export class APIUtil {
  /**
   * Make a typed fetch call with timing.
   */
  async request<T = unknown>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const start = Date.now();
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const duration = Date.now() - start;
    const body = await response.json() as T;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => { headers[name] = value; });

    return { status: response.status, headers, body, duration };
  }

  async get<T = unknown>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = unknown>(url: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'POST', body: JSON.stringify(body) });
  }

  async put<T = unknown>(url: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'PUT', body: JSON.stringify(body) });
  }

  async del<T = unknown>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  /** Assert status matches expected (default 200). */
  assertStatus(response: ApiResponse, expected: number = 200): void {
    if (response.status !== expected) {
      throw new Error(`Expected status ${expected}, got ${response.status}`);
    }
  }

  /** Assert all required keys exist in response body. */
  assertBodyKeys(response: ApiResponse<Record<string, any>>, keys: string[]): void {
    const missing = keys.filter(k => !(k in response.body));
    if (missing.length > 0) {
      throw new Error(`Missing keys in response: ${missing.join(', ')}`);
    }
  }

  /** Assert required headers exist. */
  assertHeaders(response: ApiResponse, requiredHeaders: string[]): void {
    const actualNames = Object.keys(response.headers).map(h => h.toLowerCase());
    const missing = requiredHeaders.filter(h => !actualNames.includes(h.toLowerCase()));
    if (missing.length > 0) {
      throw new Error(`Missing headers: ${missing.join(', ')}`);
    }
  }

  /** Run all assertions from an options object. */
  assertAll(response: ApiResponse<Record<string, any>>, opts: ApiAssertionOptions): void {
    if (opts.expectedStatus !== undefined) this.assertStatus(response, opts.expectedStatus);
    if (opts.requiredKeys) this.assertBodyKeys(response, opts.requiredKeys);
    if (opts.requiredHeaders) this.assertHeaders(response, opts.requiredHeaders);
  }

  /** Save response to artifacts. */
  saveResponse(name: string, response: ApiResponse): string {
    const outDir = path.resolve(process.cwd(), 'apiResponses');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...response, savedAt: new Date().toISOString() }, null, 2));
    return file;
  }
}
