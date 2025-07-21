const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns'); // Pro formátování dat a časů

// --- Nastavení Canvasu ---
const width = 648;
const height = 480;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// --- VYPNUTÍ ANTI-ALIASINGU ---
ctx.antialias = 'none'; // Pro tvary a čáry
ctx.imageSmoothingEnabled = false; // Pro vykreslování obrázků (i když to zde přímo nevyužíváme)
ctx.textDrawingMode = 'path'; // Pro text - nutí vykreslování textu jako vektorových cest
// ...

// --- Načtení fontu Roboto (pokud ho chcete použít) ---
// Předpokládá, že font máte lokálně v projektu, např. v adresáři 'fonts'
// Budete muset stáhnout soubor .ttf fontu a umístit ho do projektu.
// Např.: Následující cesty předpokládají, že máte fonty ve složce 'fonts'
const fontPathRegular = path.join(__dirname, 'fonts', 'Roboto-Regular.ttf');
const fontPathBold = path.join(__dirname, 'fonts', 'Roboto-Bold.ttf');

try {
    registerFont(fontPathRegular, { family: 'Roboto', weight: 'normal' });
    registerFont(fontPathBold, { family: 'Roboto', weight: 'bold' });
} catch (error) {
    console.warn(`Varování: Font Roboto nebyl nalezen. Zkontrolujte cestu k souborům fontů. Použije se výchozí font. Chyba: ${error.message}`);
}


