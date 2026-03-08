import pricesData from '@/data/prices.json';
import flightPricesData from '@/data/flight_prices.json';
import { differenceInDays, addDays, parse, format, addWeeks } from 'date-fns';
import { it } from 'date-fns/locale';

export interface AccommodationRequest {
  type: string;
  quantity: number;
  manualPrice?: number;
  useManualPrice: boolean;
  checkIn: string;
  checkOut: string;
  addExtraBed?: boolean;
}

export interface FlightRequest {
  airport: string;
  week: string; // "DD/MM - DD/MM"
  accommodationType: string;
  adults: number;
  children: number;
  isTwoWeeks: boolean;
  manualPrice: number;
  useManualPrice: boolean;
  includeAirportTaxes: boolean;
  includeTransfer: boolean;
  includeForfait: boolean;
}

export interface QuoteRow {
  label: string;
  periodStart: string;
  periodEnd: string;
  pricePerUnit: number;
  quantity: number;
  total: number;
  isStay: boolean;
  accommodationIndex?: number;
  isSplit?: boolean;
}

export interface DiscountInfo {
  enabled: boolean;
  type: 'fixed' | 'percentage';
  value: number;
  name?: string;
}

export interface RestaurantRequest {
  checkIn: string;
  checkOut: string;
  type: 'HB' | 'FB';
  adults: number;
  children: number;
}

export interface QuoteResult {
  rows: QuoteRow[];
  restaurantRows: QuoteRow[];
  totalStay: number;
  totalRestaurant: number;
  discountAmount: number;
  totalDiscount: number;
  finalTotal: number;
  accommodations: {
    type: string;
    quantity: number;
    prices: number[];
    period?: string;
    checkIn?: string;
    checkOut?: string;
    flightAirport?: string; // New field to pass airport info to template
  }[];
  totalPax: number;
  includeTransfer: boolean;
  includeForfait: boolean;
  restaurantGrandTotal: number;
  restaurantDiscount: DiscountInfo;
  hasExtraBed: boolean;
  isFlight?: boolean; // Marker for template
  payNowDiscount?: number;
  discountName?: string;
  customerFirstName?: string;
  customerLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  arrivalInfo?: string;
  departureInfo?: string;
  flightCodeOut?: string;
  flightCodeReturn?: string;
  isConferma?: boolean;
  useEfesoIban?: boolean;
}

