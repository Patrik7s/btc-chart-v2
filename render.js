const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

// --- Nastavení Canvasu ---
const width = 648;
const height = 480;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// --- GLOBÁLNÍ VÝCHOZÍ NASTAVENÍ: VYPNUTÍ ANTI-ALIASINGU ---
ctx.antialias = 'none'; // Pro tvary a čáry
ctx.imageSmoothingEnabled = false; // Pro vykreslování obrázků
ctx.textDrawingMode = 'path'; // Výchozí pro text


// --- Načtení fontu IBM Plex Mono ---
const fontPathPlexMonoRegular = path.join(__dirname, 'fonts', 'IBMPlexMono-Regular.ttf');
const fontPathPlexMonoBold = path.join(__dirname, 'fonts', 'IBMPlexMono-Bold.ttf');

try {
    registerFont(fontPathPlexMonoRegular, { family: 'IBM Plex Mono', weight: 'normal' });
    registerFont(fontPathPlexMonoBold, { family: 'IBM Plex Mono', weight: 'bold' });
} catch (error) {
    console.warn(`Varování: Font IBM Plex Mono nebyl nalezen. Zkontrolujte cestu k souborům fontů. Použije se výchozí font. Chyba: ${error.message}`);
}

// --- Funkce pro získání dat svíček z Binance ---
async function getBinanceCandlesData() {
    const end = Math.floor(Date.now() / 1000);
    const start = end - 12 * 60 * 60;
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&startTime=${start * 1000}&endTime=${end * 1000}`;
    const response = await fetch(url);
    const raw = await response.json();
    return raw.map(d => ({
        t: d[0], o: +d[1], h: +d[2], l: +d[3], c: +d[4]
    }));
}

// --- Funkce pro získání AKTUÁLNÍ TRŽNÍ CENY je ODSTRANĚNA ---


// --- Hlavní funkce pro kreslení grafu ---
async function drawChart() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    let candles;
    let lastClosedCandlePrice; // Zde uložíme zavírací cenu poslední UZAVŘENÉ svíčky

    try {
        candles = await getBinanceCandlesData(); // Načteme data svíček
        // <--- ZMĚNA: Kontrolujeme, zda máme alespoň 2 svíčky pro spolehlivou poslední uzavřenou
        if (!candles || candles.length < 2) { 
            throw new Error("Nedostatek dat svíček z Binance API pro určení poslední uzavřené svíčky.");
        }
        // <--- ZMĚNA: Používáme zavírací cenu předposlední svíčky, která by měla být uzavřená
        lastClosedCandlePrice = candles[candles.length - 2].c; 
    } catch (error) {
        console.error("Chyba při načítání dat z Binance:", error);
        ctx.antialias = 'default';
        ctx.textDrawingMode = 'glyph';
        ctx.fillStyle = 'black';
        ctx.font = '18px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Chyba načítání dat!', width / 2, height / 2);
        saveImage();
        return;
    }

    // --- VÝPOČET MĚŘÍTEK A ROZSAHŮ a NOVÉ PADDINGY ---
    const paddingLeft = 40;
    const paddingRight = 90;
    const paddingTop = 60;
    const paddingBottom = 75;
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

    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 1;

    // --- Kreslení os (anti-aliasing VYPNUTÝ) ---
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop + chartHeight);
    ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
    ctx.stroke();

    const axisY_XPosition = paddingLeft + chartWidth;
    ctx.beginPath();
    ctx.moveTo(axisY_XPosition, paddingTop);
    ctx.lineTo(axisY_XPosition, paddingTop + chartHeight);
    ctx.stroke();

    // --- Popisky cen na ose Y (pravá strana od osy) ---
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let p = minPrice; p <= maxPrice; p += 500) {
        const y = paddingTop + chartHeight - (p - adjustedMinPrice) * scaleY;
        if (y < paddingTop || y > paddingTop + chartHeight + 10) continue;

        if (p === minPrice) {
            ctx.textBaseline = 'bottom';
            ctx.fillText(p.toLocaleString(), axisY_XPosition + 5, y + 2);
            ctx.textBaseline = 'middle';
        } else {
            ctx.fillText(p.toLocaleString(), axisY_XPosition + 5, y);
        }
    }
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // --- Kreslení svíček (anti-aliasing VYPNUTÝ) ---
    const barWidth = Math.max(2, chartWidth / candles.length * 0.6);
    candles.forEach(c => {
        const x = paddingLeft + (c.t - minTime) * scaleX;
        const yOpen = paddingTop + chartHeight - (c.o - adjustedMinPrice) * scaleY;
        const yClose = paddingTop + chartHeight - (c.c - adjustedMinPrice) * scaleY;
        const yHigh = paddingTop + chartHeight - (c.h - adjustedMinPrice) * scaleY;
        const yLow = paddingTop + chartHeight - (c.l - adjustedMinPrice) * scaleY;

        if (x - barWidth / 2 < paddingLeft || x + barWidth / 2 > paddingLeft + chartWidth) return;

        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        const xBar = x - barWidth / 2;
        if (c.c >= c.o) {
            ctx.fillStyle = 'black';
            ctx.fillRect(xBar, yClose, barWidth, yOpen - yClose);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(xBar, yClose, barWidth, yOpen - yClose);
            ctx.strokeRect(xBar, yClose, barWidth, yOpen - yClose);
        }
    });

    // --- Čárkovaná linka AKTUÁLNÍ CENY z poslední UZAVŘENÉ svíčky (anti-aliasing VYPNUTÝ) ---
    const yCurrentPriceFromLastClosedCandle = paddingTop + chartHeight - (lastClosedCandlePrice - adjustedMinPrice) * scaleY; // <--- Využíváme cenu z poslední uzavřené
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yCurrentPriceFromLastClosedCandle);
    ctx.lineTo(paddingLeft + chartWidth, yCurrentPriceFromLastClosedCandle);
    ctx.stroke();
    ctx.setLineDash([]);


    // --- Kreslení VŠECH TEXTŮ s ZAPNUTÝM ANTI-ALIASINGEM ---

    // Popisky časů na ose X (dole)
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = '12px "IBM Plex Mono", monospace';
    for (let t = Math.ceil(minTime / (1000 * 60 * 60)) * (1000 * 60 * 60); t <= maxTime; t += (1000 * 60 * 60)) {
        const x = paddingLeft + (t - minTime) * scaleX;
        if (x < paddingLeft || x > paddingLeft + chartWidth) continue;
        const dateAtTime = new Date(t);
        const label = format(dateAtTime, 'HH:mm');
        ctx.fillText(label, x, paddingTop + chartHeight + 15);
    }
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // Zobrazení AKTUÁLNÍ CENY z poslední UZAVŘENÉ svíčky vlevo u čárkované linky
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const currentPriceToDisplay = Math.round(lastClosedCandlePrice); // <--- Používáme cenu z poslední uzavřené
    ctx.fillStyle = 'black';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(currentPriceToDisplay.toLocaleString(), 5, yCurrentPriceFromLastClosedCandle - 5);
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // Horní řádek textů: Ticker, Nákupní cena, Aktuální cena, Profit
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const averageBuyPrice = 78000;
    const currentPriceRoundedTop = Math.round(lastClosedCandlePrice); // <--- Používáme cenu z poslední uzavřené
    let profitPercentage = 0;
    if (averageBuyPrice > 0) {
        profitPercentage = ((lastClosedCandlePrice - averageBuyPrice) / averageBuyPrice) * 100; // <--- Výpočet profitu s cenou z poslední uzavřené
    }
    const profitFormattedText = `${profitPercentage.toFixed(2)}%`;

    const textSegments = [
        'BTCUSDT',
        `Nákupní cena: ${averageBuyPrice.toLocaleString()} USDT`,
        `Aktuální cena: ${currentPriceRoundedTop.toLocaleString()} USDT`,
        `Profit: ${profitFormattedText}`
    ];
    const spacingBetweenSegments = 5;
    ctx.font = `bold 13px "IBM Plex Mono", monospace`;

    let totalWidthTop = 0;
    const segmentWidthsTop = textSegments.map(segment => {
        const width = ctx.measureText(segment).width;
        totalWidthTop += width;
        return width;
    });
    totalWidthTop += (textSegments.length - 1) * spacingBetweenSegments;
    let currentXTop = (width / 2) - (totalWidthTop / 2);
    const topRowY = 30;

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
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // Spodní řádek textů: "Poslední aktualizace:", Datum, Čas a Time Frame
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const lastCandleTime = new Date(candles[candles.length - 1].t); // Čas poslední svíčky (i když otevřená)
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
    const spacingBottomSegments = 5;
    ctx.font = '12px "IBM Plex Mono", monospace'; // <--- ZŮSTÁVÁ 12px

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
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';


    saveImage(); // Uloží obrázek
}

function saveImage() {
    const buffer = canvas.toBuffer('image/png', {
        compressionLevel: 9,
        filters: canvas.PNG_FILTER_NONE,
        palette: true,
        colors: 2
    });
    fs.writeFileSync('btc-chart.png', buffer);
    console.log('Graf byl úspěšně vygenerován jako 1-bit černobílý PNG pomocí node-canvas.');
}

drawChart();