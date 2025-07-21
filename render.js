const puppeteer = require('puppeteer');
const path = require('path');

async function generateChartImage() {
  const browser = await puppeteer.launch({
    headless: true, // Spustí prohlížeč v pozadí
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Důležité pro GitHub Actions
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 648, height: 480, deviceScaleFactor: 2 }); // Nastavte rozlišení a DPI
  await page.goto(`file://${path.resolve(__dirname, 'chart.html')}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'chart.png' });
  await browser.close();
  console.log('Graf byl vygenerován jako chart.png');
}

generateChartImage();