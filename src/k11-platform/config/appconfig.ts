/**
 * Application configuration with environment variable overrides.
 * Rebuilt by Ankur Pratap — supports multi-environment switching.
 */
export interface AppConfig {
  readonly baseUrl: string;
  readonly apiUrl: string;
  readonly timeout: number;
  readonly browser: 'chromium' | 'firefox' | 'webkit';
  readonly headless: boolean;
  readonly screenshotOnFailure: boolean;
  readonly retryAttempts: number;
  readonly env: 'local' | 'dev' | 'staging' | 'production';
}

const environments: Record<string, Partial<AppConfig>> = {
  local: {
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3001/api',
  },
  dev: {
    baseUrl: 'https://dev.k11softwaresolutions.com',
    apiUrl: 'https://dev-api.k11softwaresolutions.com/api',
  },
  staging: {
    baseUrl: 'https://staging.k11softwaresolutions.com',
    apiUrl: 'https://staging-api.k11softwaresolutions.com/api',
  },
  production: {
    baseUrl: 'https://k11softwaresolutions.com',
    apiUrl: 'https://k11softwaresolutions-backend.onrender.com/api/login/',
  },
};

const env = (process.env.TEST_ENV || 'production') as AppConfig['env'];
const envOverrides = environments[env] || environments.production;

export const config: AppConfig = {
  env,
  baseUrl: process.env.BASE_URL || envOverrides.baseUrl || 'https://k11softwaresolutions.com',
  apiUrl: process.env.API_URL || envOverrides.apiUrl || 'https://k11softwaresolutions-backend.onrender.com/api/login/',
  timeout: Number(process.env.TEST_TIMEOUT) || 10000,
  browser: (process.env.BROWSER as AppConfig['browser']) || 'chromium',
  headless: process.env.HEADLESS !== 'false',
  screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE !== 'false',
  retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 2,
};
