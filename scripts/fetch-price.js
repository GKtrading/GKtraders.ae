/**
 * EN590/Gasoil Price Fetcher
 * Uses Yahoo Finance API for Heating Oil futures (HO=F) as proxy for diesel prices
 * Converts from USD/gallon to USD/metric ton
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const YAHOO_API_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/HO=F';
const DATA_FILE = path.join(__dirname, '..', 'data', 'prices.json');

// Conversion: 1 metric ton of diesel ≈ 313.32 gallons
const GALLONS_PER_MT = 313.32;

function fetchFromYahoo() {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        https.get(YAHOO_API_URL, options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);

                    if (json.chart && json.chart.result && json.chart.result[0]) {
                        const meta = json.chart.result[0].meta;
                        const pricePerGallon = meta.regularMarketPrice;

                        if (pricePerGallon) {
                            resolve({
                                pricePerGallon,
                                currency: meta.currency,
                                symbol: meta.symbol,
                                exchange: meta.exchangeName
                            });
                        } else {
                            reject(new Error('No price data in response'));
                        }
                    } else {
                        reject(new Error('Invalid API response structure'));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });

        }).on('error', (e) => {
            reject(new Error(`Request failed: ${e.message}`));
        });
    });
}

async function fetchPrice() {
    console.log('Starting price fetch...');
    console.log('Source: Yahoo Finance API (Heating Oil Futures HO=F)');

    try {
        const yahooData = await fetchFromYahoo();

        console.log(`Raw price: $${yahooData.pricePerGallon}/gallon`);

        // Convert to price per metric ton
        const pricePerMT = yahooData.pricePerGallon * GALLONS_PER_MT;
        const roundedPrice = Math.round(pricePerMT * 100) / 100;

        console.log(`Converted price: $${roundedPrice}/MT`);

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
            price: roundedPrice,
            date: today,
            timestamp: new Date().toISOString(),
            source: 'Yahoo Finance HO=F',
            rawPrice: yahooData.pricePerGallon,
            rawUnit: 'USD/gallon'
        };

        if (existingTodayIndex !== -1) {
            data.history[existingTodayIndex] = newEntry;
            console.log('Updated existing entry for today');
        } else {
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
        console.log('Price fetch completed successfully!');

        return roundedPrice;

    } catch (error) {
        console.error('Error fetching price:', error.message);
        process.exit(1);
    }
}

// Run the fetcher
fetchPrice();
