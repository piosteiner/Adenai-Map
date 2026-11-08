// The CMS test instance (test/e2e/cms-test-server.cjs) and its accounts
const CMS = 'http://localhost:3091';
const GM = { username: 'e2e-gm', password: 'e2e-gm-pass' };
const PLAYER = { username: 'e2e-player', password: 'e2e-player-pass' };

// logged in as the GM — the page's requests share the cookie
async function loginGm(page) {
    const res = await page.request.post(`${CMS}/api/login`, { data: GM });
    if (!res.ok()) throw new Error(`GM login failed: ${res.status()}`);
}

module.exports = { CMS, GM, PLAYER, loginGm };
