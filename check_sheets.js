const xlsx = require('xlsx');
const workbook = xlsx.readFile('Prezzi voli.xlsx');
console.log('SheetNames:', workbook.SheetNames);
