import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PUERTO = Number(process.env.PUERTO ?? 3100);
const ALUMNO_DIR = process.env.ALUMNO_DIR;

export default defineConfig({
  testDir: import.meta.dirname,
  outputDir: join(import.meta.dirname, 'test-results'),
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME }]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    channel: process.env.PW_CANAL || undefined,
    launchOptions: process.env.PW_EJECUTABLE
      ? { executablePath: process.env.PW_EJECUTABLE }
      : undefined,
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  webServer: ALUMNO_DIR
    ? {
        command: 'npm start',
        cwd: ALUMNO_DIR,
        url: `http://127.0.0.1:${PUERTO}/api/health`,
        env: { ...process.env, PORT: String(PUERTO) },
        reuseExistingServer: false,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      }
    : undefined,
});
