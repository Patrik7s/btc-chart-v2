const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 648, height: 480 });
  await page.goto(`file://${__dirname}/chart.html`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `${__dirname}/btc-chart.png` });
  await browser.close();
})();
