
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar } from 'lucide-react';
import { CalibrationData, PipetteType, Client, StoredPipette } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { generatePDF, getPDFPreviewURL } from './services/pdfGenerator';

const App: React.FC = () => {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-800 p-8 rounded-3xl border border-red-500/30 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert size={32} /></div>
          <h2 className="text-2xl font-bold text-white mb-4">Configurazione Mancante</h2>
          <p className="text-slate-400 mb-6 text-sm">Controlla le variabili d'ambiente su Vercel (URL e KEY di Supabase).</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-700 text-white py-3 rounded-xl font-bold">Ricarica</button>
        </div>
      </div>
    );
  }

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [data, setData] = useState<CalibrationData>({
    manufacturer: '', model: '', serialNumber: '', nominalVolume: '', nominalVolumeUnit: 'ul',
    testDate: new Date().toISOString().split('T')[0], testNumber: '', calibrationFrequencyMonths: 12, nextCalibrationDate: '',
    temperature: '', pressure: '', humidity: '', zFactor: DEFAULT_Z_FACTOR, zFactorMethod: 'ISO_WATER',
    type: PipetteType.FIXED, toleranceSystematic: '', toleranceRandom: '',
    measurementsFixed: [...INITIAL_MEASUREMENTS_FIXED], measurementsVarMin: [...INITIAL_MEASUREMENTS_VAR], 
    measurementsVarMid: [...INITIAL_MEASUREMENTS_VAR], measurementsVarMax: [...INITIAL_MEASUREMENTS_VAR],
    notes: '', pdfOptions: { includeCharts: true, colorTheme: 'default', operatorName: '', approverName: '' }
  });

  const [customPresets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pipette_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>("");
  const [showDbModal, setShowDbModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchClients(); }, [session]);
  useEffect(() => { if (session && selectedClientId) fetchPipettes(selectedClientId); }, [session, selectedClientId]);

  const getIsoLimits = (nominal: string, unit: 'ul' | 'ml'): { sys: number | ''; rand: number | '' } => {
    if (!nominal) return { sys: '', rand: '' };
    let vol = parseFloat(nominal);
    if (isNaN(vol)) return { sys: '', rand: '' };
    if (unit === 'ml') vol *= 1000;
    const match = ISO_TOLERANCES_DATA.find(iso => iso.vol === vol);
    return match ? { sys: match.sys, rand: match.rand } : { sys: '', rand: '' };
  };

  useEffect(() => {
    const limits = getIsoLimits(data.nominalVolume, data.nominalVolumeUnit);
    if (limits.sys !== '' || limits.rand !== '') {
      setData(prev => (prev.toleranceSystematic === limits.sys && prev.toleranceRandom === limits.rand) ? prev : { ...prev, toleranceSystematic: limits.sys, toleranceRandom: limits.rand });
    }
  }, [data.nominalVolume, data.nominalVolumeUnit]);

  useEffect(() => {
    const { temperature, pressure, zFactorMethod } = data;
    if (zFactorMethod === 'ISO_WATER' && typeof temperature === 'number' && typeof pressure === 'number') {
      setData(prev => ({ ...prev, zFactor: calculateZFactor(temperature, pressure) }));
    }
  }, [data.temperature, data.pressure, data.zFactorMethod]);

  const fetchClients = async () => { const { data } = await supabase.from('clients').select('*').order('name'); setClients(data || []); };
  const fetchPipettes = async (id: string) => { const { data } = await supabase.from('pipettes').select('*').eq('client_id', id).order('created_at', { ascending: false }); setStoredPipettes(data || []); };

  const handlePreviewToggle = () => {
    if (!showPreview) {
      const url = getPDFPreviewURL(data);
      setPreviewUrl(url);
      setShowPreview(true);
    } else {
      setShowPreview(false);
    }
  };

  const applyPreset = (p: any) => {
    const limits = getIsoLimits(p.nominalVolume, p.nominalVolumeUnit || 'ul');
    setData(prev => ({ 
      ...prev, ...p, 
      toleranceSystematic: (limits.sys || prev.toleranceSystematic) as number | '',
      toleranceRandom: (limits.rand || prev.toleranceRandom) as number | ''
    }));
    setNotification({ message: `Caricato: ${p.name}`, type: 'success', visible: true });
  };

  const validateData = () => {
    const errors = [];
    if (!data.serialNumber) errors.push("Matricola mancante");
    if (!data.nominalVolume) errors.push("Volume nominale mancante");
    if (errors.length > 0) { setNotification({ message: errors[0], type: 'error', visible: true }); return false; }
    return true;
  };

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Caricamento...</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden">
      <header className="p-4 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 flex justify-between items-center shrink-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2 rounded-xl shadow-inner"><Beaker size={20} className="text-white" /></div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">PipetteCal</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDbModal(true)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"><Database size={16}/> Cloud</button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-xl transition-all border border-red-500/10"><LogOut size={18}/></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* INPUT COLUMN */}
        <div className={`overflow-y-auto p-6 space-y-6 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-slate-700' : 'w-full max-w-5xl mx-auto'}`}>
          
          {/* SEZIONE PRESET & TIPO */}
          <div className="flex flex-col sm:flex-row gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Seleziona Preset</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none"
                value={selectedPresetName}
                onChange={(e) => {
                  const n = e.target.value; setSelectedPresetName(n);
                  const p = [...PIPETTE_PRESETS, ...customPresets].find(x => x.name === n);
                  if (p) applyPreset(p);
                }}
              >
                <option value="">-- Seleziona Pipetta --</option>
                <optgroup label="Standard">{PIPETTE_PRESETS.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}</optgroup>
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tipo Pipetta</label>
              <div className="grid grid-cols-2 bg-slate-900 rounded-xl p-1 border border-slate-700">
                <button onClick={() => setData({...data, type: PipetteType.FIXED})} className={`py-1.5 rounded-lg text-xs font-bold transition-all ${data.type === PipetteType.FIXED ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Fissa</button>
                <button onClick={() => setData({...data, type: PipetteType.VARIABLE})} className={`py-1.5 rounded-lg text-xs font-bold transition-all ${data.type === PipetteType.VARIABLE ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Variabile</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DATI BASE */}
            <section className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
              <h2 className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Identificazione</h2>
              <div className="grid grid-cols-1 gap-3">
                <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} />
                <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} />
                <InputGroup label="Matricola" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} />
                <div className="flex gap-2">
                  <InputGroup className="flex-1" label="Volume Nominale" value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" />
                  <div className="w-20">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Unità</label>
                    <select value={data.nominalVolumeUnit} onChange={(e) => setData({...data, nominalVolumeUnit: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-2 text-xs text-white outline-none">
                      <option value="ul">µl</option><option value="ml">ml</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* AMBIENTE & ISO */}
            <div className="space-y-6">
              <section className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
                <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Wind size={14}/> Ambiente & Z</h2>
                <div className="grid grid-cols-2 gap-3">
                  <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
                  <InputGroup label="Press (kPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
                </div>
                <InputGroup label="Fattore Z Calcolato" value={data.zFactor} onChange={() => {}} readOnly type="number" unit="Z" />
              </section>

              <section className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
                <h2 className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2"><Gauge size={14}/> Tolleranze ISO (µl)</h2>
                <div className="grid grid-cols-2 gap-3">
                  <InputGroup label="Sistematico (E)" value={data.toleranceSystematic} onChange={(e) => setData({...data, toleranceSystematic: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
                  <InputGroup label="Casuale (SD)" value={data.toleranceRandom} onChange={(e) => setData({...data, toleranceRandom: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
                </div>
              </section>
            </div>
          </div>

          {/* MISURE */}
          <section className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers size={14}/> Sessione di Misura (Pese in mg)</h2>
            <MeasurementSection 
              {...data}
              fixedData={data.measurementsFixed}
              varMinData={data.measurementsVarMin}
              varMidData={data.measurementsVarMid}
              varMaxData={data.measurementsVarMax}
              onUpdate={(t, i, v) => {
                const field = t === 'fixed' ? 'measurementsFixed' : t === 'min' ? 'measurementsVarMin' : t === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
                const arr = [...(data[field] as any)];
                arr[i] = v === '' ? '' : parseFloat(v);
                setData({...data, [field]: arr});
              }}
            />
          </section>

          {/* AZIONI FINALI */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 sticky bottom-0 bg-slate-900/80 backdrop-blur-md pb-4 z-10">
            <button 
              onClick={handlePreviewToggle} 
              className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${showPreview ? 'bg-slate-700 text-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
            >
              {showPreview ? <><EyeOff size={20}/> Chiudi Anteprima</> : <><Eye size={20}/> Anteprima Live</>}
            </button>
            <button 
              onClick={() => validateData() && generatePDF(data)} 
              className="flex-1 bg-violet-600 hover:bg-violet-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-900/20"
            >
              <Download size={20}/> Scarica Report PDF
            </button>
          </div>
        </div>

        {/* PREVIEW COLUMN */}
        {showPreview && (
          <div className="w-1/2 bg-slate-900 p-4 animate-in slide-in-from-right duration-500 ease-out">
            <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-2xl relative group">
               <iframe src={previewUrl || ''} className="w-full h-full" title="PDF Preview"></iframe>
               <button 
                 onClick={() => setShowPreview(false)} 
                 className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <X size={20}/>
               </button>
            </div>
          </div>
        )}
      </main>

      {/* NOTIFICHE */}
      {notification?.visible && (
        <div 
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl border-2 z-[100] animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 shadow-2xl ${notification.type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-red-500/50 text-red-400'}`}
          onClick={() => setNotification(null)}
        >
          {notification.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      {/* MODALE ARCHIVIO (Estesa) */}
      {showDbModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-800 w-full max-w-5xl h-[85vh] rounded-3xl border border-slate-700 flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold flex items-center gap-3 text-white"><Database size={24} className="text-indigo-400" /> Archivio Cloud Certificazioni</h2>
              <button onClick={() => setShowDbModal(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-hidden flex">
              <div className="w-1/3 border-r border-slate-700 flex flex-col bg-slate-900/20">
                <div className="p-4 bg-slate-800/40 border-b border-slate-700"><label className="text-[10px] font-bold text-slate-500 uppercase">Seleziona Cliente</label></div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {clients.map(c => (
                    <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-4 rounded-xl transition-all font-medium ${selectedClientId === c.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{c.name}</button>
                  ))}
                  {clients.length === 0 && <p className="text-center py-10 text-slate-600 text-sm italic">Nessun cliente trovato</p>}
                </div>
              </div>
              <div className="flex-1 flex flex-col bg-slate-900/40">
                <div className="p-4 bg-slate-800/40 border-b border-slate-700 flex justify-between items-center"><label className="text-[10px] font-bold text-slate-500 uppercase">Report Salvati</label></div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {selectedClientId ? (
                    storedPipettes.length > 0 ? (
                      storedPipettes.map(p => (
                        <div key={p.id} className="p-4 bg-slate-800 border border-slate-700 rounded-2xl flex justify-between items-center hover:border-slate-500 transition-all group">
                          <div className="flex gap-4 items-center">
                            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><FileText size={20}/></div>
                            <div>
                              <p className="font-bold text-slate-200">{p.manufacturer} {p.model}</p>
                              <div className="flex gap-3 text-[10px] text-slate-500 font-mono mt-1"><span>S/N: {p.serial_number}</span><span>•</span><span>{new Date(p.created_at).toLocaleDateString()}</span></div>
                            </div>
                          </div>
                          <button onClick={() => { setData(p.full_data); setShowDbModal(false); setShowPreview(false); setNotification({message: "Report caricato", type: 'success', visible: true}); }} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg">CARICA</button>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">Nessun report per questo cliente</div>
                    )
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                       <Layers size={48} className="mb-4 opacity-10" />
                       <p>Seleziona un cliente a sinistra per vedere i report</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
