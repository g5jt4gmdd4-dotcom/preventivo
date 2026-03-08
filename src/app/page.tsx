'use client';

import { useState, useMemo, useEffect } from 'react';
import { calculateQuote, calculateFlightQuote, AccommodationRequest, DiscountInfo, RestaurantRequest, FlightRequest, formatEuro } from '@/lib/calculator';
import { generateHtml, generatePlainText, generateFlightModuleHtml, type FlightModuleData, type FlightOperativo } from '@/lib/template';
import { Copy, FileText, Code, Eye, Plus, Trash2, Tag, Euro, Utensils, Home as HomeIcon, Plane, Users, RotateCcw, FileCheck, Printer, FileDown } from 'lucide-react';
import { saveAs } from 'file-saver';
import { generateDocx } from '@/lib/docxGenerator';
import flightPricesData from '@/data/flight_prices.json';

const AIRPORTS = [
  'Milano Malpensa',
  'Milano Linate',
  'Bergamo',
  'Verona',
  'Venezia',
  'Bologna',
  'Roma Fiumicino',
  'Napoli',
  'Bari',
  'Palermo',
  'Catania'
];

const DEFAULT_ACCOMMODATIONS: AccommodationRequest[] = [
  { type: 'Mono 2p', quantity: 1, useManualPrice: false, manualPrice: 0, checkIn: '', checkOut: '', addExtraBed: false }
];

const DEFAULT_RESTAURANT_REQUESTS: RestaurantRequest[] = [
  { checkIn: '', checkOut: '', type: 'HB', adults: 2, children: 0 }
];

const DEFAULT_DISCOUNT: DiscountInfo = {
  enabled: false,
  type: 'percentage',
  value: 10
};

const DEFAULT_RESTAURANT_DISCOUNT: DiscountInfo = {
  enabled: false,
  type: 'percentage',
  value: 10
};

interface HistoryEntry {
  client_name: string;
  data: any;
  status: string;
  updated_at: string;
}

const DEFAULT_FLIGHT_REQUEST: FlightRequest = {
  airport: 'Milano Malpensa',
  week: flightPricesData.weeks[0],
  accommodationType: 'Mono 2p',
  adults: 2,
  children: 0,
  isTwoWeeks: false,
  manualPrice: 0,
  useManualPrice: false,
  includeAirportTaxes: true,
  includeTransfer: true,
  includeForfait: true
};

const EMPTY_OPERATIVO: FlightOperativo = {
  compagnia: '',
  tratta: '',
  data: '',
  orarioPartenza: '',
  orarioArrivo: '',
};

