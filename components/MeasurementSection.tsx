
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { PipetteType } from '../types';
import { ArrowDownToLine, ArrowUpToLine, Target, Beaker, CheckCircle2, XCircle, AlertCircle, Gauge, Activity, Percent, Ruler, ShieldCheck, HelpCircle, X } from 'lucide-react';

interface Props {
  type: PipetteType;
  fixedData: (number | '')[];
  varMinData: (number | '')[];
  varMidData: (number | '')[];
  varMaxData: (number | '')[];
  onUpdate: (type: 'fixed' | 'min' | 'mid' | 'max', index: number, value: string) => void;
  zFactor: number | '';
  toleranceSystematic: number | '';
  toleranceRandom: number | '';
  nominalVolume: string;
  nominalVolumeUnit: 'ul' | 'ml';
}

const MeasurementInputs: React.FC<{
  values: (number | '')[];
  onChange: (index: number, val: string) => void;
  label: string;
  icon?: ReactNode;
  idPrefix: string;
  zFactor: number;
  target: number;
  tol: number | '';
}> = ({ values, onChange, label, icon, idPrefix, zFactor, target, tol }) => {
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = document.getElementById(`${idPrefix}-${index + 1}`);
      if (next) next.focus();
    }
  };

  return (
    <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 hover:border-violet-500/30 transition-all duration-300 shadow-inner">
      <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2.5">
        {icon && <span className="text-violet-400 p-1.5 bg-violet-500/10 rounded-lg">{icon}</span>}
        <span className="flex-1 text-xs uppercase tracking-wider">{label}</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {values.map((val, idx) => {
          let isError = false;
          if (val !== '' && tol !== '' && target > 0) {
            const vol = (val as number) * zFactor;
            if (Math.abs(vol - target) > tol) isError = true;
          }

          return (
            <div key={idx} className="relative group">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 font-bold pointer-events-none group-focus-within:text-violet-500">
                {idx + 1}
              </span>
              <input
                id={`${idPrefix}-${idx}`}
                type="number"
                value={val}
                onChange={(e) => onChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`w-full bg-slate-900/50 border rounded-xl py-2 pl-6 pr-1 text-xs text-white focus:outline-none transition-all ${isError ? 'border-red-500/50 focus:ring-red-500/20 bg-red-950/10' : 'border-slate-700 focus:ring-violet-500/20 focus:border-violet-500 hover:border-slate-600'}`}
                placeholder="0.000"
                step="0.0001"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  unit: string;
  icon: ReactNode;
  status?: 'pass' | 'fail' | 'neutral';
  tolerance?: number;
  currentDiff?: number;
  explanation: string;
}> = ({ label, value, unit, icon, status = 'neutral', tolerance, currentDiff, explanation }) => {
  const isPass = status === 'pass';
  const isFail = status === 'fail';
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<NodeJS.Timeout | null>(null);
  
  const toleranceUsage = (tolerance && currentDiff) ? Math.min(100, (Math.abs(currentDiff) / tolerance) * 100) : 0;

  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  useEffect(() => {
    if (showTooltip) {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setShowTooltip(false), 10000);
    }
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); };
  }, [showTooltip]);

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-300 relative group ${
      isFail ? 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-950/20' : 
      isPass ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-950/10' : 
      'bg-slate-800/20 border-slate-700/50'
    }`}>
      {/* Tooltip Popup */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-3 w-64 bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-4 z-[50] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
           <div className="flex justify-between items-start mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Info Parametro</span>
             <button onClick={() => setShowTooltip(false)} className="text-slate-500 hover:text-white transition-colors">
               <X size={14} />
             </button>
           </div>
           <p className="text-xs text-slate-300 leading-relaxed font-medium">{explanation}</p>
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-xl ${isFail ? 'bg-red-500/10 text-red-400' : isPass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-slate-400'}`}>
          {icon}
        </div>
        <div className="flex gap-1.5 items-center">
          <button 
            onClick={toggleTooltip}
            className="p-1 text-slate-600 hover:text-violet-400 transition-colors"
            title="Spiegazione parametro"
          >
            <HelpCircle size={14} />
          </button>
          {status !== 'neutral' && (
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${isPass ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {isPass ? 'In Spec' : 'Out Spec'}
            </div>
          )}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-black tracking-tight ${isFail ? 'text-red-400' : isPass ? 'text-emerald-400' : 'text-white'}`}>
            {value}
          </span>
          <span className="text-[10px] font-bold text-slate-600">{unit}</span>
        </div>
      </div>
      
      {tolerance && (
        <div className="mt-3">
          <div className="flex justify-between text-[8px] font-bold uppercase text-slate-600 mb-1">
            <span>Uso Tolleranza</span>
            <span>{toleranceUsage.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${isFail ? 'bg-red-500' : toleranceUsage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${toleranceUsage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const StatsDashboard: React.FC<{
  data: (number | '')[];
  zFactor: number | '';
  targetVol: number;
  tolSys: number | '';
  tolRand: number | '';
}> = ({ data, zFactor, targetVol, tolSys, tolRand }) => {
  const validNums = data.filter((n): n is number => typeof n === 'number');
  if (validNums.length === 0) return null;
  
  const z = Number(zFactor) || 1;
  const volumes = validNums.map(m => m * z);
  const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const squaredDiffs = volumes.map(v => Math.pow(v - meanVol, 2));
  const variance = validNums.length > 1 ? squaredDiffs.reduce((a, b) => a + b, 0) / (validNums.length - 1) : 0;
  const sd = Math.sqrt(variance);
  const inaccuracy = meanVol - targetVol;
  const relInaccuracy = targetVol > 0 ? (inaccuracy / targetVol) * 100 : 0;
  
  const isPassSys = tolSys === '' ? true : Math.abs(inaccuracy) <= tolSys;
  const isPassRand = tolRand === '' ? true : sd <= tolRand;

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="h-px flex-1 bg-slate-800"></div>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Analisi Statistica Live</span>
        <div className="h-px flex-1 bg-slate-800"></div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard 
          label="Volume Medio" 
          value={meanVol.toFixed(3)} 
          unit="µl" 
          icon={<Beaker size={16} />} 
          explanation="La media aritmetica dei volumi erogati calcolati applicando il fattore Z alla massa rilevata."
        />
        <KpiCard 
          label="Errore Sist. (E)" 
          value={inaccuracy.toFixed(3)} 
          unit="µl" 
          icon={<Activity size={16} />}
          status={isPassSys ? 'pass' : 'fail'}
          tolerance={Number(tolSys)}
          currentDiff={inaccuracy}
          explanation="La differenza tra il volume medio calcolato e il volume nominale (o target) impostato."
        />
        <KpiCard 
          label="Errore Rel. (E%)" 
          value={relInaccuracy.toFixed(2)} 
          unit="%" 
          icon={<Percent size={16} />} 
          explanation="L'errore sistematico espresso come percentuale del valore nominale."
        />
        <KpiCard 
          label="Imprecisione (SD)" 
          value={sd.toFixed(4)} 
          unit="µl" 
          icon={<Gauge size={16} />}
          status={isPassRand ? 'pass' : 'fail'}
          tolerance={Number(tolRand)}
          currentDiff={sd}
          explanation="La deviazione standard delle misure. Indica il grado di ripetibilità dello strumento."
        />
        <KpiCard 
          label="Incertezza (k=2)" 
          value={(sd * 2).toFixed(3)} 
          unit="µl" 
          icon={<ShieldCheck size={16} />} 
          explanation="L'incertezza estesa con fattore di copertura k=2, che fornisce un intervallo di confidenza di circa il 95%."
        />
      </div>
    </div>
  );
};

export const MeasurementSection: React.FC<Props> = ({ 
  type, fixedData, varMinData, varMidData, varMaxData, onUpdate, zFactor,
  toleranceSystematic, toleranceRandom, nominalVolume, nominalVolumeUnit
}) => {
  let nomVol = parseFloat(nominalVolume) || 0;
  if (nominalVolumeUnit === 'ml') nomVol *= 1000;
  const z = Number(zFactor) || 1;

  return (
    <div className="space-y-6">
      {type === PipetteType.FIXED ? (
        <div>
          <MeasurementInputs zFactor={z} target={nomVol} tol={toleranceSystematic} idPrefix="f" values={fixedData} onChange={(i, v) => onUpdate('fixed', i, v)} label="Volume Fisso" icon={<Beaker size={14} />} />
          <StatsDashboard data={fixedData} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
        </div>
      ) : (
        <div className="space-y-10">
          <div className="space-y-4">
            <MeasurementInputs zFactor={z} target={nomVol*0.1} tol={toleranceSystematic} idPrefix="min" values={varMinData} onChange={(i, v) => onUpdate('min', i, v)} label="Volume Minimo (10%)" icon={<ArrowDownToLine size={14} />} />
            <StatsDashboard data={varMinData} zFactor={zFactor} targetVol={nomVol*0.1} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
          
          <div className="space-y-4">
            <MeasurementInputs zFactor={z} target={nomVol*0.5} tol={toleranceSystematic} idPrefix="mid" values={varMidData} onChange={(i, v) => onUpdate('mid', i, v)} label="Volume Medio (50%)" icon={<Target size={14} />} />
            <StatsDashboard data={varMidData} zFactor={zFactor} targetVol={nomVol*0.5} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
          
          <div className="space-y-4">
            <MeasurementInputs zFactor={z} target={nomVol} tol={toleranceSystematic} idPrefix="max" values={varMaxData} onChange={(i, v) => onUpdate('max', i, v)} label="Volume Massimo (100%)" icon={<ArrowUpToLine size={14} />} />
            <StatsDashboard data={varMaxData} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
        </div>
      )}
    </div>
  );
};
