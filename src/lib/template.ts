import { QuoteResult, formatEuro } from './calculator';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const ACCOMMODATION_MAPPING: Record<string, { title: string, desc: string }> = {
  'Bilo 4p Super': {
    title: 'Bilocale 4 posti letto Super',
    desc: 'con angolo cottura in veranda chiusa, bagno con doccia e aria condizionata'
  },
  'Bilo 4p': {
    title: 'Bilocale 4 posti letto',
    desc: 'con angolo cottura in veranda coperta, bagno con doccia e ventilatore a soffitto<br>'
  },
  'Mono 3p': {
    title: 'Monolocale 3 posti letto',
    desc: 'con angolo cottura attrezzato, bagno con doccia, veranda coperta e ventilatore a soffitto<br>'
  },
  'Mono 2p': {
    title: 'Monolocale 2 posti letto',
    desc: 'con angolo cottura attrezzato, bagno con doccia, veranda coperta e ventilatore a soffitto<br>'
  },
  'Chalet 2+1': {
    title: 'Chalet in legno 2+1 posti letto',
    desc: 'con angolo cottura in veranda coperta, bagno con doccia e aria condizionata'
  },
  'Bungalow 2p': {
    title: 'Bungalow in muratura 2 posti letto',
    desc: 'con angolo cottura in veranda coperta, bagno con doccia e aria condizionata'
  }
};

function floorToCents(amount: number): number {
  return Math.floor(amount * 100) / 100;
}

