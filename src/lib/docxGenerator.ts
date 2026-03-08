import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import { QuoteResult, formatEuro } from './calculator';
import { format } from 'date-fns';
import { ACCOMMODATION_MAPPING } from './template';

export const generateDocx = async (res: QuoteResult): Promise<Blob> => {
  const customerFullName = [res.customerFirstName, res.customerLastName].filter(Boolean).join(' ').trim();
  const title = res.isFlight ? "OFFERTA VOLO + SOGGIORNO" : "OFFERTA SOLO SOGGIORNO";

  // Density logic for A4 fitting
  const rowCount = res.rows.length + (res.isConferma ? res.restaurantRows.length : 0);
  const accCount = res.accommodations.length;
  const extraItemsCount = (res.includeForfait ? 1 : 0) + (res.includeTransfer ? 1 : 0) + (res.hasExtraBed ? 1 : 0);
  const densityScore = (accCount * 3) + rowCount + (extraItemsCount * 0.5);

  let fontSize = 22; // 11pt
  let fontSizeRow = 22; 
  let fontSizeTitle = 28; // 14pt
  let spacingAfter = 400;
  let spacingAfterSmall = 100;
  let cellPadding = 80;

  if (densityScore > 15) {
    fontSize = 20; // 10pt
    fontSizeRow = 20;
    fontSizeTitle = 24; // 12pt
    spacingAfter = 300;
    spacingAfterSmall = 50;
    cellPadding = 50;
  }

  if (densityScore > 22) {
    fontSize = 18; // 9pt
    fontSizeRow = 19;
    fontSizeTitle = 20; // 10pt
    spacingAfter = 200;
    spacingAfterSmall = 30;
    cellPadding = 30;
  }

  // Helpers per tabelle
  const createCell = (text: string, bold = false, align: any = AlignmentType.LEFT) => {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold, font: "Aptos", size: fontSizeRow })], alignment: align })],
      margins: { top: cellPadding, bottom: cellPadding, left: 100, right: 100 },
      shading: { fill: "FFFFFF" }
    });
  };

  const pureStayRows = res.rows.filter(r => r.isStay).map(r => {
    return new TableRow({
      children: [
        createCell(`${r.periodStart} - ${r.periodEnd}`),
        createCell(r.label),
        createCell(r.quantity.toString(), false, AlignmentType.CENTER),
        createCell(`€ ${formatEuro(r.pricePerUnit)}`, false, AlignmentType.RIGHT),
        createCell(`€ ${formatEuro(r.total)}`, true, AlignmentType.RIGHT),
      ]
    });
  });

  const extraRows = res.rows.filter(r => !r.isStay).map(r => {
    return new TableRow({
      children: [
        createCell(r.periodStart ? `${r.periodStart}${r.periodEnd ? ` - ${r.periodEnd}` : ''}` : '-'),
        createCell(r.label),
        createCell(r.quantity.toString(), false, AlignmentType.CENTER),
        createCell(`€ ${formatEuro(r.pricePerUnit)}`, false, AlignmentType.RIGHT),
        createCell(`€ ${formatEuro(r.total)}`, true, AlignmentType.RIGHT),
      ]
    });
  });

  const restaurantRows = res.isConferma ? res.restaurantRows.map(r => {
    return new TableRow({
        children: [
          createCell(`${r.periodStart} - ${r.periodEnd}`),
          createCell(r.label),
          createCell(r.quantity.toString(), false, AlignmentType.CENTER),
          createCell(`-`, false, AlignmentType.RIGHT),
          createCell(`€ ${formatEuro(r.total)}`, true, AlignmentType.RIGHT),
        ]
      });
  }) : [];

  const tableHeader = new TableRow({
    children: [
      createCell("Periodo", true, AlignmentType.CENTER),
      createCell("Descrizione", true),
      createCell("Pax/Gg", true, AlignmentType.CENTER),
      createCell("Prezzo", true, AlignmentType.RIGHT),
      createCell("Totale", true, AlignmentType.RIGHT),
    ],
    tableHeader: true,
  });

  const today = format(new Date(), 'dd/MM/yyyy');
  let logoImageRun: ImageRun | null = null;
  try {
    const logoResp = await fetch('/logo.png');
    const logoBuffer = await logoResp.arrayBuffer();
    logoImageRun = new ImageRun({
      data: logoBuffer,
      transformation: { width: 100, height: 40 },
    } as any);
  } catch (e) {
    console.error("Logo fetch failed", e);
  }

  const children: any[] = [];

  const addPageContent = (targetChildren: any[], isPage2 = false) => {
    const depositRate = res.isFlight ? 0.5 : 0.3;
    const depositLabel = res.isFlight ? "50%" : "30%";
    const depositBase = res.isFlight ? (res.finalTotal - (res.restaurantGrandTotal || 0)) : res.finalTotal;
    const depositAmount = Math.floor(depositBase * depositRate * 100) / 100;

    // Density Score for Page 2 space management
    const rowCount = res.rows.length + (res.isConferma ? res.restaurantRows.length : 0);
    const accCount = res.accommodations.length;
    const extraItemsCount = (res.includeForfait ? 1 : 0) + (res.includeTransfer ? 1 : 0) + (res.hasExtraBed ? 1 : 0);
    const densityScore = (accCount * 3) + rowCount + (extraItemsCount * 0.5);
    
    let noteLinesCount = 4;
    if (densityScore > 22) noteLinesCount = 0;
    else if (densityScore > 18) noteLinesCount = 1;
    else if (densityScore > 14) noteLinesCount = 2;
    else if (densityScore > 10) noteLinesCount = 3;

    if (res.isConferma) {
      // 1. Logo and Company Info (Centered)
      if (logoImageRun) {
        targetChildren.push(new Paragraph({
          children: [logoImageRun],
          alignment: AlignmentType.CENTER,
        }));
      }

      targetChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Villaggio La Roccia Camping", bold: true, font: "Aptos", size: 20 }),
          new TextRun({ text: "\nC.da Madonna - 92031 Lampedusa", font: "Aptos", size: 18 }),
          new TextRun({ text: "\nCIR: 19084020B101960 | CIN: IT08420B1B77QEMZ6", font: "Aptos", size: 18 }),
          new TextRun({ text: "\nwww.laroccia.net", font: "Aptos", size: 18 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }));

      const customerInfoPara = new Paragraph({
        children: [
          new TextRun({ text: isPage2 ? `Capogruppo` : `Alla c.a del Sig.`, font: "Aptos", size: fontSize }),
          new TextRun({ text: `\n${res.customerFirstName || ''} ${res.customerLastName || ''}`, bold: true, font: "Aptos", size: fontSize + 2 }),
          new TextRun({ text: `\n${res.contactEmail || ''}`, font: "Aptos", size: fontSize - 2 }),
          new TextRun({ text: `\n${res.contactPhone || ''}`, font: "Aptos", size: fontSize - 2 }),
        ],
        alignment: AlignmentType.RIGHT,
      });

      const showFlightInfo = isPage2 || (!isPage2 && res.isFlight);

      if (showFlightInfo) {
        const arrivalText = `Arrivo: ${[res.flightCodeOut, res.accommodations[0]?.flightAirport, res.arrivalInfo].filter(Boolean).join(', ')}`;
        const departureText = `Partenza: ${[res.flightCodeReturn, res.accommodations[0]?.flightAirport, res.departureInfo].filter(Boolean).join(', ')}`;
        
        targetChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({
                    children: [
                        new TextRun({ text: arrivalText, font: "Aptos", size: fontSize - 2, color: "334155" }),
                        new TextRun({ text: "", break: 1 }),
                        new TextRun({ text: departureText, font: "Aptos", size: fontSize - 2, color: "334155" }),
                    ],
                    alignment: AlignmentType.LEFT
                  })],
                  width: { size: 65, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [customerInfoPara],
                  width: { size: 35, type: WidthType.PERCENTAGE }
                })
              ]
            })
          ]
        }));
        targetChildren.push(new Paragraph({ spacing: { after: spacingAfter } }));
      } else {
        targetChildren.push(new Paragraph({
            ...customerInfoPara as any,
            spacing: { after: spacingAfter }
        }));
      }

      // 3. Confirmation Line (Centered)
      targetChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `Lampedusa ${today} - CONFERMA PRENOTAZIONE${res.isFlight ? ' + VOLO A/R' : ''}`, bold: true, font: "Aptos", size: fontSize }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: spacingAfter / 2 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } }
      }));

      // 4. Accommodations List
      res.accommodations.forEach(acc => {
        targetChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `- `, font: "Aptos", size: fontSize }),
            new TextRun({ text: `${ACCOMMODATION_MAPPING[acc.type]?.title || acc.type}`, bold: true, font: "Aptos", size: fontSize }),
            new TextRun({ text: ` (${acc.period})`, font: "Aptos", size: fontSize }),
          ],
          spacing: { after: spacingAfterSmall }
        }));
      });

    } else {
      // Original Header for Quotes
      targetChildren.push(new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }));
    }

    if (!res.isConferma) {
      res.accommodations.forEach(acc => {
          targetChildren.push(new Paragraph({
              children: [
                  new TextRun({ text: `${acc.period || ''}\nSoggiorno in ${acc.quantity > 1 ? `N. ${acc.quantity} ` : ''}${acc.type}`, font: "Aptos", size: 22 })
              ],
              spacing: { after: 100 },
              alignment: AlignmentType.CENTER
          }));
      });
    }

    const isPayNowValue = !!(res.payNowDiscount && res.payNowDiscount > 0);
    const tableRows = [tableHeader, ...pureStayRows, ...restaurantRows, ...extraRows];

    if (isPage2) {
      // Add Totals inside the table for Page 2
      tableRows.push(new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "TOTALE FINALE:", bold: true, font: "Aptos", size: fontSize, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                columnSpan: 4,
                shading: { fill: "EFF6FF" },
                borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "3B82F6" } },
                margins: { top: 50, bottom: 50, left: 100, right: 100 }
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `€ ${formatEuro(res.finalTotal)}`, bold: true, font: "Aptos", size: fontSize, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                shading: { fill: "EFF6FF" },
                borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "3B82F6" } },
                margins: { top: 50, bottom: 50, left: 100, right: 100 }
            })
        ]
      }));

      if (!isPayNowValue) {
        tableRows.push(new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `Caparra richiesta (${depositLabel}):`, bold: true, font: "Aptos", size: fontSize - 2, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                    columnSpan: 4,
                    shading: { fill: "EFF6FF" },
                    margins: { top: 30, bottom: 30, left: 100, right: 100 }
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `€ ${formatEuro(depositAmount)}`, bold: true, font: "Aptos", size: fontSize - 2, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                    shading: { fill: "EFF6FF" },
                    margins: { top: 30, bottom: 30, left: 100, right: 100 }
                })
            ]
        }));
        tableRows.push(new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `Saldo in struttura:`, bold: true, font: "Aptos", size: fontSize - 2, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                    columnSpan: 4,
                    shading: { fill: "EFF6FF" },
                    margins: { top: 30, bottom: 30, left: 100, right: 100 }
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `€ ${formatEuro(Math.round((res.finalTotal - depositAmount) * 100) / 100)}`, bold: true, font: "Aptos", size: fontSize - 2, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 } })],
                    shading: { fill: "EFF6FF" },
                    margins: { top: 30, bottom: 30, left: 100, right: 100 }
                })
            ]
        }));
      }
    }

    targetChildren.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    }));

    if (isPage2) {
      targetChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "Caparra versata il: __________________________________________________________________________", font: "Aptos", size: fontSize })
        ],
        spacing: { before: 200, after: 300 },
        alignment: AlignmentType.LEFT
      }));

      targetChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "Note: ______________________________________________________________________________________", font: "Aptos", size: fontSize })
        ],
        spacing: { before: 400, after: 500 },
        alignment: AlignmentType.LEFT
      }));

      // Aggiungi più righe per le note per riempire lo spazio
      for (let i = 0; i < noteLinesCount - 1; i++) {
        targetChildren.push(new Paragraph({
          children: [
              new TextRun({ text: "____________________________________________________________________________________________", font: "Aptos", size: fontSize })
          ],
          spacing: { before: 300, after: 500 },
          alignment: AlignmentType.LEFT
        }));
      }

      // Seconda Tabella Ultra-Compatta (Ancorata al Fondo tramite spacing)
      targetChildren.push(new Paragraph({
        children: [new TextRun({ text: "----------------------------------------------------------------------------------------------------------------", color: "BFBFBF" })],
        spacing: { before: 800, after: 200 }
      }));

      targetChildren.push(new Paragraph({
        children: [new TextRun({ text: "RIEPILOGO INTERNO (COPIA COMPATTA)", bold: true, font: "Aptos", size: fontSize - 2, color: "666666" })],
        spacing: { after: 200 }
      }));

      const compactFontSize = fontSize - 2;
      const compactRows = tableRows.map(row => {
          return new TableRow({
              children: (row as any).options.children.map((cell: any) => {
                  return new TableCell({
                      ...cell.options,
                      children: cell.options.children.map((p: any) => {
                          return new Paragraph({
                              ...p.options,
                              spacing: { before: 0, after: 0 },
                              children: p.options.children.map((r: any) => {
                                  return new TextRun({
                                      ...r.options,
                                      size: compactFontSize
                                  });
                              })
                          });
                      }),
                      margins: { top: 30, bottom: 30, left: 50, right: 50 }
                  });
              })
          });
      });

      targetChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: compactRows
      }));
    }

    if (!isPage2) {
      targetChildren.push(new Paragraph({
        children: [new TextRun({ text: `TOTALE FINALE: € ${formatEuro(res.finalTotal)}`, font: "Aptos", size: fontSizeTitle + 4, bold: true, color: "1E3A8A" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: spacingAfter, after: spacingAfterSmall }
      }));

      if (!isPayNowValue) {
        targetChildren.push(new Paragraph({
          children: [new TextRun({ text: `Caparra richiesta (${depositLabel}): € ${formatEuro(depositAmount)}`, font: "Aptos", size: fontSizeTitle, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: spacingAfter }
        }));
      }

      if (res.isConferma) {
        targetChildren.push(new Paragraph({
          children: [new TextRun({ text: "ISTRUZIONI PER IL PAGAMENTO DELLA CAPARRA E NOTE", bold: true, font: "Aptos", size: fontSizeTitle, color: "1E3A8A" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: spacingAfterSmall * 2, after: spacingAfterSmall * 3 }
        }));

        if (res.useEfesoIban) {
          targetChildren.push(new Paragraph({
            children: [
                new TextRun({ text: `IBAN: IT31N0710816600000000003300`, bold: true, font: "Aptos", size: fontSize }),
                new TextRun({ text: `\nIntestato a: EfesoVacanze.com`, bold: true, font: "Aptos", size: fontSize }),
                new TextRun({ text: "\nBanca di credito cooperativo", bold: true, font: "Aptos", size: fontSize - 2 }),
                new TextRun({ text: "\nSWIFT: 000003300", bold: true, font: "Aptos", size: fontSize - 2 }),
                new TextRun({ text: `\nCausale: Prenotazione soggiorno ${res.customerLastName || ''}`, bold: true, font: "Aptos", size: fontSize }),
            ],
            spacing: { after: spacingAfterSmall * 3 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            }
          }));
        } else {
          targetChildren.push(new Paragraph({
              children: [
                  new TextRun({ text: `IBAN: IT58R0503682960CC4100005781`, font: "Aptos", size: fontSize }),
                  new TextRun({ text: `\nIntestato a: Camping la Roccia snc`, font: "Aptos", size: fontSize }),
                  new TextRun({ text: "\nBANCA AGRICOLA POPOLARE DI SICILIA  - AG. Di Lampedusa", font: "Aptos", size: fontSize - 2 }),
                  new TextRun({ text: "\nSWIFT: POPRIT3RXXX", font: "Aptos", size: fontSize - 2 }),
                  new TextRun({ text: `\nCausale: Prenotazione soggiorno ${res.customerLastName || ''}`, font: "Aptos", size: fontSize }),
              ],
              spacing: { after: spacingAfterSmall * 3 },
              border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
              }
          }));
        }

        targetChildren.push(new Paragraph({
          children: [
            new TextRun({ 
              text: "Una volta effettuato il versamento, Vi preghiamo di inviare copia della ricevuta a info@laroccia.net", 
              bold: true, 
              font: "Aptos", 
              size: fontSize
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: spacingAfterSmall * 1.5, after: spacingAfterSmall * 3 }
        }));

        targetChildren.push(new Paragraph({
          children: [
            new TextRun({ text: "Check-in / Check-out", bold: true, font: "Aptos", size: fontSizeTitle - 2, color: "1E3A8A" }),
            new TextRun({ text: "\nIl check-in è garantito dalle ore 13:00. Gli alloggi devono essere liberati entro le ore 10:00 del giorno di partenza per consentire le operazioni di pulizia.", font: "Aptos", size: fontSize - 2 })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: spacingAfterSmall * 2, after: spacingAfterSmall * 1.5 }
        }));

        targetChildren.push(new Paragraph({
          children: [
            new TextRun({ text: "Caparra e Saldo", bold: true, font: "Aptos", size: fontSizeTitle - 2, color: "1E3A8A" }),
            new TextRun({ text: `\nLa prenotazione è considerata confermata solo al ricevimento della caparra richiesta (${depositLabel}). Il saldo dovrà essere corrisposto al momento del check-in.`, font: "Aptos", size: fontSize - 2 })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: spacingAfterSmall * 3 }
        }));
      }
    }
  };

  addPageContent(children);

  if (res.isConferma) {
    children.push(new Paragraph({
      text: "",
      pageBreakBefore: true
    }));
    addPageContent(children, true);
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  return Packer.toBlob(doc);
};
