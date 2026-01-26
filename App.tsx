
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { Beaker, Thermometer, Wind, Save, Settings, FileText, Droplet, Gauge, Calculator, RotateCcw, Info, Ruler, Library, Plus, CheckCircle2, AlertCircle, X, CalendarClock, Lock, Unlock, Database, User, Search, FolderOpen, ArrowRight, LogOut, UploadCloud, Upload, Trash2, AlertTriangle, Loader2, FileCog, CheckSquare, Square, Printer, Tags, List, Calendar, PlusCircle, Copy, Hash, FileSpreadsheet, Download, Maximize2, Minimize2, ArrowRightCircle, HardDrive, Image as ImageIcon, StickyNote } from 'lucide-react';
import { CalibrationData, PipetteType, ZFactorMethod, Client, StoredPipette, PdfOptions, PdfTheme } from './types';
import { INITIAL_MEASUREMENTS_FIXED, INITIAL_MEASUREMENTS_VAR, DEFAULT_Z_FACTOR, calculateZFactor, ISO_TOLERANCES_DATA, PIPETTE_PRESETS } from './constants';
import { InputGroup } from './components/InputGroup';
import { MeasurementSection } from './components/MeasurementSection';
import { generatePDF, generateClientListPDF, generateLabelsPDF } from './services/pdfGenerator';

