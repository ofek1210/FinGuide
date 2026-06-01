import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";

const OUT = "/tmp/finguide-shots";
const FRONT = "http://localhost:5173";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.goto(`${FRONT}/login`, { waitUntil: "networkidle2", timeout: 30000 });
// Give Google's GSI script time to fully render the new black button
await new Promise((r) => setTimeout(r, 2500));

await page.screenshot({ path: `${OUT}/03b-login-filled-black.png`, fullPage: false });
console.log("✓ /tmp/finguide-shots/03b-login-filled-black.png");

await browser.close();
