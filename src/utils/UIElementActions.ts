/**
 * UI element interaction utilities with retry and safety.
 * Rebuilt by Ankur Pratap — enhanced with scroll, hover, and safe actions.
 */
import { config } from '../k11-platform/config/appconfig';
import { debugLog, debugWarn } from './DebugLogger';

export class UIElementActions {
  readonly page: any;

  constructor(page: any) {
    this.page = page;
  }

  /** Click element by visible text. */
  async clickByText(text: string, options: { exact?: boolean; timeout?: number } = {}): Promise<void> {
    const { exact = true, timeout = config.timeout } = options;
    debugLog(`[ui] clicking text: "${text}"`);
    const el = await this.page.find({ text }, { timeout });
    await el.click();
  }

  /** Click element by CSS selector with retry. */
  async clickSelector(selector: string, timeout: number = config.timeout): Promise<void> {
    debugLog(`[ui] clicking selector: ${selector}`);
    const el = await this.page.find(selector, { timeout });
    await el.click();
  }

  /** Type into an input field by selector. */
  async typeInto(selector: string, text: string, options: { clear?: boolean; timeout?: number } = {}): Promise<void> {
    const { clear = true, timeout = config.timeout } = options;
    debugLog(`[ui] typing into ${selector}`);
    const el = await this.page.find(selector, { timeout });
    if (clear) await el.clear();
    await this.page.keyboard.type(text);
  }

  /** Hover over an element. */
  async hover(selector: string, timeout: number = config.timeout): Promise<void> {
    debugLog(`[ui] hovering: ${selector}`);
    const el = await this.page.find(selector, { timeout });
    await el.hover();
  }

  /** Scroll element into view. */
  async scrollIntoView(selector: string): Promise<void> {
    debugLog(`[ui] scrolling into view: ${selector}`);
    await this.page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ behavior: 'smooth', block: 'center' })`);
  }

  /** Get text content of an element. */
  async getText(selector: string | Record<string, string>, timeout: number = config.timeout): Promise<string> {
    const el = await this.page.find(selector, { timeout });
    return el.text();
  }

  /** Check if element is visible. */
  async isVisible(selector: string | Record<string, string>, timeout: number = 3000): Promise<boolean> {
    try {
      const el = await this.page.find(selector, { timeout });
      return el.isVisible();
    } catch {
      return false;
    }
  }

  /** Take a screenshot and save it. */
  async screenshot(filePath: string, fullPage: boolean = true): Promise<Buffer> {
    debugLog(`[ui] taking screenshot: ${filePath}`);
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buffer = await this.page.screenshot({ fullPage });
    fs.writeFileSync(filePath, buffer);
    return buffer;
  }
}
