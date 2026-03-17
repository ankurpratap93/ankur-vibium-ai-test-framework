import { Page } from 'playwright';
import { config } from '../../config/appconfig';

const VALUEUP_BASE = 'https://dev.valueup.jumpiq.com';

export class ValueUpLogin {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${VALUEUP_BASE}/login?callbackUrl=%2Fdashboard%2Fhome`, { waitUntil: 'networkidle', timeout: 30000 });
  }

  async login(username: string, password: string) {
    const userInput = this.page.locator('input[name="username"], input[id="username"], input[type="text"]').first();
    const passInput = this.page.locator('input[type="password"]').first();
    await userInput.fill(username);
    await passInput.fill(password);
    const submitBtn = this.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")').first();
    await submitBtn.click();
    await this.page.waitForURL('**/dashboard/**', { timeout: 20000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async isLoggedIn(): Promise<boolean> {
    return this.page.url().includes('dashboard');
  }

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }
}
