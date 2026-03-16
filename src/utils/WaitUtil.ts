/**
 * Enhanced wait utilities with retry logic and smart polling.
 * Rebuilt by Ankur Pratap — cleaner API, better error messages.
 */
import { config } from '../k11-platform/config/appconfig';
import { debugLog, debugWarn } from './DebugLogger';

export class WaitUtil {
  readonly page: any;

  constructor(page: any) {
    this.page = page;
  }

  /** Wait for element to reach a specific state. */
  async waitForState(
    selector: string | Record<string, string>,
    state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible',
    timeout: number = config.timeout
  ): Promise<void> {
    debugLog(`[wait] waiting for ${JSON.stringify(selector)} to be ${state}`);
    const element = this.page.find(selector, { timeout });
    await element.waitFor({ state, timeout });
  }

  /** Wait for page load to complete. */
  async waitForPageLoad(timeout: number = config.timeout): Promise<void> {
    debugLog('[wait] waiting for page load');
    await this.page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout });
  }

  /** Wait for specific text to appear on page. */
  async waitForText(text: string, timeout: number = config.timeout): Promise<void> {
    debugLog(`[wait] waiting for text: "${text}"`);
    await this.page.find({ text }, { timeout });
  }

  /** Wait for URL to contain a substring. */
  async waitForUrl(substring: string, timeout: number = config.timeout): Promise<void> {
    debugLog(`[wait] waiting for URL to contain: "${substring}"`);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const url = await this.page.url();
      if (url.includes(substring)) return;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`URL did not contain "${substring}" within ${timeout}ms. Current: ${await this.page.url()}`);
  }

  /** Retry an async action with configurable attempts. */
  async retry<T>(
    action: () => Promise<T>,
    options: { attempts?: number; delay?: number; label?: string } = {}
  ): Promise<T> {
    const { attempts = config.retryAttempts, delay = 500, label = 'action' } = options;
    let lastError: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await action();
      } catch (err) {
        lastError = err;
        debugWarn(`[retry] ${label} attempt ${i}/${attempts} failed`);
        if (i < attempts) await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /** Wait for network to settle. */
  async waitForNetworkIdle(timeout: number = config.timeout): Promise<void> {
    debugLog('[wait] waiting for network idle');
    await this.page.waitForLoadState('networkidle', { timeout });
  }
}