const App: React.FC = () => {
  // --- SESSION STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- APP STATE ---
  const [data, setData] = useState<CalibrationData>({
    manufacturer: '',
    model: '',
    serialNumber: '',
    nominalVolume: '',
    nominalVolumeUnit: 'ul', // Default unit
    testDate: new Date().toISOString().split('T')[0],
    testNumber: '',
    calibrationFrequencyMonths: 12, // Default 1 year
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

  // File Input Ref for JSON Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File Input Ref for CSV Import
  const csvInputRef = useRef<HTMLInputElement>(null);
  
  // File Input Ref for Logo Upload
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Custom Presets State (Persisted locally for now, could be moved to DB later)
  const [customPresets, setCustomPresets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pipette_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // --- DATABASE STATE (SUPABASE) ---
  const [clients, setClients] = useState<Client[]>([]);
  const [storedPipettes, setStoredPipettes] = useState<StoredPipette[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Search States
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [pipetteSearchTerm, setPipetteSearchTerm] = useState('');

  // UI States
  const [selectedPresetName, setSelectedPresetName] = useState<string>("");
  const [showDbModal, setShowDbModal] = useState(false);
  const [isDbModalMaximized, setIsDbModalMaximized] = useState(false); // State for maximizing modal
  const [showPdfConfigModal, setShowPdfConfigModal] = useState(false); // PDF Config Modal
  const [dbView, setDbView] = useState<'list' | 'add_client' | 'import_csv'>('list');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientUserId, setNewClientUserId] = useState('');
  
  // Direct Add Pipette State inside Modal
  const [isAddingPipette, setIsAddingPipette] = useState(false);
  const [newPipetteForm, setNewPipetteForm] = useState({
    manufacturer: '',
    model: '',
    serialNumber: '',
    nominalVolume: '',
    nominalVolumeUnit: 'ul' as 'ul' | 'ml',
    type: PipetteType.FIXED
  });
  
  // Label Printing State
  const [showLabelDateModal, setShowLabelDateModal] = useState(false);
  const [labelDateInput, setLabelDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [labelTotalCount, setLabelTotalCount] = useState(10); // Changed from copies per pipette to total count

  // Delete States (Pipettes)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Delete States (Clients)
  const [confirmDeleteClientId, setConfirmDeleteClientId] = useState<string | null>(null);
  const [isDeletingClientId, setIsDeletingClientId] = useState<string | null>(null);

  // Import State (Advanced with Mapping)
  const [importLog, setImportLog] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'processing' | 'finished'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]); // Raw rows object
  const [columnMapping, setColumnMapping] = useState<{
    client_name: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    nominal_volume: string;
    unit: string;
    type: string;
  }>({
    client_name: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    nominal_volume: '',
    unit: '',
    type: ''
  });


  // Toast Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

  // --- EFFECTS ---

  // 1. Handle Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Data when Session exists
  useEffect(() => {
    if (session) {
      fetchClients();
    }
  }, [session]);

  // 3. Fetch Pipettes when Client Selected
  useEffect(() => {
    if (session && selectedClientId) {
      fetchPipettes(selectedClientId);
      setIsAddingPipette(false); // Reset add mode when switching client
      setPipetteSearchTerm(''); // Reset filter
    }
  }, [session, selectedClientId]);

  // Auto-calculate Z-Factor
  useEffect(() => {
    if (data.zFactorMethod === 'ISO_WATER') {
      if (typeof data.temperature === 'number' && typeof data.pressure === 'number') {
        const newZ = calculateZFactor(data.temperature, data.pressure);
        setData(prev => ({ ...prev, zFactor: newZ }));
      }
    }
  }, [data.temperature, data.pressure, data.zFactorMethod]);

  // Auto-calculate Next Calibration Date
  useEffect(() => {
    if (data.testDate && data.calibrationFrequencyMonths) {
      const date = new Date(data.testDate);
      date.setMonth(date.getMonth() + data.calibrationFrequencyMonths);
      if (date.getDate() !== new Date(data.testDate).getDate()) {
        date.setDate(0);
      }
      setData(prev => ({ ...prev, nextCalibrationDate: date.toISOString().split('T')[0] }));
    }
  }, [data.testDate, data.calibrationFrequencyMonths]);

  // Auto-populate Tolerances
  useEffect(() => {
    if (!data.nominalVolume) return;
    
    // Parse volume and normalize to µl for lookup
    let vol = parseFloat(data.nominalVolume);
    if (isNaN(vol)) return;
    
    // If unit is ML, convert to µl for ISO lookup
    if (data.nominalVolumeUnit === 'ml') {
      vol = vol * 1000;
    }

    // Find closest match in tolerances
    const match = ISO_TOLERANCES_DATA.find(iso => iso.vol === vol);
    if (match) {
      setData(prev => ({ ...prev, toleranceSystematic: match.sys, toleranceRandom: match.rand }));
    }
  }, [data.nominalVolume, data.nominalVolumeUnit]);

  // Hide notification
  useEffect(() => {
    if (notification?.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => prev ? { ...prev, visible: false } : null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- FILTERED DATA ---
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredPipettes = storedPipettes.filter(p => {
    const term = pipetteSearchTerm.toLowerCase();
    return (
      p.manufacturer.toLowerCase().includes(term) ||
      p.model.toLowerCase().includes(term) ||
      p.serial_number.toLowerCase().includes(term)
    );
  });

  // --- DATABASE FUNCTIONS (SUPABASE) ---

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error.message);
    }
  };

  const fetchPipettes = async (clientId: string) => {
    setIsLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('pipettes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setStoredPipettes(data || []);
    } catch (error: any) {
      showNotification("Errore caricamento pipette", "error");
      console.error(error);
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    
    try {
      const payload: any = {
        name: newClientName.trim()
      };
      
      if (newClientUserId.trim()) {
        payload.user_id = newClientUserId.trim();
      }

      const { error } = await supabase.from('clients').insert([payload]);

      if (error) throw error;
      
      showNotification("Cliente aggiunto con successo", "success");
      setNewClientName('');
      setNewClientUserId('');
      setDbView('list');
      fetchClients();
    } catch (error: any) {
      showNotification("Errore creazione cliente", "error");
    }
  };

  const handleDirectAddPipette = async () => {
    if (!selectedClientId || !session) return;
    if (!newPipetteForm.manufacturer || !newPipetteForm.model || !newPipetteForm.serialNumber || !newPipetteForm.nominalVolume) {
      showNotification("Compila tutti i campi obbligatori", "error");
      return;
    }

    setIsSavingDb(true);

    try {
      // Create a fresh calibration data structure
      const defaultData: CalibrationData = {
        manufacturer: newPipetteForm.manufacturer,
        model: newPipetteForm.model,
        serialNumber: newPipetteForm.serialNumber,
        nominalVolume: newPipetteForm.nominalVolume,
        nominalVolumeUnit: newPipetteForm.nominalVolumeUnit,
        type: newPipetteForm.type,
        testDate: new Date().toISOString().split('T')[0],
        testNumber: '',
        calibrationFrequencyMonths: 12,
        nextCalibrationDate: '',
        temperature: '',
        pressure: '',
        humidity: '',
        zFactor: DEFAULT_Z_FACTOR,
        zFactorMethod: 'ISO_WATER',
        toleranceSystematic: '',
        toleranceRandom: '',
        measurementsFixed: [...INITIAL_MEASUREMENTS_FIXED],
        measurementsVarMin: [...INITIAL_MEASUREMENTS_VAR],
        measurementsVarMid: [...INITIAL_MEASUREMENTS_VAR],
        measurementsVarMax: [...INITIAL_MEASUREMENTS_VAR],
        notes: '',
        pdfOptions: { includeCharts: true, colorTheme: 'default', operatorName: '', approverName: '', customLogoBase64: '' }
      };

      const payload = {
        user_id: session.user.id,
        client_id: selectedClientId,
        manufacturer: newPipetteForm.manufacturer,
        model: newPipetteForm.model,
        serial_number: newPipetteForm.serialNumber,
        nominal_volume: newPipetteForm.nominalVolume,
        last_calibrated: defaultData.testDate,
        full_data: defaultData
      };

      const { data: insertedData, error } = await supabase
        .from('pipettes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      showNotification("Pipetta aggiunta con successo", "success");
      if (insertedData) {
        setStoredPipettes(prev => [insertedData, ...prev]);
      } else {
        fetchPipettes(selectedClientId);
      }
      
      // Reset and close form
      setIsAddingPipette(false);
      setNewPipetteForm({
        manufacturer: '',
        model: '',
        serialNumber: '',
        nominalVolume: '',
        nominalVolumeUnit: 'ul',
        type: PipetteType.FIXED
      });

    } catch (error: any) {
      console.error(error);
      showNotification("Errore creazione pipetta", "error");
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!selectedClientId || !session) {
      showNotification("Seleziona un cliente prima", "error");
      return;
    }

    setIsSavingDb(true);

    try {
      const payload = {
        user_id: session.user.id,
        client_id: selectedClientId,
        manufacturer: data.manufacturer,
        model: data.model,
        serial_number: data.serialNumber,
        nominal_volume: data.nominalVolume,
        last_calibrated: data.testDate,
        full_data: data
      };

      const { data: insertedData, error } = await supabase
        .from('pipettes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      showNotification("Pipetta salvata correttamente", "success");
      // Add to list if we are viewing that client
      setStoredPipettes(prev => [insertedData, ...prev]);
    } catch (error: any) {
      console.error(error);
      showNotification("Errore salvataggio", "error");
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleLoadFromDb = (pipette: StoredPipette) => {
    setData(pipette.full_data);
    showNotification("Dati caricati", "success");
    setShowDbModal(false);
  };

  const handleDeletePipette = async (id: string) => {
    setIsDeletingId(id);
    try {
      const { data, error } = await supabase
        .from('pipettes')
        .delete()
        .eq('id', id)
        .select(); // IMPORTANT: Request deleted rows return to confirm RLS

      if (error) throw error;

      // RLS Check: If no data returned, deletion was blocked by policy
      if (!data || data.length === 0) {
        throw new Error("Permesso negato: non puoi eliminare questa pipetta (RLS)");
      }

      setStoredPipettes(prev => prev.filter(p => p.id !== id));
      showNotification("Pipetta eliminata", "success");
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "Errore eliminazione", "error");
    } finally {
      setIsDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const executeDeleteClient = async (id: string) => {
    setIsDeletingClientId(id);
    try {
      const { data, error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Impossibile eliminare: permesso negato o record non trovato");
      }

      setClients(prev => prev.filter(c => c.id !== id));
      showNotification("Cliente eliminato", "success");
      
      // If we deleted the currently viewed client, reset view
      if (selectedClientId === id) {
        setSelectedClientId(null);
        setStoredPipettes([]);
      }
    } catch (error: any) {
      console.error(error);
      // Helpful message if foreign key constraint fails
      if (error.message?.includes('violates foreign key constraint')) {
        showNotification("Impossibile eliminare: il cliente ha delle pipette associate.", "error");
      } else {
        showNotification(error.message || "Errore eliminazione cliente", "error");
      }
    } finally {
      setIsDeletingClientId(null);
      setConfirmDeleteClientId(null);
    }
  };
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit
        showNotification("Il logo è troppo grande (Max 1MB)", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setData(d => ({
            ...d,
            pdfOptions: { ...d.pdfOptions!, customLogoBase64: base64 }
        }));
        showNotification("Logo caricato!", "success");
    };
    reader.readAsDataURL(file);
  };

  // --- CSV IMPORT LOGIC ---

  const downloadCsvTemplate = () => {
    // Standard CSV headers for import
    const headers = [
      "client_name", "manufacturer", "model", "serial_number", "nominal_volume", "unit", "type"
    ];
    // Example row
    const example = [
      "Laboratorio Rossi", "Gilson", "Pipetman", "MK302", "1000", "ul", "VARIABLE"
    ];
    
    // Add BOM for Excel UTF-8 and use Semicolon for Excel EU/IT compatibility
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(";") + "\n" + example.join(";");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_importazione_pipette.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 1: Parse and Analyze file
  const handleFileSelect = (file: File) => {
    setImportStep('upload');
    setImportLog([]);
    setCsvHeaders([]);
    setCsvRows([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;

        // Detect delimiter (Comma or Semicolon for Italian Excel)
        const firstLine = text.split('\n')[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';

        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error("Il file sembra vuoto o non valido.");

        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
        const rawRows = [];

        // Parse rows
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
          // Simple object with header as key (temporary)
          const rowObj: any = {};
          headers.forEach((h, idx) => {
             rowObj[h] = cols[idx];
          });
          rawRows.push(rowObj);
        }

        setCsvHeaders(headers);
        setCsvRows(rawRows);
        
        // Auto-Detect Mapping based on standard names
        const newMapping = { ...columnMapping };
        const lowerHeaders = headers.map(h => h.toLowerCase());
        
        const findMatch = (candidates: string[]) => {
           return headers.find(h => candidates.some(c => h.toLowerCase().includes(c))) || '';
        };

        newMapping.client_name = findMatch(['client', 'cliente', 'laboratorio', 'owner', 'ragione']);
        newMapping.manufacturer = findMatch(['manufacturer', 'costruttore', 'marca', 'brand', 'maker']);
        newMapping.model = findMatch(['model', 'modello', 'tipo']);
        newMapping.serial_number = findMatch(['serial', 'matricola', 'sn', 's/n', 'id']);
        newMapping.nominal_volume = findMatch(['vol', 'capacity', 'capacità']);
        newMapping.unit = findMatch(['unit', 'unità', 'u.m.']);
        newMapping.type = findMatch(['type', 'fisso', 'variabile']);

        setColumnMapping(newMapping);
        setImportStep('mapping'); // Go to mapping step

      } catch (err: any) {
        setNotification({ message: "Errore lettura file: " + err.message, type: 'error', visible: true });
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    setImportStep('processing');
    const addToLog = (msg: string) => setImportLog(prev => [...prev, msg]);
    let importedCount = 0;

    try {
        // Validation
        if (!columnMapping.client_name || !columnMapping.serial_number) {
            throw new Error("Devi mappare almeno 'Cliente' e 'Matricola'.");
        }

        let currentClients = [...clients];
        if (currentClients.length === 0) {
            const { data } = await supabase.from('clients').select('*');
            if (data) currentClients = data;
        }

        for (let i = 0; i < csvRows.length; i++) {
            const rawRow = csvRows[i];
            
            // Extract values using mapping
            const clientName = rawRow[columnMapping.client_name];
            const serialNum = rawRow[columnMapping.serial_number];
            
            if (!clientName || !serialNum) {
                addToLog(`Riga ${i+1}: Saltata (Dati mancanti)`);
                continue;
            }

            // 1. Find or Create Client
            let clientId = currentClients.find(c => c.name.toLowerCase() === clientName.toLowerCase())?.id;
            
            if (!clientId) {
                addToLog(`Cliente '${clientName}' non trovato. Creazione...`);
                const { data: newClient, error: clientError } = await supabase
                    .from('clients')
                    .insert([{ name: clientName, user_id: session?.user?.id }])
                    .select()
                    .single();
                
                if (clientError || !newClient) {
                    addToLog(`Errore creazione cliente '${clientName}': ${clientError?.message}`);
                    continue;
                }
                clientId = newClient.id;
                currentClients.push(newClient);
            }

            // 2. Prepare Data
            const manufacturer = columnMapping.manufacturer ? rawRow[columnMapping.manufacturer] : 'Unknown';
            const model = columnMapping.model ? rawRow[columnMapping.model] : 'Unknown';
            const volumeStr = columnMapping.nominal_volume ? rawRow[columnMapping.nominal_volume] : '0';
            const unitStr = columnMapping.unit ? rawRow[columnMapping.unit] : 'ul';
            const typeStr = columnMapping.type ? rawRow[columnMapping.type] : '';

            const volUnit = (unitStr || 'ul').toLowerCase().includes('ml') ? 'ml' : 'ul';
            const pType = (typeStr || '').toUpperCase().includes('VAR') ? PipetteType.VARIABLE : PipetteType.FIXED;

            const defaultData: CalibrationData = {
                manufacturer: manufacturer,
                model: model,
                serialNumber: serialNum,
                nominalVolume: volumeStr,
                nominalVolumeUnit: volUnit,
                type: pType,
                testDate: new Date().toISOString().split('T')[0],
                testNumber: '',
                calibrationFrequencyMonths: 12,
                nextCalibrationDate: '',
                temperature: '',
                pressure: '',
                humidity: '',
                zFactor: DEFAULT_Z_FACTOR,
                zFactorMethod: 'ISO_WATER',
                toleranceSystematic: '',
                toleranceRandom: '',
                measurementsFixed: [...INITIAL_MEASUREMENTS_FIXED],
                measurementsVarMin: [...INITIAL_MEASUREMENTS_VAR],
                measurementsVarMid: [...INITIAL_MEASUREMENTS_VAR],
                measurementsVarMax: [...INITIAL_MEASUREMENTS_VAR],
                notes: '',
                pdfOptions: { includeCharts: true, colorTheme: 'default', operatorName: '', approverName: '' }
            };

            // 3. Insert
            const { error: pipError } = await supabase.from('pipettes').insert([{
                 client_id: clientId,
                 user_id: session?.user?.id,
                 manufacturer: manufacturer,
                 model: model,
                 serial_number: serialNum,
                 nominal_volume: volumeStr,
                 last_calibrated: defaultData.testDate,
                 full_data: defaultData
            }]);

            if (pipError) {
                 addToLog(`Errore pipetta ${serialNum}: ${pipError.message}`);
            } else {
                 importedCount++;
                 addToLog(`Pipetta ${serialNum} ok.`);
            }
        }
        
        showNotification(`Finito: ${importedCount} importati.`, "success");
        fetchClients();
        setImportStep('finished');

    } catch (err: any) {
        showNotification(err.message, "error");
        addToLog("Errore critico: " + err.message);
        setImportStep('finished');
    }
  };


  // --- HELPER FUNCTIONS ---

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ message: msg, type, visible: true });
  };

  const updateMeasurement = (type: 'fixed' | 'min' | 'mid' | 'max', index: number, value: string) => {
    const numValue = value === '' ? '' : parseFloat(value);
    
    setData(prev => {
      const newData = { ...prev };
      if (type === 'fixed') {
        const arr = [...prev.measurementsFixed];
        arr[index] = numValue;
        newData.measurementsFixed = arr;
      } else if (type === 'min') {
        const arr = [...prev.measurementsVarMin];
        arr[index] = numValue;
        newData.measurementsVarMin = arr;
      } else if (type === 'mid') {
        const arr = [...prev.measurementsVarMid];
        arr[index] = numValue;
        newData.measurementsVarMid = arr;
      } else if (type === 'max') {
        const arr = [...prev.measurementsVarMax];
        arr[index] = numValue;
        newData.measurementsVarMax = arr;
      }
      return newData;
    });
  };

  const applyPreset = (preset: any) => {
    setData(prev => ({
      ...prev,
      nominalVolume: preset.nominalVolume,
      manufacturer: preset.manufacturer || prev.manufacturer,
      model: preset.model || prev.model,
      serialNumber: preset.serialNumber || prev.serialNumber, // Use preserved serial if available
      type: preset.type || prev.type,
      // Restore measurements if they exist in the preset/save, otherwise reset
      measurementsFixed: preset.measurementsFixed || [...INITIAL_MEASUREMENTS_FIXED],
      measurementsVarMin: preset.measurementsVarMin || [...INITIAL_MEASUREMENTS_VAR],
      measurementsVarMid: preset.measurementsVarMid || [...INITIAL_MEASUREMENTS_VAR],
      measurementsVarMax: preset.measurementsVarMax || [...INITIAL_MEASUREMENTS_VAR],
      // Restore environment if exists
      temperature: preset.temperature !== undefined ? preset.temperature : prev.temperature,
      pressure: preset.pressure !== undefined ? preset.pressure : prev.pressure,
      humidity: preset.humidity !== undefined ? preset.humidity : prev.humidity,
      zFactor: preset.zFactor || prev.zFactor,

      toleranceSystematic: preset.toleranceSystematic !== undefined ? preset.toleranceSystematic : '',
      toleranceRandom: preset.toleranceRandom !== undefined ? preset.toleranceRandom : '',
      notes: preset.notes || ''
    }));
    showNotification(`Dati "${preset.name}" caricati`, "success");
  };

  const handleLocalSave = () => {
    if (!data.serialNumber) {
      showNotification("Inserisci almeno la Matricola (S/N)", "error");
      return;
    }
    
    const timestamp = new Date().toLocaleString('it-IT', { 
       day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' 
    });
    
    const saveName = `${data.serialNumber} - ${timestamp}`;
    
    // Create a preset object that contains EVERYTHING needed to restore state
    const savedItem = {
      ...data,
      name: saveName,
    };

    // Add to current presets list
    const updatedPresets = [savedItem, ...customPresets];
    setCustomPresets(updatedPresets);
    
    // Persist to LocalStorage
    try {
      localStorage.setItem('pipette_presets', JSON.stringify(updatedPresets));
      showNotification("Salvato in Locale (vedi 'Carica Preset')", "success");
    } catch (e) {
      showNotification("Errore salvataggio locale (Storage pieno?)", "error");
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPresetName) return;

    // Check if it's actually a custom preset
    const isCustom = customPresets.some(p => p.name === selectedPresetName);
    if (!isCustom) return;

    if (window.confirm(`Sei sicuro di voler eliminare definitivamente il salvataggio "${selectedPresetName}"?`)) {
      const updatedPresets = customPresets.filter(p => p.name !== selectedPresetName);
      setCustomPresets(updatedPresets);
      localStorage.setItem('pipette_presets', JSON.stringify(updatedPresets));
      setSelectedPresetName(""); // Reset selection
      showNotification("Preset eliminato correttamente", "success");
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans pb-24">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-violet-900/20">
            <Beaker size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              PipetteCal
            </h1>
            <p className="text-slate-500 text-sm font-medium">Professional Calibration Tool</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
            onClick={() => setShowPdfConfigModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-slate-700 font-medium"
          >
            <Settings size={18} />
            Opzioni PDF
          </button>
          
          <button 
            onClick={() => setShowDbModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2 font-medium"
          >
            <Database size={18} />
            Archivio Cloud
          </button>

          <button 
            onClick={() => supabase.auth.signOut()}
            className="bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 px-3 py-2.5 rounded-xl transition-all border border-slate-700"
            title="Esci"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Info */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* GENERAL INFO CARD */}
          <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-xl">
            <h2 className="text-violet-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info size={16} /> Dati Pipetta
            </h2>
            
            {/* PRESETS DROPDOWN */}
            <div className="mb-6">
               <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block ml-1">Carica Preset / Salvataggi</label>
               <div className="flex gap-2">
                 <div className="relative flex-1">
                   <select 
                     className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none appearance-none"
                     value={selectedPresetName}
                     onChange={(e) => {
                        const name = e.target.value;
                        setSelectedPresetName(name);
                        const preset = [...PIPETTE_PRESETS, ...customPresets].find(p => p.name === name);
                        if (preset) applyPreset(preset);
                     }}
                   >
                     <option value="">-- Seleziona o Scrivi --</option>
                     <optgroup label="Standard">
                       {PIPETTE_PRESETS.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                     </optgroup>
                     {customPresets.length > 0 && (
                       <optgroup label="Salvati in Locale">
                         {customPresets.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                       </optgroup>
                     )}
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      <ArrowRight size={14} className="rotate-90" />
                   </div>
                 </div>
                 
                 {/* Delete Button - Only shows if a custom preset is selected */}
                 {customPresets.some(p => p.name === selectedPresetName) && (
                    <button 
                      onClick={handleDeletePreset}
                      className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/30 rounded-xl px-3 transition-colors"
                      title="Elimina questo salvataggio locale"
                    >
                      <Trash2 size={18} />
                    </button>
                 )}
               </div>
            </div>

            <div className="space-y-4">
              <InputGroup label="Costruttore" value={data.manufacturer} onChange={(e) => setData({ ...data, manufacturer: e.target.value })} />
              <InputGroup label="Modello" value={data.model} onChange={(e) => setData({ ...data, model: e.target.value })} />
              <InputGroup label="Matricola (S/N)" value={data.serialNumber} onChange={(e) => setData({ ...data, serialNumber: e.target.value })} icon={<Hash size={16}/>} />
              
              {/* NOMINAL VOLUME WITH UNIT */}
              <div className="flex gap-2">
                 <div className="flex-1">
                   <InputGroup 
                     label="Volume Nominale" 
                     value={data.nominalVolume} 
                     onChange={(e) => setData({ ...data, nominalVolume: e.target.value })} 
                     placeholder="Es. 1000"
                     icon={<Ruler size={16}/>}
                   />
                 </div>
                 <div className="w-24">
                   <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 block">Unità</label>
                   <div className="relative">
                      <select
                        value={data.nominalVolumeUnit}
                        onChange={(e) => setData({ ...data, nominalVolumeUnit: e.target.value as 'ul' | 'ml' })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 pl-3 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
                      >
                        <option value="ul">µl</option>
                        <option value="ml">ml</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <ArrowRight size={12} className="rotate-90" />
                      </div>
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <button
                  onClick={() => setData({ ...data, type: PipetteType.FIXED })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${data.type === PipetteType.FIXED ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                  Volume Fisso
                </button>
                <button
                  onClick={() => setData({ ...data, type: PipetteType.VARIABLE })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${data.type === PipetteType.VARIABLE ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                  Variabile
                </button>
              </div>

              {/* NOTES AREA */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-2">
                  <StickyNote size={14} className="text-slate-500"/> Note Aggiuntive
                </label>
                <textarea
                  value={data.notes}
                  onChange={(e) => setData({ ...data, notes: e.target.value })}
                  placeholder="Inserisci eventuali note o osservazioni..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:outline-none min-h-[80px] transition-all resize-none"
                />
              </div>
            </div>
          </div>
          
           {/* LIMITS CARD */}
           <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-xl">
             <h2 className="text-rose-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Gauge size={16} /> Tolleranze ISO (µl)
            </h2>
             <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Sistematico (E)" value={data.toleranceSystematic} onChange={(e) => setData({ ...data, toleranceSystematic: parseFloat(e.target.value) || '' })} type="number" step="0.01" />
              <InputGroup label="Casuale (SD)" value={data.toleranceRandom} onChange={(e) => setData({ ...data, toleranceRandom: parseFloat(e.target.value) || '' })} type="number" step="0.01" />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Measurements */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-800/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 mb-8 pb-6 border-b border-slate-700/50">
               <InputGroup 
                 className="w-40" 
                 label="Data Test" 
                 value={data.testDate} 
                 onChange={(e) => setData({ ...data, testDate: e.target.value })} 
                 type="date"
               />
               <div className="w-32">
                 <InputGroup 
                    label="Freq (Mesi)" 
                    value={data.calibrationFrequencyMonths} 
                    onChange={(e) => setData({ ...data, calibrationFrequencyMonths: parseInt(e.target.value) || 12 })} 
                    type="number" 
                 />
               </div>
               <div className="flex-1 flex items-end justify-end gap-3">
                  <button 
                    onClick={handleLocalSave}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all border border-slate-700 flex items-center gap-2 font-bold"
                    title="Salva dati nel browser"
                  >
                    <Save size={20} />
                    <span className="hidden sm:inline">Salva Locale</span>
                  </button>
                  <button 
                    onClick={() => {
                       if (window.confirm("Sei sicuro di voler resettare tutti i dati?")) {
                          window.location.reload();
                       }
                    }}
                    className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                    title="Nuova Calibrazione"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button 
                    onClick={() => generatePDF(data)}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-violet-900/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <FileText size={20} />
                    Genera PDF
                  </button>
               </div>
            </div>

            {/* Environment Section (Moved here) */}
            <div className="mb-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
               <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                 <Wind size={16} /> Condizioni Ambientali & Fattore Z
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                 <InputGroup label="Temp (°C)" value={data.temperature} onChange={(e) => setData({ ...data, temperature: parseFloat(e.target.value) || '' })} type="number" step="0.1" />
                 <InputGroup label="Pressione (kPa)" value={data.pressure} onChange={(e) => setData({ ...data, pressure: parseFloat(e.target.value) || '' })} type="number" step="0.1" />
                 <InputGroup label="Umidità (%)" value={data.humidity} onChange={(e) => setData({ ...data, humidity: parseFloat(e.target.value) || '' })} type="number" step="1" icon={<Droplet size={14}/>} />
                 
                 {/* Z Factor Column */}
                 <div className="flex flex-col">
                   <div className="flex justify-between items-center mb-1.5 min-h-[16px]">
                      <label className="text-xs font-semibold text-slate-400 uppercase">Fattore Z</label>
                      <button 
                         onClick={() => setData(d => ({ ...d, zFactorMethod: d.zFactorMethod === 'MANUAL' ? 'ISO_WATER' : 'MANUAL' }))}
                         className="text-[9px] text-violet-400 hover:text-violet-300 underline whitespace-nowrap"
                       >
                         {data.zFactorMethod === 'MANUAL' ? 'Auto (ISO)' : 'Manuale'}
                       </button>
                   </div>
                   <InputGroup 
                     label="" 
                     value={data.zFactor} 
                     onChange={(e) => setData({ ...data, zFactor: parseFloat(e.target.value) || '' })} 
                     type="number" 
                     step="0.0001"
                     readOnly={data.zFactorMethod === 'ISO_WATER'}
                     icon={<Calculator size={16}/>}
                   />
                 </div>
               </div>
            </div>

            <MeasurementSection 
              type={data.type}
              fixedData={data.measurementsFixed}
              varMinData={data.measurementsVarMin}
              varMidData={data.measurementsVarMid}
              varMaxData={data.measurementsVarMax}
              onUpdate={updateMeasurement}
              zFactor={data.zFactor}
              toleranceSystematic={data.toleranceSystematic}
              toleranceRandom={data.toleranceRandom}
              nominalVolume={data.nominalVolume}
              nominalVolumeUnit={data.nominalVolumeUnit}
            />

          </div>
        </div>

      </main>

      {/* --- NOTIFICATION TOAST --- */}
      {notification && notification.visible && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn z-50 border ${
          notification.type === 'success' 
            ? 'bg-slate-900 text-emerald-400 border-emerald-500/30' 
            : 'bg-slate-900 text-red-400 border-red-500/30'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      {/* --- DATABASE MODAL --- */}
      {showDbModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
          <div 
             className={`bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-300
                ${isDbModalMaximized 
                   ? 'w-full h-full rounded-none fixed inset-0 m-0' 
                   : 'w-full max-w-5xl rounded-2xl max-h-[90vh]'
                }
             `}
          >
            
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Database className="text-indigo-400" />
                 Archivio Cloud
               </h2>
               <div className="flex gap-2 items-center">
                 {dbView !== 'list' && (
                    <button onClick={() => { setDbView('list'); setImportStep('upload'); }} className="px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">
                      Indietro
                    </button>
                 )}
                 <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>
                 
                 {/* Maximize/Minimize Button */}
                 <button 
                   onClick={() => setIsDbModalMaximized(!isDbModalMaximized)} 
                   className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg hidden md:block"
                   title={isDbModalMaximized ? "Riduci" : "Espandi a tutto schermo"}
                 >
                   {isDbModalMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                 </button>

                 <button onClick={() => setShowDbModal(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
                   <X size={20} />
                 </button>
               </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex">
              
              {/* Sidebar (Client List) */}
              <div className={`${isDbModalMaximized ? 'w-1/4 max-w-xs' : 'w-1/3'} border-r border-slate-800 flex flex-col bg-slate-900/50`}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                   <span className="text-xs font-bold text-slate-500 uppercase">Clienti</span>
                   <button 
                     onClick={() => setDbView('add_client')}
                     className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors" 
                     title="Aggiungi Cliente"
                   >
                     <Plus size={16} />
                   </button>
                </div>
                {/* Client Search */}
                <div className="p-2 px-3 border-b border-slate-800/50">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-500"/>
                        <input 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Cerca Cliente..."
                            value={clientSearchTerm}
                            onChange={(e) => setClientSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredClients.map(client => (
                    <div 
                      key={client.id}
                      className={`group flex items-center justify-between p-3 rounded-xl transition-all ${selectedClientId === client.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <button
                        onClick={() => setSelectedClientId(client.id)}
                        className="flex-1 text-left flex items-center gap-3 truncate"
                      >
                        <User size={16} className={selectedClientId === client.id ? "text-indigo-200" : "text-slate-600"} />
                        <span className="font-medium truncate">{client.name}</span>
                      </button>

                      {/* Delete Client Button */}
                      {confirmDeleteClientId === client.id ? (
                        <button
                          disabled={isDeletingClientId === client.id}
                          onClick={() => executeDeleteClient(client.id)}
                          className="ml-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold hover:bg-red-700 animate-fadeIn"
                        >
                          {isDeletingClientId === client.id ? <Loader2 size={12} className="animate-spin" /> : "CONFERMA"}
                        </button>
                      ) : (
                        <button
                           onClick={(e) => {
                             e.stopPropagation();
                             setConfirmDeleteClientId(client.id);
                             setTimeout(() => setConfirmDeleteClientId(null), 3000);
                           }}
                           className={`p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all ${selectedClientId === client.id ? 'text-indigo-200 hover:text-white' : 'text-slate-500'}`}
                        >
                           <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-sm">
                        {clientSearchTerm ? "Nessun risultato." : "Nessun cliente."}
                    </div>
                  )}
                </div>
                {/* Bulk Import Button in Sidebar Footer */}
                 <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={() => { setDbView('import_csv'); setImportStep('upload'); }}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wide rounded-lg flex items-center justify-center gap-2 border border-slate-700"
                    >
                        <FileSpreadsheet size={14} /> Importa CSV / Access
                    </button>
                 </div>
              </div>

              {/* Main Area */}
              <div className="flex-1 flex flex-col bg-slate-900 relative">
                
                {/* VIEW: LIST (Pipettes) */}
                {dbView === 'list' && (
                  <>
                    {selectedClientId ? (
                      <>
                        <div className="p-4 bg-slate-800/30 flex flex-col gap-4 border-b border-slate-800">
                           <div className="flex justify-between items-center">
                               <div className="flex gap-2">
                                    <button
                                    onClick={handleSaveToDb}
                                    disabled={isSavingDb}
                                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                                    >
                                    {isSavingDb ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />}
                                    {isSavingDb ? "Salvataggio..." : "Salva Corrente Qui"}
                                    </button>

                                    <button
                                    onClick={() => setIsAddingPipette(!isAddingPipette)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border ${isAddingPipette ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 text-indigo-400 border-slate-700 hover:bg-indigo-900/20'}`}
                                    >
                                    {isAddingPipette ? <X size={14}/> : <PlusCircle size={14}/>}
                                    {isAddingPipette ? "Annulla" : "Nuova Pipetta"}
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                        if (!storedPipettes.length) return;
                                        const clientName = clients.find(c => c.id === selectedClientId)?.name || "Cliente";
                                        generateClientListPDF(clientName, storedPipettes);
                                        }}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-2"
                                    >
                                        <List size={14}/> Lista PDF
                                    </button>
                                    <button
                                        onClick={() => {
                                        setShowLabelDateModal(true);
                                        }}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-2"
                                    >
                                        <Tags size={14}/> Etichette
                                    </button>
                                </div>
                           </div>
                           
                           {/* Pipette Filter */}
                           <div className="relative w-full">
                                <Search size={14} className="absolute left-3 top-2.5 text-slate-500"/>
                                <input 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Cerca Matricola, Modello, Costruttore..."
                                    value={pipetteSearchTerm}
                                    onChange={(e) => setPipetteSearchTerm(e.target.value)}
                                />
                           </div>
                        </div>

                        {/* Inline Add Pipette Form */}
                        {isAddingPipette && (
                           <div className="p-4 border-b border-indigo-500/30 bg-indigo-900/10 animate-slideIn">
                              <h3 className="text-sm font-bold text-indigo-400 mb-3">Aggiungi Nuova Pipetta Vuota</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                 <input 
                                    placeholder="Costruttore" 
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    value={newPipetteForm.manufacturer}
                                    onChange={e => setNewPipetteForm({...newPipetteForm, manufacturer: e.target.value})}
                                 />
                                 <input 
                                    placeholder="Modello" 
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    value={newPipetteForm.model}
                                    onChange={e => setNewPipetteForm({...newPipetteForm, model: e.target.value})}
                                 />
                                 <input 
                                    placeholder="Matricola" 
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    value={newPipetteForm.serialNumber}
                                    onChange={e => setNewPipetteForm({...newPipetteForm, serialNumber: e.target.value})}
                                 />
                                 <div className="flex gap-2">
                                    <input 
                                       placeholder="Volume" 
                                       className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white flex-1"
                                       value={newPipetteForm.nominalVolume}
                                       onChange={e => setNewPipetteForm({...newPipetteForm, nominalVolume: e.target.value})}
                                    />
                                    <select
                                       className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white w-20"
                                       value={newPipetteForm.nominalVolumeUnit}
                                       onChange={e => setNewPipetteForm({...newPipetteForm, nominalVolumeUnit: e.target.value as any})}
                                    >
                                       <option value="ul">µl</option>
                                       <option value="ml">ml</option>
                                    </select>
                                 </div>
                                 <select 
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    value={newPipetteForm.type}
                                    onChange={e => setNewPipetteForm({...newPipetteForm, type: e.target.value as any})}
                                 >
                                    <option value="FIXED">Fissa</option>
                                    <option value="VARIABLE">Variabile</option>
                                 </select>
                                 <button
                                    onClick={handleDirectAddPipette}
                                    disabled={isSavingDb}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-sm flex items-center justify-center gap-2"
                                 >
                                    {isSavingDb ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                                    Crea
                                 </button>
                              </div>
                           </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                           {isLoadingDb ? (
                             <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500"/></div>
                           ) : filteredPipettes.length === 0 ? (
                             <div className="text-center text-slate-500 py-10">
                                {pipetteSearchTerm ? "Nessuna pipetta trovata con questi filtri." : "Nessuna pipetta per questo cliente."}
                             </div>
                           ) : (
                             filteredPipettes.map(pipette => (
                               <div key={pipette.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-indigo-500/50 transition-all flex justify-between items-center group">
                                 <div>
                                   <div className="flex items-center gap-2">
                                     {!pipette.user_id && <div className="w-2 h-2 rounded-full bg-red-500" title="Missing UserID owner"></div>}
                                     <h4 className="font-bold text-white">{pipette.manufacturer} {pipette.model}</h4>
                                     <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">{pipette.nominal_volume} {pipette.full_data.nominalVolumeUnit || 'µl'}</span>
                                   </div>
                                   <div className="text-sm text-slate-400 mt-1 flex items-center gap-4">
                                     <span className="font-mono text-slate-500">S/N: {pipette.serial_number}</span>
                                     <span>Data: {new Date(pipette.last_calibrated).toLocaleDateString()}</span>
                                   </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <button 
                                     onClick={() => handleLoadFromDb(pipette)}
                                     className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors text-xs font-bold px-3"
                                   >
                                     CARICA
                                   </button>
                                   
                                   {/* Delete Confirmation Button */}
                                   {confirmDeleteId === pipette.id ? (
                                      <button 
                                        onClick={() => handleDeletePipette(pipette.id)}
                                        className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-700 animate-fadeIn flex items-center gap-2"
                                        disabled={isDeletingId === pipette.id}
                                      >
                                        {isDeletingId === pipette.id ? <Loader2 size={12} className="animate-spin" /> : "CONFERMA?"}
                                      </button>
                                   ) : (
                                      <button 
                                        onClick={() => {
                                           setConfirmDeleteId(pipette.id);
                                           // Auto-reset after 3s
                                           setTimeout(() => setConfirmDeleteId(null), 3000);
                                        }}
                                        className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                                        title="Elimina"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                   )}
                                 </div>
                               </div>
                             ))
                           )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <FolderOpen size={48} className="mb-4 opacity-20" />
                        <p>Seleziona un cliente per visualizzare le pipette</p>
                      </div>
                    )}
                  </>
                )}

                {/* VIEW: ADD CLIENT */}
                {dbView === 'add_client' && (
                  <div className="p-8 max-w-lg mx-auto w-full">
                    <h2 className="text-2xl font-bold text-white mb-6">Nuovo Cliente</h2>
                    <div className="space-y-4">
                      <InputGroup 
                        label="Nome Cliente / Laboratorio" 
                        value={newClientName} 
                        onChange={(e) => setNewClientName(e.target.value)} 
                        placeholder="Es. Laboratorio Analisi Rossi"
                      />
                      
                      <div className="pt-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 ml-1 flex items-center gap-2">
                            User ID Proprietario <span className="text-[10px] bg-slate-800 px-1 rounded normal-case font-normal">(Opzionale)</span>
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-3 text-slate-500"/>
                            <input 
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-300 font-mono placeholder-slate-600 focus:border-indigo-500 outline-none"
                                value={newClientUserId}
                                onChange={(e) => setNewClientUserId(e.target.value)}
                                placeholder={session?.user?.id}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                            Lascia vuoto per assegnare a te stesso. Incolla un ID diverso per assegnare ad un altro account (se hai i permessi).
                            <br/>Il tuo ID: <span className="font-mono text-slate-400">{session?.user?.id}</span>
                        </p>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button 
                          onClick={handleAddClient}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all"
                        >
                          Crea Cliente
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                 {/* VIEW: IMPORT CSV (SMART) */}
                 {dbView === 'import_csv' && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/90 z-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileSpreadsheet className="text-emerald-400" size={24}/> Importazione Massiva
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">
                                  {importStep === 'upload' && "Carica il file (Excel/Access CSV)"}
                                  {importStep === 'mapping' && "Collega le colonne"}
                                  {importStep === 'processing' && "Elaborazione in corso..."}
                                  {importStep === 'finished' && "Importazione Completata"}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className={`mx-auto space-y-8 transition-all duration-300 ${isDbModalMaximized ? 'max-w-5xl' : 'max-w-3xl'}`}>
                                
                                {importStep === 'upload' && (
                                  <>
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                                        <div className="flex gap-4 items-start">
                                            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">1</div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-white mb-2">Carica il tuo file</h3>
                                                <p className="text-sm text-slate-400 mb-4">
                                                    Non preoccuparti dei nomi delle colonne. Se non li riconosco, ti chiederò di collegarli nel prossimo passaggio.
                                                </p>
                                                
                                                <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors bg-slate-900/50">
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        ref={csvInputRef}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if(file) handleFileSelect(file);
                                                            e.target.value = '';
                                                        }}
                                                        className="hidden"
                                                        id="csv-upload"
                                                    />
                                                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-3">
                                                        <UploadCloud size={32} className="text-slate-500"/>
                                                        <span className="text-indigo-400 font-medium">Clicca per caricare il CSV</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-center">
                                       <button onClick={downloadCsvTemplate} className="text-xs text-slate-500 underline hover:text-slate-300">
                                          Scarica modello standard (facoltativo)
                                       </button>
                                    </div>
                                  </>
                                )}

                                {importStep === 'mapping' && (
                                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 animate-fadeIn">
                                     <h3 className="font-bold text-white mb-4">Mappatura Colonne</h3>
                                     <p className="text-sm text-slate-400 mb-6">
                                        Per favore, indica a quale colonna del tuo file corrispondono i campi del database.
                                     </p>

                                     <div className="space-y-4">
                                        {[
                                          { id: 'client_name', label: 'Cliente / Laboratorio', req: true },
                                          { id: 'serial_number', label: 'Matricola (S/N)', req: true },
                                          { id: 'manufacturer', label: 'Costruttore', req: false },
                                          { id: 'model', label: 'Modello', req: false },
                                          { id: 'nominal_volume', label: 'Volume Nominale', req: false },
                                          { id: 'unit', label: 'Unità (ul/ml)', req: false },
                                          { id: 'type', label: 'Tipo (Fissa/Variabile)', req: false },
                                        ].map((field) => (
                                          <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-b border-slate-700/50 pb-4">
                                             <div>
                                                <span className="text-sm font-medium text-slate-200">{field.label}</span>
                                                {field.req && <span className="text-red-400 ml-1">*</span>}
                                             </div>
                                             <div className="flex flex-col gap-1">
                                                <select
                                                className={`bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white outline-none ${
                                                    (columnMapping as any)[field.id] ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-600'
                                                }`}
                                                value={(columnMapping as any)[field.id]}
                                                onChange={(e) => setColumnMapping({...columnMapping, [field.id]: e.target.value})}
                                                >
                                                    <option value="">-- Seleziona colonna --</option>
                                                    {csvHeaders.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                                {/* Preview Value */}
                                                {(columnMapping as any)[field.id] && csvRows.length > 0 && (
                                                    <span className="text-[10px] text-slate-500 px-1 truncate">
                                                        Esempio: <span className="text-slate-300">{csvRows[0][(columnMapping as any)[field.id]] || '(vuoto)'}</span>
                                                    </span>
                                                )}
                                             </div>
                                          </div>
                                        ))}
                                     </div>

                                     <div className="mt-8 flex justify-end gap-3">
                                        <button 
                                          onClick={() => setImportStep('upload')}
                                          className="px-4 py-2 text-slate-400 hover:text-white"
                                        >
                                          Annulla
                                        </button>
                                        <button 
                                          onClick={executeImport}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2"
                                        >
                                          Conferma Importazione <ArrowRightCircle size={18}/>
                                        </button>
                                     </div>
                                  </div>
                                )}
                                
                                {importStep === 'processing' && (
                                    <div className="flex flex-col items-center justify-center py-12 animate-fadeIn">
                                        <Loader2 size={48} className="animate-spin text-indigo-500 mb-6" />
                                        <h3 className="text-xl font-bold text-white mb-2">Elaborazione in corso...</h3>
                                        <p className="text-slate-400 text-sm">Sto analizzando il file e importando i dati nel database.</p>
                                    </div>
                                )}

                                {importStep === 'finished' && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center animate-fadeIn">
                                        <div className="flex justify-center mb-6">
                                            <div className="bg-emerald-500/20 p-4 rounded-full">
                                                <CheckCircle2 size={48} className="text-emerald-500" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Importazione Completata</h3>
                                        <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                            L'operazione è terminata. Puoi vedere i dettagli nel log qui sotto oppure andare direttamente all'elenco delle pipette.
                                        </p>
                                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                                             <button 
                                                onClick={() => { setDbView('list'); setImportStep('upload'); }}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                                             >
                                                <Database size={18} /> Vai all'Archivio
                                             </button>
                                             <button 
                                                onClick={() => { setImportStep('upload'); setImportLog([]); setCsvRows([]); setCsvHeaders([]); }}
                                                className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                             >
                                                <UploadCloud size={18} /> Importa altro file
                                             </button>
                                        </div>
                                    </div>
                                )}

                                {/* Log Output */}
                                {importLog.length > 0 && (
                                    <div className="bg-black/40 border border-slate-800 rounded-xl p-4 font-mono text-xs h-48 overflow-y-auto">
                                        {importLog.map((log, i) => (
                                            <div key={i} className={`mb-1 ${log.includes('ERRORE') ? 'text-red-400' : log.includes('Saltata') ? 'text-yellow-500' : 'text-slate-400'}`}>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                 )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PDF OPTIONS MODAL --- */}
      {showPdfConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-xl p-6">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-white">Opzioni PDF</h2>
                 <button onClick={() => setShowPdfConfigModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>

              <div className="space-y-6">
                 {/* Theme Selection */}
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Tema Colori</label>
                    <div className="grid grid-cols-4 gap-3">
                       <button 
                         onClick={() => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, colorTheme: 'default' } }))}
                         className={`h-12 rounded-lg bg-gradient-to-br from-violet-700 to-indigo-800 border-2 ${data.pdfOptions?.colorTheme === 'default' ? 'border-white' : 'border-transparent opacity-60'}`}
                         title="Default Viola"
                       />
                       <button 
                         onClick={() => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, colorTheme: 'blue' } }))}
                         className={`h-12 rounded-lg bg-gradient-to-br from-blue-700 to-sky-800 border-2 ${data.pdfOptions?.colorTheme === 'blue' ? 'border-white' : 'border-transparent opacity-60'}`}
                         title="Corporate Blue"
                       />
                       <button 
                         onClick={() => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, colorTheme: 'grayscale' } }))}
                         className={`h-12 rounded-lg bg-gradient-to-br from-gray-700 to-slate-800 border-2 ${data.pdfOptions?.colorTheme === 'grayscale' ? 'border-white' : 'border-transparent opacity-60'}`}
                         title="Bianco e Nero"
                       />
                       <button 
                         onClick={() => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, colorTheme: 'custom' } }))}
                         className={`h-12 rounded-lg bg-slate-800 border-2 flex items-center justify-center ${data.pdfOptions?.colorTheme === 'custom' ? 'border-white' : 'border-slate-600 opacity-60'}`}
                         title="Personalizzato"
                       >
                         <span className="text-xs font-bold">CUSTOM</span>
                       </button>
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                       {data.pdfOptions?.colorTheme === 'default' ? 'Viola (Default)' : 
                        data.pdfOptions?.colorTheme === 'blue' ? 'Corporate Blue' : 
                        data.pdfOptions?.colorTheme === 'grayscale' ? 'Bianco e Nero (Stampa)' : 'Colori Personalizzati'}
                    </p>
                 </div>

                 {/* Custom Colors Inputs (Only show if Custom is selected) */}
                 {data.pdfOptions?.colorTheme === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 animate-fadeIn bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Primario</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" 
                                    value={data.pdfOptions.customPrimaryColor || '#000000'}
                                    onChange={(e) => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, customPrimaryColor: e.target.value } }))}
                                    className="h-10 w-full rounded cursor-pointer bg-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Secondario</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" 
                                    value={data.pdfOptions.customSecondaryColor || '#666666'}
                                    onChange={(e) => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, customSecondaryColor: e.target.value } }))}
                                    className="h-10 w-full rounded cursor-pointer bg-transparent"
                                />
                            </div>
                        </div>
                    </div>
                 )}
                 
                 {/* Logo Upload */}
                 <div className="pt-4 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Logo Aziendale</label>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                            {data.pdfOptions?.customLogoBase64 ? (
                                <img src={data.pdfOptions.customLogoBase64} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <ImageIcon size={24} className="text-slate-600" />
                            )}
                        </div>
                        <div className="flex-1">
                            <input 
                                type="file" 
                                accept="image/*"
                                className="hidden" 
                                id="logo-upload"
                                ref={logoInputRef}
                                onChange={handleLogoUpload}
                            />
                            <div className="flex gap-2">
                                <label 
                                    htmlFor="logo-upload"
                                    className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <UploadCloud size={14}/> Carica
                                </label>
                                {data.pdfOptions?.customLogoBase64 && (
                                    <button 
                                        onClick={() => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, customLogoBase64: '' } }))}
                                        className="px-3 py-2 bg-red-900/20 text-red-400 rounded-lg text-xs font-medium border border-red-900/30 hover:bg-red-900/40 transition-colors"
                                    >
                                        Rimuovi
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">Formato consigliato: PNG trasparente. Max 1MB.</p>
                        </div>
                    </div>
                 </div>

                 {/* Toggles */}
                 <div className="space-y-3 pt-4 border-t border-slate-800">
                    <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition-colors">
                       <div className={`w-5 h-5 rounded border flex items-center justify-center ${data.pdfOptions?.includeCharts ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-500'}`}>
                          {data.pdfOptions?.includeCharts && <CheckSquare size={14} />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden" 
                         checked={data.pdfOptions?.includeCharts}
                         onChange={e => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, includeCharts: e.target.checked } }))}
                       />
                       <span className="text-sm font-medium">Includi Grafici nel Report</span>
                    </label>
                 </div>

                 {/* Chart Scaling Manual Overrides */}
                 <div className="pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Scala Grafici (Opzionale)</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Lasciare vuoto per calcolo automatico.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup 
                            label="Y Min" 
                            value={data.pdfOptions?.chartYMin || ''} 
                            onChange={e => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, chartYMin: parseFloat(e.target.value) || '' } }))} 
                            type="number" 
                            placeholder="Auto"
                        />
                        <InputGroup 
                            label="Y Max" 
                            value={data.pdfOptions?.chartYMax || ''} 
                            onChange={e => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, chartYMax: parseFloat(e.target.value) || '' } }))} 
                            type="number" 
                            placeholder="Auto"
                        />
                    </div>
                 </div>

                 {/* Signatures */}
                 <div className="pt-4 border-t border-slate-800 space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Firme Footer</h3>
                    <InputGroup 
                       label="Nome Operatore" 
                       value={data.pdfOptions?.operatorName || ''}
                       onChange={e => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, operatorName: e.target.value } }))}
                       placeholder="Es. Mario Rossi"
                    />
                    <InputGroup 
                       label="Approvato da" 
                       value={data.pdfOptions?.approverName || ''}
                       onChange={e => setData(d => ({ ...d, pdfOptions: { ...d.pdfOptions!, approverName: e.target.value } }))}
                       placeholder="Es. Resp. Laboratorio"
                    />
                 </div>

                 <button 
                   onClick={() => setShowPdfConfigModal(false)}
                   className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl mt-4"
                 >
                    Salva Opzioni
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- LABEL PRINTING MODAL --- */}
      {showLabelDateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-xl p-6 animate-scaleIn">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Tags size={20} className="text-indigo-400"/> Stampa Etichette
                 </h2>
                 <button onClick={() => setShowLabelDateModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>

              <div className="space-y-4">
                 <p className="text-sm text-slate-400">
                    Genera un foglio A4 di etichette adesive (layout compatto 4 colonne x 14mm).
                 </p>

                 <InputGroup 
                    label="Data Taratura" 
                    value={labelDateInput} 
                    onChange={e => setLabelDateInput(e.target.value)} 
                    type="date"
                 />
                 
                 <InputGroup 
                    label="Numero Totale Etichette" 
                    value={labelTotalCount} 
                    onChange={e => setLabelTotalCount(parseInt(e.target.value) || 1)} 
                    type="number"
                 />

                 <div className="pt-2">
                    <button 
                       onClick={() => {
                          generateLabelsPDF(labelDateInput, labelTotalCount);
                          setShowLabelDateModal(false);
                       }}
                       className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                    >
                       <Printer size={18} /> Scarica PDF Etichette
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;