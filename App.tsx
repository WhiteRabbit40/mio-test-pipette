
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar, Thermometer, Activity } from 'lucide-react';
import { CalibrationData, PipetteType, Client, StoredPipette } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { LiveChart } from './components/LiveChart';
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

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Caricamento...</div>;
  if (!session) return <Auth />;

  const nominalUl = (parseFloat(data.nominalVolume) || 0) * (data.nominalVolumeUnit === 'ml' ? 1000 : 1);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden">
      <header className="p-4 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 flex justify-between items-center shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-900/40"><Beaker size={20} className="text-white" /></div>
          <div>
            <h1 className="text-lg font-bold leading-none">PipetteCal</h1>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Calibration Suite</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDbModal(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-600/50"><Database size={14}/> Cloud</button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-400 hover:text-white rounded-xl transition-all border border-red-500/10"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-6 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-slate-700' : 'w-full max-w-6xl mx-auto'}`}>
          
          <div className="space-y-8 pb-10">
            {/* SEZIONE PRESET RAPIDO */}
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Caricamento Rapido Preset</label>
                <select 
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition-all"
                  value={selectedPresetName}
                  onChange={(e) => {
                    const n = e.target.value; setSelectedPresetName(n);
                    const p = PIPETTE_PRESETS.find(x => x.name === n);
                    if (p) applyPreset(p);
                  }}
                >
                  <option value="">-- Seleziona una configurazione --</option>
                  {PIPETTE_PRESETS.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700 w-full md:w-auto">
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setData({...data, type: PipetteType.FIXED})} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${data.type === PipetteType.FIXED ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Volume Fisso</button>
                  <button onClick={() => setData({...data, type: PipetteType.VARIABLE})} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${data.type === PipetteType.VARIABLE ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Variabile</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* DATI IDENTIFICATIVI */}
              <section className="space-y-5">
                <div className="flex items-center gap-3 px-1">
                   <div className="p-2 bg-violet-500/10 rounded-lg"><Info size={16} className="text-violet-400"/></div>
                   <h2 className="text-sm font-bold text-white uppercase tracking-wider">Identificazione</h2>
                </div>
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4">
                  <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} placeholder="Es. Gilson, Eppendorf..." />
                  <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} placeholder="Es. Pipetman P1000" />
                  <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} placeholder="Obbligatorio per il certificato" />
                  <div className="flex gap-4">
                    <InputGroup className="flex-1" label="Volume Nominale" value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" />
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block ml-1">Unità</label>
                      <select value={data.nominalVolumeUnit} onChange={(e) => setData({...data, nominalVolumeUnit: e.target.value as any})} className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 px-3 text-xs text-white outline-none focus:border-violet-500 transition-colors">
                        <option value="ul">µl</option><option value="ml">ml</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* AMBIENTE & TOLLERANZE */}
              <section className="space-y-8">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 px-1">
                     <div className="p-2 bg-emerald-500/10 rounded-lg"><Thermometer size={16} className="text-emerald-400"/></div>
                     <h2 className="text-sm font-bold text-white uppercase tracking-wider">Ambiente & Calcolo Z</h2>
                  </div>
                  <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Temperatura (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                      <InputGroup label="Pressione (kPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                    </div>
                    <InputGroup label="Fattore Z (ISO 8655)" value={data.zFactor} onChange={() => {}} readOnly type="number" unit="Z" className="opacity-80" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center gap-3 px-1">
                     <div className="p-2 bg-rose-500/10 rounded-lg"><Gauge size={16} className="text-rose-400"/></div>
                     <h2 className="text-sm font-bold text-white uppercase tracking-wider">Limiti di Tolleranza ISO (µl)</h2>
                  </div>
                  <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 grid grid-cols-2 gap-4">
                    <InputGroup label="Errore Sist. (E)" value={data.toleranceSystematic} onChange={(e) => setData({...data, toleranceSystematic: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.01" />
                    <InputGroup label="Errore Cas. (SD)" value={data.toleranceRandom} onChange={(e) => setData({...data, toleranceRandom: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.01" />
                  </div>
                </div>
              </section>
            </div>

            {/* SESSIONE DI MISURA & GRAFICI LIVE */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 px-1">
                 <div className="p-2 bg-indigo-500/10 rounded-lg"><Activity size={16} className="text-indigo-400"/></div>
                 <h2 className="text-sm font-bold text-white uppercase tracking-wider">Sessione di Misura</h2>
              </div>
              <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30">
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
                
                {/* GRAFICI LIVE INTERATTIVI */}
                <div className="mt-8 space-y-4">
                   {data.type === PipetteType.FIXED ? (
                     <LiveChart data={data.measurementsFixed} target={nominalUl} label="Volume Fisso" zFactor={Number(data.zFactor) || 1} />
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <LiveChart data={data.measurementsVarMin} target={nominalUl * 0.1} label="10% Vol" zFactor={Number(data.zFactor) || 1} />
                        <LiveChart data={data.measurementsVarMid} target={nominalUl * 0.5} label="50% Vol" zFactor={Number(data.zFactor) || 1} />
                        <LiveChart data={data.measurementsVarMax} target={nominalUl} label="100% Vol" zFactor={Number(data.zFactor) || 1} />
                     </div>
                   )}
                </div>
              </div>
            </section>
          </div>

          {/* AZIONI FISSE IN FONDO */}
          <div className="sticky bottom-4 left-0 right-0 flex gap-4 bg-slate-900/90 backdrop-blur-xl p-4 rounded-3xl border border-slate-700 shadow-2xl z-20">
            <button 
              onClick={handlePreviewToggle} 
              className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${showPreview ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
            >
              {showPreview ? <><EyeOff size={20}/> Chiudi Anteprima</> : <><Eye size={20}/> Anteprima Report</>}
            </button>
            <button 
              onClick={() => generatePDF(data)} 
              className="flex-[1.5] bg-violet-600 hover:bg-violet-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-violet-900/30 hover:-translate-y-0.5"
            >
              <Download size={22}/> Genera & Scarica Certificato
            </button>
          </div>
        </div>

        {/* COLONNA PREVIEW PDF */}
        {showPreview && (
          <div className="w-1/2 bg-slate-950 p-6 animate-in slide-in-from-right duration-500">
            <div className="w-full h-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner relative group">
               <iframe src={previewUrl || ''} className="w-full h-full" title="PDF Preview"></iframe>
               <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setShowPreview(false)} className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg transition-colors"><X size={20}/></button>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALE ARCHIVIO */}
      {showDbModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-[40px] border border-slate-800 flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-3"><Database size={24} className="text-violet-500" /> Database Certificazioni</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">Cronologia tarature salvate in cloud</p>
              </div>
              <button onClick={() => setShowDbModal(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors"><X size={24}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/3 border-r border-slate-800 p-4 space-y-2 overflow-y-auto">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 block mb-2">Seleziona Cliente</label>
                {clients.map(c => (
                  <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-4 rounded-2xl transition-all font-bold text-sm ${selectedClientId === c.id ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>{c.name}</button>
                ))}
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-slate-950/30">
                {selectedClientId ? (
                  storedPipettes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {storedPipettes.map(p => (
                        <div key={p.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex justify-between items-center hover:border-violet-500/50 transition-all">
                          <div className="flex gap-5 items-center">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-violet-400 border border-slate-700"><FileText size={24}/></div>
                            <div>
                              <p className="font-bold text-white text-base">{p.manufacturer} {p.model}</p>
                              <div className="flex gap-3 text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter"><span>S/N: {p.serial_number}</span><span>•</span><span>{new Date(p.created_at).toLocaleDateString()}</span></div>
                            </div>
                          </div>
                          <button onClick={() => { setData(p.full_data); setShowDbModal(false); setShowPreview(false); setNotification({message: "Configurazione caricata con successo", type: 'success', visible: true}); }} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-xs shadow-lg transition-all">APPLIQUA</button>
                        </div>
                      ))}
                    </div>
                  ) : <div className="h-full flex flex-col items-center justify-center text-slate-600 font-medium">Nessun certificato trovato per questo cliente</div>
                ) : <div className="h-full flex flex-col items-center justify-center text-slate-600">Scegli un cliente dalla lista a sinistra</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div 
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-3xl border-2 z-[110] animate-in slide-in-from-bottom-10 flex items-center gap-3 shadow-2xl ${notification.type === 'success' ? 'bg-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-red-500 text-red-400'}`}
          onClick={() => setNotification(null)}
        >
          {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          <span className="font-bold text-sm tracking-tight">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
