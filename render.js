const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
const sharp = require('sharp'); 

const width = 648;
const height = 480;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

ctx.antialias = 'none';
ctx.imageSmoothingEnabled = false;
ctx.textDrawingMode = 'glyph';

const fontPathPlex = path.join(__dirname, 'fonts', 'IBMPlexMono-Regular.ttf');
try {
    registerFont(fontPathPlex, { family: 'IBMPlexMono' });
} catch (error) {
    console.warn(`Font IBM Plex Mono nebyl nalezen. Chyba: ${error.message}`);
}

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

async function drawChart() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    let candles;
    let lastClosedCandlePrice;

    try {
        candles = await getBinanceCandlesData();
        if (!candles || candles.length < 2) throw new Error("Nedostatek dat svíček.");
        lastClosedCandlePrice = candles[candles.length - 2].c;
    } catch (error) {
        console.error("Chyba při načítání dat:", error);
        ctx.fillStyle = 'black';
        ctx.font = '16px "IBMPlexMono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Chyba načítání dat!', width / 2, height / 2);
        saveImage();
        return;
    }

    const paddingLeft = 40;
    const paddingRight = 90;
    const paddingTop = 80;
    // Decreased paddingBottom to reduce the gap
    const paddingBottom = 100; // Adjusted from 120 to 100
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (chartHeight <= 0) {
        console.error("Chart height is too small or negative. Adjust padding values.");
        ctx.fillStyle = 'black';
        ctx.font = '16px "IBMPlexMono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Chyba rozměrů grafu!', width / 2, height / 2);
        saveImage();
        return;
    }

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

    // Draw X-axis (bottom line of the chart)
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop + chartHeight);
    ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
    ctx.stroke();

    // Draw Y-axis (right line of the chart)
    const axisY_XPosition = paddingLeft + chartWidth;
    ctx.beginPath();
    ctx.moveTo(axisY_XPosition, paddingTop);
    ctx.lineTo(axisY_XPosition, paddingTop + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.font = '16px "IBMPlexMono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let p = minPrice; p <= maxPrice; p += 500) {
        const y = paddingTop + chartHeight - (p - adjustedMinPrice) * scaleY;
        if (y < paddingTop || y > paddingTop + chartHeight + 10) continue;
        ctx.fillText(p.toLocaleString(), axisY_XPosition + 5, y);
    }

    // Draw candles
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

    // Draw current price line
    const yCurrentPrice = paddingTop + chartHeight - (lastClosedCandlePrice - adjustedMinPrice) * scaleY;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yCurrentPrice);
    ctx.lineTo(paddingLeft + chartWidth, yCurrentPrice);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw current price label on Y-axis
    ctx.font = '16px "IBMPlexMono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(lastClosedCandlePrice).toLocaleString(), 5, yCurrentPrice - 5);


    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';

    // Draw X-axis labels (times)
    const hoursToShow = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    for (let t = Math.ceil(minTime / (1000 * 60 * 60)) * (1000 * 60 * 60); t <= maxTime; t += (1000 * 60 * 60)) {
        const x = paddingLeft + (t - minTime) * scaleX;
        if (x < paddingLeft || x > paddingLeft + chartWidth) continue;
        const hour = new Date(t).getHours();
        if (hoursToShow.includes(hour)) {
            const label = format(new Date(t), 'HH:mm');
            // X-axis label position, relative to the new paddingBottom
            ctx.fillText(label, x, paddingTop + chartHeight + 18); 
        }
    }

    // Header information
    const averageBuyPrice = 78000;
    const profit = ((lastClosedCandlePrice - averageBuyPrice) / averageBuyPrice) * 100;
    ctx.fillText(`BTCUSDT   Nákupní cena: ${averageBuyPrice.toLocaleString()} USDT`, width / 2, 40);
    ctx.fillText(`Aktuální cena: ${Math.round(lastClosedCandlePrice).toLocaleString()} USDT   Profit: ${profit.toFixed(2)}%`, width / 2, 64);

    // Footer information (Last update and Time Frame)
    const lastCandleTime = new Date(candles[candles.length - 1].t);
    const formattedDate = format(lastCandleTime, 'dd.MM.yyyy');
    const cestHours = lastCandleTime.getHours();
    const cestMins = lastCandleTime.getMinutes();
    const utcHours = lastCandleTime.getUTCHours();
    const nyHours = (utcHours - 4 + 24) % 24;
    const nyMins = lastCandleTime.getUTCMinutes();

    // Y positions for footer text are kept relative to height, which adjusts with paddingBottom
    ctx.fillText(`Poslední aktualizace: ${formattedDate} ${('0' + cestHours).slice(-2)}:${('0' + cestMins).slice(-2)} CEST | ${('0' + nyHours).slice(-2)}:${('0' + nyMins).slice(-2)} NY`, width / 2, height - 35);
    ctx.fillText('Time Frame: 15 minut', width / 2, height - 15);

    saveImage();
}

function saveImage() {
    const buffer = canvas.toBuffer('image/png', {
        compressionLevel: 9,
        filters: canvas.PNG_FILTER_NONE,
        palette: true,
        colors: 2
    });
    fs.writeFileSync('btc-chart.png', buffer);
    console.log('Graf byl vygenerován.');
}

drawChart();