
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

// Mappaggio esplicito delle classi per evitare bug con il compilatore JIT di Tailwind
const THEME_CONFIG = {
  violet: { 
    primary: 'violet-600', 
    accent: 'text-violet-400', 
    bg: 'bg-violet-600', 
    bgLight: 'bg-violet-500/10', 
    border: 'border-violet-500/20',
    shadow: 'shadow-violet-900/40',
    gradient: 'from-violet-500/10'
  },
  teal: { 
    primary: 'teal-600', 
    accent: 'text-teal-400', 
    bg: 'bg-teal-600', 
    bgLight: 'bg-teal-500/10', 
    border: 'border-teal-500/20',
    shadow: 'shadow-teal-900/40',
    gradient: 'from-teal-500/10'
  },
  sky: { 
    primary: 'sky-600', 
    accent: 'text-sky-400', 
    bg: 'bg-sky-600', 
    bgLight: 'bg-sky-500/10', 
    border: 'border-sky-500/20',
    shadow: 'shadow-sky-900/40',
    gradient: 'from-sky-500/10'
  },
  blue: { 
    primary: 'blue-600', 
    accent: 'text-blue-400', 
    bg: 'bg-blue-600', 
    bgLight: 'bg-blue-500/10', 
    border: 'border-blue-500/20',
    shadow: 'shadow-blue-900/40',
    gradient: 'from-blue-500/10'
  }
};

