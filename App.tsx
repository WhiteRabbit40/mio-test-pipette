
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Thermometer, Wind, Save, Settings, FileText, Droplet, Gauge, Calculator, RotateCcw, Info, Ruler, Library, Plus, CheckCircle2, AlertCircle, X, CalendarClock, Lock, Unlock, Database, User, Search, FolderOpen, ArrowRight, LogOut, UploadCloud, Upload, Trash2, AlertTriangle, Loader2, FileCog, CheckSquare, Square, Printer, Tags, List, Calendar, PlusCircle, Copy, Hash, FileSpreadsheet, Download, Maximize2, Minimize2, ArrowRightCircle, HardDrive, Image as ImageIcon, StickyNote, ShieldAlert } from 'lucide-react';
import { CalibrationData, PipetteType, ZFactorMethod, Client, StoredPipette, PdfOptions, PdfTheme } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { generatePDF, generateClientListPDF, generateLabelsPDF } from './services/pdfGenerator';

const App: React.FC = () => {
  // --- CONFIG CHECK ---
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-800 p-8 rounded-3xl border border-red-500/30 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Configurazione Mancante</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            Le chiavi di sicurezza di Supabase non sono state trovate. 
            Per proteggere i tuoi dati, l'app è stata oscurata.
          </p>
          <div className="bg-slate-900 p-4 rounded-xl text-left mb-6 font-mono text-xs text-violet-400 border border-slate-700">
            1. Vai su Vercel Dashboard<br />
            2. Settings &gt; Environment Variables<br />
            3. Aggiungi VITE_SUPABASE_URL<br />
            4. Aggiungi VITE_SUPABASE_ANON_KEY
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-colors font-bold"
          >
            Ho configurato, ricarica
          </button>
        </div>
      </div>
    );
  }

  // --- SESSION STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- APP STATE ---
  const [data, setData] = useState<CalibrationData>({
    manufacturer: '',
    model: '',
    serialNumber: '',
    nominalVolume: '',
    nominalVolumeUnit: 'ul',
    testDate: new Date().toISOString().split('T')[0],
    testNumber: '',
    calibrationFrequencyMonths: 12,
    nextCalibrationDate: '',
    temperature: '',
    pressure: '',
    humidity: '',
    zFactor: DEFAULT_Z_FACTOR,
    zFactorMethod: 'ISO_WATER',
    type: PipetteType.FIXED,
    toleranceSystematic: '',
    toleranceRandom: '',
    measurementsFixed: [...INITIAL_MEASUREMENTS_FIXED],
    measurementsVarMin: [...INITIAL_MEASUREMENTS_VAR], 
    measurementsVarMid: [...INITIAL_MEASUREMENTS_VAR],
    measurementsVarMax: [...INITIAL_MEASUREMENTS_VAR],
    notes: '',
    pdfOptions: {
      includeCharts: true,
      colorTheme: 'default',
      customPrimaryColor: '#000000',
      customSecondaryColor: '#666666',
      operatorName: '',
      approverName: '',
      customLogoBase64: '',
      chartYMin: '',
      chartYMax: ''
    }
  });

  const [customPresets, setCustomPresets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pipette_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [pipetteSearchTerm, setPipetteSearchTerm] = useState('');
  const [selectedPresetName, setSelectedPresetName] = useState<string>("");
  const [showDbModal, setShowDbModal] = useState(false);
  const [showPdfConfigModal, setShowPdfConfigModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    }).catch(err => {
      console.error("Auth Error:", err);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchClients(); }, [session]);
  useEffect(() => { if (session && selectedClientId) { fetchPipettes(selectedClientId); } }, [session, selectedClientId]);

  useEffect(() => {
    if (data.zFactorMethod === 'ISO_WATER') {
      if (typeof data.temperature === 'number' && typeof data.pressure === 'number') {
        const newZ = calculateZFactor(data.temperature, data.pressure);
        setData(prev => ({ ...prev, zFactor: newZ }));
      }
    }
  }, [data.temperature, data.pressure, data.zFactorMethod]);

  useEffect(() => {
    if (data.testDate && data.calibrationFrequencyMonths) {
      const date = new Date(data.testDate);
      date.setMonth(date.getMonth() + data.calibrationFrequencyMonths);
      if (date.getDate() !== new Date(data.testDate).getDate()) date.setDate(0);
      setData(prev => ({ ...prev, nextCalibrationDate: date.toISOString().split('T')[0] }));
    }
  }, [data.testDate, data.calibrationFrequencyMonths]);

  useEffect(() => {
    if (!data.nominalVolume) return;
    let vol = parseFloat(data.nominalVolume);
    if (isNaN(vol)) return;
    if (data.nominalVolumeUnit === 'ml') vol = vol * 1000;
    const match = ISO_TOLERANCES_DATA.find(iso => iso.vol === vol);
    if (match) setData(prev => ({ ...prev, toleranceSystematic: match.sys, toleranceRandom: match.rand }));
  }, [data.nominalVolume, data.nominalVolumeUnit]);

  useEffect(() => {
    if (notification?.visible) {
      const timer = setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error: any) { console.error('Error fetching clients:', error.message); }
  };

  const fetchPipettes = async (clientId: string) => {
    setIsLoadingDb(true);
    try {
      const { data, error } = await supabase.from('pipettes').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (error) throw error;
      setStoredPipettes(data || []);
    } catch (error: any) { showNotification("Errore caricamento pipette", "error"); } finally { setIsLoadingDb(false); }
  };

  const handleSaveToDb = async () => {
    if (!selectedClientId || !session) { showNotification("Seleziona cliente", "error"); return; }
    setIsSavingDb(true);
    try {
      const payload = { user_id: session.user.id, client_id: selectedClientId, manufacturer: data.manufacturer, model: data.model, serial_number: data.serialNumber, nominal_volume: data.nominalVolume, last_calibrated: data.testDate, full_data: data };
      const { data: inserted, error } = await supabase.from('pipettes').insert([payload]).select().single();
      if (error) throw error;
      showNotification("Salvato", "success");
      setStoredPipettes(prev => [inserted, ...prev]);
    } catch (error: any) { showNotification("Errore salvataggio", "error"); } finally { setIsSavingDb(false); }
  };

  const handleLoadFromDb = (p: StoredPipette) => { setData(p.full_data); showNotification("Dati caricati", "success"); setShowDbModal(false); };

  const showNotification = (msg: string, type: 'success' | 'error') => setNotification({ message: msg, type, visible: true });
  const updateMeasurement = (type: 'fixed' | 'min' | 'mid' | 'max', index: number, value: string) => {
    const num = value === '' ? '' : parseFloat(value);
    setData(prev => {
      const newData = { ...prev };
      const field = type === 'fixed' ? 'measurementsFixed' : type === 'min' ? 'measurementsVarMin' : type === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
      const arr = [...(prev[field] as any)];
      arr[index] = num;
      (newData as any)[field] = arr;
      return newData;
    });
  };

  const applyPreset = (p: any) => {
    setData(prev => ({ ...prev, ...p, name: undefined }));
    showNotification(`Dati "${p.name}" caricati`, "success");
  };

  const handleLocalSave = () => {
    if (!data.serialNumber) { showNotification("Inserisci Matricola", "error"); return; }
    const name = `${data.serialNumber} - ${new Date().toLocaleString()}`;
    const updated = [{ ...data, name }, ...customPresets];
    setCustomPresets(updated);
    localStorage.setItem('pipette_presets', JSON.stringify(updated));
    showNotification("Salvato in Locale", "success");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium animate-pulse">Inizializzazione PipetteCal...</p>
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans pb-24">
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl shadow-lg">
            <Beaker size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">PipetteCal</h1>
            <p className="text-slate-500 text-sm font-medium">Professional Calibration Tool</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setShowPdfConfigModal(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-slate-700"><Settings size={18} /> Opzioni PDF</button>
           <button onClick={() => setShowDbModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"><Database size={18} /> Archivio Cloud</button>
           <button onClick={() => supabase.auth.signOut()} className="bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 px-3 py-2.5 rounded-xl border border-slate-700"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-xl">
            <h2 className="text-violet-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Info size={16} /> Dati Pipetta</h2>
            <div className="mb-6">
               <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Preset / Salvataggi</label>
               <select className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white" value={selectedPresetName} onChange={(e) => {
                  const n = e.target.value; setSelectedPresetName(n);
                  const p = [...PIPETTE_PRESETS, ...customPresets].find(x => x.name === n);
                  if (p) applyPreset(p);
               }}>
                  <option value="">-- Seleziona --</option>
                  <optgroup label="Standard">{PIPETTE_PRESETS.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</optgroup>
                  {customPresets.length > 0 && <optgroup label="Locali">{customPresets.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</optgroup>}
               </select>
            </div>
            <div className="space-y-4">
              <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({ ...data, manufacturer: e.target.value })} />
              <InputGroup label="Modello" value={data.model} onChange={(e) => setData({ ...data, model: e.target.value })} />
              <InputGroup label="Matricola" value={data.serialNumber} onChange={(e) => setData({ ...data, serialNumber: e.target.value })} />
              <div className="flex gap-2">
                 <div className="flex-1"><InputGroup label="Volume Nominale" value={data.nominalVolume} onChange={(e) => setData({ ...data, nominalVolume: e.target.value })} /></div>
                 <div className="w-24">
                   <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Unità</label>
                   <select value={data.nominalVolumeUnit} onChange={(e) => setData({ ...data, nominalVolumeUnit: e.target.value as any })} className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 px-3 text-white">
                     <option value="ul">µl</option><option value="ml">ml</option>
                   </select>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-900/50 rounded-xl border border-slate-700">
                <button onClick={() => setData({ ...data, type: PipetteType.FIXED })} className={`py-2 rounded-lg text-sm font-medium ${data.type === PipetteType.FIXED ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>Fissa</button>
                <button onClick={() => setData({ ...data, type: PipetteType.VARIABLE })} className={`py-2 rounded-lg text-sm font-medium ${data.type === PipetteType.VARIABLE ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>Variabile</button>
              </div>
              <textarea value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} placeholder="Note..." className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm min-h-[80px]" />
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-xl">
             <h2 className="text-rose-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Gauge size={16} /> Tolleranze ISO (µl)</h2>
             <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Sistematico (E)" value={data.toleranceSystematic} onChange={(e) => setData({ ...data, toleranceSystematic: parseFloat(e.target.value) || '' })} type="number" />
              <InputGroup label="Casuale (SD)" value={data.toleranceRandom} onChange={(e) => setData({ ...data, toleranceRandom: parseFloat(e.target.value) || '' })} type="number" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-800/80 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-2xl relative">
            <div className="flex flex-wrap gap-3 mb-8 pb-6 border-b border-slate-700">
               <InputGroup className="w-40" label="Data Test" value={data.testDate} onChange={(e) => setData({ ...data, testDate: e.target.value })} type="date" />
               <div className="w-32"><InputGroup label="Freq (Mesi)" value={data.calibrationFrequencyMonths} onChange={(e) => setData({ ...data, calibrationFrequencyMonths: parseInt(e.target.value) || 12 })} type="number" /></div>
               <div className="flex-1 flex items-end justify-end gap-3">
                  <button onClick={handleLocalSave} className="p-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-slate-700 flex items-center gap-2 font-bold"><Save size={20} /><span className="hidden sm:inline">Salva Locale</span></button>
                  <button onClick={() => generatePDF(data)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold transition-all"><FileText size={20} /> Genera PDF</button>
               </div>
            </div>
            <div className="mb-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
               <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Wind size={16} /> Condizioni Ambientali</h3>
               <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                 <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({ ...data, temperature: parseFloat(e.target.value) || '' })} type="number" />
                 <InputGroup label="Pressione (kPa)" value={data.pressure} onChange={(e) => setData({ ...data, pressure: parseFloat(e.target.value) || '' })} type="number" />
                 <InputGroup label="Umidità (%)" value={data.humidity} onChange={(e) => setData({ ...data, humidity: parseFloat(e.target.value) || '' })} type="number" />
                 <InputGroup label="Fattore Z" value={data.zFactor} onChange={(e) => setData({ ...data, zFactor: parseFloat(e.target.value) || '' })} type="number" readOnly={data.zFactorMethod === 'ISO_WATER'} />
               </div>
            </div>
            <MeasurementSection type={data.type} fixedData={data.measurementsFixed} varMinData={data.measurementsVarMin} varMidData={data.measurementsVarMid} varMaxData={data.measurementsVarMax} onUpdate={updateMeasurement} zFactor={data.zFactor} toleranceSystematic={data.toleranceSystematic} toleranceRandom={data.toleranceRandom} nominalVolume={data.nominalVolume} nominalVolumeUnit={data.nominalVolumeUnit} />
          </div>
        </div>
      </main>

      {showDbModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <h2 className="text-xl font-bold flex items-center gap-2"><Database className="text-indigo-400" /> Archivio Cloud</h2>
                <button onClick={() => setShowDbModal(false)} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
             </div>
             <div className="flex-1 overflow-hidden flex">
                <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-800/20">
                   <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase">Clienti</span><button onClick={() => setNewClientName('Nuovo Cliente')} className="p-1 bg-indigo-600 rounded text-white"><Plus size={16}/></button></div>
                   <div className="flex-1 overflow-y-auto p-2">
                      {clients.map(c => (
                        <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-3 rounded-xl mb-1 transition-all ${selectedClientId === c.id ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'text-slate-400 hover:bg-slate-800'}`}>{c.name}</button>
                      ))}
                   </div>
                </div>
                <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-900">
                   {selectedClientId ? (
                     <div className="space-y-3">
                        <button onClick={handleSaveToDb} className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 py-3 rounded-xl border border-emerald-600/30 mb-4 font-bold flex items-center justify-center gap-2 transition-all"><Save size={18}/> Salva Report in Cloud</button>
                        {storedPipettes.map(p => (
                          <div key={p.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center hover:border-slate-500 transition-all">
                            <div><div className="font-bold text-slate-200">{p.manufacturer} {p.model}</div><div className="text-xs text-slate-500 font-mono">S/N: {p.serial_number} • {new Date(p.created_at).toLocaleDateString()}</div></div>
                            <button onClick={() => handleLoadFromDb(p)} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white font-bold text-xs shadow-md">CARICA</button>
                          </div>
                        ))}
                        {storedPipettes.length === 0 && <div className="text-center py-20 text-slate-600 italic">Nessun report salvato per questo cliente</div>}
                     </div>
                   ) : <div className="text-center py-40 text-slate-600 flex flex-col items-center gap-4"><FolderOpen size={48} className="opacity-20"/><p>Seleziona un cliente dalla lista a sinistra</p></div>}
                </div>
             </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 z-50 border ${notification.type === 'success' ? 'bg-slate-900 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-red-400 border-red-500/30'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <p className="font-medium">{notification.message}</p>
        </div>
      )}
    </div>
  );
};

export default App;
