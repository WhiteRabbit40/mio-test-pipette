
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, Download } from 'lucide-react';
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

  // Fix: Line 75 - Narrow temperature and pressure types to number before calling calculateZFactor
  useEffect(() => {
    const { temperature, pressure, zFactorMethod } = data;
    if (zFactorMethod === 'ISO_WATER' && typeof temperature === 'number' && typeof pressure === 'number') {
      setData(prev => ({ ...prev, zFactor: calculateZFactor(temperature, pressure) }));
    }
  }, [data.temperature, data.pressure, data.zFactorMethod, data.zFactorMethod]);

  const fetchClients = async () => { const { data } = await supabase.from('clients').select('*').order('name'); setClients(data || []); };
  const fetchPipettes = async (id: string) => { const { data } = await supabase.from('pipettes').select('*').eq('client_id', id).order('created_at', { ascending: false }); setStoredPipettes(data || []); };

  const handlePreview = () => {
    const url = getPDFPreviewURL(data);
    setPreviewUrl(url);
  };

  const validateData = () => {
    const errors = [];
    if (!data.serialNumber) errors.push("Matricola mancante");
    if (!data.nominalVolume) errors.push("Volume nominale non impostato");
    if (data.temperature === '') errors.push("Temperatura mancante");
    if (errors.length > 0) { setNotification({ message: errors[0], type: 'error', visible: true }); return false; }
    return true;
  };

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Caricamento...</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden">
      {/* HEADER COMPATTO */}
      <header className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Beaker className="text-violet-500" />
          <h1 className="text-xl font-bold">PipetteCal</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDbModal(true)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"><Database size={16}/> Archivio</button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg"><LogOut size={16}/></button>
        </div>
      </header>

      {/* MAIN LAYOUT SPLIT SCREEN */}
      <main className="flex-1 flex overflow-hidden">
        {/* LATO SINISTRO: INPUT */}
        <div className="w-full md:w-1/2 overflow-y-auto p-4 space-y-4 border-r border-slate-700">
          <section className="bg-slate-800/40 p-4 rounded-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Dati Base</h2>
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} />
              <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} />
              <InputGroup label="Matricola" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} />
              <InputGroup label="Volume Nom." value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
              <InputGroup label="Press (kPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" />
            </div>
          </section>

          <section className="bg-slate-800/40 p-4 rounded-xl">
            {/* Fix: Line 132 - Explicitly pass measurement arrays to match MeasurementSection props names */}
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

          <div className="flex gap-3 pt-4">
            <button onClick={handlePreview} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Eye size={18}/> Anteprima Live</button>
            <button onClick={() => validateData() && generatePDF(data)} className="flex-1 bg-violet-600 hover:bg-violet-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download size={18}/> Scarica PDF</button>
          </div>
        </div>

        {/* LATO DESTRO: ANTEPRIMA PDF */}
        <div className="hidden md:block w-1/2 bg-slate-900 p-4">
          {previewUrl ? (
            <div className="w-full h-full rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
               <iframe src={previewUrl} className="w-full h-full" title="PDF Preview"></iframe>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
              <FileText size={64} className="mb-4 opacity-20" />
              <p>Clicca "Anteprima Live" per visualizzare il certificato qui.</p>
            </div>
          )}
        </div>
      </main>

      {/* MODALE ARCHIVIO */}
      {showDbModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-800 w-full max-w-4xl h-[80vh] rounded-2xl border border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><Database size={18} /> Archivio Clienti</h2>
              <button onClick={() => setShowDbModal(false)}><X/></button>
            </div>
            <div className="flex-1 overflow-hidden flex">
              <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-2">
                {clients.map(c => (
                  <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-3 rounded-lg mb-1 ${selectedClientId === c.id ? 'bg-violet-600' : 'hover:bg-slate-700'}`}>{c.name}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {storedPipettes.map(p => (
                  <div key={p.id} className="p-3 bg-slate-900/50 rounded-xl flex justify-between items-center">
                    <div><p className="font-bold text-sm">{p.serial_number}</p><p className="text-[10px] text-slate-500">{p.model}</p></div>
                    <button onClick={() => { setData(p.full_data); setShowDbModal(false); }} className="text-xs bg-violet-600 px-3 py-1 rounded">CARICA</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl border z-[100] animate-bounce ${notification.type === 'success' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' : 'bg-red-900/50 border-red-500 text-red-400'}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default App;