const App: React.FC = () => {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-800 p-8 rounded-3xl border border-red-500/30 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert size={32} /></div>
          <h2 className="text-2xl font-bold text-white mb-4">Configurazione Cloud Mancante</h2>
          <p className="text-slate-400 mb-6 text-sm">Controlla le variabili d'ambiente (URL e KEY di Supabase).</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-700 text-white py-3 rounded-xl font-bold">Ricarica</button>
        </div>
      </div>
    );
  }

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
      if (newZ !== data.zFactor) {
        setData(prev => ({ ...prev, zFactor: newZ }));
      }
    }
  }, [data.temperature, data.pressure]);

  useEffect(() => {
    if (data.testDate && data.calibrationFrequencyMonths) {
      const d = new Date(data.testDate);
      d.setMonth(d.getMonth() + data.calibrationFrequencyMonths);
      const nextDate = d.toISOString().split('T')[0];
      if (data.nextCalibrationDate !== nextDate) setData(prev => ({ ...prev, nextCalibrationDate: nextDate }));
    }
  }, [data.testDate, data.calibrationFrequencyMonths]);

  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [pipetteSearchTerm, setPipetteSearchTerm] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  const fetchClients = async () => { const { data } = await supabase.from('clients').select('*').order('name'); setClients(data || []); };
  const fetchPipettes = async (id: string) => { const { data } = await supabase.from('pipettes').select('*').eq('client_id', id).order('created_at', { ascending: false }); setStoredPipettes(data || []); };

  const fetchWeather = async () => {
    setWeatherLoading(true);
    let lat: number, lon: number;
    try {
      if (locationSearch.trim()) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationSearch)}&count=1&language=it&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) throw new Error("Località non trovata");
        lat = geoData.results[0].latitude; lon = geoData.results[0].longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => { navigator.geolocation.getCurrentPosition(resolve, reject); });
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      }
      const today = new Date().toISOString().split('T')[0];
      const isHistorical = data.testDate < today;
      let temp: number, press: number;
      if (isHistorical) {
        const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${data.testDate}&end_date=${data.testDate}&hourly=temperature_2m,surface_pressure`);
        const weather = await res.json();
        temp = weather.hourly.temperature_2m[12] || weather.hourly.temperature_2m[0];
        press = weather.hourly.surface_pressure[12] || weather.hourly.surface_pressure[0];
      } else {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure`);
        const weather = await res.json();
        temp = weather.current.temperature_2m; press = weather.current.surface_pressure;
      }
      setData(prev => ({ ...prev, temperature: temp, pressure: press }));
      setNotification({ message: `Dati meteo aggiornati`, type: 'success', visible: true });
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error', visible: true });
    } finally { setWeatherLoading(false); }
  };

  const handleSave = async () => {
    if (!selectedClientId) { setShowDbModal(true); return; }
    setSaveLoading(true);
    const { error } = await supabase.from('pipettes').insert([{
      client_id: selectedClientId,
      user_id: session?.user.id,
      manufacturer: data.manufacturer,
      model: data.model,
      serial_number: data.serialNumber,
      nominal_volume: `${data.nominalVolume} ${data.nominalVolumeUnit}`,
      last_calibrated: data.testDate,
      full_data: { ...data, uiTheme }
    }]);
    setSaveLoading(false);
    if (!error) { fetchPipettes(selectedClientId); setNotification({ message: "Salvato nel cloud!", type: 'success', visible: true }); }
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

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-violet-500" /></div>;
  if (!session) return <Auth />;

  const nominalUl = (parseFloat(data.nominalVolume) || 0) * (data.nominalVolumeUnit === 'ml' ? 1000 : 1);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden">
      <header className="p-4 bg-slate-800/95 backdrop-blur-md border-b border-slate-700 flex justify-between items-center shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shadow-lg transition-colors duration-500 ${activeTheme.bg} ${activeTheme.shadow}`}>
            <Beaker size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">PipetteCal</h1>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Lab Automation Suite</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all border border-slate-600/50 text-slate-300"
            >
              <Palette size={18} />
            </button>
            {showThemePicker && (
              <div className="absolute top-full right-0 mt-2 p-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 min-w-[120px] animate-in zoom-in-95">
                {(Object.keys(THEME_CONFIG) as UiTheme[]).map(t => (
                  <button 
                    key={t}
                    onClick={() => { setUiTheme(t); setShowThemePicker(false); }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all ${uiTheme === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-700/50'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${THEME_CONFIG[t].bg}`}></div>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { fetchClients(); setShowDbModal(true); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-600/50"><Database size={14}/> Archivio</button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-400 hover:text-white rounded-xl transition-all border border-red-500/10"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-4 md:p-8 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-slate-700' : 'w-full'}`}>
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-32">
            
            <aside className="md:col-span-4 lg:col-span-3 space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className={`p-2 ${activeTheme.bgLight} rounded-lg ${activeTheme.accent}`}><Info size={16}/></div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Anagrafica</h2>
              </div>
              <div className={`bg-slate-800/20 p-6 rounded-[32px] border border-slate-700/30 space-y-6 shadow-xl bg-gradient-to-br ${activeTheme.gradient} to-transparent`}>
                <div className="bg-slate-900/40 p-1 rounded-xl border border-slate-700 grid grid-cols-2 gap-1">
                  <button onClick={() => setData({...data, type: PipetteType.FIXED})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.FIXED ? `${activeTheme.bg} text-white shadow-lg` : 'text-slate-500'}`}>Fissa</button>
                  <button onClick={() => setData({...data, type: PipetteType.VARIABLE})} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === PipetteType.VARIABLE ? `${activeTheme.bg} text-white shadow-lg` : 'text-slate-500'}`}>Variabile</button>
                </div>
                <CustomDatePicker label="Data Taratura" value={data.testDate} onChange={(val) => setData({...data, testDate: val})} />
                <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} theme={uiTheme} />
                <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} theme={uiTheme} />
                <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} theme={uiTheme} />
              </div>
            </aside>

            <div className="md:col-span-8 lg:col-span-9 space-y-8">
              <section className={`bg-slate-800/20 p-6 rounded-[32px] border border-slate-700/30 space-y-4 bg-gradient-to-r ${activeTheme.gradient} to-transparent`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-3"><Thermometer size={18} className={activeTheme.accent}/> Parametri Ambientali</h2>
                  <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input type="text" placeholder="Località (es. Roma)..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} className="bg-transparent text-xs text-white pl-9 pr-3 py-2 outline-none w-40 md:w-56" />
                    </div>
                    <button onClick={fetchWeather} disabled={weatherLoading} className={`px-4 py-2 ${activeTheme.bgLight} ${activeTheme.accent} hover:${activeTheme.bg} hover:text-white rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border ${activeTheme.border}`}>
                      {weatherLoading ? <Loader2 className="animate-spin" size={12}/> : <MapPin size={12}/>} RILEVA METEO
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Fixed onChange to handle number conversion and empty string */}
                  <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Press (hPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" theme={uiTheme} />
                  <InputGroup label="Fattore Z" value={data.zFactor} readOnly theme={uiTheme} />
                </div>
              </section>

              <section className="bg-slate-800/20 p-8 rounded-[40px] border border-slate-700/40 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className={`p-3 ${activeTheme.bgLight} rounded-2xl ${activeTheme.accent}`}><Activity size={24} /></div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Rilevazioni Massa (mg)</h2>
                </div>
                {/* Properly spreading data which now aligns with MeasurementSection Props renaming */}
                <MeasurementSection {...data} onUpdate={(t, i, v) => {
                  const field = t === 'fixed' ? 'measurementsFixed' : t === 'min' ? 'measurementsVarMin' : t === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
                  const arr = [...(data[field] as any)]; arr[i] = v === '' ? '' : parseFloat(v);
                  setData({...data, [field]: arr});
                }} theme={uiTheme} />
                <div className="mt-12 border-t border-slate-700/50 pt-8">
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
            <div className="flex gap-4 bg-slate-900/90 backdrop-blur-2xl p-3 rounded-[32px] border border-slate-700/50 shadow-2xl max-w-2xl w-full">
              <button onClick={handlePreviewToggle} className="hidden md:flex flex-1 py-4 rounded-2xl font-black text-[10px] uppercase items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700 transition-all border border-slate-700">
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
          <div className="hidden md:block w-1/2 bg-slate-900 h-full relative p-4 animate-in slide-in-from-right-10">
             <iframe src={previewUrl} className="w-full h-full rounded-2xl border border-slate-700 shadow-2xl" />
             <button onClick={handlePreviewToggle} className="absolute top-8 right-8 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-2xl border border-slate-700 transition-all">
                <X size={24} />
             </button>
          </div>
        )}
      </main>
      
      {/* ... Modals e notifiche rimangono invariate ... */}
    </div>
  );
};

export default App;