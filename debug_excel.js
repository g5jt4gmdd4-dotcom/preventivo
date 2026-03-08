const xlsx = require('xlsx');
const workbook = xlsx.readFile('Prezzi voli.xlsx');
const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
console.log(data.slice(0, 5));
