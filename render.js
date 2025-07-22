const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
const sharp = require('sharp'); 

// --- Nastavení Canvasu ---
const width = 648;
const height = 480;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// --- GLOBÁLNÍ VÝCHOZÍ NASTAVENÍ: VYPNUTÍ ANTI-ALIASINGU ---
ctx.antialias = 'none'; // Pro tvary a čáry
ctx.imageSmoothingEnabled = false; // Pro vykreslování obrázků
ctx.textDrawingMode = 'path'; // Výchozí pro text


// --- Načtení fontu Terminus TTF ---
const fontPathTerminus = path.join(__dirname, 'fonts', 'TerminusTTF-4.49.3.ttf');

try {
    registerFont(fontPathTerminus, { family: 'TerminusTTF', weight: 'normal' });
    registerFont(fontPathTerminus, { family: 'TerminusTTF', weight: 'bold' });
} catch (error) {
    console.warn(`Varování: Font TerminusTTF nebyl nalezen. Zkontrolujte cestu k souborům fontů. Použije se výchozí font. Chyba: ${error.message}`);
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

// --- Hlavní funkce pro kreslení grafu ---
async function drawChart() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    let candles;
    let lastClosedCandlePrice;

    try {
        candles = await getBinanceCandlesData();
        if (!candles || candles.length < 2) { 
            throw new Error("Nedostatek dat svíček z Binance API pro určení poslední uzavřené svíčky.");
        }
        lastClosedCandlePrice = candles[candles.length - 2].c; 
    } catch (error) {
        console.error("Chyba při načítání dat z Binance:", error);
        ctx.antialias = 'default';
        ctx.textDrawingMode = 'glyph';
        ctx.fillStyle = 'black';
        ctx.font = '14px "TerminusTTF", monospace'; // Font pro chybu
        ctx.textAlign = 'center';
        ctx.fillText('Chyba načítání dat!', width / 2, height / 2);
        saveImage(); // Uloží se i chybový obrázek
        return;
    }

    // --- VÝPOČET MĚŘÍTEK A ROZSAHŮ a NOVÉ PADDINGY ---
    const paddingLeft = 40;
    const paddingRight = 90;
    const paddingTop = 90;
    const paddingBottom = 90;
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
    ctx.antialias = 'default'; // ZAPNUTO pro text
    ctx.textDrawingMode = 'glyph';
    ctx.font = '14px "TerminusTTF", monospace';
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
    ctx.antialias = 'none'; // VYPNTUTÍ anti-aliasingu
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
    const yCurrentPriceFromLastClosedCandle = paddingTop + chartHeight - (lastClosedCandlePrice - adjustedMinPrice) * scaleY;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yCurrentPriceFromLastClosedCandle);
    ctx.lineTo(paddingLeft + chartWidth, yCurrentPriceFromLastClosedCandle);
    ctx.stroke();
    ctx.setLineDash([]);


    // --- Kreslení VŠECH TEXTŮ s ZAPNUTÝM ANTI-ALIASINGEM (s následným ditheringem Sharpem) ---

    // Popisky časů na ose X (dole)
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = '14px "TerminusTTF", monospace';
    // Zobrazovat jen každé 2 hodiny
    const hoursToShow = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; 
    for (let t = Math.ceil(minTime / (1000 * 60 * 60)) * (1000 * 60 * 60); t <= maxTime; t += (1000 * 60 * 60)) {
        const x = paddingLeft + (t - minTime) * scaleX;
        if (x < paddingLeft || x > paddingLeft + chartWidth) continue;
        const dateAtTime = new Date(t);
        const hour = dateAtTime.getHours(); 
        
        if (hoursToShow.includes(hour)) {
            const label = format(dateAtTime, 'HH:mm');
            ctx.fillText(label, x, paddingTop + chartHeight + 15);
        }
    }
    ctx.antialias = 'none'; // VYPNTUTÍ anti-aliasingu
    ctx.textDrawingMode = 'path';

    // Zobrazení AKTUÁLNÍ CENY z poslední UZAVŘENÉ svíčky vlevo u čárkované linky
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const currentPriceToDisplay = Math.round(lastClosedCandlePrice);
    ctx.fillStyle = 'black';
    ctx.font = '14px "TerminusTTF", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(currentPriceToDisplay.toLocaleString(), 5, yCurrentPriceFromLastClosedCandle - 5);
    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // Horní řádek textů: Ticker, Nákupní cena, Aktuální cena, Profit (ROZDELENO NA DVA ŘÁDKY)
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const averageBuyPrice = 78000;
    const currentPriceRoundedTop = Math.round(lastClosedCandlePrice);
    let profitPercentage = 0;
    if (averageBuyPrice > 0) {
        profitPercentage = ((lastClosedCandlePrice - averageBuyPrice) / averageBuyPrice) * 100;
    }
    const profitFormattedText = `${profitPercentage.toFixed(2)}%`;

    // První řádek nahoře
    const topTextLine1 = 'BTCUSDT';
    const fontLine1 = `bold 14px "TerminusTTF", monospace`; 

    // Druhý řádek nahoře (s cenami a profitem)
    const topTextLine2 = `Nákupní cena: ${averageBuyPrice.toLocaleString()} USDT Aktuální cena: ${currentPriceRoundedTop.toLocaleString()} USDT Profit: ${profitFormattedText}`;
    const fontLine2 = `bold 14px "TerminusTTF", monospace`; 
    const topRowY1 = 20; 
    const topRowY2 = topRowY1 + 20; // Mezera upravena pro 14px font

    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';

    // Vykreslení prvního řádku
    ctx.font = fontLine1;
    ctx.fillText(topTextLine1, width / 2, topRowY1);

    // Vykreslení druhého řádku
    ctx.font = fontLine2;
    ctx.fillText(topTextLine2, width / 2, topRowY2);

    ctx.antialias = 'none';
    ctx.textDrawingMode = 'path';

    // Spodní řádek textů: "Poslední aktualizace:", Datum, Čas a Time Frame (ROZDELENO NA DVA ŘÁDKY)
    ctx.antialias = 'default';
    ctx.textDrawingMode = 'glyph';
    const lastCandleTime = new Date(candles[candles.length - 1].t);
    const formattedDate = format(lastCandleTime, 'dd.MM.yyyy');
    const cestHours = lastCandleTime.getHours();
    const cestMins = lastCandleTime.getMinutes();
    const utcHours = lastCandleTime.getUTCHours();
    const nyHours = (utcHours - 4 + 24) % 24;
    const nyMins = lastCandleTime.getUTCMinutes();

    // První řádek dole
    const bottomTextLine1 = `Poslední aktualizace: ${formattedDate} ${('0' + cestHours).slice(-2)}:${('0' + cestMins).slice(-2)} CEST | ${('0' + nyHours).slice(-2)}:${('0' + nyMins).slice(-2)} NY`;
    const fontBottomLine1 = '14px "TerminusTTF", monospace';
    
    // Druhý řádek dole
    const bottomTextLine2 = `Time Frame: 15 minut`;
    const fontBottomLine2 = '14px "TerminusTTF", monospace';

    const lineSpacingBottom = 20; 
    const bottomRowY2 = height - 15;
    const bottomRowY1 = bottomRowY2 - lineSpacingBottom;

    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.fillText(bottomTextLine1, width / 2, bottomRowY1);
    ctx.fillText(bottomTextLine2, width / 2, bottomRowY2);
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