
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar, Thermometer, Activity, User, Plus, Search } from 'lucide-react';
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
  const [newClientName, setNewClientName] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchClients(); }, [session]);
  useEffect(() => { if (session && selectedClientId) fetchPipettes(selectedClientId); }, [session, selectedClientId]);

  // Calcolo data scadenza automatica
  useEffect(() => {
    if (data.testDate && data.calibrationFrequencyMonths) {
      const d = new Date(data.testDate);
      d.setMonth(d.getMonth() + data.calibrationFrequencyMonths);
      const nextDate = d.toISOString().split('T')[0];
      if (data.nextCalibrationDate !== nextDate) setData(prev => ({ ...prev, nextCalibrationDate: nextDate }));
    }
  }, [data.testDate, data.calibrationFrequencyMonths]);

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

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const { data: c, error } = await supabase.from('clients').insert([{ name: newClientName.trim() }]).select().single();
    if (error) { setNotification({ message: error.message, type: 'error', visible: true }); } 
    else { fetchClients(); setSelectedClientId(c.id); setNewClientName(""); setNotification({ message: "Cliente creato", type: 'success', visible: true }); }
  };

  const handleSave = async () => {
    if (!selectedClientId) { setShowDbModal(true); setNotification({ message: "Seleziona prima un cliente dal database", type: 'error', visible: true }); return; }
    if (!data.serialNumber) { setNotification({ message: "Matricola obbligatoria per salvare", type: 'error', visible: true }); return; }
    
    setSaveLoading(true);
    const { error } = await supabase.from('pipettes').insert([{
      client_id: selectedClientId,
      manufacturer: data.manufacturer,
      model: data.model,
      serial_number: data.serialNumber,
      nominal_volume: `${data.nominalVolume} ${data.nominalVolumeUnit}`,
      last_calibrated: data.testDate,
      full_data: data
    }]);

    setSaveLoading(false);
    if (error) setNotification({ message: "Errore salvataggio: " + error.message, type: 'error', visible: true });
    else setNotification({ message: "Report salvato con successo!", type: 'success', visible: true });
  };

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
      <header className="p-4 bg-slate-800/95 backdrop-blur-md border-b border-slate-700 flex justify-between items-center shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-900/40"><Beaker size={20} className="text-white" /></div>
          <div>
            <h1 className="text-lg font-bold leading-none">PipetteCal</h1>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Lab Automation System</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {selectedClientId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-900/30 border border-indigo-500/30 rounded-full">
              <User size={12} className="text-indigo-400" />
              <span className="text-xs font-bold text-indigo-300">{clients.find(c => c.id === selectedClientId)?.name}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowDbModal(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-600/50"><Database size={14}/> Cloud</button>
            <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-400 hover:text-white rounded-xl transition-all border border-red-500/10"><LogOut size={16}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-6 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-slate-700' : 'w-full max-w-6xl mx-auto'}`}>
          
          <div className="space-y-8 pb-12">
            {/* PRESET & TIPO */}
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-end shadow-inner">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Richiamo Rapido Configurazione</label>
                <select 
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition-all"
                  value={selectedPresetName}
                  onChange={(e) => {
                    const n = e.target.value; setSelectedPresetName(n);
                    const p = PIPETTE_PRESETS.find(x => x.name === n);
                    if (p) applyPreset(p);
                  }}
                >
                  <option value="">-- Seleziona una pipetta standard --</option>
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
              {/* IDENTIFICAZIONE */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400"><Info size={16}/></div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Anagrafica Strumento</h2>
                  </div>
                </div>
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4 shadow-sm">
                  <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} placeholder="Es. Gilson" />
                  <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} placeholder="Es. Pipetman P200" />
                  <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} placeholder="Matricola univoca strumento" />
                  <div className="flex gap-4">
                    <InputGroup className="flex-1" label="Volume Nominale" value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" />
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block ml-1">Unità</label>
                      <select value={data.nominalVolumeUnit} onChange={(e) => setData({...data, nominalVolumeUnit: e.target.value as any})} className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 px-3 text-xs text-white outline-none focus:border-violet-500">
                        <option value="ul">µl</option><option value="ml">ml</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* AMBIENTE & DATE */}
              <section className="space-y-6">
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Thermometer size={16} className="text-emerald-400"/>
                    <h2 className="text-xs font-bold text-slate-300 uppercase">Condizioni Ambientali</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                    <InputGroup label="Press (kPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                  </div>
                  <InputGroup label="Fattore Z Correzione" value={data.zFactor} onChange={() => {}} readOnly type="number" unit="Z" className="opacity-80" />
                </div>

                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar size={16} className="text-indigo-400"/>
                    <h2 className="text-xs font-bold text-slate-300 uppercase">Validità Certificato</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Data Test" value={data.testDate} onChange={(e) => setData({...data, testDate: e.target.value})} type="date" />
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 ml-1">Frequenza</label>
                      <select 
                        value={data.calibrationFrequencyMonths} 
                        onChange={(e) => setData({...data, calibrationFrequencyMonths: parseInt(e.target.value)})} 
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 px-3 text-xs text-white"
                      >
                        <option value={3}>3 Mesi</option>
                        <option value={6}>6 Mesi</option>
                        <option value={12}>12 Mesi</option>
                        <option value={24}>24 Mesi</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* MISURE */}
            <section className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Activity size={18} className="text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Sessione di Pesata (mg)</h2>
              </div>
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
              
              <div className="mt-8">
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
            </section>

            {/* OPERATORE E NOTE */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4 shadow-sm">
                <h2 className="text-xs font-bold text-slate-300 uppercase mb-2">Responsabilità</h2>
                <InputGroup label="Operatore / Tecnico" value={data.pdfOptions?.operatorName || ''} onChange={(e) => setData({...data, pdfOptions: {...data.pdfOptions!, operatorName: e.target.value}})} placeholder="Nome del tecnico" />
                <InputGroup label="Approvatore (QA)" value={data.pdfOptions?.approverName || ''} onChange={(e) => setData({...data, pdfOptions: {...data.pdfOptions!, approverName: e.target.value}})} placeholder="Firma autorizzata" />
              </div>
              <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 flex flex-col shadow-sm">
                <label className="text-xs font-semibold text-slate-400 uppercase mb-2 ml-1">Note Tecniche</label>
                <textarea 
                  value={data.notes} 
                  onChange={(e) => setData({...data, notes: e.target.value})} 
                  placeholder="Inserisci osservazioni, stato dello strumento (es. dopo pulizia o sostituzione pistone)..."
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-2xl p-4 text-sm text-white focus:border-violet-500 outline-none min-h-[120px]"
                />
              </div>
            </section>
          </div>

          {/* AZIONI FISSE */}
          <div className="sticky bottom-4 left-0 right-0 flex gap-4 bg-slate-900/95 backdrop-blur-xl p-4 rounded-3xl border border-slate-700 shadow-2xl z-20">
            <button onClick={handlePreviewToggle} className={`hidden md:flex flex-1 py-4 rounded-2xl font-bold items-center justify-center gap-2 transition-all ${showPreview ? 'bg-slate-800 text-slate-400' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
              {showPreview ? <><EyeOff size={18}/> Chiudi Anteprima</> : <><Eye size={18}/> Anteprima</>}
            </button>
            <button onClick={handleSave} disabled={saveLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50">
              {saveLoading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Salva su Cloud</>}
            </button>
            <button onClick={() => generatePDF(data)} className="flex-[1.2] bg-violet-600 hover:bg-violet-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-violet-900/30">
              <Download size={20}/> Scarica Report PDF
            </button>
          </div>
        </div>

        {/* ANTEPRIMA */}
        {showPreview && (
          <div className="w-1/2 bg-slate-950 p-6 animate-in slide-in-from-right duration-500">
            <div className="w-full h-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 relative">
               <iframe src={previewUrl || ''} className="w-full h-full" title="PDF Preview"></iframe>
               <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg"><X size={20}/></button>
            </div>
          </div>
        )}
      </main>

      {/* MODALE DATABASE */}
      {showDbModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-[40px] border border-slate-800 flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
              <h2 className="text-xl font-bold flex items-center gap-3"><Database size={24} className="text-violet-500" /> Archivio Cloud</h2>
              <button onClick={() => setShowDbModal(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* SIDEBAR CLIENTI */}
              <div className="w-1/3 border-r border-slate-800 flex flex-col">
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Plus className="absolute left-3 top-3 text-emerald-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Nome nuovo cliente..." 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                    />
                  </div>
                  <button onClick={handleCreateClient} className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-600/30">Crea Cliente</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 block mb-2">Lista Clienti</label>
                  {clients.map(c => (
                    <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-4 rounded-2xl transition-all font-bold text-sm ${selectedClientId === c.id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>{c.name}</button>
                  ))}
                </div>
              </div>

              {/* LISTA REPORT */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-950/30">
                {selectedClientId ? (
                  storedPipettes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {storedPipettes.map(p => (
                        <div key={p.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col gap-4 hover:border-violet-500/50 transition-all group">
                          <div className="flex gap-4 items-center">
                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all"><FileText size={20}/></div>
                            <div>
                              <p className="font-bold text-white text-sm">{p.manufacturer} {p.model}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">S/N: {p.serial_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                             <span className="text-[10px] text-slate-500 font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                             <button onClick={() => { setData(p.full_data); setShowDbModal(false); setNotification({message: "Report caricato", type: 'success', visible: true}); }} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs shadow-lg">CARICA DATI</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="h-full flex flex-col items-center justify-center text-slate-600">Nessun report salvato per questo cliente</div>
                ) : <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">Scegli un cliente a sinistra per gestire i dati</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-3xl border-2 z-[110] animate-in slide-in-from-bottom-10 flex items-center gap-3 shadow-2xl ${notification.type === 'success' ? 'bg-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-red-500 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          <span className="font-bold text-sm tracking-tight">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
