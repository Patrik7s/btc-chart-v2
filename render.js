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
  // Načte HTML soubor a počká, až se DOM načte (rychlejší než networkidle0)
  await page.goto(htmlFilePath, { waitUntil: 'domcontentloaded' }); 

  // Nastavení velikosti viewportu a deviceScaleFactor pro ostrost e-inku
  // Výstupní obrázek bude 648x480 pixelů, ale vykreslí se s dvojnásobnou přesností
  await page.setViewport({ width: 648, height: 480, deviceScaleFactor: 2 }); 

  // Počkáme pevnou 1 sekundu, abychom dali grafu čas na načtení dat z API a vykreslení
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Pořídíme screenshot stránky jako buffer (do paměti)
  const imageBuffer = await page.screenshot({ type: 'png' }); 

  await browser.close(); // Prohlížeč už nepotřebujeme, můžeme ho zavřít

  // --- Zpracování obrázku pomocí sharp na PRAVÝ 1-bit černobílý PNG ---
  // Převést na stupně šedi, pak na 1-bit černobílý s prahem 128,
  // a explicitně vynutit PNG s 2-barevnou paletou pro e-ink optimalizaci.
  await sharp(imageBuffer)
    .grayscale() // Převést obrázek na stupně šedi
    .threshold(128) // Převést na 1-bit černobílý (hodnoty nad 128 jsou bílé, pod 128 černé)
    .toFormat('png', { palette: true, colors: 2 }) // <-- KLÍČOVÁ OPTIMALIZACE: Skutečný 1-bit PNG
    .toFile('btc-chart.png'); // Uložit zpracovaný obrázek pod stejným názvem

  console.log('Graf byl úspěšně vygenerován a převeden na pravý 1-bit černobílý PNG obrázek jako btc-chart.png');
})();