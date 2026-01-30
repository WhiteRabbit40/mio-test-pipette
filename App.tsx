
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import type { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar, Thermometer, Activity, User, Plus, Upload, FileSpreadsheet, Trash2, Search, Filter, CloudRain, MapPin, Settings2, ShieldCheck, Palette, Sparkles, ChevronRight, History, Trash, Printer, Ruler, Tag, FileDown } from 'lucide-react';
import { CalibrationData, PipetteType, Client, StoredPipette, UiTheme } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { LiveChart } from './components/LiveChart';
import { generatePDF, getPDFPreviewURL, generateClientListPDF, generateLabelsSheetPDF } from './services/pdfGenerator';
import { CustomDatePicker } from './components/CustomDatePicker';

const THEME_CONFIG = {
  violet: { 
    rootBg: 'bg-[#0f172a]', headerBg: 'bg-[#1e293b]/95', cardBg: 'bg-slate-800/40', primary: 'violet-600', 
    accent: 'text-violet-400', bg: 'bg-violet-600', bgLight: 'bg-violet-500/10', border: 'border-violet-500/20',
    shadow: 'shadow-violet-900/40', gradient: 'from-violet-500/20', glow: 'bg-violet-500/20'
  },
  teal: { 
    rootBg: 'bg-[#042f2e]', headerBg: 'bg-[#134e4a]/95', cardBg: 'bg-[#115e59]/30', primary: 'teal-500', 
    accent: 'text-teal-400', bg: 'bg-teal-600', bgLight: 'bg-teal-500/15', border: 'border-teal-500/30',
    shadow: 'shadow-teal-900/40', gradient: 'from-teal-600/20', glow: 'bg-teal-500/20'
  },
  sky: { 
    rootBg: 'bg-[#0c4a6e]', headerBg: 'bg-[#075985]/95', cardBg: 'bg-[#0369a1]/25', primary: 'sky-500', 
    accent: 'text-sky-400', bg: 'bg-sky-500', bgLight: 'bg-sky-500/15', border: 'border-sky-400/30',
    shadow: 'shadow-sky-900/40', gradient: 'from-sky-500/20', glow: 'bg-sky-500/20'
  },
  blue: { 
    rootBg: 'bg-[#1e3a8a]', headerBg: 'bg-[#1e40af]/95', cardBg: 'bg-[#1d4ed8]/20', primary: 'blue-500', 
    accent: 'text-blue-400', bg: 'bg-blue-600', bgLight: 'bg-blue-500/15', border: 'border-blue-400/30',
    shadow: 'shadow-blue-900/40', gradient: 'from-blue-600/20', glow: 'bg-blue-500/20'
  }
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [weatherType, setWeatherType] = useState<string | null>(null);
  const [uiTheme, setUiTheme] = useState<UiTheme>('violet');
  const [showThemePicker, setShowThemePicker] = useState(false);
  
  const [showDbModal, setShowDbModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelCount, setLabelCount] = useState(18); // Default grid multiplier

  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  const [data, setData] = useState<CalibrationData>({
    manufacturer: '', model: '', serialNumber: '', nominalVolume: '', nominalVolumeUnit: 'ul',
    testDate: new Date().toISOString().split('T')[0], testNumber: '', calibrationFrequencyMonths: 12, nextCalibrationDate: '',
    temperature: '', pressure: '', humidity: '', zFactor: DEFAULT_Z_FACTOR, zFactorMethod: 'ISO_WATER',
    type: PipetteType.FIXED, toleranceSystematic: '', toleranceRandom: '',
    measurementsFixed: [...INITIAL_MEASUREMENTS_FIXED], measurementsVarMin: [...INITIAL_MEASUREMENTS_VAR], 
    measurementsVarMid: [...INITIAL_MEASUREMENTS_VAR], measurementsVarMax: [...INITIAL_MEASUREMENTS_VAR],
    notes: '', pdfOptions: { includeCharts: true, colorTheme: 'default', operatorName: '', approverName: '' },
    uiTheme: 'violet'
  });

  const activeTheme = THEME_CONFIG[uiTheme];

  useEffect(() => {
    (supabase.auth as any).getSession().then(({ data: { session } }: any) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (notification?.visible) {
      const timer = setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (data.temperature !== '' && data.pressure !== '') {
      // Open-Meteo returns pressure in hPa. Conversion to kPa happens inside calculateZFactor by factor 0.1
      const newZ = calculateZFactor(Number(data.temperature), Number(data.pressure) * 0.1);
      setData(prev => ({ ...prev, zFactor: newZ }));
    }
  }, [data.temperature, data.pressure]);

  const applyIsoTolerances = () => {
    const vol = parseFloat(data.nominalVolume);
    if (isNaN(vol)) {
      setNotification({ message: "Inserisci prima il volume nominale", type: 'error', visible: true });
      return;
    }
    const volUl = data.nominalVolumeUnit === 'ml' ? vol * 1000 : vol;
    const match = ISO_TOLERANCES_DATA.find(t => t.vol === volUl);
    
    if (match) {
      setData(prev => ({ ...prev, toleranceSystematic: match.sys, toleranceRandom: match.rand }));
      setNotification({ message: `Limiti ISO 8655 applicati per ${volUl} µl`, type: 'success', visible: true });
    } else {
      setNotification({ message: "Volume non standard ISO 8655-2. Inserisci i limiti manualmente.", type: 'error', visible: true });
    }
  };

  const fetchClients = async () => {
    setDbLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (!error) setClients(data || []);
    setDbLoading(false);
  };

  const fetchPipettes = async (clientId: string) => {
    setDbLoading(true);
    const { data, error } = await supabase.from('pipettes').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (!error) setStoredPipettes(data || []);
    setDbLoading(false);
  };

  const handleClientSelect = (id: string) => {
    setSelectedClientId(id);
    fetchPipettes(id);
  };

  const loadPipette = (pipette: StoredPipette) => {
    setData(pipette.full_data);
    if (pipette.full_data.uiTheme) setUiTheme(pipette.full_data.uiTheme);
    setShowDbModal(false);
    setNotification({ message: "Record caricato con successo", type: 'success', visible: true });
  };

  const deletePipette = async (id: string) => {
    const { error } = await supabase.from('pipettes').delete().eq('id', id);
    if (!error) {
      setStoredPipettes(prev => prev.filter(p => p.id !== id));
      setNotification({ message: "Record eliminato", type: 'success', visible: true });
    }
  };

  const handlePrintLabels = () => {
    generateLabelsSheetPDF(labelCount, data.testDate, data.calibrationFrequencyMonths, uiTheme);
    setShowLabelModal(false);
  };

  const handlePrintClientList = () => {
    if (!selectedClientId) return;
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      generateClientListPDF(client.name, storedPipettes, uiTheme);
    }
  };

  const handleSave = async () => {
    if (!selectedClientId) { 
      setNotification({ message: "Seleziona un cliente dall'archivio prima di salvare", type: 'error', visible: true });
      setShowDbModal(true); 
      return; 
    }
    setSaveLoading(true);
    const { error } = await supabase.from('pipettes').insert([{
      client_id: selectedClientId, user_id: session?.user.id, manufacturer: data.manufacturer,
      model: data.model, serial_number: data.serialNumber, nominal_volume: `${data.nominalVolume} ${data.nominalVolumeUnit}`,
      last_calibrated: data.testDate, full_data: { ...data, uiTheme }
    }]);
    setSaveLoading(false);
    if (!error) setNotification({ message: "Salvato nel cloud!", type: 'success', visible: true });
    else setNotification({ message: "Errore nel salvataggio", type: 'error', visible: true });
  };

  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      let lat: number, lon: number;
      if (locationSearch.trim()) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationSearch)}&count=1&language=it&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) throw new Error("Località non trovata");
        lat = geoData.results[0].latitude; lon = geoData.results[0].longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      }

      const today = new Date();
      today.setHours(0,0,0,0);
      const testDate = new Date(data.testDate);
      testDate.setHours(0,0,0,0);
      
      const diffTime = testDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      
      let temp: number, press: number;

      if (diffDays < 0) {
        // DATI STORICI (Archivio)
        const dateStr = testDate.toISOString().split('T')[0];
        const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,surface_pressure`);
        const weather = await res.json();
        if (!weather.hourly) throw new Error("Dati storici non disponibili per questa località/data");
        temp = weather.hourly.temperature_2m[12]; // Ore 12:00
        press = weather.hourly.surface_pressure[12];
        setWeatherType("Dato Storico (Archivio)");
      } else if (diffDays <= 7) {
        // PREVISIONE (Forecast)
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure&hourly=temperature_2m,surface_pressure`);
        const weather = await res.json();
        if (diffDays === 0) {
          temp = weather.current.temperature_2m;
          press = weather.current.surface_pressure;
          setWeatherType("Meteo Real-Time");
        } else {
          temp = weather.hourly.temperature_2m[diffDays * 24 + 12];
          press = weather.hourly.surface_pressure[diffDays * 24 + 12];
          setWeatherType("Meteo Previsionale");
        }
      } else {
        // STIMA STAGIONALE (Basata sull'anno scorso)
        const historicalDate = new Date(testDate.getFullYear() - 1, testDate.getMonth(), testDate.getDate());
        const dateStr = historicalDate.toISOString().split('T')[0];
        const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,surface_pressure`);
        const weather = await res.json();
        temp = weather.hourly.temperature_2m[12];
        press = weather.hourly.surface_pressure[12];
        setWeatherType("Stima Stagionale (Anno Prec.)");
      }
      
      setData(prev => ({ ...prev, temperature: temp, pressure: press }));
      setNotification({ message: `Dati ambientali recuperati con successo`, type: 'success', visible: true });
    } catch (err: any) {
      setNotification({ message: `Errore Meteo: ${err.message}`, type: 'error', visible: true });
    } finally { setWeatherLoading(false); }
  };

  const handlePreviewToggle = () => {
    if (!showPreview) setPreviewUrl(getPDFPreviewURL({ ...data, uiTheme }));
    else { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setShowPreview(!showPreview);
  };

  if (!isSupabaseConfigured) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
    <ShieldAlert size={64} className="text-amber-500 mb-6" />
    <h2 className="text-2xl font-bold mb-2">Configurazione Richiesta</h2>
    <p className="text-slate-400 max-w-md">Per favore imposta le variabili d'ambiente <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> nelle impostazioni di Vercel.</p>
  </div>;

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-violet-500" /></div>;
  if (!session) return <Auth />;

  return (
    <div className={`min-h-screen ${activeTheme.rootBg} text-slate-100 flex flex-col h-screen overflow-hidden transition-colors duration-700`}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[150px] ${activeTheme.glow} animate-pulse`}></div>
        <div className={`absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[150px] ${activeTheme.glow} opacity-60`}></div>
      </div>

      <header className={`p-4 ${activeTheme.headerBg} backdrop-blur-md border-b ${activeTheme.border} flex justify-between items-center shrink-0 z-20 shadow-2xl transition-all`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shadow-lg transition-all duration-500 ${activeTheme.bg} ${activeTheme.shadow}`}>
            <Beaker size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">PipetteCal</h1>
            <span className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-black">2S - Strumentazione</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowLabelModal(true)} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-amber-500/20 text-amber-400">
            <Tag size={14}/> Etichette
          </button>
          <div className="relative">
            <button onClick={() => setShowThemePicker(!showThemePicker)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 text-white">
              <Palette size={18} />
            </button>
            {showThemePicker && (
              <div className="absolute top-full right-0 mt-2 p-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 min-w-[150px] animate-in zoom-in-95">
                {(Object.keys(THEME_CONFIG) as UiTheme[]).map(t => (
                  <button key={t} onClick={() => { setUiTheme(t); setShowThemePicker(false); }} className={`flex items-center gap-3 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${uiTheme === t ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                    <div className={`w-3 h-3 rounded-full ${THEME_CONFIG[t].bg} ring-2 ring-white/20`}></div>
                    {t === 'violet' ? 'Original' : t === 'teal' ? 'Ocean' : t === 'sky' ? 'Sky' : 'Azure'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { fetchClients(); setShowDbModal(true); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-white/10"><Database size={14}/> Archivio</button>
          <button onClick={() => (supabase.auth as any).signOut()} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-4 md:p-8 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-white/5' : 'w-full'}`}>
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-32">
            
            <aside className="md:col-span-4 lg:col-span-4 space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className={`p-2 ${activeTheme.bgLight} rounded-lg ${activeTheme.accent}`}><Info size={16}/></div>
                <h2 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Anagrafica Strumento</h2>
              </div>
              
              <div className={`${activeTheme.cardBg} p-6 rounded-[32px] border ${activeTheme.border} space-y-5 shadow-xl backdrop-blur-md transition-all duration-500`}>
                <div className="bg-black/20 p-1 rounded-xl border border-white/10 grid grid-cols-2 gap-1">
                  <button onClick={() => setData({...data, type: PipetteType.FIXED})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.FIXED ? `${activeTheme.bg} text-white shadow-lg` : 'text-white/30'}`}>Fissa</button>
                  <button onClick={() => setData({...data, type: PipetteType.VARIABLE})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.VARIABLE ? `${activeTheme.bg} text-white shadow-lg` : 'text-white/30'}`}>Variabile</button>
                </div>
                
                <CustomDatePicker label="Data Taratura" value={data.testDate} onChange={(val) => setData({...data, testDate: val})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} theme={uiTheme} />
                  <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} theme={uiTheme} />
                </div>
                
                <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} theme={uiTheme} />

                <div className="pt-4 border-t border-white/10">
                   <div className="flex items-center gap-3 px-1 mb-4">
                    <div className={`p-2 ${activeTheme.bgLight} rounded-lg ${activeTheme.accent}`}><Ruler size={14}/></div>
                    <h2 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Specifiche Tecniche</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-end">
                    <InputGroup label="Vol. Nominale" value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" theme={uiTheme} />
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.1em] mb-2 ml-1">Unità</label>
                      <div className="bg-black/20 p-1 rounded-xl border border-white/10 grid grid-cols-2 gap-1 h-[46px]">
                        <button onClick={() => setData({...data, nominalVolumeUnit: 'ul'})} className={`py-1 rounded-lg text-[10px] font-black uppercase transition-all ${data.nominalVolumeUnit === 'ul' ? `${activeTheme.bg} text-white` : 'text-white/30'}`}>µl</button>
                        <button onClick={() => setData({...data, nominalVolumeUnit: 'ml'})} className={`py-1 rounded-lg text-[10px] font-black uppercase transition-all ${data.nominalVolumeUnit === 'ml' ? `${activeTheme.bg} text-white` : 'text-white/30'}`}>ml</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <InputGroup label="Tol. Sist. (µl)" value={data.toleranceSystematic} onChange={(e) => setData({...data, toleranceSystematic: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} step="0.01" />
                    <InputGroup label="Tol. Cas. (µl)" value={data.toleranceRandom} onChange={(e) => setData({...data, toleranceRandom: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} step="0.01" />
                  </div>

                  <button 
                    onClick={applyIsoTolerances}
                    className={`w-full mt-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2 ${activeTheme.accent}`}
                  >
                    <ShieldCheck size={14}/> Applica Limiti ISO 8655
                  </button>
                </div>
              </div>
            </aside>

            <div className="md:col-span-8 lg:col-span-8 space-y-8">
              <section className={`${activeTheme.cardBg} p-7 rounded-[32px] border ${activeTheme.border} space-y-6 shadow-xl backdrop-blur-md transition-all duration-500`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-2"><Wind size={14} className={activeTheme.accent}/> Parametri Ambientali</h2>
                    {weatherType && <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${activeTheme.bgLight} ${activeTheme.accent}`}>{weatherType}</span>}
                  </div>
                  <div className="flex items-center gap-2 bg-black/30 p-2 rounded-2xl border border-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                      <input type="text" placeholder="Località per meteo..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} className="bg-transparent text-xs text-white pl-9 pr-3 py-1.5 outline-none w-40 md:w-64" />
                    </div>
                    <button onClick={fetchWeather} disabled={weatherLoading} className={`px-4 py-1.5 ${activeTheme.bg} text-white hover:opacity-90 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all`}>
                      {weatherLoading ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} Rileva
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InputGroup label="Temperatura (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Pressione (hPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Fattore Z (Interpolato)" value={data.zFactor} readOnly theme={uiTheme} icon={<Gauge size={16}/>}/>
                </div>
              </section>

              <section className={`${activeTheme.cardBg} p-8 rounded-[40px] border ${activeTheme.border} shadow-2xl relative overflow-hidden backdrop-blur-md transition-all duration-500`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className={`p-3 ${activeTheme.bgLight} rounded-2xl ${activeTheme.accent}`}><Activity size={24} /></div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Rilevazioni Gravimetriche (mg)</h2>
                </div>
                <MeasurementSection {...data} onUpdate={(t, i, v) => {
                  const field = t === 'fixed' ? 'measurementsFixed' : t === 'min' ? 'measurementsVarMin' : t === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
                  const arr = [...(data[field] as any)]; arr[i] = v === '' ? '' : parseFloat(v);
                  setData({...data, [field]: arr});
                }} theme={uiTheme} />
              </section>
            </div>
          </div>
          
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 px-6">
            <div className="flex gap-4 bg-black/40 backdrop-blur-3xl p-3 rounded-[32px] border border-white/10 shadow-2xl max-w-2xl w-full">
              <button onClick={handlePreviewToggle} className="hidden md:flex flex-1 py-4 rounded-2xl font-black text-[10px] uppercase items-center justify-center gap-2 bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10">
                {showPreview ? <><EyeOff size={16}/> Chiudi</> : <><Eye size={16}/> Anteprima</>}
              </button>
              <button onClick={handleSave} disabled={saveLoading} className={`flex-1 ${activeTheme.bg} hover:opacity-90 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all shadow-lg ${activeTheme.shadow} text-white`}>
                {saveLoading ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Salva Cloud</>}
              </button>
              <button onClick={() => generatePDF({ ...data })} className={`flex-[1.2] bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/40 text-white`}>
                <Download size={16}/> Scarica PDF
              </button>
            </div>
          </div>
        </div>

        {showPreview && previewUrl && (
          <div className="hidden md:block w-1/2 bg-black/40 h-full relative p-4 animate-in slide-in-from-right-10">
             <iframe src={previewUrl} className="w-full h-full rounded-2xl border border-white/10 shadow-2xl" />
             <button onClick={handlePreviewToggle} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full shadow-2xl border border-white/10 transition-all">
                <X size={24} />
             </button>
          </div>
        )}
      </main>
      
      {showLabelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className={`w-full max-w-sm ${activeTheme.rootBg} border ${activeTheme.border} rounded-[40px] shadow-2xl p-8 space-y-6`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-3"><Tag className="text-amber-500"/> Stampa Etichette</h3>
                <button onClick={() => setShowLabelModal(false)} className="text-white/30 hover:text-white"><X size={24}/></button>
              </div>
              <p className="text-sm text-white/50">Quante etichette vuoi stampare? (Layout ultra-compatto 3x18 per A4)</p>
              <div className="grid grid-cols-4 gap-2">
                {[18, 36, 54, 108].map(n => (
                  <button key={n} onClick={() => setLabelCount(n)} className={`py-3 rounded-2xl font-black text-xs transition-all ${labelCount === n ? 'bg-amber-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{n}</button>
                ))}
              </div>
              <div className="pt-4">
                 <button onClick={handlePrintLabels} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2 transition-all">
                   <FileDown size={18}/> Scarica Foglio A4
                 </button>
              </div>
           </div>
        </div>
      )}

      {showDbModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`w-full max-w-4xl ${activeTheme.rootBg} border ${activeTheme.border} rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[80vh]`}>
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-3"><Database className={activeTheme.accent}/> Archivio Tarature</h3>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Account: {session.user.email}</p>
              </div>
              <button onClick={() => { setShowDbModal(false); setSelectedClientId(null); setStoredPipettes([]); }} className="p-3 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/3 border-r border-white/5 overflow-y-auto p-4 space-y-2 bg-black/20">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  <input type="text" placeholder="Filtra clienti..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-white/20" />
                </div>
                {dbLoading && clients.length === 0 ? <Loader2 className="animate-spin mx-auto mt-10 text-white/20" /> : 
                  clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(client => (
                  <button key={client.id} onClick={() => handleClientSelect(client.id)} className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group ${selectedClientId === client.id ? `${activeTheme.bg} text-white shadow-lg` : 'hover:bg-white/5 text-white/60'}`}>
                    <span className="text-sm font-bold truncate">{client.name}</span>
                    <ChevronRight size={16} className={selectedClientId === client.id ? 'text-white' : 'text-white/10 group-hover:text-white/40'} />
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {!selectedClientId ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <User size={48} />
                    <p className="text-sm font-bold uppercase tracking-widest">Seleziona un cliente</p>
                  </div>
                ) : dbLoading ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className={`animate-spin ${activeTheme.accent}`} size={32} /></div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                       <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Storico Strumenti ({storedPipettes.length})</h4>
                       {storedPipettes.length > 0 && (
                         <button onClick={handlePrintClientList} className={`flex items-center gap-2 px-4 py-2 ${activeTheme.bg} text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95`}>
                           <Printer size={14}/> Stampa Elenco
                         </button>
                       )}
                    </div>

                    {storedPipettes.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <History size={48} />
                        <p className="text-sm font-bold uppercase tracking-widest">Nessuna taratura trovata</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {storedPipettes.map(pipette => (
                          <div key={pipette.id} className="bg-white/5 border border-white/5 p-5 rounded-3xl hover:border-white/20 transition-all group flex items-center justify-between">
                            <div className="flex-1 cursor-pointer" onClick={() => loadPipette(pipette)}>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-xs font-black uppercase tracking-wider text-white">{pipette.manufacturer} {pipette.model}</span>
                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${activeTheme.bgLight} ${activeTheme.accent}`}>{pipette.nominal_volume}</span>
                              </div>
                              <div className="flex items-center gap-4 text-[10px] text-white/40 font-bold">
                                <span className="flex items-center gap-1"><Info size={10}/> S/N: {pipette.serial_number}</span>
                                <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(pipette.last_calibrated).toLocaleDateString('it-IT')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setData(pipette.full_data); setShowLabelModal(true); }} className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl transition-all" title="Stampa Etichette"><Tag size={14}/></button>
                              <button onClick={() => loadPipette(pipette)} className={`p-2 ${activeTheme.bg} text-white rounded-xl shadow-lg`} title="Carica"><Upload size={14}/></button>
                              <button onClick={() => deletePipette(pipette.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all" title="Elimina"><Trash size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-3xl border-2 z-[300] animate-in slide-in-from-bottom-10 flex items-center gap-3 shadow-2xl ${activeTheme.rootBg} ${notification.type === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
