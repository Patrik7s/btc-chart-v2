const puppeteer = require('puppeteer');
const path = require('path');
const sharp = require('sharp'); // Knihovna pro zpracování obrázků

(async () => {
  const browser = await puppeteer.launch({
    headless: true, // Spustí prohlížeč v pozadí (bez grafického rozhraní)
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Důležité pro běh na serverech (jako GitHub Actions)
  });
  const page = await browser.newPage();

  // Zkonstruujeme cestu k HTML souboru, aby fungovala v jakémkoli adresáři
  const htmlFilePath = `file://${path.resolve(__dirname, 'chart.html')}`;
  await page.goto(htmlFilePath, { waitUntil: 'networkidle0' }); // Načte HTML soubor

  // Nastavení velikosti viewportu a deviceScaleFactor pro ostrost e-inku
  // Výstupní obrázek bude 648x480 pixelů, ale vykreslí se s dvojnásobnou přesností
  await page.setViewport({ width: 648, height: 480, deviceScaleFactor: 2 }); 

  // Počkáme chvíli, abychom dali grafu čas na vykreslení po načtení dat z API
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Pořídíme screenshot stránky jako buffer (do paměti)
  const imageBuffer = await page.screenshot({ type: 'png' }); 

  await browser.close(); // Prohlížeč už nepotřebujeme, můžeme ho zavřít

  // --- Zpracování obrázku pomocí sharp na 1-bit černobílý ---
  // Použijeme sharp pro převod na stupně šedi a poté na 1-bit černobílý s prahem 128
  // Výsledný soubor bude btc-chart.png (648x480 pixelů)
  await sharp(imageBuffer)
    .grayscale() // Převést obrázek na stupně šedi
    .threshold(128) // Převést na 1-bit černobílý (hodnoty nad 128 jsou bílé, pod 128 černé)
    .toFile('btc-chart.png'); // Uložit zpracovaný obrázek pod stejným názvem

  console.log('Graf byl úspěšně vygenerován a převeden na 1-bit černobílý obrázek jako btc-chart.png');
})();