/**
 * Common non-UI utilities — file I/O, crypto, PDF, Excel.
 * Rebuilt by Ankur Pratap — cleaner API, removed broken stubs.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import { Workbook } from 'exceljs';

export class CommonUtils {
  readonly page: any;

  constructor(page: any) {
    this.page = page;
  }

  /** Decrypt AES-encrypted text. */
  decrypt(encrypted: string, secret: string): string {
    return CryptoJS.AES.decrypt(encrypted, secret).toString(CryptoJS.enc.Utf8);
  }

  /** Encrypt text with AES. */
  encrypt(plainText: string, secret: string): string {
    return CryptoJS.AES.encrypt(plainText, secret).toString();
  }

  /** Wait for specified milliseconds. */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Read a cell value from an Excel file. */
  async getExcelCellValue(filePath: string, sheetName: string, row: number, col: number): Promise<string> {
    const workbook = new Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Sheet '${sheetName}' not found in ${filePath}`);
    return sheet.getRow(row).getCell(col).toString();
  }

  /** Read all rows from an Excel sheet as objects. */
  async getExcelData(filePath: string, sheetName: string): Promise<Record<string, string>[]> {
    const workbook = new Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Sheet '${sheetName}' not found`);

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNum) => { headers[colNum] = String(cell.value || '').trim(); });

    const rows: Record<string, string>[] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj: Record<string, string> = {};
      row.eachCell((cell, colNum) => { obj[headers[colNum] || `col${colNum}`] = String(cell.value || ''); });
      rows.push(obj);
    });
    return rows;
  }

  /** Read a text file. */
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /** Write a text file. */
  writeFile(filePath: string, data: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  /** Generate a timestamped filename. */
  timestampedName(prefix: string, ext: string = 'png'): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${ts}.${ext}`;
  }

  /** Ensure a directory exists. */
  ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }
}