export function calculateFlightQuote(
  request: FlightRequest,
  discount: DiscountInfo,
  restaurantEnabled: boolean,
  restaurantRequests: RestaurantRequest[],
  restaurantDiscount: DiscountInfo
): QuoteResult {
  const rows: QuoteRow[] = [];
  const totalPax = request.adults + request.children;
  
  // Parse Week Dates
  // Format in JSON is "DD/MM - DD/MM" (e.g. "31/05 - 07/06")
  // We assume current year (2025/2026). Logic needs to be robust.
  const currentYear = new Date().getFullYear(); 
  // If month is < current month, maybe next year? But let's assume specific year or current.
  // The JSON data seems to imply a season.
  const [startStr, endStr] = request.week.split(' - ');
  const parseDate = (d: string) => parse(`${d}/${currentYear}`, 'dd/MM/yyyy', new Date());
  
  let checkIn = parseDate(startStr);
  let checkOut = parseDate(endStr);
  
  // Handle year crossover if needed (not expected for summer season data)
  if (checkOut < checkIn) {
    checkOut = addDays(checkOut, 365); // Just in case
  }

  // Calculate Stay Price for Week 1
  // The price in JSON includes the stay for week 1, so we don't need to calculate it separately.
  // const week1StayPrice = calculateStayPriceOnly(checkIn, checkOut, request.accommodationType);
  
  // Flight Price (Actually Package Price)
  let packagePricePerPerson = 0;
  if (request.useManualPrice) {
    // If Manual Price is checked:
    // 1. manualPrice is treated as FLIGHT ONLY price per person.
    // 2. We need to calculate standard stay price separately.
    // 3. Package Price = Flight (Manual) + Stay (Calculated)
    
    const flightPricePerPerson = request.manualPrice;
    
    // Calculate Stay Price using standard logic (Week 1)
    // Note: calculateStayPriceOnly returns TOTAL for the room for the period.
    // We need per person contribution if we want a "per person package price".
    // Or we just sum totals.
    const week1StayTotal = calculateStayPriceOnly(checkIn, checkOut, request.accommodationType);
    
    // Package Total = (Flight * Pax) + Stay Total
    const flightTotal = flightPricePerPerson * totalPax;
    const packageTotal = flightTotal + week1StayTotal;
    
    packagePricePerPerson = packageTotal / totalPax; // Derived per person price for consistency
    
  } else {
    // Lookup in JSON (Standard Logic)
    // JSON price is already Package Price per Person
    const weekData = flightPricesData.prices.find(p => p.period === request.week);
    if (weekData) {
      // @ts-ignore
      packagePricePerPerson = weekData.prices[request.accommodationType] || 0;
    }
  }

  // Package Total = Package Price * Pax
  const packageTotal = packagePricePerPerson * totalPax;

  rows.push({
    label: `Pacchetto Volo + Soggiorno (${request.week}) - ${request.accommodationType}`,
    periodStart: startStr,
    periodEnd: endStr,
    pricePerUnit: packagePricePerPerson,
    quantity: totalPax,
    total: packageTotal,
    isStay: true, // Treated as stay/main item
    accommodationIndex: 0
  });

  // Calculate Base Total for Discount
  let baseTotalForDiscount = packageTotal;
  let grandTotal = packageTotal;

  // Week 2
  if (request.isTwoWeeks) {
    const week2CheckIn = checkOut;
    const week2CheckOut = addDays(week2CheckIn, 7);
    
    // Supplement
    const supplementTotal = 70 * totalPax;
    rows.push({
      label: 'Supplemento 2° Settimana',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: 70,
      quantity: totalPax,
      total: supplementTotal,
      isStay: false
    });
    // Supplement is usually part of the package cost, so we include it in discount base
    baseTotalForDiscount += supplementTotal;
    grandTotal += supplementTotal;

    // Week 2 Stay
    const week2StayTotal = calculateStayPriceOnly(week2CheckIn, week2CheckOut, request.accommodationType);
    rows.push({
      label: `Soggiorno 2° Settimana - ${request.accommodationType}`,
      periodStart: format(week2CheckIn, 'dd/MM'),
      periodEnd: format(week2CheckOut, 'dd/MM'),
      pricePerUnit: week2StayTotal, 
      quantity: 1,
      total: week2StayTotal,
      isStay: true,
      accommodationIndex: 0
    });
    baseTotalForDiscount += week2StayTotal;
    grandTotal += week2StayTotal;
  }

  // Airport Taxes
  if (request.includeAirportTaxes) {
    const taxesTotal = 35 * totalPax;
    rows.push({
      label: 'Tasse Aeroportuali',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: 35,
      quantity: totalPax,
      total: taxesTotal,
      isStay: false
    });
    grandTotal += taxesTotal;
  }

  // Forfait
  if (request.includeForfait) {
    // 15 euro per person per week
    const weeks = request.isTwoWeeks ? 2 : 1;
    const forfaitPricePerPerson = 15 * weeks; // 15, 30, 45...
    const forfaitTotal = forfaitPricePerPerson * totalPax;
    rows.push({
      label: 'Forfait Servizi (a persona)',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: forfaitPricePerPerson,
      quantity: totalPax,
      total: forfaitTotal,
      isStay: false
    });
    grandTotal += forfaitTotal;
  }

  // Transfer
  if (request.includeTransfer) {
    const transferTotal = 10 * totalPax;
    rows.push({
      label: 'Transfer A/R (a persona)',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: 10,
      quantity: totalPax,
      total: transferTotal,
      isStay: false
    });
    grandTotal += transferTotal;
  }

  // Restaurant Logic (Copied from calculateQuote)
  let restaurantTotal = 0;
  const restaurantRows: QuoteRow[] = [];
  
  if (restaurantEnabled) {
    for (const req of restaurantRequests) {
      if (!req.checkIn || !req.checkOut) continue;
      const checkIn = parse(req.checkIn, 'yyyy-MM-dd', new Date());
      const checkOut = parse(req.checkOut, 'yyyy-MM-dd', new Date());
      const nights = differenceInDays(checkOut, checkIn);
      
      if (nights <= 0) continue;

      const adultPrice = req.type === 'FB' ? 55 : 35;
      const childPrice = req.type === 'FB' ? 35 : 20;
      
      const subTotal = (req.adults * adultPrice + req.children * childPrice) * nights;
      restaurantTotal += subTotal;

      const typeLabel = req.type === 'FB' ? 'Pensione Completa' : 'Mezza Pensione';
      
      restaurantRows.push({
        label: `${typeLabel} (${req.adults} Adulti, ${req.children} Bambini)`,
        periodStart: format(checkIn, 'dd/MM'),
        periodEnd: format(checkOut, 'dd/MM'),
        pricePerUnit: 0, // Complex price
        quantity: nights, // Display nights in quantity or just use as multiplier
        total: subTotal,
        isStay: false
      });
    }
  }

  // Discount (Applied only to base package cost)
  let discountAmount = 0;
  if (discount.enabled) {
    if (discount.type === 'fixed') {
      discountAmount = discount.value;
    } else {
      discountAmount = (baseTotalForDiscount * discount.value) / 100;
    }
  }

  let restaurantDiscountAmount = 0;
  if (restaurantDiscount.enabled) {
    if (restaurantDiscount.type === 'fixed') {
      restaurantDiscountAmount = restaurantDiscount.value;
    } else {
      restaurantDiscountAmount = (restaurantTotal * restaurantDiscount.value) / 100;
    }
  }

  const periodStr = request.isTwoWeeks 
    ? `Dal ${startStr} al ${format(addDays(parseDate(endStr), 7), 'dd/MM')}`
    : `Dal ${startStr} al ${endStr}`;

  const finalTotal = grandTotal - discountAmount + restaurantTotal - restaurantDiscountAmount;

  return {
    rows,
    restaurantRows: restaurantRows,
    totalStay: grandTotal, 
    totalRestaurant: restaurantTotal,
    discountAmount,
    totalDiscount: discountAmount + restaurantDiscountAmount,
    finalTotal: finalTotal,
    accommodations: [{
      type: request.accommodationType,
      quantity: 1,
      prices: [packagePricePerPerson],
      period: periodStr,
      checkIn: startStr,
      checkOut: endStr,
      flightAirport: request.airport // Passing airport
    }],
    totalPax,
    includeTransfer: request.includeTransfer,
    includeForfait: request.includeForfait,
    restaurantGrandTotal: restaurantTotal - restaurantDiscountAmount,
    restaurantDiscount: restaurantDiscount,
    hasExtraBed: false,
    isFlight: true,
    payNowDiscount: 0, // No pay now discount for flight
    discountName: discount.name || 'Sconto'
  };
}