// --- Funkce pro získání dat z Binance (stejná jako v chart.html) ---
async function getBinanceData() {
    const end = Math.floor(Date.now() / 1000);
    const start = end - 12 * 60 * 60; // posledních 12 hodin
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&startTime=${start * 1000}&endTime=${end * 1000}`;
    const response = await fetch(url); // fetch je v Node.js >= 18 nativní
    const raw = await response.json();
    return raw.map(d => ({
        t: d[0],
        o: +d[1],
        h: +d[2],
        l: +d[3],
        c: +d[4]
    }));
}

// --- Hlavní funkce pro kreslení grafu ---
async function drawChart() {
    // 1. Vyplnění pozadí (bílé)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // 2. Načtení dat
    let candles;
    try {
        candles = await getBinanceData();
        if (!candles || candles.length === 0) {
            throw new Error("Žádná data z Binance API.");
        }
    } catch (error) {
        console.error("Chyba při načítání dat z Binance:", error);
        // Zde můžete vykreslit chybovou zprávu na plátno
        ctx.fillStyle = 'black';
        ctx.font = '20px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chyba načítání dat!', width / 2, height / 2);
        // Uloží i chybný obrázek
        saveImage();
        return; // Ukončí funkci
    }

    // Zde by začala VLASTNÍ LOGIKA vykreslování grafu:
    // ----------------------------------------------------
    // --- VÝPOČET MĚŘÍTEK A ROZSAHŮ (podobně jako v chart.html) ---
    const paddingLeft = 20;
    const paddingRight = 70;
    const paddingTop = 45;
    const paddingBottom = 60;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const times = candles.map(c => c.t);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const prices = candles.flatMap(c => [c.l, c.h]);
    const minPrice = Math.floor(Math.min(...prices) / 500) * 500;
    const adjustedMinPrice = Math.max(minPrice, Math.min(...prices));
    const maxPrice = Math.ceil(Math.max(...prices) / 500) * 500;

    const scaleX = chartWidth / (maxTime - minTime);
    const scaleY = chartHeight / (maxPrice - adjustedMinPrice);

    // --- Kreslení os a popisků ---
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 1; // Tloušťka čar

    // Osa X (vodorovná dole)
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop + chartHeight);
    ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
    ctx.stroke();

    // Osa Y (svislá vpravo)
    const axisY_XPosition = paddingLeft + chartWidth;
    ctx.beginPath();
    ctx.moveTo(axisY_XPosition, paddingTop);
    ctx.lineTo(axisY_XPosition, paddingTop + chartHeight);
    ctx.stroke();

    // Popisky cen na ose Y (pravá strana)
    ctx.font = '12px Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let p = minPrice; p <= maxPrice; p += 500) {
        const y = paddingTop + chartHeight - (p - adjustedMinPrice) * scaleY;
        if (p === minPrice) {
            ctx.textBaseline = 'bottom';
            ctx.fillText(p.toLocaleString(), axisY_XPosition + 5, y + 2);
            ctx.textBaseline = 'middle';
        } else {
            ctx.fillText(p.toLocaleString(), axisY_XPosition + 5, y);
        }
    }

    // Popisky časů na ose X (dole)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = Math.ceil(minTime / (1000 * 60 * 60)) * (1000 * 60 * 60); t <= maxTime; t += (1000 * 60 * 60)) {
        const x = paddingLeft + (t - minTime) * scaleX;
        if (x < paddingLeft || x > paddingLeft + chartWidth) continue;
        const dateAtTime = new Date(t);
        const label = format(dateAtTime, 'HH:mm'); // Použijte date-fns pro formátování
        ctx.fillText(label, x, paddingTop + chartHeight + 5);
    }

    // --- Kreslení svíček ---
    const barWidth = Math.max(2, chartWidth / candles.length * 0.6);
    candles.forEach(c => {
        const x = paddingLeft + (c.t - minTime) * scaleX;
        const yOpen = paddingTop + chartHeight - (c.o - adjustedMinPrice) * scaleY;
        const yClose = paddingTop + chartHeight - (c.c - adjustedMinPrice) * scaleY;
        const yHigh = paddingTop + chartHeight - (c.h - adjustedMinPrice) * scaleY;
        const yLow = paddingTop + chartHeight - (c.l - adjustedMinPrice) * scaleY;

        // Kreslení knotů
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Kreslení těla svíčky
        const xBar = x - barWidth / 2;
        if (c.c >= c.o) {
            ctx.fillStyle = 'black';
            ctx.fillRect(xBar, yClose, barWidth, yOpen - yClose);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(xBar, yClose, barWidth, yOpen - yClose);
            ctx.strokeRect(xBar, yClose, barWidth, yOpen - yClose); // Okraj pro bílé svíčky
        }
    });

    // --- Čárkovaná linka aktuální ceny a popisek ---
    const currentPrice = candles[candles.length - 1].c;
    const yCurrentPrice = paddingTop + chartHeight - (currentPrice - adjustedMinPrice) * scaleY;

    ctx.setLineDash([5, 5]); // Nastaví delší čárky
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yCurrentPrice);
    ctx.lineTo(paddingLeft + chartWidth, yCurrentPrice);
    ctx.stroke();
    ctx.setLineDash([]); // Resetovat

    // Popisek aktuální ceny vlevo
    ctx.fillStyle = 'black';
    ctx.font = '12px Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(currentPrice).toLocaleString(), 5, yCurrentPrice - 5);

    // --- Horní a spodní informační texty ---
    // Horní texty
    const averageBuyPrice = 78000;
    const currentPriceRounded = Math.round(currentPrice);
    let profitPercentage = 0;
    if (averageBuyPrice > 0) {
        profitPercentage = ((currentPrice - averageBuyPrice) / averageBuyPrice) * 100;
    }
    const profitFormattedText = `${profitPercentage.toFixed(2)}%`;

    const textSegments = [
        'BTCUSDT',
        `Nákupní cena: ${averageBuyPrice.toLocaleString()} USDT`,
        `Aktuální cena: ${currentPriceRounded.toLocaleString()} USDT`,
        `Profit: ${profitFormattedText}`
    ];
    const spacingBetweenSegments = 20;
    ctx.font = 'bold 12px Roboto, sans-serif';

    let totalWidthTop = 0;
    const segmentWidthsTop = textSegments.map(segment => {
        const width = ctx.measureText(segment).width;
        totalWidthTop += width;
        return width;
    });
    totalWidthTop += (textSegments.length - 1) * spacingBetweenSegments;
    let currentXTop = (width / 2) - (totalWidthTop / 2);
    const topRowY = 20;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';
    ctx.fillText(textSegments[0], currentXTop, topRowY);
    currentXTop += segmentWidthsTop[0] + spacingBetweenSegments;
    ctx.fillText(textSegments[1], currentXTop, topRowY);
    currentXTop += segmentWidthsTop[1] + spacingBetweenSegments;
    ctx.fillText(textSegments[2], currentXTop, topRowY);
    currentXTop += segmentWidthsTop[2] + spacingBetweenSegments;
    if (profitPercentage >= 0) {
        ctx.fillStyle = 'black';
    } else {
        ctx.fillStyle = 'red';
    }
    ctx.fillText(textSegments[3], currentXTop, topRowY);

    // Spodní texty
    const lastCandleTime = new Date(candles[candles.length - 1].t);
    const formattedDate = format(lastCandleTime, 'dd.MM.yyyy');
    const cestHours = lastCandleTime.getHours();
    const cestMins = lastCandleTime.getMinutes();
    const utcHours = lastCandleTime.getUTCHours();
    const nyHours = (utcHours - 4 + 24) % 24;
    const nyMins = lastCandleTime.getUTCMinutes();

    const updateText = `Poslední aktualizace:`;
    const timeAndDateText = `${formattedDate} ${('0' + cestHours).slice(-2)}:${('0' + cestMins).slice(-2)} CEST | ${('0' + nyHours).slice(-2)}:${('0' + nyMins).slice(-2)} NY`;
    const timeframeText = `Time Frame: 15 minut`;

    const bottomTextSegments = [
        updateText,
        timeAndDateText,
        timeframeText
    ];
    const spacingBottomSegments = 20;
    ctx.font = '12px Roboto, sans-serif';

    let totalBottomWidth = 0;
    const bottomSegmentWidths = bottomTextSegments.map(segment => {
        const width = ctx.measureText(segment).width;
        totalBottomWidth += width;
        return width;
    });
    totalBottomWidth += (bottomTextSegments.length - 1) * spacingBottomSegments;
    let currentBottomX = (width / 2) - (totalBottomWidth / 2);
    const bottomTextY = height - 20;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';
    ctx.fillText(updateText, currentBottomX, bottomTextY);
    currentBottomX += bottomSegmentWidths[0] + spacingBottomSegments;
    ctx.fillText(timeAndDateText, currentBottomX, bottomTextY);
    currentBottomX += bottomSegmentWidths[1] + spacingBottomSegments;
    ctx.fillText(timeframeText, currentBottomX, bottomTextY);


    // ----------------------------------------------------
    // 3. Uložení obrázku jako 1-bit černobílého PNG
    saveImage();
}

function saveImage() {
    // Vytvoříme buffer z canvasu jako PNG
    // Použijeme toFormat s palette: true a colors: 2 pro 1-bit černobílý PNG
    const buffer = canvas.toBuffer('image/png', { 
        compressionLevel: 9, 
        filters: canvas.PNG_FILTER_NONE,
        palette: true, 
        colors: 2 
    });
    fs.writeFileSync('btc-chart.png', buffer);
    console.log('Graf byl úspěšně vygenerován jako 1-bit černobílý PNG pomocí node-canvas.');
}

// Spustit kreslení
drawChart();