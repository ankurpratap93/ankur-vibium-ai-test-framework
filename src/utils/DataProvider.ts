/**
 * Data-driven testing provider with typed output and JSON support.
 * Rebuilt by Ankur Pratap — supports CSV, JSON, and inline data.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { CsvRow, LoginTestData } from '../types';

export class DataProvider {
  /** Parse a CSV file into typed row objects. */
  static fromCsv<T extends CsvRow = CsvRow>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows: T[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const obj: CsvRow = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = (cols[j] || '').trim();
      }
      rows.push(obj as T);
    }
    return rows;
  }

  /** Parse a JSON file into typed data. */
  static fromJson<T = unknown>(filePath: string): T {
    if (!fs.existsSync(filePath)) {
      throw new Error(`JSON file not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /** Create inline test data (for quick parametric tests). */
  static inline<T>(data: T[]): T[] {
    return data;
  }

  /** Load login test data from CSV with proper typing. */
  static loginData(csvPath: string): LoginTestData[] {
    return DataProvider.fromCsv<LoginTestData>(csvPath);
  }
}

export default DataProvider;