function calculateStayPriceOnly(checkIn: Date, checkOut: Date, type: string): number {
  let total = 0;
  const nights = differenceInDays(checkOut, checkIn);
  for (let i = 0; i < nights; i++) {
    const d = addDays(checkIn, i);
    total += getPriceForDate(d, type);
  }
  return total;
}

export function calculateQuote(
  accommodations: AccommodationRequest[],
  totalPax: number,
  includeTransfer: boolean,
  includeForfait: boolean,
  discount: DiscountInfo,
  restaurantEnabled: boolean,
  restaurantRequests: RestaurantRequest[],
  restaurantDiscount: DiscountInfo,
  payNowDiscount: boolean = false
): QuoteResult {
  const rows: QuoteRow[] = [];
  let stayTotal = 0;
  let maxNights = 0;
  let overallMinDate: Date | null = null;
  let overallMaxDate: Date | null = null;
  let hasExtraBed = false;
  
  // Store prices for each accommodation index
  const accommodationPricesMap = new Map<number, Set<number>>();

  let accIdx = 0;
  for (const acc of accommodations) {
    if (acc.addExtraBed) hasExtraBed = true;
    const checkIn = parse(acc.checkIn, 'yyyy-MM-dd', new Date());
    const checkOut = parse(acc.checkOut, 'yyyy-MM-dd', new Date());
    const totalNights = differenceInDays(checkOut, checkIn);
    
    if (!overallMinDate || checkIn < overallMinDate) overallMinDate = checkIn;
    if (!overallMaxDate || checkOut > overallMaxDate) overallMaxDate = checkOut;
    if (totalNights > maxNights) maxNights = totalNights;

    const accPrices = new Set<number>();
    const extraBedCharge = acc.addExtraBed ? 10 : 0;
    const labelExtraBed = acc.addExtraBed ? ' (+ Letto Extra)' : '';
    
    if (acc.useManualPrice && acc.manualPrice !== undefined) {
      const price = acc.manualPrice + extraBedCharge;
      accPrices.add(price);
      
      // Group rows based on quantity
      const totalForUnit = price * totalNights;
      const totalForAllUnits = totalForUnit * acc.quantity;
      
      rows.push({
        label: `${acc.quantity > 1 ? `N. ${acc.quantity} ` : ''}Soggiorno in ${acc.type}${labelExtraBed}`,
        periodStart: format(checkIn, 'dd/MM'),
        periodEnd: format(checkOut, 'dd/MM'),
        pricePerUnit: price * acc.quantity, // Unit price * quantity
        quantity: totalNights, // Shows nights per unit (common for all)
        total: totalForAllUnits,
        isStay: true,
        accommodationIndex: accIdx
      });
      stayTotal += totalForAllUnits;
    } else {
      let currentSegment: { start: Date; price: number; nights: number } | null = null;
      const accRows: QuoteRow[] = [];

      for (let i = 0; i < totalNights; i++) {
        const currentDate = addDays(checkIn, i);
        const baseDayPrice = getPriceForDate(currentDate, acc.type);
        const dayPrice = baseDayPrice + extraBedCharge;
        accPrices.add(dayPrice);

        if (currentSegment && currentSegment.price === dayPrice) {
          currentSegment.nights += 1;
        } else {
          if (currentSegment) {
            const segmentEnd = addDays(currentSegment.start, currentSegment.nights);
            const segTotal = currentSegment.price * currentSegment.nights; // Total for ONE unit
            const totalForAllUnits = segTotal * acc.quantity;

            accRows.push({
              label: `${acc.quantity > 1 ? `N. ${acc.quantity} ` : ''}Soggiorno in ${acc.type}${labelExtraBed}`,
              periodStart: format(currentSegment.start, 'dd/MM'),
              periodEnd: format(segmentEnd, 'dd/MM'),
              pricePerUnit: currentSegment.price * acc.quantity, // Unit price * quantity
              quantity: currentSegment.nights,
              total: totalForAllUnits,
              isStay: true,
              accommodationIndex: accIdx,
              isSplit: true
            });
            stayTotal += totalForAllUnits;
          }
          currentSegment = { start: currentDate, price: dayPrice, nights: 1 };
        }
      }

      if (currentSegment) {
        const segmentEnd = addDays(currentSegment.start, currentSegment.nights);
        const segTotal = currentSegment.price * currentSegment.nights; // Total for ONE unit
        const totalForAllUnits = segTotal * acc.quantity;

        accRows.push({
          label: `${acc.quantity > 1 ? `N. ${acc.quantity} ` : ''}Soggiorno in ${acc.type}${labelExtraBed}`,
          periodStart: format(currentSegment.start, 'dd/MM'),
          periodEnd: format(segmentEnd, 'dd/MM'),
          pricePerUnit: currentSegment.price * acc.quantity, // Unit price * quantity
          quantity: currentSegment.nights,
          total: totalForAllUnits,
          isStay: true,
          accommodationIndex: accIdx,
          isSplit: true
        });
        stayTotal += totalForAllUnits;
      }
      rows.push(...accRows);
    }
    
    accommodationPricesMap.set(accIdx, accPrices);
    accIdx++;
  }

  // Calculate Base Total for Discount (Accommodation Only)
  let baseTotalForDiscount = stayTotal;
  let grandTotal = stayTotal;

  // Extra services
  if (includeForfait) {
    const weeks = Math.ceil(maxNights / 7);
    const forfaitPricePerPerson = 15 * weeks; // 15, 30, 45...
    const forfaitTotal = forfaitPricePerPerson * totalPax;
    rows.push({
      label: 'Forfait Servizi (a persona)',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: forfaitPricePerPerson,
      quantity: totalPax,
      total: forfaitTotal,
      isStay: false
    });
    grandTotal += forfaitTotal;
  }

  if (includeTransfer) {
    const transferTotal = 10 * totalPax;
    rows.push({
      label: 'Transfer A/R (a persona)',
      periodStart: '',
      periodEnd: '',
      pricePerUnit: 10,
      quantity: totalPax,
      total: transferTotal,
      isStay: false
    });
    grandTotal += transferTotal;
  }

  // Pay Now Discount (10%) applies to stay + extras, never to restaurant.
  let payNowAmount = 0;
  if (payNowDiscount) {
    payNowAmount = (grandTotal * 10) / 100;
  }

  // Restaurant logic
  let restaurantTotal = 0;
  const restaurantRows: QuoteRow[] = [];
  
  if (restaurantEnabled) {
    for (const req of restaurantRequests) {
      if (!req.checkIn || !req.checkOut) continue;
      const checkIn = parse(req.checkIn, 'yyyy-MM-dd', new Date());
      const checkOut = parse(req.checkOut, 'yyyy-MM-dd', new Date());
      const nights = differenceInDays(checkOut, checkIn);
      
      if (nights <= 0) continue;

      const adultPrice = req.type === 'FB' ? 55 : 35;
      const childPrice = req.type === 'FB' ? 35 : 20;
      
      const subTotal = (req.adults * adultPrice + req.children * childPrice) * nights;
      restaurantTotal += subTotal;

      const typeLabel = req.type === 'FB' ? 'Pensione Completa' : 'Mezza Pensione';
      
      restaurantRows.push({
        label: `${typeLabel} (${req.adults} Adulti, ${req.children} Bambini)`,
        periodStart: format(checkIn, 'dd/MM'),
        periodEnd: format(checkOut, 'dd/MM'),
        pricePerUnit: 0, // Complex price
        quantity: nights, // Display nights in quantity or just use as multiplier
        total: subTotal,
        isStay: false
      });
    }
  }

  let discountAmount = 0;
  if (discount.enabled) {
    if (discount.type === 'fixed') {
      discountAmount = discount.value;
    } else {
      discountAmount = (baseTotalForDiscount * discount.value) / 100;
    }
  }

  let restaurantDiscountAmount = 0;
  if (restaurantDiscount.enabled) {
    if (restaurantDiscount.type === 'fixed') {
      restaurantDiscountAmount = restaurantDiscount.value;
    } else {
      restaurantDiscountAmount = (restaurantTotal * restaurantDiscount.value) / 100;
    }
  }

  const finalTotal = grandTotal - discountAmount - payNowAmount + restaurantTotal - restaurantDiscountAmount;

  return {
    rows,
    restaurantRows,
    totalStay: grandTotal,
    totalRestaurant: restaurantTotal,
    discountAmount,
    totalDiscount: discountAmount + restaurantDiscountAmount + payNowAmount,
    finalTotal,
    accommodations: accommodations.map((acc, index) => {
      // Re-calculate prices set for description purposes
      const prices = accommodationPricesMap.get(index) || new Set<number>();
      const checkIn = parse(acc.checkIn, 'yyyy-MM-dd', new Date());
      const checkOut = parse(acc.checkOut, 'yyyy-MM-dd', new Date());
      
      return {
        type: acc.type,
        quantity: acc.quantity,
        prices: Array.from(prices),
        period: `Dal ${format(checkIn, 'dd/MM/yyyy')} al ${format(checkOut, 'dd/MM/yyyy')}`,
        checkIn: acc.checkIn,
        checkOut: acc.checkOut
      };
    }),
    totalPax,
    includeTransfer,
    includeForfait,
    restaurantGrandTotal: restaurantTotal - restaurantDiscountAmount,
    restaurantDiscount,
    hasExtraBed,
    payNowDiscount: payNowAmount,
    discountName: discount.name || 'Sconto'
  };
}

function getPriceForDate(date: Date, accommodationType: string): number {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate(); // 1-31
  
  // Convert date to a comparable number: MMDD
  const dateNum = month * 100 + day;
  
  // Safe access to ranges handling potential module default export issues
  const ranges = pricesData.ranges || (pricesData as any).default?.ranges || [];

  for (const range of ranges) {
    const [startDay, startMonth] = range.start.split('/').map(Number);
    const [endDay, endMonth] = range.end.split('/').map(Number);
    
    const startNum = startMonth * 100 + startDay;
    const endNum = endMonth * 100 + endDay;

    if (endNum < startNum) {
      // Wrap around year (e.g. Dec to Jan)
      if (dateNum >= startNum || dateNum <= endNum) {
        return (range.prices as any)[accommodationType];
      }
    } else {
      // Normal range
      if (dateNum >= startNum && dateNum <= endNum) {
        return (range.prices as any)[accommodationType];
      }
    }
  }
  return 0;
}

export function formatEuro(amount: number): string {
  return amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


