
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar, Thermometer, Activity, User, Plus, Upload, FileSpreadsheet, Trash2, Search, Filter, CloudRain, MapPin, Settings2, ShieldCheck, Palette } from 'lucide-react';
import { CalibrationData, PipetteType, Client, StoredPipette, UiTheme } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { LiveChart } from './components/LiveChart';
import { generatePDF, getPDFPreviewURL } from './services/pdfGenerator';
import { CustomDatePicker } from './components/CustomDatePicker';

// Configurazione estesa dei temi per coprire l'intero applicativo
const THEME_CONFIG = {
  violet: { 
    rootBg: 'bg-[#0f172a]', 
    headerBg: 'bg-[#1e293b]/95',
    cardBg: 'bg-slate-800/40',
    primary: 'violet-600', 
    accent: 'text-violet-400', 
    bg: 'bg-violet-600', 
    bgLight: 'bg-violet-500/10', 
    border: 'border-violet-500/20',
    shadow: 'shadow-violet-900/40',
    gradient: 'from-violet-500/20',
    accentText: 'text-violet-300'
  },
  teal: { 
    rootBg: 'bg-[#042f2e]', // Verde Acqua Scuro
    headerBg: 'bg-[#134e4a]/95',
    cardBg: 'bg-[#115e59]/30',
    primary: 'teal-500', 
    accent: 'text-teal-400', 
    bg: 'bg-teal-600', 
    bgLight: 'bg-teal-500/15', 
    border: 'border-teal-500/30',
    shadow: 'shadow-teal-900/40',
    gradient: 'from-teal-600/20',
    accentText: 'text-teal-300'
  },
  sky: { 
    rootBg: 'bg-[#0c4a6e]', // Blu Cielo Scuro
    headerBg: 'bg-[#075985]/95',
    cardBg: 'bg-[#0369a1]/25',
    primary: 'sky-500', 
    accent: 'text-sky-400', 
    bg: 'bg-sky-500', 
    bgLight: 'bg-sky-500/15', 
    border: 'border-sky-400/30',
    shadow: 'shadow-sky-900/40',
    gradient: 'from-sky-500/20',
    accentText: 'text-sky-200'
  },
  blue: { 
    rootBg: 'bg-[#1e3a8a]', // Azzurro/Blu Profondo
    headerBg: 'bg-[#1e40af]/95',
    cardBg: 'bg-[#1d4ed8]/20',
    primary: 'blue-500', 
    accent: 'text-blue-400', 
    bg: 'bg-blue-600', 
    bgLight: 'bg-blue-500/15', 
    border: 'border-blue-400/30',
    shadow: 'shadow-blue-900/40',
    gradient: 'from-blue-600/20',
    accentText: 'text-blue-200'
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
  const [uiTheme, setUiTheme] = useState<UiTheme>('violet');
  const [showThemePicker, setShowThemePicker] = useState(false);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (data.temperature !== '' && data.pressure !== '') {
      const newZ = calculateZFactor(Number(data.temperature), Number(data.pressure) * 0.1);
      if (newZ !== data.zFactor) setData(prev => ({ ...prev, zFactor: newZ }));
    }
  }, [data.temperature, data.pressure]);

  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  const fetchClients = async () => { const { data } = await supabase.from('clients').select('*').order('name'); setClients(data || []); };
  const fetchPipettes = async (id: string) => { const { data } = await supabase.from('pipettes').select('*').eq('client_id', id).order('created_at', { ascending: false }); setStoredPipettes(data || []); };

  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      let lat: number, lon: number;
      if (locationSearch.trim()) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationSearch)}&count=1&language=it&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results) throw new Error("Località non trovata");
        lat = geoData.results[0].latitude; lon = geoData.results[0].longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      }
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure`);
      const weather = await res.json();
      setData(prev => ({ ...prev, temperature: weather.current.temperature_2m, pressure: weather.current.surface_pressure }));
      setNotification({ message: `Meteo aggiornato`, type: 'success', visible: true });
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error', visible: true });
    } finally { setWeatherLoading(false); }
  };

  const handleSave = async () => {
    if (!selectedClientId) { setShowDbModal(true); return; }
    setSaveLoading(true);
    const { error } = await supabase.from('pipettes').insert([{
      client_id: selectedClientId, user_id: session?.user.id, manufacturer: data.manufacturer,
      model: data.model, serial_number: data.serialNumber, nominal_volume: `${data.nominalVolume} ${data.nominalVolumeUnit}`,
      last_calibrated: data.testDate, full_data: { ...data, uiTheme }
    }]);
    setSaveLoading(false);
    if (!error) setNotification({ message: "Salvato nel cloud!", type: 'success', visible: true });
  };

  const handlePreviewToggle = () => {
    if (!showPreview) {
      const url = getPDFPreviewURL({ ...data, uiTheme });
      setPreviewUrl(url);
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setShowPreview(!showPreview);
  };

  if (!isSupabaseConfigured) return <div>Configura Supabase</div>;
  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-violet-500" /></div>;
  if (!session) return <Auth />;

  const nominalUl = (parseFloat(data.nominalVolume) || 0) * (data.nominalVolumeUnit === 'ml' ? 1000 : 1);

  return (
    <div className={`min-h-screen ${activeTheme.rootBg} text-slate-100 flex flex-col h-screen overflow-hidden transition-colors duration-700`}>
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[120px] ${activeTheme.bg}`}></div>
        <div className={`absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-[120px] ${activeTheme.bg}`}></div>
      </div>

      <header className={`p-4 ${activeTheme.headerBg} backdrop-blur-md border-b ${activeTheme.border} flex justify-between items-center shrink-0 z-20 shadow-2xl transition-all`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shadow-lg transition-all duration-500 ${activeTheme.bg} ${activeTheme.shadow}`}>
            <Beaker size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">PipetteCal</h1>
            <span className={`text-[10px] ${activeTheme.accentText} uppercase tracking-widest font-bold`}>Lab Automation Suite</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 text-white"
            >
              <Palette size={18} />
            </button>
            {showThemePicker && (
              <div className="absolute top-full right-0 mt-2 p-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 min-w-[140px] animate-in zoom-in-95">
                {(Object.keys(THEME_CONFIG) as UiTheme[]).map(t => (
                  <button 
                    key={t}
                    onClick={() => { setUiTheme(t); setShowThemePicker(false); }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all ${uiTheme === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-700/50'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${THEME_CONFIG[t].bg}`}></div>
                    {t === 'violet' ? 'Original' : t === 'teal' ? 'Ocean Teal' : t === 'sky' ? 'Sky Breeze' : 'Azure Deep'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { fetchClients(); setShowDbModal(true); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-white/10"><Database size={14}/> Archivio</button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/40 text-red-200 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-4 md:p-8 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-white/5' : 'w-full'}`}>
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-32">
            
            <aside className="md:col-span-4 lg:col-span-3 space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className={`p-2 ${activeTheme.bgLight} rounded-lg ${activeTheme.accent}`}><Info size={16}/></div>
                <h2 className={`text-sm font-bold ${activeTheme.accentText} uppercase tracking-wider`}>Anagrafica</h2>
              </div>
              <div className={`${activeTheme.cardBg} p-6 rounded-[32px] border ${activeTheme.border} space-y-6 shadow-xl bg-gradient-to-br ${activeTheme.gradient} to-transparent backdrop-blur-sm transition-all duration-500`}>
                <div className="bg-black/20 p-1 rounded-xl border border-white/10 grid grid-cols-2 gap-1">
                  <button onClick={() => setData({...data, type: PipetteType.FIXED})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.FIXED ? `${activeTheme.bg} text-white shadow-lg` : 'text-slate-400'}`}>Fissa</button>
                  <button onClick={() => setData({...data, type: PipetteType.VARIABLE})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.VARIABLE ? `${activeTheme.bg} text-white shadow-lg` : 'text-slate-400'}`}>Variabile</button>
                </div>
                <CustomDatePicker label="Data Taratura" value={data.testDate} onChange={(val) => setData({...data, testDate: val})} />
                <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} theme={uiTheme} />
                <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} theme={uiTheme} />
                <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} theme={uiTheme} />
              </div>
            </aside>

            <div className="md:col-span-8 lg:col-span-9 space-y-8">
              <section className={`${activeTheme.cardBg} p-6 rounded-[32px] border ${activeTheme.border} space-y-4 bg-gradient-to-r ${activeTheme.gradient} to-transparent backdrop-blur-sm transition-all duration-500`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3"><Thermometer size={18} className={activeTheme.accent}/> Parametri Ambientali</h2>
                  <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input type="text" placeholder="Località..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} className="bg-transparent text-xs text-white pl-9 pr-3 py-2 outline-none w-40 md:w-56" />
                    </div>
                    <button onClick={fetchWeather} disabled={weatherLoading} className={`px-4 py-2 ${activeTheme.bg} text-white hover:opacity-90 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all`}>
                      {weatherLoading ? <Loader2 className="animate-spin" size={12}/> : <MapPin size={12}/>} RILEVA
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Press (hPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Fattore Z" value={data.zFactor} readOnly theme={uiTheme} />
                </div>
              </section>

              <section className={`${activeTheme.cardBg} p-8 rounded-[40px] border ${activeTheme.border} shadow-2xl relative overflow-hidden backdrop-blur-md transition-all duration-500`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className={`p-3 ${activeTheme.bgLight} rounded-2xl ${activeTheme.accent}`}><Activity size={24} /></div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Rilevazioni Massa (mg)</h2>
                </div>
                <MeasurementSection {...data} onUpdate={(t, i, v) => {
                  const field = t === 'fixed' ? 'measurementsFixed' : t === 'min' ? 'measurementsVarMin' : t === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
                  const arr = [...(data[field] as any)]; arr[i] = v === '' ? '' : parseFloat(v);
                  setData({...data, [field]: arr});
                }} theme={uiTheme} />
                <div className="mt-12 border-t border-white/5 pt-8">
                   {data.type === PipetteType.FIXED ? (
                     <LiveChart data={data.measurementsFixed} target={nominalUl} label="Trend" zFactor={Number(data.zFactor) || 1} theme={uiTheme} />
                   ) : (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <LiveChart data={data.measurementsVarMin} target={nominalUl * 0.1} label="Trend 10%" zFactor={Number(data.zFactor) || 1} theme={uiTheme} />
                        <LiveChart data={data.measurementsVarMid} target={nominalUl * 0.5} label="Trend 50%" zFactor={Number(data.zFactor) || 1} theme={uiTheme} />
                        <LiveChart data={data.measurementsVarMax} target={nominalUl} label="Trend 100%" zFactor={Number(data.zFactor) || 1} theme={uiTheme} />
                     </div>
                   )}
                </div>
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
              <button onClick={() => generatePDF({ ...data, pdfOptions: { ...data.pdfOptions!, colorTheme: uiTheme as any } })} className={`flex-[1.2] bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/40 text-white`}>
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
      
      {notification?.visible && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-3xl border-2 z-[120] animate-in slide-in-from-bottom-10 flex items-center gap-3 shadow-2xl bg-slate-900 ${notification.type === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