export function generateHtml(res: QuoteResult): string {
  const customerFullName = [res.customerFirstName, res.customerLastName].filter(Boolean).join(' ').trim();
  const depositRate = res.isFlight ? 0.5 : 0.3;
  const depositLabel = res.isFlight ? '50%' : '30%';
  const depositBase = res.isFlight ? (res.finalTotal - (res.restaurantGrandTotal || 0)) : res.finalTotal;
  const depositAmount = floorToCents(depositBase * depositRate);
  const balanceInProperty = Math.round((res.finalTotal - depositAmount) * 100) / 100;
  const hideBalanceForPayNow = !!(res.payNowDiscount && res.payNowDiscount > 0);

  // Density logic for A4 fitting
  const rowCount = res.rows.length + (res.isConferma ? res.restaurantRows.length : 0);
  const accCount = res.accommodations.length;
  const extraItemsCount = (res.includeForfait ? 1 : 0) + (res.includeTransfer ? 1 : 0) + (res.hasExtraBed ? 1 : 0);
  
  // Scoring: accs = 3 points, rows = 1 point, extras = 1 point
  const densityScore = (accCount * 3) + rowCount + (extraItemsCount * 0.5);
  
  let fs = res.isConferma ? '10pt' : '11pt';      // lowered to 10pt for confirmations
  let fsTitle = res.isConferma ? '16px' : '18px'; 
  let cellPad = '6px';  
  let sectionMar = '15px'; 
  let boxPad = '6px 10px'; 
  let rowFS = res.isConferma ? '10pt' : '11pt';
  
  if (densityScore > 10) { // lowered from 12
      // Level 2: Compact
      fs = '9.5pt';
      fsTitle = '15px';
      cellPad = '5px';
      sectionMar = '10px';
      boxPad = '5px 8px';
      rowFS = '9.5pt';
  }
  
  if (densityScore > 18) { // Level 3: Ultra Compact
      fs = '9pt';
      fsTitle = '14px';
      cellPad = '3px'; // reduced from 4px
      sectionMar = '6px'; // reduced from 8px
      boxPad = '3px 5px'; // reduced from 4px 6px
      rowFS = '9pt';
  }
  
  // New Level 4: Extreme compression for very large quotes
  if (densityScore > 25) {
      fs = '8.5pt';
      cellPad = '2px';
      sectionMar = '4px';
      boxPad = '2px 4px';
      rowFS = '8.5pt';
  }

  let noteLinesCount = 4;
  if (densityScore > 22) noteLinesCount = 0;
  else if (densityScore > 18) noteLinesCount = 1;
  else if (densityScore > 14) noteLinesCount = 2;
  else if (densityScore > 10) noteLinesCount = 3;

  // Title
  const title = res.isFlight ? "OFFERTA VOLO + SOGGIORNO" : "OFFERTA SOLO SOGGIORNO";

  // Accommodations description logic
  const accommodationsDesc = res.accommodations.map(acc => {
    const mapping = ACCOMMODATION_MAPPING[acc.type];
    
    let pricesText = '';
    if (res.isFlight) {
        pricesText = acc.prices.length > 0 ? `Costo del pacchetto a persona € ${formatEuro(acc.prices[0])}` : '';
    } else {
        if (acc.prices.length === 0) {
          pricesText = '';
        } else if (acc.prices.length === 1) {
          pricesText = `Costo giornaliero dell'alloggio € ${formatEuro(acc.prices[0])} a notte`;
        } else {
          pricesText = `Costo giornaliero dell'alloggio da € ${formatEuro(Math.min(...acc.prices))} a € ${formatEuro(Math.max(...acc.prices))} a notte`;
        }
    }
    
    const quantityPrefix = acc.quantity > 1 ? `N. ${acc.quantity} ` : '';
    const prefix = res.isFlight ? 'Soggiorno in ' : 'Soggiorno in '; 
    const flightLine = res.isFlight && acc.flightAirport ? `<div style="font-weight: normal; margin: 5px 0;">Volo A/R da ${acc.flightAirport}</div>` : '';

    return `
    <div style="margin-bottom: ${sectionMar === '30px' ? '20px' : '10px'}; text-align: center; font-size: ${fs};">
      <div style="margin-bottom: 5px; font-weight: bold;">${acc.period || ''}</div>
      <span style="font-weight: normal;">${prefix}${quantityPrefix}${mapping.title}</span> ${mapping.desc}
      ${flightLine}
      <div style="font-weight: normal; margin: 5px 0;">${pricesText}</div>
    </div>
    `;
  }).join('');

  // Extras List Logic
  const hasSecondWeekSupplement = res.rows.some(r => r.label === 'Supplemento 2° Settimana');
  const hasAirportTaxes = res.rows.some(r => r.label === 'Tasse Aeroportuali');

  // Check for Air Con logic across all accommodations
  const accsWithAirCon = res.accommodations.filter(acc => 
    acc.type === 'Bungalow 2p' || acc.type === 'Bilo 4p Super' || acc.type === 'Chalet 2+1'
  );
  
  let airConText = '';
  if (accsWithAirCon.length > 0) {
    if (res.accommodations.length === 1) {
       // Only one accommodation and it has AC
       airConText = '<li style="margin-bottom: 5px;"><strong>Aria condizionata</strong> inclusa</li>';
    } else {
       // Multiple accommodations
       if (accsWithAirCon.length === res.accommodations.length) {
         // All have AC
         airConText = '<li style="margin-bottom: 5px;"><strong>Aria condizionata</strong> inclusa</li>';
       } else {
         // Mixed
         const types = Array.from(new Set(accsWithAirCon.map(a => a.type))).join(' e ');
         airConText = `<li style="margin-bottom: 5px;"><strong>Aria condizionata</strong> inclusa (SOLO IN ${types})</li>`;
       }
    }
  }

  const showExtras = res.includeForfait || res.includeTransfer || res.hasExtraBed || airConText !== '' || hasSecondWeekSupplement || hasAirportTaxes;

  const extrasHtml = showExtras ? `
    <div style="margin-bottom: ${sectionMar}; text-align: center;">
      <div style="font-size: ${fs}; text-align: left; display: inline-block; max-width: 800px;">
        <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
          ${res.includeForfait ? '<li style="margin-bottom: 5px;"><strong>FORFAIT SERVIZI</strong> a fine soggiorno €15,00 a persona per settimana. Comprende: pulizie finali, cambio lenzuola ed asciugamani settimanale, consumi di acqua luce e gas, parcheggio auto/moto/carrelli.</li>' : ''}
          ${res.includeTransfer ? '<li style="margin-bottom: 5px;"><strong>TRANSFER A/R</strong> a e per aeroporto/porto €10,00 a persona. Da prenotare almeno 3 giorni prima comunicando aeroporto di partenza ed orario d\'arrivo.</li>' : ''}
          ${hasSecondWeekSupplement ? '<li style="margin-bottom: 5px;"><strong>Supplemento 2° settimana</strong> €70,00 a persona</li>' : ''}
          ${hasAirportTaxes ? '<li style="margin-bottom: 5px;"><strong>Tasse aeroportuali</strong> €35,00 a persona</li>' : ''}
          ${airConText}
          ${res.hasExtraBed ? '<li style="margin-bottom: 5px;"><strong>Letto aggiuntivo</strong> €10,00 a persona al giorno</li>' : ''}
        </ul>
      </div>
    </div>
  ` : '';


  // Rows logic (Cute Table Style)
  const staysRowsHtml = res.rows
    .filter(r => r.isStay)
    .map((row, idx) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? '#f0f9ff' : '#ffffff';
      return `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e0f2fe;">
        <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.periodStart} - ${row.periodEnd}
        </td>
        <td style="padding: ${cellPad}; text-align: left; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.label}
        </td>
        <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.quantity > 0 ? row.quantity : '-'}
        </td>
        <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          € ${formatEuro(row.pricePerUnit)}
        </td>
        <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000; font-weight: 600;">
          € ${formatEuro(row.total)}
        </td>
      </tr>
      `;
    }).join('');

  const restaurantRowsHtml = res.isConferma ? res.restaurantRows.map((row, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#f0f9ff' : '#ffffff';
    return `
    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e0f2fe;">
      <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
        ${row.periodStart} - ${row.periodEnd}
      </td>
      <td style="padding: ${cellPad}; text-align: left; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
        ${row.label}
      </td>
      <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
        ${row.quantity}
      </td>
      <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
        -
      </td>
      <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000; font-weight: 600;">
        € ${formatEuro(row.total)}
      </td>
    </tr>
    `;
  }).join('') : '';

  const extrasRowsHtml = res.rows
    .filter(r => !r.isStay)
    .map((row, idx) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? '#f0f9ff' : '#ffffff';
      return `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e0f2fe;">
        <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.periodStart || '-'} ${row.periodEnd ? `- ${row.periodEnd}` : ''}
        </td>
        <td style="padding: ${cellPad}; text-align: left; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.label}
        </td>
        <td style="padding: ${cellPad}; text-align: center; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          ${row.quantity > 0 ? row.quantity : '-'}
        </td>
        <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000;">
          € ${formatEuro(row.pricePerUnit)}
        </td>
        <td style="padding: ${cellPad}; text-align: right; font-family: Aptos, sans-serif; font-size: ${rowFS}; color: #000000; font-weight: 600;">
          € ${formatEuro(row.total)}
        </td>
      </tr>
      `;
    }).join('');

  // Restaurant Table (Softer Style)
  let restaurantHtml = '';
  if (res.restaurantRows.length > 0) {
    const restaurantRowsHtml = res.restaurantRows.map((row, idx) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? '#f0f9ff' : '#ffffff'; // Same light blue
      return `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e0f2fe;">
        <td style="padding: 12px; text-align: center; font-family: Aptos, sans-serif; font-size: 11pt; color: #000000;">
          ${row.periodStart} - ${row.periodEnd}
        </td>
        <td style="padding: 12px; text-align: left; font-family: Aptos, sans-serif; font-size: 11pt; color: #000000;">
          ${row.label}
        </td>
        <td style="padding: 12px; text-align: center; font-family: Aptos, sans-serif; font-size: 11pt; color: #000000;">
          ${row.quantity}
        </td>
        <td style="padding: 12px; text-align: right; font-family: Aptos, sans-serif; font-size: 11pt; color: #000000; font-weight: 600;">
          € ${formatEuro(row.total)}
        </td>
      </tr>
    `}).join('');

    restaurantHtml = `
      <div style="margin-top: ${sectionMar}; margin-bottom: ${sectionMar};" align="center">
        <table width="680" align="center" style="width: 680px; max-width: 100%; margin: 0 auto; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; table-layout: fixed;">
          <thead style="background-color: #f1f5f9;">
            <tr>
              <th style="padding: ${cellPad}; text-align: center; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, sans-serif; width: 25%;">Periodo</th>
              <th style="padding: ${cellPad}; text-align: left; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, sans-serif; width: 55%;">Descrizione</th>
              <th style="padding: ${cellPad}; text-align: center; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, sans-serif; width: 10%;">Pax/Gg</th>
              <th style="padding: ${cellPad}; text-align: right; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, sans-serif; width: 10%;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${restaurantRowsHtml}
          </tbody>
          <tfoot>
            ${res.restaurantDiscount.enabled ? `
            <tr>
              <td colspan="3" style="padding: 8px 12px; text-align: right; color: #dc2626; font-family: Aptos, sans-serif; font-size: 10pt;">Sconto Ristorante (${res.restaurantDiscount.type === 'fixed' ? 'Fisso' : res.restaurantDiscount.value + '%'}):</td>
              <td style="padding: 8px 12px; text-align: right; color: #dc2626; font-family: Aptos, sans-serif; font-size: 10pt;">- € ${formatEuro(res.totalRestaurant - res.restaurantGrandTotal)}</td>
            </tr>
            ` : ''}
            <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <td colspan="3" style="padding: ${cellPad}; text-align: right; color: #000000; font-family: Aptos, sans-serif; font-size: ${rowFS};">Totale Ristorante:</td>
              <td style="padding: ${cellPad}; text-align: right; color: #000000; font-family: Aptos, sans-serif; font-size: ${fsTitle}; font-weight: bold;">€ ${formatEuro(res.restaurantGrandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  // Restaurant General Info
  const restaurantInfoHtml = `
    <div style="margin-bottom: ${sectionMar}; font-size: ${fs}; text-align: center;">
      <div style="font-weight: bold; margin-bottom: 5px; text-transform: uppercase; font-size: ${fsTitle};">Ristorante</div>
      <a href="https://www.laroccia.net/ita-37-1/ristorante" style="color: #2563eb; text-decoration: underline; font-weight: normal;">RISTORANTE LA ROCCIA - CLICCA PER AVERE PIU' INFO</a>
      <p style="margin: 10px 0; font-weight: normal;">
        Mezza pensione euro 35,00 al giorno per gli adulti, ed euro 20,00 per i bambini con età inferiore ai 12 anni<br>
        Colazione: caffè/cappuccino/succo ed un cornetto<br>
        Pranzo o cena: Antipasto, primo, secondo e contorno | ½l acqua ed ¼ di vino
        <br><br>
        Pensione completa euro 55,00 al giorno, ed euro 35,00 per i bambini con età inferiore ai 12 anni
      </p>
    </div>
  `;
  const today = format(new Date(), 'dd/MM/yyyy');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const logoPath = `${basePath}/logo.png`;
  const allRowsHtml = staysRowsHtml + restaurantRowsHtml + extrasRowsHtml;

  // Function to generate content for a specific page
  const getPageContentHtml = (pageNumber: number) => {
    const isPage2 = pageNumber === 2;
    const showFlightInfo = isPage2 || (pageNumber === 1 && res.isFlight);
    
    // Flight info block
    const flightInfoSideBlock = showFlightInfo ? `
      <div style="text-align: left; font-size: ${fs}; line-height: 1.4; color: #000000;">
        <strong>Arrivo:</strong> ${[res.flightCodeOut, res.accommodations[0]?.flightAirport, res.arrivalInfo].filter(Boolean).join(', ')}<br>
        <strong>Partenza:</strong> ${[res.flightCodeReturn, res.accommodations[0]?.flightAirport, res.departureInfo].filter(Boolean).join(', ')}
      </div>
    ` : '';

    return `
    <div style="${isPage2 ? 'display: flex; flex-direction: column; min-height: 267mm;' : ''}">
      <div style="flex-shrink: 0;">
        ${res.isConferma ? `
        <!-- Logo and Company Info (Centered) -->
        <div style="text-align: center; margin-bottom: 5px;">
          <img src="${logoPath}" alt="Logo" style="display: block; margin: 0 auto 5px auto; max-height: 55px;">
          <div style="font-size: 9pt; line-height: 1.3; color: #000000;">
            <strong>Villaggio La Roccia Camping</strong><br>
            C.da Madonna - 92031 Lampedusa<br>
            CIR: 19084020B101960 | CIN: IT08420B1B77QEMZ6<br>
            <a href="https://www.laroccia.net" style="color: #000000; text-decoration: none;">www.laroccia.net</a>
          </div>
        </div>

        <!-- Header Section (SX: Flight Info, DX: Customer Info) -->
        <div style="display: flex; justify-content: ${showFlightInfo ? 'space-between' : 'flex-end'}; align-items: flex-end; margin-bottom: 15px;">
          ${flightInfoSideBlock}
          <div style="text-align: right; font-size: ${fs}; line-height: 1.4;">
            ${isPage2 ? 'Capogruppo' : 'Alla c.a del Sig.'}<br>
            <strong>${res.customerFirstName || ''} ${res.customerLastName || ''}</strong><br>
            ${res.contactEmail || ''}<br>
            ${res.contactPhone || ''}
          </div>
        </div>

        <!-- Confirmation Title and Date (Centered) -->
        <div style="text-align: center; margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; font-size: ${fs};">
          Lampedusa ${today} - CONFERMA PRENOTAZIONE${res.isFlight ? ' + VOLO A/R' : ''}
        </div>

        <!-- Accommodations List -->
        ${!isPage2 ? `
        <div style="margin-bottom: 15px; font-size: ${fs};">
          ${res.accommodations.map(acc => {
            const mapping = ACCOMMODATION_MAPPING[acc.type];
            return `<div style="margin-bottom: 3px;">- <strong>${mapping.title}</strong> (${acc.period})</div>`;
          }).join('')}
        </div>
        ` : ''}
        ` : `
        <!-- Original Title for Quotes -->
        <h1 style="text-align: center; margin: 0 0 5px 0; font-size: 24px; font-weight: bold; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; color: #000000; mso-line-height-rule: exactly; line-height: 120%;">
          ${title}
        </h1>
        `}

        ${!res.isConferma ? `
        <!-- Description (Quotes only) -->
        <div style="margin-bottom: 20px;">
          ${accommodationsDesc}
        </div>
        
        <!-- Extras List (Unified - Quotes only) -->
        ${extrasHtml}
        ` : ''}

        <!-- Cost Table -->
        <div style="margin-bottom: 20px;" align="center">
          <table width="680" align="center" style="width: 680px; max-width: 100%; margin: 0 auto; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; table-layout: fixed;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 12px; text-align: center; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 25%;">Periodo</th>
                <th style="padding: 12px; text-align: left; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 45%;">Descrizione</th>
                <th style="padding: 12px; text-align: center; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 10%;">Pax/Gg</th>
                <th style="padding: 12px; text-align: right; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 10%;">Prezzo</th>
                <th style="padding: 12px; text-align: right; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 10%;">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${res.isConferma ? `
                ${staysRowsHtml}
                ${restaurantRowsHtml}
                ${extrasRowsHtml}
              ` : `
                ${staysRowsHtml}
                ${extrasRowsHtml}
              `}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                <td colspan="4" style="padding: 12px; text-align: right; font-size: 11pt; color: #000000; font-family: Aptos, Calibri, sans-serif;">Totale Parziale:</td>
                <td style="padding: 12px; text-align: right; font-size: 12pt; font-weight: bold; color: #000000; font-family: Aptos, Calibri, sans-serif;">€ ${formatEuro(res.totalStay + (res.isConferma ? res.totalRestaurant : 0))}</td>
              </tr>
              ${res.discountAmount > 0 ? `
              <tr style="background-color: #f0fdf4;">
                <td colspan="4" style="padding: 10px 12px; text-align: right; font-size: 11pt; color: #15803d; font-family: Aptos, sans-serif;">${res.discountName || 'Sconto applicato'}:</td>
                <td style="padding: 10px 12px; text-align: right; font-size: 11pt; font-weight: 600; color: #15803d; font-family: Aptos, sans-serif;">- € ${formatEuro(res.discountAmount)}</td>
              </tr>
              ` : ''}
              ${res.payNowDiscount && res.payNowDiscount > 0 ? `
              <tr style="background-color: #f0fdf4;">
                <td colspan="4" style="padding: 10px 12px; text-align: right; font-size: 11pt; color: #15803d; font-family: Aptos, sans-serif;">Sconto Paga Prima:</td>
                <td style="padding: 10px 12px; text-align: right; font-size: 11pt; font-weight: 600; color: #15803d; font-family: Aptos, sans-serif;">- € ${formatEuro(res.payNowDiscount)}</td>
              </tr>
              ` : ''}
              ${res.isConferma && res.restaurantDiscount.enabled ? `
              <tr style="background-color: #f0fdf4;">
                <td colspan="4" style="padding: 10px 12px; text-align: right; font-size: 11pt; color: #15803d; font-family: Aptos, sans-serif;">Sconto Ristorante:</td>
                <td style="padding: 10px 12px; text-align: right; font-size: 11pt; font-weight: 600; color: #15803d; font-family: Aptos, sans-serif;">- € ${formatEuro(res.totalRestaurant - res.restaurantGrandTotal)}</td>
              </tr>
              ` : ''}
              
              ${isPage2 ? `
              <tr style="background-color: #eff6ff; border-top: 2px solid #3b82f6;">
                <td colspan="4" style="padding: 6px 12px; text-align: right; font-size: 11pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">TOTALE FINALE:</td>
                <td style="padding: 6px 12px; text-align: right; font-size: 11pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">€ ${formatEuro(res.finalTotal)}</td>
              </tr>
              ${!hideBalanceForPayNow ? `
              <tr style="background-color: #eff6ff;">
                <td colspan="4" style="padding: 3px 12px; text-align: right; font-size: 10pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">Caparra richiesta (${depositLabel}):</td>
                <td style="padding: 3px 12px; text-align: right; font-size: 10pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">€ ${formatEuro(depositAmount)}</td>
              </tr>
              <tr style="background-color: #eff6ff;">
                <td colspan="4" style="padding: 3px 12px; text-align: right; font-size: 10pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">Saldo in struttura:</td>
                <td style="padding: 3px 12px; text-align: right; font-size: 10pt; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif;">€ ${formatEuro(balanceInProperty)}</td>
              </tr>
              ` : ''}
              ` : ''}
            </tfoot>
          </table>
        </div>
      </div>

      ${isPage2 ? `
      <!-- Space Filler with dynamic notes -->
      <div style="flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-top: 10px; margin-bottom: 20px; font-size: ${fs}; color: #000; display: flex; align-items: flex-end;">
          <span style="white-space: nowrap;">Caparra versata il:</span>
          <div style="flex-grow: 1; border-bottom: 1px solid #000; margin-left: 10px; height: 1px;"></div>
        </div>

        <div style="margin-top: 10px; font-size: ${fs}; color: #000; flex-grow: 1;">
          <div style="margin-bottom: ${densityScore > 10 ? '15px' : '25px'}; display: flex; align-items: flex-end;">
            <span style="white-space: nowrap;">Note:</span>
            <div style="flex-grow: 1; border-bottom: 1px solid #000; margin-left: 10px; height: 1px;"></div>
          </div>
          ${Array.from({ length: noteLinesCount - 1 }).map(() => `
            <div style="border-bottom: 1px solid #000; margin-bottom: ${densityScore > 10 ? '15px' : '25px'}; height: 1px; width: 100%;"></div>
          `).join('')}
        </div>
      </div>

      <!-- Seconda Tabella Ultra-Compatta (Ancorata al Fondo) -->
      <div style="margin-top: auto; border-top: 1px dashed #ccc; padding-top: 20px; flex-shrink: 0; padding-bottom: 10px;" align="center">
        <div style="font-size: 9pt; font-weight: bold; color: #666; margin-bottom: 8px; text-transform: uppercase;">Riepilogo Interno</div>
        <table width="680" align="center" style="width: 680px; max-width: 100%; margin: 0 auto; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 9pt;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #3b82f6;">
              <th style="padding: 3px 6px; text-align: center; border: 1px solid #e5e7eb; color: #1e3a8a; width: 25%;">Periodo</th>
              <th style="padding: 3px 6px; text-align: left; border: 1px solid #e5e7eb; color: #1e3a8a; width: 45%;">Descrizione</th>
              <th style="padding: 3px 6px; text-align: center; border: 1px solid #e5e7eb; color: #1e3a8a; width: 10%;">Pax/Gg</th>
              <th style="padding: 3px 6px; text-align: right; border: 1px solid #e5e7eb; color: #1e3a8a; width: 10%;">Prezzo</th>
              <th style="padding: 3px 6px; text-align: right; border: 1px solid #e5e7eb; color: #1e3a8a; width: 10%;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${allRowsHtml.replace(/padding:[^;]+;/g, 'padding: 3px 6px;').replace(/font-size:[^;]+;/g, 'font-size: 9pt;')}
          </tbody>
          <tfoot>
            <tr style="background-color: #eff6ff; border-top: 1px solid #3b82f6;">
              <td colspan="4" style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">TOTALE FINALE:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">€ ${formatEuro(res.finalTotal)}</td>
            </tr>
            ${!hideBalanceForPayNow ? `
            <tr style="background-color: #eff6ff;">
              <td colspan="4" style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">Caparra (${depositLabel}):</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">€ ${formatEuro(depositAmount)}</td>
            </tr>
            <tr style="background-color: #eff6ff;">
              <td colspan="4" style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">Saldo:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: bold; color: #1e3a8a;">€ ${formatEuro(balanceInProperty)}</td>
            </tr>
            ` : ''}
          </tfoot>
        </table>
      </div>
      ` : ''}
    </div>

    ${!isPage2 ? `
    <!-- Grand Total Section (Page 1 Only) -->
    <div align="center" style="margin-bottom: ${sectionMar};">
    <table width="680" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="width: 680px; max-width: 100%; margin: 0 auto; border-collapse: separate; border-spacing: 0; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px;">
      <tr>
        <td align="center" style="padding: ${sectionMar === '30px' ? '20px' : '12px'};">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="font-size: ${fsTitle}; font-weight: bold; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif; padding-bottom: 5px;">TOTALE FINALE: € ${formatEuro(res.finalTotal)}</td>
            </tr>
            ${!hideBalanceForPayNow ? `
            <tr>
              <td align="center" style="font-size: ${fs}; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif; padding-bottom: 5px;">Caparra richiesta (${depositLabel}): € ${formatEuro(depositAmount)}</td>
            </tr>
            ` : ''}
            ${!hideBalanceForPayNow ? `
            <tr>
              <td align="center" style="font-size: ${fs}; color: #1e3a8a; font-family: Aptos, Calibri, sans-serif; padding-bottom: 5px;">Saldo in struttura: \u20AC ${formatEuro(balanceInProperty)}</td>
            </tr>
            ` : ''}
            ${res.payNowDiscount && res.payNowDiscount > 0 ? `<tr><td align="center" style="font-size: ${densityScore > 22 ? '8pt' : '10pt'}; color: #15803d; font-weight: bold; font-family: Aptos, Calibri, sans-serif; padding-bottom: 5px;">Per usufruire dello sconto paga prima, l'intero importo deve essere saldato entro 7 giorni dalla conferma.</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
    </div>
    ` : ''}

    ${!res.isConferma ? restaurantHtml : ''}
    ${!res.isConferma ? restaurantInfoHtml : ''}

    ${(res.isConferma && !isPage2) ? `
    <!-- IBAN and Notes Section (Page 1 Only) -->
    <div style="margin-top: ${sectionMar}; border-top: 1px solid #e2e8f0; padding-top: 10px;">
      <h3 style="font-size: ${fsTitle}; color: #1e3a8a; text-align: center; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">
        Istruzioni per il pagamento della caparra e note
      </h3>
      
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: ${boxPad}; border-radius: 4px; margin-bottom: 8px; font-size: ${fs}; line-height: 1.2;">
        ${res.useEfesoIban ? `
          IBAN: <strong>IT31N0710816600000000003300</strong><br>
          Intestato a: <strong>EfesoVacanze.com</strong><br>
          <strong>Banca di credito cooperativo</strong><br>
          SWIFT: <strong>000003300</strong><br>
          Causale: <strong>Prenotazione soggiorno ${res.customerLastName || ''}</strong>
        ` : `
          IBAN: IT58R0503682960CC4100005781<br>
          Intestato a: Camping la Roccia snc<br>
          BANCA AGRICOLA POPOLARE DI SICILIA  - AG. Di Lampedusa<br>
          SWIFT: POPRIT3RXXX<br>
          Causale: Prenotazione soggiorno ${res.customerLastName || ''}
        `}
      </div>

      <div style="text-align: center; font-weight: bold; color: #000000; margin-bottom: 8px; font-size: ${fs}; line-height: 1.2;">
        Una volta effettuato il versamento, Vi preghiamo di inviare copia della ricevuta a info@laroccia.net
      </div>

      <div style="margin-bottom: 8px; font-size: ${fs}; line-height: 1.2; text-align: center;">
        <strong style="color: #1e3a8a; text-transform: uppercase;">Check-in / Check-out</strong><br>
        Il check-in è garantito dalle ore 13:00. Gli alloggi devono essere liberati entro le ore 10:00 del giorno di partenza per consentire le operazioni di pulizia.
      </div>

      <div style="margin-bottom: 5px; font-size: ${fs}; line-height: 1.2; text-align: center;">
        <strong style="color: #1e3a8a; text-transform: uppercase;">Caparra e Saldo</strong><br>
        La prenotazione è considerata confermata solo al ricevimento della caparra richiesta (${depositLabel}). Il saldo dovrà essere corrisposto al momento del check-in.
      </div>
    </div>
    ` : ''}
    `;
  };

  // Main Template
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=Windows-1252">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      
      body {
        background-color: #f8fafc;
        margin: 0;
        padding: 40px 0;
      }
      
      .preview-page {
        background-color: white;
        width: 210mm;
        margin: 0 auto 50px auto;
        padding: ${densityScore > 22 ? '5mm 10mm' : '10mm 15mm'}; /* Dynamic padding for overflow */
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08);
        border-radius: 4px;
        box-sizing: border-box;
        border: 1px solid #e2e8f0;
        position: relative;
      }
      
      .preview-page::after {
        content: attr(data-page);
        position: absolute;
        bottom: 5mm; /* reduced */
        right: 10mm; /* reduced */
        font-size: 8pt;
        color: #000000;
      }
      
      .page-break {
        display: none;
      }
      
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body {
          background-color: white;
          padding: 0;
          margin: 0;
        }
        .preview-page {
          box-shadow: none;
          margin: 0;
          padding: ${densityScore > 22 ? '5mm 10mm' : '10mm 15mm'}; /* Dynamic padding for print */
          min-height: 297mm;
          border-radius: 0;
          border: none;
          width: 210mm;
          page-break-after: always;
          overflow: visible; /* Fondamentale per non tagliare */
        }
        .preview-page::after {
          display: none;
        }
        .page-break {
          display: none; /* Rimosso perché usiamo page-break-after sulla classe .preview-page */
        }
        
        body.print-pdf-only .preview-page:nth-of-type(n+2) {
          display: none !important;
        }
      }
    </style>
  </head>
  <body style="font-family: 'Inter', Aptos, sans-serif; font-size: 11pt; color: #000000; margin: 0; padding: 0;">
    
    <div class="preview-page" data-page="Pagina 1" align="center">
      <div style="width: 680px; max-width: 100%; margin: 0 auto; text-align: left;">
        ${getPageContentHtml(1)}
      </div>
    </div> <!-- End Page 1 -->


    ${res.isConferma ? `
    <!-- PAGE 2 (COPY IDENTICAL TO THE FIRST ONE) -->
    <div class="page-break"></div>
    <div class="preview-page" data-page="Pagina 2" align="center">
      <div style="width: 680px; max-width: 100%; margin: 0 auto; text-align: left;">
        ${getPageContentHtml(2)}
      </div>
    </div>
    ` : ''}


  </body>
  </html>
  `;

}

/**
 * Generates a plain text version of the quote for emails/copying.
 */
export function generatePlainText(res: QuoteResult): string {
  const customerFullName = [res.customerFirstName, res.customerLastName].filter(Boolean).join(' ').trim();
  const depositRate = res.isFlight ? 0.5 : 0.3;
  const depositLabel = res.isFlight ? '50%' : '30%';
  const depositAmount = floorToCents(res.finalTotal * depositRate);
  const balanceInProperty = Math.round((res.finalTotal - depositAmount) * 100) / 100;
  const hideBalanceForPayNow = !!(res.payNowDiscount && res.payNowDiscount > 0);

  let text = ``;
  text += `${res.isFlight ? "OFFERTA VOLO + SOGGIORNO" : "OFFERTA SOLO SOGGIORNO"}\n\n`;
  if (customerFullName) {
    text += `Gentile ${customerFullName},\n\n`;
  }
  
  res.accommodations.forEach(acc => {
    const mapping = ACCOMMODATION_MAPPING[acc.type];
    
    let pricesText = '';
    if (res.isFlight) {
        pricesText = acc.prices.length > 0 ? `Prezzo pacchetto a persona € ${formatEuro(acc.prices[0])}` : '';
    } else {
        if (acc.prices.length === 0) {
          pricesText = '';
        } else if (acc.prices.length === 1) {
          pricesText = `€ ${formatEuro(acc.prices[0])} a notte`;
        } else {
          pricesText = `con tariffe da € ${formatEuro(Math.min(...acc.prices))} a € ${formatEuro(Math.max(...acc.prices))} a notte`;
        }
    }
    
    const prefix = res.isFlight ? 'Pacchetto Volo + Soggiorno in ' : 'Soggiorno in ';
    text += `${prefix}${acc.quantity > 1 ? `N. ${acc.quantity} ` : ''}${mapping.title} ${mapping.desc} - ${pricesText}\n`;
    text += `${acc.period || ''}\n\n`;
  });

  text += `DETTAGLIO COSTI:\n`;
  res.rows.forEach(row => {
    text += `${row.label} (${row.periodStart} - ${row.periodEnd}): € ${formatEuro(row.total)}\n`;
  });

  if (res.totalDiscount > 0) {
    text += `Sconto applicato: - € ${formatEuro(res.totalDiscount)}\n`;
  }

  text += `\nTOTALE PREVENTIVO: € ${formatEuro(res.finalTotal)}\n`;
  text += `Caparra richiesta (${depositLabel}): € ${formatEuro(depositAmount)}\n`;
  if (!hideBalanceForPayNow) {
    text += `Saldo in struttura: \u20AC ${formatEuro(balanceInProperty)}\n`;
  }

  if (res.includeForfait || res.includeTransfer || res.hasExtraBed) {
    text += `\nSERVIZI INCLUSI/OPZIONALI:\n`;
    if (res.includeForfait) text += `• FORFAIT SERVIZI: €15,00/persona/settimana (pulizie, biancheria, consumi)\n`;
    if (res.includeTransfer) text += `• TRANSFER A/R: €10,00/persona\n`;
    if (res.hasExtraBed) text += `• Letto aggiuntivo: €10,00/persona/giorno\n`;
  }

  if (res.restaurantRows.length > 0) {
    text += `\nSERVIZIO RISTORANTE:\n`;
    res.restaurantRows.forEach(row => {
      text += `${row.label} (${row.periodStart} - ${row.periodEnd}): € ${formatEuro(row.total)}\n`;
    });
    if (res.restaurantDiscount.enabled) {
      text += `Sconto Ristorante: - € ${formatEuro(res.totalRestaurant - res.restaurantGrandTotal)}\n`;
      text += `Totale Ristorante Scontato: € ${formatEuro(res.restaurantGrandTotal)}\n`;
    }
  }

  text += `\n\nRISTORANTE LA ROCCIA\nMezza pensione euro 35,00 al giorno per gli adulti, ed euro 20,00 per i bambini (<12 anni)\nPensione completa euro 55,00 al giorno, ed euro 35,00 per i bambini (<12 anni)\n`;

  return text;
}

/** Dati operativo volo (andata o ritorno) per il modulo trasporti */
export interface FlightOperativo {
  compagnia: string;
  tratta: string;
  data: string;
  orarioPartenza: string;
  orarioArrivo: string;
}

/** Dati per generare il modulo operativo trasporti (layout ALBANI BGY.doc) */
export interface FlightModuleData {
  praticaNumber: string;
  preventivoNumber: string;
  /** Data in cui è stato fatto originariamente il preventivo (es. da storico); formattata gg/mm/aaaa */
  preventivoCreatedAt?: string;
  customerFirstName: string;
  customerLastName: string;
  otherPassengers: string;
  /** Kg bagaglio in stiva (editabile dal form) */
  bagaglioStivaKg?: number;
  /** Kg bagaglio a mano (editabile dal form) */
  bagaglioManoKg?: number;
  andata: FlightOperativo;
  ritorno: FlightOperativo;
}

/**
 * Genera HTML A4 del modulo operativo trasporti (copia fedele layout ALBANI BGY.doc).
 * Intestazione agenzia, tabella nominativi, box operativo voli, note bagagli/carta imbarco.
 */
export function generateFlightModuleHtml(data: FlightModuleData): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const logoPath = `${basePath}/logo.png`;
  const efesoLogoPath = `${basePath}/efeso.png`;

  const passengers: { cognome: string; nome: string }[] = [];
  const mainCognome = (data.customerLastName || '').trim().toUpperCase();
  const mainNome = (data.customerFirstName || '').trim();
  if (mainCognome || mainNome) {
    passengers.push({ cognome: mainCognome, nome: mainNome });
  }
  const lines = (data.otherPassengers || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const cognome = (parts[0] || '').toUpperCase();
    const nome = parts.slice(1).join(' ');
    passengers.push({ cognome, nome });
  }

  const rowsHtml =
    passengers.length > 0
      ? passengers
          .map(
            (p, idx) => {
              const rowBg = idx % 2 === 0 ? '#f0f9ff' : '#ffffff';
              return `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e0f2fe;">
        <td style="padding: 12px; text-align: left; font-family: Aptos, Calibri, sans-serif; font-size: 10pt; color: #000000;">${p.cognome}</td>
        <td style="padding: 12px; text-align: left; font-family: Aptos, Calibri, sans-serif; font-size: 10pt; color: #000000;">${p.nome}</td>
      </tr>`;
            }
          )
          .join('')
      : `
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e0f2fe;">
        <td style="padding: 12px; height: 24px; font-family: Aptos, sans-serif; font-size: 10pt; color: #000000;"></td>
        <td style="padding: 12px; font-family: Aptos, sans-serif; font-size: 10pt; color: #000000;"></td>
      </tr>`;

  const a = data.andata || { compagnia: '', tratta: '', data: '', orarioPartenza: '', orarioArrivo: '' };
  const r = data.ritorno || { compagnia: '', tratta: '', data: '', orarioPartenza: '', orarioArrivo: '' };

  const todayStr = format(new Date(), 'dd/MM/yyyy', { locale: it });
  const preventivoDateStr = data.preventivoCreatedAt && data.preventivoCreatedAt.trim() ? data.preventivoCreatedAt.trim() : '—';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>Modulo Operativo Trasporti</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Aptos, Calibri, sans-serif; font-size: 11pt; margin: 0; padding: 15mm; color: #000000; background: #f8fafc; }
    .page { width: 210mm; min-height: 297mm; box-sizing: border-box; background: #fff; padding: 18px; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; }
    .header-table { margin-bottom: 18px; }
    .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10pt; margin: 18px 0 10px 0; color: #000000; }
    .operativo-block { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; }
    .operativo-block .operativo-title { font-weight: 600; font-size: 10pt; color: #000000; padding: 10px 12px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .operativo-block table { width: 100%; }
    .operativo-block td { padding: 8px 12px; font-size: 10pt; border: none; }
    .operativo-block td:first-child { width: 26%; color: #000000; font-weight: 500; }
    .operativo-block td:last-child { color: #000000; }
    .operativo-block tr { border-bottom: 1px solid #e2e8f0; }
    .operativo-block tr:last-child { border-bottom: none; }
    .footer-notes { font-size: 9pt; margin-top: 24px; line-height: 1.5; color: #000000; padding: 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .footer-notes strong { color: #000000; }
    .pratica-line { font-size: 10pt; margin-bottom: 8px; color: #000000; }
    .modulo-title { font-size: 12pt; font-weight: 700; margin-bottom: 16px; text-align: center; color: #1e293b; letter-spacing: 0.02em; }
  </style>
</head>
<body>
  <div class="page">
    <table class="header-table">
      <tr>
        <td style="width: 50%; vertical-align: top; text-align: left; padding-right: 24px;">
          <img src="${logoPath}" alt="Villaggio La Roccia Camping" style="max-height: 78px; display: block; margin-bottom: 8px;" />
          <div style="font-size: 9pt; line-height: 1.35; color: #000000;">
            <strong>Villaggio La Roccia Camping</strong><br />
            C.da Madonna - 92031 Lampedusa<br />
            CIR: 19084020B101960 | CIN: IT08420B1B77QEMZ6<br />
            <a href="https://www.laroccia.net" style="color: #000000; text-decoration: none;">www.laroccia.net</a>
          </div>
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 24px;">
          <div style="text-align: right;">
            <img src="${efesoLogoPath}" alt="Efesovacanze" style="max-height: 78px; display: inline-block; margin-bottom: 8px; vertical-align: top;" />
            <div style="font-size: 9pt; line-height: 1.35; color: #000000;">
              <strong>Efesovacanze.com</strong><br />
              Via Pirandello, 10<br />
              92031 - Lampedusa e Linosa (AG)<br />
              P.IVA 02888040843
            </div>
          </div>
        </td>
      </tr>
    </table>
    <div class="modulo-title">Modulo Operativo Trasporti</div>

    <div class="pratica-line"><strong>N. Pratica:</strong> ${(data.praticaNumber || '').trim() || '—'} &nbsp;&nbsp; <strong>Data:</strong> ${todayStr}</div>
    <div class="pratica-line"><strong>N. Preventivo:</strong> ${(data.preventivoNumber || '').trim() || '—'} &nbsp;&nbsp; <strong>Data:</strong> ${preventivoDateStr}</div>

    <div class="section-title">Elenco nominativi</div>
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 12px; text-align: left; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 40%;">Cognome</th>
            <th style="padding: 12px; text-align: left; color: #000000; font-size: 10pt; text-transform: uppercase; font-family: Aptos, Calibri, sans-serif; width: 60%;">Nome</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div class="section-title" style="margin-top: 20px;">Operativo Trasporti</div>

    <div class="operativo-block">
      <div class="operativo-title">Andata</div>
      <table>
        <tr><td>Compagnia</td><td>${a.compagnia || '—'}</td></tr>
        <tr><td>Tratta</td><td>${a.tratta || '—'}</td></tr>
        <tr><td>Data</td><td>${a.data || '—'}</td></tr>
        <tr><td>Orario Partenza</td><td>${a.orarioPartenza || '—'}</td></tr>
        <tr><td>Orario Arrivo</td><td>${a.orarioArrivo || '—'}</td></tr>
      </table>
    </div>

    <div class="operativo-block">
      <div class="operativo-title">Ritorno</div>
      <table>
        <tr><td>Compagnia</td><td>${r.compagnia || '—'}</td></tr>
        <tr><td>Tratta</td><td>${r.tratta || '—'}</td></tr>
        <tr><td>Data</td><td>${r.data || '—'}</td></tr>
        <tr><td>Orario Partenza</td><td>${r.orarioPartenza || '—'}</td></tr>
        <tr><td>Orario Arrivo</td><td>${r.orarioArrivo || '—'}</td></tr>
      </table>
    </div>

    <div class="section-title">Note</div>
    <div class="footer-notes">
      <p style="margin: 0 0 10px 0;">Bagaglio in stiva kg <strong>${data.bagaglioStivaKg ?? 15}</strong> + kg <strong>${data.bagaglioManoKg ?? 7}</strong> a mano a passeggero.</p>
      <p style="margin: 0;">La carta d'imbarco verrà inviata il mercoledì precedente la partenza.</p>
    </div>
  </div>
</body>
</html>`;
}


