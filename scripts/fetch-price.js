const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TRADINGVIEW_URL = 'https://www.tradingview.com/symbols/NYMEX-AGT1!/';
const DATA_FILE = path.join(__dirname, '..', 'data', 'prices.json');

async function fetchPrice() {
    console.log('Starting price fetch...');
    console.log(`URL: ${TRADINGVIEW_URL}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('Navigating to TradingView...');
        await page.goto(TRADINGVIEW_URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for price element to load
        console.log('Waiting for price element...');
        await page.waitForSelector('[class*="lastContainer"] [class*="last-"]', { timeout: 30000 });

        // Extract the price - TradingView uses dynamic class names, so we look for patterns
        const priceData = await page.evaluate(() => {
            // Try multiple selectors as TradingView changes their structure
            const selectors = [
                '[class*="lastContainer"] [class*="last-"]',
                '[data-name="legend-source-item"] [class*="value"]',
                '.tv-symbol-price-quote__value',
                '[class*="priceValue"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent.trim();
                    // Extract numeric value
                    const match = text.match(/[\d,]+\.?\d*/);
                    if (match) {
                        return match[0].replace(/,/g, '');
                    }
                }
            }

            // Fallback: search for any element with a price-like value
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.children.length === 0) {
                    const text = el.textContent.trim();
                    // Match price patterns like "692.50" or "1,234.56"
                    if (/^[\d,]+\.\d{2}$/.test(text)) {
                        const value = parseFloat(text.replace(/,/g, ''));
                        // Reasonable range for gas oil futures (per metric ton)
                        if (value > 100 && value < 2000) {
                            return text.replace(/,/g, '');
                        }
                    }
                }
            }

            return null;
        });

        if (!priceData) {
            throw new Error('Could not extract price from page');
        }

        const price = parseFloat(priceData);
        console.log(`Extracted price: $${price}`);

        // Get current date in ISO format
        const today = new Date().toISOString().split('T')[0];

        // Load existing data or create new
        let data = { current: null, history: [] };
        if (fs.existsSync(DATA_FILE)) {
            const existingData = fs.readFileSync(DATA_FILE, 'utf8');
            data = JSON.parse(existingData);
        }

        // Check if we already have a price for today
        const existingTodayIndex = data.history.findIndex(entry => entry.date === today);

        const newEntry = {
            price: price,
            date: today,
            timestamp: new Date().toISOString()
        };

        if (existingTodayIndex !== -1) {
            // Update today's entry
            data.history[existingTodayIndex] = newEntry;
            console.log('Updated existing entry for today');
        } else {
            // Add new entry
            data.history.unshift(newEntry);
            console.log('Added new entry for today');
        }

        // Update current price
        data.current = newEntry;

        // Sort history by date (newest first)
        data.history.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Write updated data
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log(`Data saved to ${DATA_FILE}`);

        await browser.close();
        console.log('Price fetch completed successfully!');

        return price;

    } catch (error) {
        console.error('Error fetching price:', error.message);

        if (browser) {
            await browser.close();
        }

        // Exit with error code for GitHub Actions
        process.exit(1);
    }
}

// Run the fetcher
fetchPrice();
