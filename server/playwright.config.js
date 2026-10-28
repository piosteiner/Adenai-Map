// Browser tests (npx playwright test): the map as it is in this checkout, served locally; its data and the CMS checks
// go to the live CMS server, read-only (nothing is written). Unit tests: npm test.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'test/e2e',
    timeout: 30000,
    retries: 1,
    reporter: [['list']],
    outputDir: 'test/e2e/.results',
    use: { baseURL: 'http://127.0.0.1:4173', ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
    webServer: {
        command: 'python3 -m http.server 4173 --bind 127.0.0.1',
        cwd: '..',
        url: 'http://127.0.0.1:4173/index.html',
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'ignore',
    },
});