export default function Home() {
  const [mainTab, setMainTab] = useState<'preventivi' | 'conferme' | 'volo'>('preventivi');

  const [mode, setMode] = useState<'stay' | 'flight'>('stay');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');

  // --- Conferme Extra State ---
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [arrivalInfo, setArrivalInfo] = useState('');
  const [departureInfo, setDepartureInfo] = useState('');
  const [flightCodeOut, setFlightCodeOut] = useState('');
  const [flightCodeReturn, setFlightCodeReturn] = useState('');
  const [useEfesoIban, setUseEfesoIban] = useState(false);

  // --- Stay Mode State ---
  const [accommodations, setAccommodations] = useState<AccommodationRequest[]>(DEFAULT_ACCOMMODATIONS);

  const [totalPax, setTotalPax] = useState(2);
  const [includeTransfer, setIncludeTransfer] = useState(true);
  const [includeForfait, setIncludeForfait] = useState(true);
  const [payNowDiscount, setPayNowDiscount] = useState(false);
  const [discount, setDiscount] = useState<DiscountInfo>({
    enabled: false,
    type: 'percentage',
    value: 10
  });

  const [restaurantEnabled, setRestaurantEnabled] = useState(false);
  const [restaurantRequests, setRestaurantRequests] = useState<RestaurantRequest[]>(DEFAULT_RESTAURANT_REQUESTS);
  const [restaurantDiscount, setRestaurantDiscount] = useState<DiscountInfo>(DEFAULT_RESTAURANT_DISCOUNT);

  // --- Flight Mode State ---
  const [flightRequest, setFlightRequest] = useState<FlightRequest>(DEFAULT_FLIGHT_REQUEST);

  // --- Sezione Volo (modulo operativo trasporti) — stato separato ---
  const [voloPraticaNumber, setVoloPraticaNumber] = useState('');
  const [voloPreventivoNumber, setVoloPreventivoNumber] = useState('');
  const [voloPreventivoCreatedAt, setVoloPreventivoCreatedAt] = useState('');
  const [voloBagaglioStivaKg, setVoloBagaglioStivaKg] = useState(15);
  const [voloBagaglioManoKg, setVoloBagaglioManoKg] = useState(7);
  const [voloOtherPassengers, setVoloOtherPassengers] = useState('');
  const [voloCompagnia, setVoloCompagnia] = useState('');
  const [voloCittaPartenza, setVoloCittaPartenza] = useState('');
  const [voloAndata, setVoloAndata] = useState<FlightOperativo>({ ...EMPTY_OPERATIVO });
  const [voloRitorno, setVoloRitorno] = useState<FlightOperativo>({ ...EMPTY_OPERATIVO });

  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'text'>('preview');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async (tabStr = mainTab, currentMode = mode) => {
    try {
      setLoadingHistory(true);
      let url: string;
      if (tabStr === 'volo') {
        url = `/api/history?status=conferma&mode=flight`;
      } else {
        const statusParam = tabStr === 'conferme' ? 'all' : 'preventivo';
        url = `/api/history?status=${statusParam}&mode=${currentMode}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'volo') {
      fetchHistory('volo');
    } else {
      fetchHistory(mainTab, mode);
    }
  }, [mainTab, mode]);

  const deleteEntry = async (clientName: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo record?')) return;
    try {
      const res = await fetch(`/api/history?client_name=${encodeURIComponent(clientName)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore eliminazione');
      if (mainTab === 'volo') await fetchHistory('volo');
      else await fetchHistory(mainTab, mode);
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Errore durante l\'eliminazione del record.');
    }
  };

  const restoreHistory = (entry: HistoryEntry) => {
    const data = entry.data;

    if (mainTab === 'volo') {
      const names = entry.client_name.split(' ');
      setCustomerFirstName(names[0] || '');
      setCustomerLastName(names.slice(1).join(' ') || '');
      setVoloOtherPassengers(data.otherPassengers ?? data.voloOtherPassengers ?? '');
      setVoloCompagnia(data.voloCompagnia ?? data.flightOperativoAndata?.compagnia ?? '');
      const citta = data.voloCittaPartenza ?? (data.flightOperativoAndata?.tratta ? data.flightOperativoAndata.tratta.replace(/\s*-\s*Lampedusa\s*$/i, '').trim() : '');
      setVoloCittaPartenza(citta);
      const andataBase = data.flightOperativoAndata ? { ...EMPTY_OPERATIVO, ...data.flightOperativoAndata } : { ...EMPTY_OPERATIVO };
      const ritornoBase = data.flightOperativoRitorno ? { ...EMPTY_OPERATIVO, ...data.flightOperativoRitorno } : { ...EMPTY_OPERATIVO };
      const year = new Date().getFullYear();
      if (data.flightRequest?.week) {
        const parts = data.flightRequest.week.split(/\s*-\s*/).map((s: string) => s.trim());
        if (parts[0]) andataBase.data = parts[0].includes('/') && parts[0].length <= 5 ? `${parts[0]}/${year}` : parts[0];
        if (parts[1]) ritornoBase.data = parts[1].includes('/') && parts[1].length <= 5 ? `${parts[1]}/${year}` : parts[1];
      }
      if (data.arrivalInfo !== undefined && data.arrivalInfo !== '') andataBase.orarioArrivo = data.arrivalInfo;
      if (data.departureInfo !== undefined && data.departureInfo !== '') ritornoBase.orarioPartenza = data.departureInfo;
      setVoloAndata(andataBase);
      setVoloRitorno(ritornoBase);
      if (data.voloPraticaNumber !== undefined) setVoloPraticaNumber(data.voloPraticaNumber);
      if (data.voloPreventivoNumber !== undefined) setVoloPreventivoNumber(data.voloPreventivoNumber);
      if (entry.updated_at) {
        const d = new Date(entry.updated_at);
        setVoloPreventivoCreatedAt(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      } else setVoloPreventivoCreatedAt('');
      if (data.voloBagaglioStivaKg !== undefined) setVoloBagaglioStivaKg(Number(data.voloBagaglioStivaKg) || 15);
      if (data.voloBagaglioManoKg !== undefined) setVoloBagaglioManoKg(Number(data.voloBagaglioManoKg) || 7);
      return;
    }

    if (data.mode) setMode(data.mode);
    setTimeout(() => {
      const names = entry.client_name.split(' ');
      setCustomerFirstName(names[0] || '');
      setCustomerLastName(names.slice(1).join(' ') || '');
      if (data.contactEmail !== undefined) setContactEmail(data.contactEmail);
      if (data.contactPhone !== undefined) setContactPhone(data.contactPhone);
      if (data.arrivalInfo !== undefined) setArrivalInfo(data.arrivalInfo);
      if (data.departureInfo !== undefined) setDepartureInfo(data.departureInfo);
      if (data.flightCodeOut !== undefined) setFlightCodeOut(data.flightCodeOut);
      if (data.flightCodeReturn !== undefined) setFlightCodeReturn(data.flightCodeReturn);
      if (data.accommodations) setAccommodations(data.accommodations);
      if (data.totalPax !== undefined) setTotalPax(data.totalPax);
      if (data.includeTransfer !== undefined) setIncludeTransfer(data.includeTransfer);
      if (data.includeForfait !== undefined) setIncludeForfait(data.includeForfait);
      if (data.payNowDiscount !== undefined) setPayNowDiscount(data.payNowDiscount);
      if (data.discount) setDiscount(data.discount);
      if (data.restaurantEnabled !== undefined) setRestaurantEnabled(data.restaurantEnabled);
      if (data.restaurantRequests) setRestaurantRequests(data.restaurantRequests);
      if (data.restaurantDiscount) setRestaurantDiscount(data.restaurantDiscount);
      if (data.flightRequest) setFlightRequest(data.flightRequest);
      if (data.useEfesoIban !== undefined) setUseEfesoIban(data.useEfesoIban);
      setActiveTab('preview');
    }, 0);
  };

  // --- Handlers ---

  const addAccommodation = () => {
    const firstAcc = accommodations[0];
    setAccommodations([...accommodations, { 
      type: 'Mono 2p', 
      quantity: 1, 
      useManualPrice: false, 
      manualPrice: 0,
      checkIn: firstAcc?.checkIn || '',
      checkOut: firstAcc?.checkOut || '',
      addExtraBed: false
    }]);
  };

  const removeAccommodation = (index: number) => {
    if (accommodations.length > 1) {
      setAccommodations(accommodations.filter((_, i) => i !== index));
    }
  };

  const updateAccommodation = (index: number, field: keyof AccommodationRequest, value: any) => {
    setAccommodations(prev => {
      const newAccs = [...prev];
      newAccs[index] = { ...newAccs[index], [field]: value };
      
      if (field === 'checkIn') {
        if (newAccs[index].checkOut && value > newAccs[index].checkOut) {
          newAccs[index].checkOut = '';
        }
      }
      
      return newAccs;
    });
  };

  const addRestaurant = () => {
    const firstAcc = accommodations[0];
    const newReq: RestaurantRequest = { 
      checkIn: firstAcc?.checkIn || '', 
      checkOut: firstAcc?.checkOut || '', 
      type: 'HB', 
      adults: 2, 
      children: 0 
    };
    
    // If enabling for the first time and list is empty (or has default empty one), update the first one
    if (restaurantRequests.length === 1 && !restaurantRequests[0].checkIn) {
        setRestaurantRequests([newReq]);
    } else {
        setRestaurantRequests([...restaurantRequests, newReq]);
    }
  };

  // Effect to sync restaurant dates when enabling if empty
  const handleRestaurantToggle = (checked: boolean) => {
    setRestaurantEnabled(checked);
    
    // Sync logic for Stay Mode
    if (mode === 'stay' && checked && accommodations.length > 0) {
      const firstAcc = accommodations[0];
      if (firstAcc.checkIn && firstAcc.checkOut) {
         setRestaurantRequests(prev => {
             if (prev.length === 1 && !prev[0].checkIn) {
                 return [{
                     ...prev[0],
                     checkIn: firstAcc.checkIn,
                     checkOut: firstAcc.checkOut
                 }];
             }
             return prev;
         });
      }
    }
    
    // Sync logic for Flight Mode
    if (mode === 'flight' && checked && flightRequest.week) {
       // Parse week string "DD/MM - DD/MM" to actual YYYY-MM-DD strings
       const currentYear = new Date().getFullYear();
       const [startStr, endStr] = flightRequest.week.split(' - ');
       
       // Helper to convert DD/MM to YYYY-MM-DD
       const toIso = (dStr: string) => {
           const [d, m] = dStr.split('/');
           return `${currentYear}-${m}-${d}`;
       };
       
       const checkIn = toIso(startStr);
       const checkOut = toIso(endStr); // This is usually 7 days later
       
       // Handle 2 weeks if checked
       let finalCheckOut = checkOut;
       if (flightRequest.isTwoWeeks) {
           // We need to calculate date + 7 days properly or just trust the user will adjust?
           // Ideally we parse date, add 7 days, format back.
           // For simplicity in this context without heavy date-fns usage inside component (though it's available via imports if needed, but not imported currently):
           // Actually date-fns is not imported in page.tsx currently.
           // Let's rely on the calculator's logic which handles dates.
           // But here we need to set the string state.
           // Let's assume standard 7 days. If 2 weeks, we might want to extend it.
           // However, "flightRequest.week" is just one week. 
           // The "isTwoWeeks" flag handles the price calculation.
           // If user wants restaurant for 2 weeks, they should probably adjust manually or we try to smart guess.
           // For now, let's just sync the base week dates.
           // To do it properly with date math, we'd need date-fns in page.tsx.
       }

       setRestaurantRequests(prev => {
           if (prev.length === 1 && !prev[0].checkIn) {
               return [{
                   ...prev[0],
                   checkIn,
                   checkOut
               }];
           }
           return prev;
       });
    }
  };

  const removeRestaurant = (index: number) => {
    if (restaurantRequests.length > 1) {
      setRestaurantRequests(restaurantRequests.filter((_, i) => i !== index));
    }
  };

  const updateRestaurant = (index: number, field: keyof RestaurantRequest, value: any) => {
    const newReqs = [...restaurantRequests];
    newReqs[index] = { ...newReqs[index], [field]: value };
    
    if (field === 'checkIn') {
      if (newReqs[index].checkOut && value > newReqs[index].checkOut) {
        newReqs[index].checkOut = '';
      }
    }
    
    setRestaurantRequests(newReqs);
  };

  const updateFlightRequest = (field: keyof FlightRequest, value: any) => {
    setFlightRequest(prev => ({ ...prev, [field]: value }));
  };

  const resetQuoteForm = () => {
    setMode('stay');
    setCustomerFirstName('');
    setCustomerLastName('');
    setContactEmail('');
    setContactPhone('');
    setArrivalInfo('');
    setDepartureInfo('');
    setAccommodations([{ ...DEFAULT_ACCOMMODATIONS[0] }]);
    setTotalPax(2);
    setIncludeTransfer(true);
    setIncludeForfait(true);
    setPayNowDiscount(true);
    setDiscount({ ...DEFAULT_DISCOUNT });
    setRestaurantEnabled(false);
    setRestaurantRequests([{ ...DEFAULT_RESTAURANT_REQUESTS[0] }]);
    setRestaurantDiscount({ ...DEFAULT_RESTAURANT_DISCOUNT });
    setFlightRequest({ ...DEFAULT_FLIGHT_REQUEST });
    setUseEfesoIban(false);
    setActiveTab('preview');
  };

  const quote = useMemo(() => {
    if (mode === 'stay') {
      if (accommodations.length === 0) return null;
      const allDatesSet = accommodations.every(acc => acc.checkIn && acc.checkOut);
      if (!allDatesSet) return null;
      if (totalPax < 1) return null;

      try {
        return calculateQuote(
          accommodations, 
          totalPax, 
          includeTransfer, 
          includeForfait, 
          discount,
          restaurantEnabled,
          restaurantRequests,
          restaurantDiscount,
          payNowDiscount
        );
      } catch (e) {
        console.error("Error calculating stay quote:", e);
        return null;
      }
    } else {
      // Flight Mode
      if (!flightRequest.week) return null;
      const totalFlightPax = flightRequest.adults + flightRequest.children;
      if (totalFlightPax < 1) return null;

      try {
        return calculateFlightQuote(
          flightRequest, 
          discount,
          restaurantEnabled,
          restaurantRequests,
          restaurantDiscount
        );
      } catch (e) {
        console.error("Error calculating flight quote:", e);
        return null;
      }
    }
  }, [mode, accommodations, totalPax, includeTransfer, includeForfait, discount, restaurantEnabled, restaurantRequests, restaurantDiscount, flightRequest, payNowDiscount]);

  const quoteWithCustomer = useMemo(() => {
    if (!quote) return null;
    return {
      ...quote,
      customerFirstName: customerFirstName.trim(),
      customerLastName: customerLastName.trim(),
      contactEmail,
      contactPhone,
      arrivalInfo,
      departureInfo,
      flightCodeOut,
      flightCodeReturn,
      isConferma: mainTab === 'conferme',
      useEfesoIban
    };
  }, [quote, customerFirstName, customerLastName, contactEmail, contactPhone, arrivalInfo, departureInfo, flightCodeOut, flightCodeReturn, mainTab, useEfesoIban]);

  const htmlOutput = useMemo(() => quoteWithCustomer ? generateHtml(quoteWithCustomer) : '', [quoteWithCustomer]);
  const textOutput = useMemo(() => quoteWithCustomer ? generatePlainText(quoteWithCustomer) : '', [quoteWithCustomer]);

  const flightModuleHtml = useMemo(() => {
    const trattaAndata = voloCittaPartenza.trim() ? `${voloCittaPartenza.trim()} - Lampedusa` : '';
    const trattaRitorno = voloCittaPartenza.trim() ? `Lampedusa - ${voloCittaPartenza.trim()}` : '';
    const data: FlightModuleData = {
      praticaNumber: voloPraticaNumber,
      preventivoNumber: voloPreventivoNumber,
      preventivoCreatedAt: voloPreventivoCreatedAt || undefined,
      bagaglioStivaKg: voloBagaglioStivaKg,
      bagaglioManoKg: voloBagaglioManoKg,
      customerFirstName,
      customerLastName,
      otherPassengers: voloOtherPassengers,
      andata: { ...voloAndata, compagnia: voloCompagnia, tratta: trattaAndata },
      ritorno: { ...voloRitorno, compagnia: voloCompagnia, tratta: trattaRitorno },
    };
    return generateFlightModuleHtml(data);
  }, [voloPraticaNumber, voloPreventivoNumber, voloPreventivoCreatedAt, voloBagaglioStivaKg, voloBagaglioManoKg, customerFirstName, customerLastName, voloOtherPassengers, voloCompagnia, voloCittaPartenza, voloAndata, voloRitorno]);

  // Fix image path for GitHub Pages
  const logoPath = process.env.NODE_ENV === 'production' ? '/Prev3/logo.png' : '/logo.png';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiato negli appunti!');
  };
  const saveQuoteToHistory = async (status: 'preventivo' | 'conferma') => {
    if (customerFirstName || customerLastName) {
      const clientName = `${customerFirstName} ${customerLastName}`.trim();
      if (clientName) {
        try {
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName,
              quoteData: {
                mode,
                accommodations,
                totalPax,
                includeTransfer,
                includeForfait,
                payNowDiscount,
                discount,
                restaurantEnabled,
                restaurantRequests,
                restaurantDiscount,
                flightRequest,
                contactEmail,
                contactPhone,
                arrivalInfo,
                departureInfo,
                flightCodeOut,
                flightCodeReturn,
                useEfesoIban,
                quote: quoteWithCustomer
              },
              status: status
            })
          });
          await fetchHistory(mainTab, mode);
        } catch (err) {
          console.error('Errore nel salvataggio storico:', err);
        }
      }
    }
  };

  const copyRichText = async () => {
    try {
      const blob = new Blob([htmlOutput], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([textOutput], { type: 'text/plain' }) })];
      await navigator.clipboard.write(data);
      
      await saveQuoteToHistory(mainTab === 'conferme' ? 'conferma' : 'preventivo');
    } catch (err) {
      console.error('Errore nella copia rich text:', err);
      navigator.clipboard.writeText(htmlOutput);
      alert('Copiato come codice HTML (fallback)');
    }
  };

  const saveAsWord = async () => {
    if (!quoteWithCustomer) return;
    try {
      const blob = await generateDocx(quoteWithCustomer);
      const filename = `Conferma_${quoteWithCustomer.customerLastName || 'Cliente'}.docx`;
      saveAs(blob, filename);

      // Save to history automatically
      if (customerFirstName || customerLastName) {
        const clientName = `${customerFirstName} ${customerLastName}`.trim();
        if (clientName) {
           await fetch('/api/history', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               clientName,
               quoteData: {
                 mode,
                 accommodations,
                 totalPax,
                 includeTransfer,
                 includeForfait,
                 payNowDiscount,
                 discount,
                 restaurantEnabled,
                 restaurantRequests,
                 restaurantDiscount,
                 flightRequest,
                 contactEmail,
                 contactPhone,
                 arrivalInfo,
                 departureInfo,
                 flightCodeOut,
                 flightCodeReturn,
                 useEfesoIban,
                 quote: quoteWithCustomer
               },
               status: 'conferma'
             })
           });
           await fetchHistory(mainTab, mode);
        }
      }
    } catch (err) {
      console.error('Errore generazione DOCX:', err);
      alert('Errore durante la generazione del file Word.');
    }
  };

  return (
    <main className="min-h-screen flex bg-slate-100">
      {/* Sidebar Liquid Glass */}
      <aside className="w-20 bg-slate-900/90 backdrop-blur-xl border-r border-slate-700 text-white flex flex-col items-center sticky top-0 h-screen shrink-0 z-10 transition-all">
        <div className="p-4 border-b border-slate-700/50 flex flex-col items-center w-full mt-2">
          <img src={logoPath} alt="Logo" className="w-10 h-auto bg-white/10 rounded-lg p-1 mb-2" />
        </div>
        <nav className="flex-1 w-full px-2 py-4 space-y-4">
          <button
            onClick={() => setMainTab('preventivi')}
            className={`w-full flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] font-bold uppercase transition-all ${
              mainTab === 'preventivi' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50' : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Preventivi"
          >
            <FileText className="w-6 h-6 mb-1" />
            Prev.
          </button>
          <button
            onClick={() => setMainTab('conferme')}
            className={`w-full flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] font-bold uppercase transition-all ${
              mainTab === 'conferme' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50' : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Conferme"
          >
            <FileCheck className="w-6 h-6 mb-1" />
            Conf.
          </button>
          <button
            onClick={() => setMainTab('volo')}
            className={`w-full flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] font-bold uppercase transition-all ${
              mainTab === 'volo' ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-400/50' : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Modulo Operativo Trasporti"
          >
            <Plane className="w-6 h-6 mb-1" />
            Volo
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto h-screen relative">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {mainTab === 'volo' ? (
            <>
            {/* ---------- Sezione Volo: solo modulo operativo trasporti ---------- */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-8 text-white bg-gradient-to-r from-sky-600 to-sky-400">
                <h1 className="text-3xl font-extrabold tracking-tight uppercase">Modulo Operativo Trasporti</h1>
                <p className="text-white/90 mt-2 text-lg font-medium">Dati pratica, nominativi e operativo voli per la stampa</p>
              </div>
              <div className="grid lg:grid-cols-[400px,1fr] gap-0">
                <div className="p-6 bg-slate-50 border-r border-slate-200 space-y-6">
                  <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Dati Pratica</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">N. Pratica</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloPraticaNumber} onChange={(e) => setVoloPraticaNumber(e.target.value)} placeholder="Es. 2024-001" /></div>
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">N. Preventivo</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloPreventivoNumber} onChange={(e) => setVoloPreventivoNumber(e.target.value)} placeholder="Es. 123" /></div>
                    </div>
                  </section>
                  <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Passeggeri</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Capogruppo – Nome</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)} placeholder="Nome" /></div>
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Capogruppo – Cognome</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)} placeholder="Cognome" /></div>
                    </div>
                    <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Altri passeggeri (uno per riga: Cognome Nome)</label><textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm min-h-[80px]" value={voloOtherPassengers} onChange={(e) => setVoloOtherPassengers(e.target.value)} placeholder="Rossi Mario&#10;Bianchi Laura" /></div>
                  </section>
                  <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Operativo Voli</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Arrivo e ripartenza sempre Lampedusa; indica la città di partenza.</p>
                    <div className="space-y-3 mb-4">
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Compagnia (andata e ritorno)</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloCompagnia} onChange={(e) => setVoloCompagnia(e.target.value)} placeholder="Es. Ryanair" /></div>
                      <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Città di partenza</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloCittaPartenza} onChange={(e) => setVoloCittaPartenza(e.target.value)} placeholder="Es. BGY, MXP" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-bold text-sky-700 text-xs mb-2">Andata</div>
                        <div className="space-y-2">
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Data</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloAndata.data} onChange={(e) => setVoloAndata((a) => ({ ...a, data: e.target.value }))} placeholder="gg/mm/aaaa" /></div>
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Or. Partenza</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloAndata.orarioPartenza} onChange={(e) => setVoloAndata((a) => ({ ...a, orarioPartenza: e.target.value }))} /></div>
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Or. Arrivo</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloAndata.orarioArrivo} onChange={(e) => setVoloAndata((a) => ({ ...a, orarioArrivo: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-sky-700 text-xs mb-2">Ritorno</div>
                        <div className="space-y-2">
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Data</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloRitorno.data} onChange={(e) => setVoloRitorno((r) => ({ ...r, data: e.target.value }))} placeholder="gg/mm/aaaa" /></div>
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Or. Partenza</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloRitorno.orarioPartenza} onChange={(e) => setVoloRitorno((r) => ({ ...r, orarioPartenza: e.target.value }))} /></div>
                          <div><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Or. Arrivo</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={voloRitorno.orarioArrivo} onChange={(e) => setVoloRitorno((r) => ({ ...r, orarioArrivo: e.target.value }))} /></div>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Note – Bagaglio</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Valori usati nella nota del modulo stampato (bagaglio in stiva + a mano).</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Stiva (kg)</label>
                        <input type="number" min="0" max="99" className="w-14 p-2 border border-slate-200 rounded-lg text-sm text-center" value={voloBagaglioStivaKg} onChange={(e) => setVoloBagaglioStivaKg(Math.max(0, parseInt(e.target.value, 10) || 0))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">A mano (kg)</label>
                        <input type="number" min="0" max="99" className="w-14 p-2 border border-slate-200 rounded-lg text-sm text-center" value={voloBagaglioManoKg} onChange={(e) => setVoloBagaglioManoKg(Math.max(0, parseInt(e.target.value, 10) || 0))} />
                      </div>
                    </div>
                  </section>
                </div>
                <div className="bg-slate-200 min-h-[500px] flex flex-col">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase">Anteprima modulo</span>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    <iframe srcDoc={flightModuleHtml} title="Anteprima modulo volo" className="w-full min-h-[800px] border border-slate-200 rounded-lg bg-white shadow-inner" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><RotateCcw className="w-4 h-4 mr-2 text-sky-600" /> Storico conferme volo</h3>
                {loadingHistory ? <div className="text-slate-500 text-sm">Caricamento...</div> : history.length === 0 ? <div className="text-slate-500 text-sm">Nessuna conferma volo. Carica da Conferme (Volo + Soggiorno) per vederla qui.</div> : (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="text-xs uppercase bg-slate-100 text-slate-500 sticky top-0">
                        <tr><th className="px-4 py-2 font-bold">Nome Cliente</th><th className="px-4 py-2 font-bold">Data</th><th className="px-4 py-2 text-center font-bold">Azione</th></tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => (
                          <tr key={entry.client_name} className="border-b border-slate-100 bg-emerald-50/50 hover:bg-emerald-100">
                            <td className="px-4 py-2 font-bold text-slate-800 truncate max-w-[200px]">
                              <div className="flex items-center gap-2">
                                {entry.data?.mode === 'flight' && <Plane className="w-3.5 h-3.5 text-blue-500 shrink-0 mr-1.5" />}
                                {entry.client_name}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">{new Date(entry.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={() => restoreHistory(entry)} className="bg-sky-100 text-sky-700 hover:bg-sky-200 px-3 py-1 rounded text-xs font-bold">Carica</button>
                                <button type="button" onClick={() => deleteEntry(entry.client_name)} className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" title="Elimina">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* FAB Salva PDF con nome — sezione Volo (tondo in basso a destra come Conferme) */}
            {mainTab === 'volo' && (
              <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
                <button
                  type="button"
                  onClick={async () => {
                    const fileName = `Modulo_Volo_${customerLastName || 'cliente'}.pdf`.trim();
                    try {
                      const response = await fetch('/api/pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ html: flightModuleHtml, fileName }),
                      });
                      if (!response.ok) throw new Error('PDF generation failed');
                      const blob = await response.blob();
                      if ('showSaveFilePicker' in window) {
                        try {
                          const handle = await (window as any).showSaveFilePicker({
                            suggestedName: fileName,
                            types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
                          });
                          const writable = await handle.createWritable();
                          await writable.write(blob);
                          await writable.close();
                        } catch (err: any) {
                          if (err.name !== 'AbortError') throw err;
                        }
                      } else {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      }
                    } catch (error) {
                      console.error('Error saving PDF:', error);
                      alert('Errore durante la generazione del PDF.');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white w-14 h-14 rounded-full shadow-2xl shadow-purple-600/30 flex items-center justify-center transform hover:scale-110 transition-all group"
                  title="Salva PDF con nome"
                >
                  <FileText className="w-6 h-6" />
                  <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Salva PDF con nome
                  </span>
                </button>
              </div>
            )}
            </>
          ) : (
          <>
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className={`p-8 text-white flex items-center gap-6 transition-colors duration-500 ${mainTab === 'conferme' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`}>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight uppercase">
                  {mainTab === 'conferme' ? 'Conferme' : 'Preventivi'}
                </h1>
                <p className="text-white/90 mt-2 text-lg font-medium">
                  {mainTab === 'conferme' ? 'Gestione prenotazioni confermate' : 'Gestione multi-alloggio, sconti e prezzi manuali'}
                </p>
              </div>
            </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setMode('stay')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              mode === 'stay' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            Solo Soggiorno
          </button>
          <button
            onClick={() => setMode('flight')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              mode === 'flight' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plane className="w-4 h-4" />
            Volo + Soggiorno
          </button>
        </div>

        <div className="grid lg:grid-cols-[450px,1fr] gap-0">
          {/* Form Area */}
          <div className="p-8 bg-slate-50 border-r border-slate-200 space-y-8 relative">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={resetQuoteForm}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors uppercase tracking-wider shadow-sm"
                title="Resetta tutto il preventivo"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            
            {mainTab === 'conferme' && (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-emerald-800 uppercase flex items-center gap-2">
                  <FileCheck className="w-4 h-4" /> Dettagli Conferma / Logistica
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Nome</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={customerFirstName}
                      onChange={(e) => setCustomerFirstName(e.target.value)}
                      placeholder="Nome cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Cognome</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                      placeholder="Cognome cliente"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Email</label>
                    <input
                      type="email"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="email@es.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Cellulare</label>
                    <input
                      type="tel"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+39 333..."
                    />
                  </div>
                </div>
                {mode === 'flight' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/50">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Volo Andata (Codice)</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                        value={flightCodeOut}
                        onChange={(e) => setFlightCodeOut(e.target.value)}
                        placeholder="Es: U2 1234"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Volo Ritorno (Codice)</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                        value={flightCodeReturn}
                        onChange={(e) => setFlightCodeReturn(e.target.value)}
                        placeholder="Es: U2 5678"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-white/50 border border-emerald-200 rounded-lg shadow-sm group hover:bg-white transition-all cursor-pointer" onClick={() => setUseEfesoIban(!useEfesoIban)}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-500 cursor-pointer"
                    checked={useEfesoIban}
                    onChange={(e) => setUseEfesoIban(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Iban Efeso</span>
                    <span className="text-[9px] text-emerald-600 font-medium">Usa dati EfesoVacanze.com invece del Camping</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Arrivo (Orario)</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={arrivalInfo}
                      onChange={(e) => setArrivalInfo(e.target.value)}
                      placeholder="Es: 10:30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Partenza (Orario)</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-900"
                      value={departureInfo}
                      onChange={(e) => setDepartureInfo(e.target.value)}
                      placeholder="Es: 18:45"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'stay' ? (
              // STAY MODE FORM
              <div className="space-y-6">
              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                {mainTab !== 'conferme' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nome</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                        value={customerFirstName}
                        onChange={(e) => setCustomerFirstName(e.target.value)}
                        placeholder="Nome cliente"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cognome</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                        value={customerLastName}
                        onChange={(e) => setCustomerLastName(e.target.value)}
                        placeholder="Cognome cliente"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-800 uppercase tracking-wider">Alloggi e Periodi</label>
                    <button
                      onClick={addAccommodation}
                      className="flex items-center text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      AGGIUNGI
                    </button>
                  </div>

                {accommodations.map((acc, index) => (
                  <div key={index} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 relative group">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Arrivo</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                          value={acc.checkIn}
                          onChange={(e) => updateAccommodation(index, 'checkIn', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Partenza</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                          value={acc.checkOut}
                          min={acc.checkIn}
                          onChange={(e) => updateAccommodation(index, 'checkOut', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tipo</label>
                        <select
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                          value={acc.type}
                          onChange={(e) => updateAccommodation(index, 'type', e.target.value)}
                        >
                          <option value="Bilo 4p Super">Bilo 4p Super</option>
                          <option value="Bilo 4p">Bilo 4p</option>
                          <option value="Mono 3p">Mono 3p</option>
                          <option value="Mono 2p">Mono 2p</option>
                          <option value="Chalet 2+1">Chalet 2+1</option>
                          <option value="Bungalow 2p">Bungalow 2p</option>
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">N°</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-center text-slate-900"
                          value={acc.quantity}
                          onChange={(e) => updateAccommodation(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center text-[10px] font-bold text-slate-500 cursor-pointer uppercase">
                        <input
                          type="checkbox"
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={acc.addExtraBed}
                          onChange={(e) => updateAccommodation(index, 'addExtraBed', e.target.checked)}
                        />
                        Letto aggiuntivo (+10€/gg)
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <label className="flex items-center text-[10px] font-bold text-slate-500 cursor-pointer uppercase">
                        <input
                          type="checkbox"
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={acc.useManualPrice}
                          onChange={(e) => updateAccommodation(index, 'useManualPrice', e.target.checked)}
                        />
                        Prezzo Manuale
                      </label>
                      {acc.useManualPrice && (
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                          <input
                            type="number"
                            className="w-full pl-5 pr-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                            value={acc.manualPrice}
                            onChange={(e) => updateAccommodation(index, 'manualPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>

                    {accommodations.length > 1 && (
                      <button
                        onClick={() => removeAccommodation(index)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Common Stay Options */}
              <div className="space-y-4 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-slate-800 uppercase tracking-wider">Ospiti Totali</label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                    <button 
                      onClick={() => setTotalPax(Math.max(1, totalPax - 1))}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900">{totalPax}</span>
                    <button 
                      onClick={() => setTotalPax(totalPax + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      checked={includeForfait}
                      onChange={(e) => setIncludeForfait(e.target.checked)}
                    />
                    <span className="ml-3 text-sm font-medium text-slate-700">Includi Forfait Servizi</span>
                  </label>
                  
                  <label className="flex items-center p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      checked={includeTransfer}
                      onChange={(e) => setIncludeTransfer(e.target.checked)}
                    />
                    <span className="ml-3 text-sm font-medium text-slate-700">Includi Transfer A/R</span>
                  </label>

                  <label className="flex items-center p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      checked={payNowDiscount}
                      onChange={(e) => setPayNowDiscount(e.target.checked)}
                    />
                    <span className="ml-3 text-sm font-medium text-slate-700">Paga Prima (-10%)</span>
                  </label>
                </div>
              </div>

              {/* Common Discount Section */}
              <div className="space-y-4 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={discount.enabled}
                        onChange={(e) => setDiscount({ ...discount, enabled: e.target.checked })}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${discount.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${discount.enabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      Sconto Extra
                    </span>
                  </label>
                </div>

                {discount.enabled && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-3 items-center">
                      <select
                        className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700"
                        value={discount.type}
                        onChange={(e) => setDiscount({ ...discount, type: e.target.value as 'fixed' | 'percentage' })}
                      >
                        <option value="percentage">Percentuale (%)</option>
                        <option value="fixed">Fisso (€)</option>
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-sm font-medium"
                          value={discount.value}
                          onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                          {discount.type === 'fixed' ? <Euro className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">%</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Nome sconto (opzionale, default: Sconto)"
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                        value={discount.name || ''}
                        onChange={(e) => setDiscount({ ...discount, name: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={restaurantEnabled}
                          onChange={(e) => handleRestaurantToggle(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${restaurantEnabled ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${restaurantEnabled ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="ml-3 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                        <Utensils className="w-4 h-4 mr-2" />
                        Ristorante
                      </span>
                    </label>
                    {restaurantEnabled && (
                      <button
                        onClick={addRestaurant}
                        className="flex items-center text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        AGGIUNGI
                      </button>
                    )}
                  </div>

                  {restaurantEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      {restaurantRequests.map((req, index) => (
                        <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3 relative">
                           {/* Existing Restaurant Request Logic */}
                           {restaurantRequests.length > 1 && (
                            <button
                              onClick={() => removeRestaurant(index)}
                              className="absolute top-2 right-2 text-orange-400 hover:text-orange-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Dal</label>
                              <input
                                type="date"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.checkIn}
                                onChange={(e) => updateRestaurant(index, 'checkIn', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Al</label>
                              <input
                                type="date"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.checkOut}
                                min={req.checkIn}
                                onChange={(e) => updateRestaurant(index, 'checkOut', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Trattamento</label>
                              <select
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.type}
                                onChange={(e) => updateRestaurant(index, 'type', e.target.value as 'HB' | 'FB')}
                              >
                                <option value="HB">Mezza P.</option>
                                <option value="FB">Pensione C.</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Adulti</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.adults}
                                onChange={(e) => updateRestaurant(index, 'adults', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Bambini</label>
                              <input
                                type="number"
                                min="0"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.children}
                                onChange={(e) => updateRestaurant(index, 'children', parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="pt-4 border-t border-orange-200">
                        <label className="flex items-center mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 border-orange-300"
                            checked={restaurantDiscount.enabled}
                            onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, enabled: e.target.checked })}
                          />
                          <span className="ml-2 text-sm font-bold text-orange-800">Sconto Ristorante</span>
                        </label>
                        
                        {restaurantDiscount.enabled && (
                          <div className="flex gap-3 items-center">
                            <select
                              className="p-2 border border-orange-200 rounded-lg text-xs bg-white"
                              value={restaurantDiscount.type}
                              onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, type: e.target.value as 'fixed' | 'percentage' })}
                            >
                              <option value="percentage">Percentuale (%)</option>
                              <option value="fixed">Fisso (€)</option>
                            </select>
                            <input
                              type="number"
                              className="w-24 p-2 border border-orange-200 rounded-lg text-xs"
                              value={restaurantDiscount.value}
                              onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, value: parseFloat(e.target.value) || 0 })}
                              placeholder="Valore"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              {/* Common Discount Section Removed from here */}
              </div>
            ) : (
              // FLIGHT MODE FORM
              <div className="space-y-6">
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  {mainTab !== 'conferme' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nome</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                          value={customerFirstName}
                          onChange={(e) => setCustomerFirstName(e.target.value)}
                          placeholder="Nome cliente"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cognome</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium text-slate-900"
                          value={customerLastName}
                          onChange={(e) => setCustomerLastName(e.target.value)}
                          placeholder="Cognome cliente"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <Plane className="w-5 h-5 mr-2 text-blue-600" />
                    Dettagli Volo + Soggiorno
                  </h3>
                  
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    {/* Airport */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Aeroporto di Partenza</label>
                      <select
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-900"
                        value={flightRequest.airport}
                        onChange={(e) => updateFlightRequest('airport', e.target.value)}
                      >
                        {AIRPORTS.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    {/* Week */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Settimana</label>
                      <select
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-900"
                        value={flightRequest.week}
                        onChange={(e) => updateFlightRequest('week', e.target.value)}
                      >
                        {flightPricesData.weeks.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>

                    {/* Accommodation Type */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tipologia Alloggio</label>
                      <select
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-900"
                        value={flightRequest.accommodationType}
                        onChange={(e) => updateFlightRequest('accommodationType', e.target.value)}
                      >
                        <option value="Mono 2p">Mono 2p</option>
                        <option value="Mono 3p">Mono 3p</option>
                        <option value="Bilo 4p">Bilo 4p</option>
                        <option value="Bilo 4p Super">Bilo 4p Super</option>
                        <option value="Chalet 2+1">Chalet 2+1</option>
                        <option value="Bungalow 2p">Bungalow 2p</option>
                      </select>
                    </div>

                    {/* Pax */}
                    <div className="space-y-4 pt-6 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Ospiti Totali
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adulti</label>
                            <input
                            type="number"
                            min="1"
                            className="w-full p-3 border border-slate-200 rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={flightRequest.adults}
                            onChange={(e) => updateFlightRequest('adults', parseInt(e.target.value) || 1)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bambini</label>
                            <input
                            type="number"
                            min="0"
                            className="w-full p-3 border border-slate-200 rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={flightRequest.children}
                            onChange={(e) => updateFlightRequest('children', parseInt(e.target.value) || 0)}
                            />
                        </div>
                        </div>
                    </div>

                    {/* Common Discount Section */}
                    <div className="space-y-4 pt-6 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={discount.enabled}
                                onChange={(e) => setDiscount({ ...discount, enabled: e.target.checked })}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${discount.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${discount.enabled ? 'transform translate-x-4' : ''}`}></div>
                            </div>
                            <span className="ml-3 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                            <Tag className="w-4 h-4 mr-2" />
                            Sconto Extra
                            </span>
                        </label>
                        </div>

                        {discount.enabled && (
                        <div className="flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                            <select
                            className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700"
                            value={discount.type}
                            onChange={(e) => setDiscount({ ...discount, type: e.target.value as 'fixed' | 'percentage' })}
                            >
                            <option value="percentage">Percentuale (%)</option>
                            <option value="fixed">Fisso (€)</option>
                            </select>
                            <div className="relative flex-1">
                            <input
                                type="number"
                                className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-sm font-medium"
                                value={discount.value}
                                onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                            />
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                {discount.type === 'fixed' ? <Euro className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">%</span>}
                            </div>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                          checked={flightRequest.isTwoWeeks}
                          onChange={(e) => updateFlightRequest('isTwoWeeks', e.target.checked)}
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">2 Settimane (+70€ supplemento)</span>
                      </label>

                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                          checked={flightRequest.includeAirportTaxes}
                          onChange={(e) => updateFlightRequest('includeAirportTaxes', e.target.checked)}
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">Includi Tasse Aeroportuali (35€/pax)</span>
                      </label>
                      
                      <div className="pt-2 border-t border-slate-100 mt-2">
                         <label className="flex items-center cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            checked={flightRequest.useManualPrice}
                            onChange={(e) => updateFlightRequest('useManualPrice', e.target.checked)}
                          />
                          <span className="ml-2 text-sm font-medium text-slate-700">Prezzo Manuale Volo</span>
                        </label>
                        
                        {flightRequest.useManualPrice && (
                           <div className="flex items-center gap-2">
                             <span className="text-sm text-slate-500">€</span>
                             <input
                               type="number"
                               className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                               value={flightRequest.manualPrice}
                               onChange={(e) => updateFlightRequest('manualPrice', parseFloat(e.target.value) || 0)}
                               placeholder="Prezzo Volo"
                             />
                           </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 mt-2 space-y-2">
                         <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                              checked={flightRequest.includeForfait}
                              onChange={(e) => updateFlightRequest('includeForfait', e.target.checked)}
                            />
                            <span className="ml-2 text-sm font-medium text-slate-700">Includi Forfait Servizi</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                              checked={flightRequest.includeTransfer}
                              onChange={(e) => updateFlightRequest('includeTransfer', e.target.checked)}
                            />
                            <span className="ml-2 text-sm font-medium text-slate-700">Includi Transfer</span>
                          </label>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Restaurant Section for Flight Mode */}
                <div className="space-y-4 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={restaurantEnabled}
                          onChange={(e) => handleRestaurantToggle(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${restaurantEnabled ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${restaurantEnabled ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="ml-3 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                        <Utensils className="w-4 h-4 mr-2" />
                        Ristorante
                      </span>
                    </label>
                    {restaurantEnabled && (
                      <button
                        onClick={addRestaurant}
                        className="flex items-center text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        AGGIUNGI
                      </button>
                    )}
                  </div>

                  {restaurantEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      {restaurantRequests.map((req, index) => (
                        <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3 relative">
                           {/* Existing Restaurant Request Logic */}
                           {restaurantRequests.length > 1 && (
                            <button
                              onClick={() => removeRestaurant(index)}
                              className="absolute top-2 right-2 text-orange-400 hover:text-orange-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Dal</label>
                              <input
                                type="date"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.checkIn}
                                onChange={(e) => updateRestaurant(index, 'checkIn', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Al</label>
                              <input
                                type="date"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.checkOut}
                                min={req.checkIn}
                                onChange={(e) => updateRestaurant(index, 'checkOut', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Trattamento</label>
                              <select
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.type}
                                onChange={(e) => updateRestaurant(index, 'type', e.target.value as 'HB' | 'FB')}
                              >
                                <option value="HB">Mezza P.</option>
                                <option value="FB">Pensione C.</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Adulti</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.adults}
                                onChange={(e) => updateRestaurant(index, 'adults', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Bambini</label>
                              <input
                                type="number"
                                min="0"
                                className="w-full p-2 border border-orange-200 rounded-lg text-xs"
                                value={req.children}
                                onChange={(e) => updateRestaurant(index, 'children', parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="pt-4 border-t border-orange-200">
                        <label className="flex items-center mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 border-orange-300"
                            checked={restaurantDiscount.enabled}
                            onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, enabled: e.target.checked })}
                          />
                          <span className="ml-2 text-sm font-bold text-orange-800">Sconto Ristorante</span>
                        </label>
                        
                        {restaurantDiscount.enabled && (
                          <div className="flex gap-3 items-center">
                            <select
                              className="p-2 border border-orange-200 rounded-lg text-xs bg-white"
                              value={restaurantDiscount.type}
                              onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, type: e.target.value as 'fixed' | 'percentage' })}
                            >
                              <option value="percentage">Percentuale (%)</option>
                              <option value="fixed">Fisso (€)</option>
                            </select>
                            <input
                              type="number"
                              className="w-24 p-2 border border-orange-200 rounded-lg text-xs"
                              value={restaurantDiscount.value}
                              onChange={(e) => setRestaurantDiscount({ ...restaurantDiscount, value: parseFloat(e.target.value) || 0 })}
                              placeholder="Valore"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>

                {/* Flight Discount */}
                <div className="space-y-4 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={discount.enabled}
                          onChange={(e) => setDiscount({ ...discount, enabled: e.target.checked })}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${discount.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${discount.enabled ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="ml-3 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                        <Tag className="w-4 h-4 mr-2" />
                        Sconto Extra
                      </span>
                    </label>
                  </div>

                  {discount.enabled && (
                    <div className="flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                      <select
                        className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700"
                        value={discount.type}
                        onChange={(e) => setDiscount({ ...discount, type: e.target.value as 'fixed' | 'percentage' })}
                      >
                        <option value="percentage">Percentuale (%)</option>
                        <option value="fixed">Fisso (€)</option>
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-sm font-medium"
                          value={discount.value}
                          onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                          {discount.type === 'fixed' ? <Euro className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">%</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview Area */}
          <div className="bg-slate-200 relative min-h-screen">
            <div className="p-8">
            {quote ? (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="font-bold text-slate-700">Anteprima Preventivo</h2>
                    <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded text-slate-600">
                      {mode === 'stay' ? 'SOLO SOGGIORNO' : 'VOLO + SOGGIORNO'}
                    </span>
                  </div>
                  
                  {activeTab === 'preview' && (
                    <div className="bg-slate-200">
                      <iframe
                        id="print-area"
                        srcDoc={htmlOutput}
                        className="w-full h-[1200px] border-none shadow-inner bg-slate-200"
                        title="Anteprima della conferma"
                      />
                    </div>
                  )}

                  {activeTab === 'html' && (
                    <div className="relative group">
                      <pre className="p-4 bg-slate-900 text-blue-100 text-xs overflow-x-auto h-[500px] font-mono leading-relaxed">
                        {htmlOutput}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(htmlOutput)}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors backdrop-blur"
                        title="Copia HTML"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {activeTab === 'text' && (
                    <div className="relative group">
                      <pre className="p-6 bg-white text-slate-700 text-sm overflow-x-auto h-[500px] font-mono whitespace-pre-wrap border-t border-slate-100">
                        {textOutput}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(textOutput)}
                        className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded transition-colors"
                        title="Copia Testo"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center border-2 border-dashed border-slate-300 rounded-xl">
                <HomeIcon className="w-16 h-16 mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-500 mb-2">Pronto per generare il preventivo</h3>
                <p className="max-w-xs mx-auto">
                  {mode === 'stay' 
                    ? "Inserisci le date e gli alloggi nel pannello di sinistra per vedere l'anteprima in tempo reale."
                    : "Seleziona i dettagli del volo e del soggiorno per calcolare il pacchetto."}
                </p>
              </div>
            )}
            </div>

            {/* Floating Action Button (FAB) for Copy / Conferme */}
            {quote && (
              <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
                {mainTab === 'conferme' ? (
                  <>
                    <button
                      onClick={async () => {
                        await saveQuoteToHistory('conferma');
                        const iframe = document.getElementById('print-area') as HTMLIFrameElement;
                        if (iframe && iframe.contentWindow) {
                          iframe.contentWindow.print();
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white w-14 h-14 rounded-full shadow-2xl shadow-emerald-600/30 flex items-center justify-center transform hover:scale-110 transition-all group"
                      title="Stampa (2 Pagine)"
                    >
                      <Printer className="w-6 h-6" />
                      <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Stampa (2 Pagine)
                      </span>
                    </button>
                    <button
                      onClick={async () => {
                        await saveQuoteToHistory('conferma');
                        const fileName = `caparra ${customerLastName || 'cliente'}.pdf`.trim();
                        
                        try {
                          const response = await fetch('/api/pdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              html: htmlOutput, 
                              fileName 
                            }),
                          });

                          if (!response.ok) throw new Error('PDF generation failed');

                          const blob = await response.blob();
                          
                          if ('showSaveFilePicker' in window) {
                            try {
                              const handle = await (window as any).showSaveFilePicker({
                                suggestedName: fileName,
                                types: [{
                                  description: 'Documento PDF',
                                  accept: { 'application/pdf': ['.pdf'] },
                                }],
                              });
                              const writable = await handle.createWritable();
                              await writable.write(blob);
                              await writable.close();
                            } catch (err: any) {
                              if (err.name !== 'AbortError') {
                                throw err;
                              }
                            }
                          } else {
                            // Fallback per browser non supportati
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          }
                        } catch (error) {
                          console.error('Error saving PDF:', error);
                          alert('Errore durante la generazione del PDF. Prova a usare il tasto Stampa.');
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white w-14 h-14 rounded-full shadow-2xl shadow-purple-600/30 flex items-center justify-center transform hover:scale-110 transition-all group"
                      title={`Salva PDF (caparra ${customerLastName || ''})`}
                    >
                      <FileText className="w-6 h-6" />
                      <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Salva PDF con nome
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={copyRichText}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl shadow-blue-600/30 flex items-center justify-center transform hover:scale-110 transition-all group"
                    title="Copia per Outlook"
                  >
                    <Copy className="w-6 h-6" />
                    <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Copia per Outlook
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <RotateCcw className="w-4 h-4 mr-2 text-blue-600" />
                Storico {mainTab === 'conferme' ? `Preventivi (${mode === 'stay' ? 'Solo Soggiorno' : 'Volo + Soggiorno'})` : 'Preventivi'}
              </h3>
              {loadingHistory ? (
                <div className="text-slate-500 text-sm">Caricamento storico...</div>
              ) : history.length === 0 ? (
                <div className="text-slate-500 text-sm">Nessun elemento salvato.</div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="text-xs uppercase bg-slate-100 text-slate-500 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 font-bold">Nome Cliente</th>
                          <th className="px-4 py-2 font-bold">Data</th>
                          <th className="px-4 py-2 font-bold text-right">Totale</th>
                          <th className="px-4 py-2 text-center font-bold">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => (
                          <tr 
                            key={entry.client_name} 
                            className={`border-b border-slate-100 transition-colors ${
                              entry.status === 'conferma' ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-blue-50/50'
                            }`}
                          >
                            <td className="px-4 py-2 font-bold text-slate-800 truncate max-w-[150px]" title={entry.client_name}>
                              <div className="flex items-center gap-2">
                                {entry.status === 'conferma' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shrink-0"></span>}
                                {entry.data?.mode === 'flight' && <Plane className="w-3.5 h-3.5 text-blue-500 shrink-0 mr-1.5" />}
                                {entry.client_name}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">
                              {new Date(entry.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-blue-600">
                              {formatEuro(entry.data.quote?.finalTotal || 0)} €
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => restoreHistory(entry)}
                                  className={`${
                                    entry.status === 'conferma' 
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  } px-3 py-1 rounded text-xs font-bold transition-colors inline-block`}
                                >
                                  {entry.status === 'conferma' ? 'Vedi' : 'Carica'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteEntry(entry.client_name)}
                                  className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
