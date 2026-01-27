
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Wind, Save, Settings, FileText, Gauge, Info, CheckCircle2, AlertCircle, X, Database, LogOut, Loader2, ShieldAlert, Eye, EyeOff, Download, Layers, Calendar, Thermometer, Activity, User, Plus, Upload, FileSpreadsheet, Trash2, Search, Filter, CloudRain, MapPin } from 'lucide-react';
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
  const [weatherLoading, setWeatherLoading] = useState(false);

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
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [pipetteSearchTerm, setPipetteSearchTerm] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchClients(); }, [session]);
  useEffect(() => { if (session && selectedClientId) fetchPipettes(selectedClientId); }, [session, selectedClientId]);

  // Ricalcola fattore Z quando cambiano temp o pressione
  useEffect(() => {
    if (data.temperature !== '' && data.pressure !== '') {
      const newZ = calculateZFactor(Number(data.temperature), Number(data.pressure));
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

  const fetchClients = async () => { const { data } = await supabase.from('clients').select('*').order('name'); setClients(data || []); };
  const fetchPipettes = async (id: string) => { const { data } = await supabase.from('pipettes').select('*').eq('client_id', id).order('created_at', { ascending: false }); setStoredPipettes(data || []); };

  const fetchWeather = () => {
    setWeatherLoading(true);
    if (!navigator.geolocation) {
      setNotification({ message: "Geolocalizzazione non supportata", type: 'error', visible: true });
      setWeatherLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,surface_pressure`);
        const result = await response.json();
        
        if (result.current) {
          // Converti pressione hPa in kPa (1 hPa = 0.1 kPa)
          const pressureKpa = (result.current.surface_pressure * 0.1).toFixed(1);
          const tempC = result.current.temperature_2m;
          
          setData(prev => ({
            ...prev,
            temperature: tempC,
            pressure: parseFloat(pressureKpa)
          }));
          setNotification({ message: "Dati meteo aggiornati con successo", type: 'success', visible: true });
        }
      } catch (err) {
        setNotification({ message: "Errore nel recupero dati meteo", type: 'error', visible: true });
      } finally {
        setWeatherLoading(false);
      }
    }, () => {
      setNotification({ message: "Permesso geolocalizzazione negato", type: 'error', visible: true });
      setWeatherLoading(false);
    });
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const { data: c, error } = await supabase.from('clients').insert([{ name: newClientName.trim() }]).select().single();
    if (error) { setNotification({ message: error.message, type: 'error', visible: true }); } 
    else { fetchClients(); setSelectedClientId(c.id); setNewClientName(""); setShowNewClientModal(false); setNotification({ message: "Cliente creato con successo", type: 'success', visible: true }); }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
      const newClients = rows.map(r => ({ name: r.replace(/"/g, '') }));
      const { error } = await supabase.from('clients').insert(newClients);

      if (error) setNotification({ message: "Errore importazione: " + error.message, type: 'error', visible: true });
      else { fetchClients(); setNotification({ message: `Importati ${newClients.length} clienti`, type: 'success', visible: true }); }
    };
    reader.readAsText(file);
  };

  const handleDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("ATTENZIONE: Eliminando il cliente verranno cancellate anche TUTTE le sue tarature salvate. Continuare?")) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) setNotification({ message: error.message, type: 'error', visible: true });
    else { fetchClients(); if (selectedClientId === id) setSelectedClientId(null); }
  };

  const handleDeletePipette = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo certificato di taratura?")) return;
    const { error } = await supabase.from('pipettes').delete().eq('id', id);
    if (error) setNotification({ message: error.message, type: 'error', visible: true });
    else { if (selectedClientId) fetchPipettes(selectedClientId); setNotification({ message: "Certificato eliminato", type: 'success', visible: true }); }
  };

  const handleSave = async () => {
    if (!selectedClientId) { setShowDbModal(true); setNotification({ message: "Seleziona un cliente prima di salvare", type: 'error', visible: true }); return; }
    if (!data.serialNumber) { setNotification({ message: "Matricola obbligatoria", type: 'error', visible: true }); return; }
    
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
    if (error) setNotification({ message: error.message, type: 'error', visible: true });
    else { 
      if (selectedClientId) fetchPipettes(selectedClientId);
      setNotification({ message: "Certificato salvato nel cloud!", type: 'success', visible: true });
    }
  };

  const handlePreviewToggle = () => {
    if (!showPreview) {
      const url = getPDFPreviewURL(data);
      setPreviewUrl(url);
      setShowPreview(true);
    } else { setShowPreview(false); }
  };

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Caricamento...</div>;
  if (!session) return <Auth />;

  const nominalUl = (parseFloat(data.nominalVolume) || 0) * (data.nominalVolumeUnit === 'ml' ? 1000 : 1);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredPipettes = storedPipettes.filter(p => 
    p.serial_number.toLowerCase().includes(pipetteSearchTerm.toLowerCase()) ||
    p.manufacturer.toLowerCase().includes(pipetteSearchTerm.toLowerCase()) ||
    p.model.toLowerCase().includes(pipetteSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden">
      <header className="p-4 bg-slate-800/95 backdrop-blur-md border-b border-slate-700 flex justify-between items-center shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-900/40"><Beaker size={20} className="text-white" /></div>
          <div>
            <h1 className="text-lg font-bold leading-none">PipetteCal</h1>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Lab Automation Suite</span>
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
            <button onClick={() => setShowDbModal(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-600/50"><Database size={14}/> Gestione Cloud</button>
            <button onClick={() => supabase.auth.signOut()} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-400 hover:text-white rounded-xl transition-all border border-red-500/10"><LogOut size={16}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`overflow-y-auto p-6 transition-all duration-500 ease-in-out ${showPreview ? 'w-full md:w-1/2 border-r border-slate-700' : 'w-full max-w-6xl mx-auto'}`}>
          
          <div className="space-y-8 pb-12">
            {/* CONFIG RAPIDA */}
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-end shadow-inner">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Richiamo Preset</label>
                <select 
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition-all"
                  value={selectedPresetName}
                  onChange={(e) => {
                    const n = e.target.value; setSelectedPresetName(n);
                    const p = PIPETTE_PRESETS.find(x => x.name === n);
                    if (p) {
                      const limits = ISO_TOLERANCES_DATA.find(iso => iso.vol === (parseFloat(p.nominalVolume) * (p.nominalVolume.includes('ml') ? 1000 : 1)));
                      setData(prev => ({ 
                        ...prev, 
                        manufacturer: p.manufacturer,
                        model: p.model,
                        nominalVolume: p.nominalVolume,
                        type: p.type as PipetteType,
                        toleranceSystematic: limits?.sys || prev.toleranceSystematic,
                        toleranceRandom: limits?.rand || prev.toleranceRandom
                      }));
                      setNotification({ message: `Configurazione caricata: ${p.name}`, type: 'success', visible: true });
                    }
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
              {/* DATI ANAGRAFICA & DATA */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400"><Info size={16}/></div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Anagrafica & Data</h2>
                </div>
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4">
                  <InputGroup 
                    label="Data Taratura" 
                    type="date" 
                    value={data.testDate} 
                    onChange={(e) => setData({...data, testDate: e.target.value})} 
                    icon={<Calendar size={16}/>}
                  />
                  <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({...data, manufacturer: e.target.value})} />
                  <InputGroup label="Modello" value={data.model} onChange={(e) => setData({...data, model: e.target.value})} />
                  <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({...data, serialNumber: e.target.value})} />
                  <div className="flex gap-4">
                    <InputGroup className="flex-1" label="Volume Nominale" value={data.nominalVolume} onChange={(e) => setData({...data, nominalVolume: e.target.value})} type="number" />
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block ml-1">Unità</label>
                      <select value={data.nominalVolumeUnit} onChange={(e) => setData({...data, nominalVolumeUnit: e.target.value as any})} className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 px-3 text-xs text-white outline-none">
                        <option value="ul">µl</option><option value="ml">ml</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* AMBIENTE & ISO */}
              <section className="space-y-6">
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 space-y-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Thermometer size={16} className="text-emerald-400"/>
                      <h2 className="text-xs font-bold text-slate-300 uppercase">Ambiente</h2>
                    </div>
                    <button 
                      onClick={fetchWeather} 
                      disabled={weatherLoading}
                      className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {weatherLoading ? <Loader2 className="animate-spin" size={12}/> : <MapPin size={12}/>}
                      RILEVA METEO LIVE
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({...data, temperature: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                    <InputGroup label="Press (kPa)" value={data.pressure} onChange={(e) => setData({...data, pressure: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.1" />
                  </div>
                  <InputGroup label="Z Factor (Calcolato)" value={data.zFactor} onChange={() => {}} readOnly type="number" unit="Z" />
                </div>
                <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30 grid grid-cols-2 gap-4">
                   <InputGroup label="Tolleranza E (µl)" value={data.toleranceSystematic} onChange={(e) => setData({...data, toleranceSystematic: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.01" />
                   <InputGroup label="Tolleranza SD (µl)" value={data.toleranceRandom} onChange={(e) => setData({...data, toleranceRandom: e.target.value === '' ? '' : parseFloat(e.target.value)})} type="number" step="0.01" />
                </div>
              </section>
            </div>

            {/* MISURE */}
            <section className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30">
              <div className="flex items-center gap-3 mb-6"><Activity size={18} className="text-indigo-400" /><h2 className="text-sm font-bold text-white uppercase tracking-wider">Misure (mg)</h2></div>
              <MeasurementSection {...data} fixedData={data.measurementsFixed} varMinData={data.measurementsVarMin} varMidData={data.measurementsVarMid} varMaxData={data.measurementsVarMax} onUpdate={(t, i, v) => {
                const field = t === 'fixed' ? 'measurementsFixed' : t === 'min' ? 'measurementsVarMin' : t === 'mid' ? 'measurementsVarMid' : 'measurementsVarMax';
                const arr = [...(data[field] as any)];
                arr[i] = v === '' ? '' : parseFloat(v);
                setData({...data, [field]: arr});
              }} zFactor={data.zFactor} />
              <div className="mt-8">
                 {data.type === PipetteType.FIXED ? (
                   <LiveChart data={data.measurementsFixed} target={nominalUl} label="Fissa" zFactor={Number(data.zFactor) || 1} />
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <LiveChart data={data.measurementsVarMin} target={nominalUl * 0.1} label="10%" zFactor={Number(data.zFactor) || 1} />
                      <LiveChart data={data.measurementsVarMid} target={nominalUl * 0.5} label="50%" zFactor={Number(data.zFactor) || 1} />
                      <LiveChart data={data.measurementsVarMax} target={nominalUl} label="100%" zFactor={Number(data.zFactor) || 1} />
                   </div>
                 )}
              </div>
            </section>
          </div>

          <div className="sticky bottom-4 left-0 right-0 flex gap-4 bg-slate-900/95 backdrop-blur-xl p-4 rounded-3xl border border-slate-700 shadow-2xl z-20">
            <button onClick={handlePreviewToggle} className="hidden md:flex flex-1 py-4 rounded-2xl font-bold items-center justify-center gap-2 bg-slate-700 text-white hover:bg-slate-600 transition-all">
              {showPreview ? <><EyeOff size={18}/> Chiudi Anteprima</> : <><Eye size={18}/> Anteprima</>}
            </button>
            <button onClick={handleSave} disabled={saveLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50">
              {saveLoading ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Salva Cloud</>}
            </button>
            <button onClick={() => generatePDF(data)} className="flex-[1.2] bg-violet-600 hover:bg-violet-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl">
              <Download size={20}/> Scarica PDF
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="w-1/2 bg-slate-950 p-6 animate-in slide-in-from-right duration-500">
            <div className="w-full h-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 relative">
               <iframe src={previewUrl || ''} className="w-full h-full" title="Preview"></iframe>
               <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-xl"><X size={20}/></button>
            </div>
          </div>
        )}
      </main>

      {/* MODALE DATABASE */}
      {showDbModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-[40px] border border-slate-800 flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
              <h2 className="text-xl font-bold flex items-center gap-3"><Database size={24} className="text-violet-500" /> Archivio Cloud Clienti</h2>
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleCsvImport} accept=".csv" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all"><FileSpreadsheet size={16} className="text-emerald-400" /> Importa CSV Clienti</button>
                <button onClick={() => setShowNewClientModal(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg"><Plus size={16} /> Nuovo Cliente</button>
                <button onClick={() => setShowDbModal(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors"><X size={24}/></button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50">
                <div className="p-4 border-b border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                      type="text" 
                      placeholder="Cerca cliente..." 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-violet-500 outline-none"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 block mb-2">Lista Clienti</label>
                  {filteredClients.map(c => (
                    <div key={c.id} className="group relative">
                      <button onClick={() => setSelectedClientId(c.id)} className={`w-full text-left p-4 rounded-2xl transition-all font-bold text-sm pr-12 ${selectedClientId === c.id ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>{c.name}</button>
                      <button 
                        title="Elimina Cliente"
                        onClick={(e) => handleDeleteClient(c.id, e)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-xs italic">Nessun cliente trovato</div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-slate-950/20">
                {selectedClientId && (
                  <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text" 
                        placeholder="Filtra per matricola, modello o marca..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-violet-500 outline-none"
                        value={pipetteSearchTerm}
                        onChange={(e) => setPipetteSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase ml-4">
                      {filteredPipettes.length} Certificati Trovati
                    </div>
                  </div>
                )}
                
                <div className="flex-1 p-6 overflow-y-auto">
                  {selectedClientId ? (
                    filteredPipettes.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPipettes.map(p => (
                          <div key={p.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col gap-4 hover:border-violet-500/50 transition-all group relative">
                            <button 
                              title="Elimina Certificato"
                              onClick={() => handleDeletePipette(p.id)}
                              className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={16}/>
                            </button>
                            <div className="flex gap-4 items-center">
                              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-violet-400"><FileText size={20}/></div>
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
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                        {pipetteSearchTerm ? 'Nessun certificato corrisponde alla ricerca' : 'Nessun report per questo cliente'}
                      </div>
                    )
                  ) : <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">Scegli un cliente dalla lista per visualizzare i report</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUOVO CLIENTE */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-slate-800 w-full max-w-md p-8 rounded-[32px] border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
             <h3 className="text-xl font-bold text-white mb-2">Crea Nuovo Cliente</h3>
             <p className="text-sm text-slate-400 mb-6">Inserisci la ragione sociale o il nome del cliente per l'archivio.</p>
             <input 
               autoFocus
               type="text" 
               className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white mb-6 outline-none focus:border-violet-500 transition-colors"
               placeholder="Es. Laboratorio Analisi Rossi Srl"
               value={newClientName}
               onChange={(e) => setNewClientName(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
             />
             <div className="flex gap-3">
               <button onClick={() => setShowNewClientModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white">Annulla</button>
               <button onClick={handleCreateClient} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-violet-900/20">Crea Cliente</button>
             </div>
          </div>
        </div>
      )}

      {notification?.visible && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-3xl border-2 z-[120] animate-in slide-in-from-bottom-10 flex items-center gap-3 shadow-2xl ${notification.type === 'success' ? 'bg-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-red-500 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          <span className="font-bold text-sm tracking-tight">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
