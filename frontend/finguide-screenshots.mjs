import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = "/tmp/finguide-shots";
const FRONT = "http://localhost:5173";
const BACK = "http://localhost:5000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true };

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(label, url, viewport, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);

  if (opts.token) {
    // Pre-seed the JWT before navigation so RequireAuth lets us in.
    await page.goto(`${FRONT}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate((tok, user) => {
      localStorage.setItem("token", tok);
      if (user) localStorage.setItem("auth_user", JSON.stringify(user));
    }, opts.token, opts.user || null);
  }

  console.log(`→ ${label}  →  ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch((e) => {
    console.warn(`   warn: networkidle2 timeout — proceeding (${e.message})`);
  });
  await settle(800); // Let CSS animations land

  const filePath = path.join(OUT, `${label}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`   ✓ ${filePath}`);
  await page.close();
  return filePath;
}

// Register a fresh test user to capture authenticated screens.
async function registerUser() {
  const email = `visual-review-${Date.now()}@gmail.com`;
  const password = "Visual1!Review";
  const name = "Visual Review";

  const res = await fetch(`${BACK}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const json = await res.json();
  if (!json.success || !(json.token || json.data?.token)) {
    throw new Error(`register failed: ${JSON.stringify(json)}`);
  }
  const token = json.token || json.data.token;
  const user = json.data?.user || { name, email };
  console.log(`   ✓ registered ${email}`);
  return { token, user };
}

// === SHOTS ============================================================

// 1. Landing
await shoot("01-landing", `${FRONT}/`, DESKTOP);

// 3. Login (number 3 in the user list)
await shoot("03-login", `${FRONT}/login`, DESKTOP);

// Register so we can hit authenticated pages
const { token, user } = await registerUser();

// 2. Dashboard
await shoot("02-dashboard", `${FRONT}/dashboard`, DESKTOP, { token, user });

// 4. Documents Upload
await shoot("04-documents-upload", `${FRONT}/documents`, DESKTOP, { token, user });

// 5. Scan Status (will likely show empty / waiting state since no scan in progress)
await shoot("05-scan-status", `${FRONT}/documents/scan/demo`, DESKTOP, { token, user });

// 6. Scan Complete
await shoot("06-scan-complete", `${FRONT}/documents/scan/complete`, DESKTOP, { token, user });

// 7. Payslip Detail (empty / not-found state)
await shoot("07-payslip-detail", `${FRONT}/payslip-history`, DESKTOP, { token, user });

// 8. Findings
await shoot("08-findings", `${FRONT}/findings`, DESKTOP, { token, user });

// 9. Settings
await shoot("09-settings", `${FRONT}/settings`, DESKTOP, { token, user });

// 10. Mobile Landing
await shoot("10-mobile-landing", `${FRONT}/`, MOBILE);

await browser.close();
console.log("\nAll done.");
