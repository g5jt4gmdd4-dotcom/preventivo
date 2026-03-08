const fs = require('fs');

function decodeQuotedPrintable(str) {
    return str
        .replace(/=\r\n/g, '')
        .replace(/=([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        })
        .replace(/=E0/g, 'à')
        .replace(/=E8/g, 'è')
        .replace(/=E9/g, 'é')
        .replace(/=EC/g, 'ì')
        .replace(/=F2/g, 'ò')
        .replace(/=F9/g, 'ù');
}

const content = fs.readFileSync('./preventivo.eml', 'utf-8');
const htmlStart = content.indexOf('<html>');
const htmlEnd = content.indexOf('</html>') + 7;
let html = content.substring(htmlStart, htmlEnd);

html = decodeQuotedPrintable(html);

// Remove the signature part if it exists (the one before the template)
// The user wants the output IDENTICAL to the model. 
// The model in the eml has some stuff before "OFFERTA SOLO SOGGIORNO"
// "Buongiorno, In risposta alla sua cortese richiesta..."
// I should keep it if it's part of the template.

fs.writeFileSync('./cleaned_template.html', html);
