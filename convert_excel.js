const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbook = xlsx.readFile('Prezzi voli.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(worksheet);

// First row contains the labels, we skip it for the actual prices
const mappings = rawData[0];
const prices = rawData.slice(1).map(row => {
  return {
    period: row.Periodo,
    prices: {
      "Bilo 4p Super": row.Bilo,
      "Bilo 4p": row.Bilo_1,
      "Mono 3p": row.Mono,
      "Mono 2p": row.Mono_1,
      "Chalet 2+1": row.Chalet_1,
      "Bungalow 2p": row.Bungalow
    }
  };
});

const output = {
  weeks: prices.map(p => p.period),
  prices: prices
};

const outputPath = path.join(__dirname, 'src', 'data', 'flight_prices.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Converted Excel to structured JSON: ${outputPath}`);
