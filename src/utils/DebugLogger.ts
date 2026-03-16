/**
 * Debug logger with structured output and log levels.
 * Rebuilt by Ankur Pratap — supports levels, timestamps, and file output.
 */
import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const debugEnabled = process.env.K11_DEBUG === 'true';
const logToFile = process.env.LOG_TO_FILE === 'true';
const logFilePath = path.resolve(process.cwd(), 'reports', 'test-execution.log');

function timestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'debug' && !debugEnabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const prefix = `[${timestamp()}] [${level.toUpperCase().padEnd(5)}]`;
  return `${prefix} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
}

function writeToFile(message: string): void {
  if (!logToFile) return;
  try {
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFilePath, message + '\n');
  } catch { /* silent */ }
}

export function debugLog(...args: unknown[]): void {
  if (!shouldLog('debug')) return;
  const msg = formatMessage('debug', args);
  console.log(msg);
  writeToFile(msg);
}

export function infoLog(...args: unknown[]): void {
  if (!shouldLog('info')) return;
  const msg = formatMessage('info', args);
  console.log(msg);
  writeToFile(msg);
}

export function debugWarn(...args: unknown[]): void {
  if (!shouldLog('warn')) return;
  const msg = formatMessage('warn', args);
  console.warn(msg);
  writeToFile(msg);
}

export function errorLog(...args: unknown[]): void {
  const msg = formatMessage('error', args);
  console.error(msg);
  writeToFile(msg);
}
