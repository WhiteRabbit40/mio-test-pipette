
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { PipetteType, UiTheme } from '../types';
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
  theme?: UiTheme;
}

const THEME_ACCENTS = {
  violet: 'text-violet-400 bg-violet-500/10 focus:border-violet-500 focus:ring-violet-500/20',
  teal: 'text-teal-400 bg-teal-500/10 focus:border-teal-500 focus:ring-teal-500/20',
  sky: 'text-sky-400 bg-sky-500/10 focus:border-sky-500 focus:ring-sky-500/20',
  blue: 'text-blue-400 bg-blue-500/10 focus:border-blue-500 focus:ring-blue-500/20'
};

const MeasurementInputs: React.FC<{
  values: (number | '')[];
  onChange: (index: number, val: string) => void;
  label: string;
  icon?: ReactNode;
  idPrefix: string;
  zFactor: number;
  target: number;
  tol: number | '';
  theme: UiTheme;
}> = ({ values, onChange, label, icon, idPrefix, zFactor, target, tol, theme }) => {
  return (
    <div className={`bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 hover:border-${theme}-500/30 transition-all duration-300 shadow-inner`}>
      <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2.5">
        {icon && <span className={`p-1.5 rounded-lg ${THEME_ACCENTS[theme].split(' ')[1]} ${THEME_ACCENTS[theme].split(' ')[0]}`}>{icon}</span>}
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
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 font-bold pointer-events-none group-focus-within:text-indigo-400">{idx + 1}</span>
              <input id={`${idPrefix}-${idx}`} type="number" value={val} onChange={(e) => onChange(idx, e.target.value)} 
                className={`w-full bg-slate-900/50 border rounded-xl py-2 pl-6 pr-1 text-xs text-white focus:outline-none transition-all ${isError ? 'border-red-500/50 focus:ring-red-500/20 bg-red-950/10' : `border-slate-700 ${THEME_ACCENTS[theme].split(' ').slice(2).join(' ')} hover:border-slate-600`}`}
                placeholder="0.000" step="0.0001" />
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
  theme: UiTheme;
}> = ({ label, value, unit, icon, status = 'neutral', tolerance, currentDiff, explanation, theme }) => {
  const isPass = status === 'pass';
  const isFail = status === 'fail';
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toleranceUsage = (tolerance && currentDiff) ? Math.min(100, (Math.abs(currentDiff) / tolerance) * 100) : 0;

  const toggleTooltip = (e: React.MouseEvent) => { e.stopPropagation(); setShowTooltip(!showTooltip); };
  useEffect(() => {
    if (showTooltip) {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setShowTooltip(false), 10000);
    }
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); };
  }, [showTooltip]);

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-300 relative group ${isFail ? 'bg-red-500/5 border-red-500/20' : isPass ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/20 border-slate-700/50'}`}>
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-3 w-64 bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-4 z-[50] animate-in fade-in zoom-in-95 backdrop-blur-xl">
           <div className="flex justify-between items-start mb-2">
             <span className={`text-[10px] font-black uppercase tracking-widest text-${theme}-400`}>Info</span>
             <button onClick={() => setShowTooltip(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
           </div>
           <p className="text-xs text-slate-300 font-medium leading-relaxed">{explanation}</p>
        </div>
      )}
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-xl ${isFail ? 'bg-red-500/10 text-red-400' : isPass ? 'bg-emerald-500/10 text-emerald-400' : `bg-${theme}-500/10 text-${theme}-400`}`}>{icon}</div>
        <button onClick={toggleTooltip} className="p-1 text-slate-600 hover:text-white transition-colors"><HelpCircle size={14} /></button>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-black tracking-tight ${isFail ? 'text-red-400' : isPass ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
          <span className="text-[10px] font-bold text-slate-600">{unit}</span>
        </div>
      </div>
      {tolerance && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase"><span>Uso Tolleranza</span><span>{toleranceUsage.toFixed(0)}%</span></div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${isFail ? 'bg-red-500' : toleranceUsage > 80 ? 'bg-amber-500' : `bg-${theme}-500`}`} style={{ width: `${toleranceUsage}%` }} />
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
  theme: UiTheme;
}> = ({ data, zFactor, targetVol, tolSys, tolRand, theme }) => {
  const validNums = data.filter((n): n is number => typeof n === 'number');
  if (validNums.length === 0) return null;
  const z = Number(zFactor) || 1;
  const volumes = validNums.map(m => m * z);
  const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const inaccuracy = meanVol - targetVol;
  const sd = Math.sqrt(validNums.length > 1 ? volumes.map(v => Math.pow(v - meanVol, 2)).reduce((a, b) => a + b, 0) / (validNums.length - 1) : 0);
  const isPassSys = tolSys === '' ? true : Math.abs(inaccuracy) <= tolSys;
  const isPassRand = tolRand === '' ? true : sd <= tolRand;

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-2 mb-4 px-1"><div className="h-px flex-1 bg-slate-800"></div><span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Risultati</span><div className="h-px flex-1 bg-slate-800"></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard theme={theme} label="Vol. Medio" value={meanVol.toFixed(3)} unit="µl" icon={<Beaker size={16} />} explanation="Volume medio erogato." />
        <KpiCard theme={theme} label="Err. Sist. (E)" value={inaccuracy.toFixed(3)} unit="µl" icon={<Activity size={16} />} status={isPassSys ? 'pass' : 'fail'} tolerance={Number(tolSys)} currentDiff={inaccuracy} explanation="Differenza dal nominale." />
        <KpiCard theme={theme} label="Err. Rel. (E%)" value={(targetVol > 0 ? (inaccuracy/targetVol)*100 : 0).toFixed(2)} unit="%" icon={<Percent size={16} />} explanation="Errore in percentuale." />
        <KpiCard theme={theme} label="Imprecis. (SD)" value={sd.toFixed(4)} unit="µl" icon={<Gauge size={16} />} status={isPassRand ? 'pass' : 'fail'} tolerance={Number(tolRand)} currentDiff={sd} explanation="Deviazione standard." />
        <KpiCard theme={theme} label="Incert. (k=2)" value={(sd * 2).toFixed(3)} unit="µl" icon={<ShieldCheck size={16} />} explanation="Incertezza estesa." />
      </div>
    </div>
  );
};

export const MeasurementSection: React.FC<Props> = ({ 
  type, fixedData, varMinData, varMidData, varMaxData, onUpdate, zFactor, toleranceSystematic, toleranceRandom, nominalVolume, nominalVolumeUnit, theme = 'violet'
}) => {
  let nomVol = parseFloat(nominalVolume) || 0; if (nominalVolumeUnit === 'ml') nomVol *= 1000;
  return (
    <div className="space-y-6">
      {type === PipetteType.FIXED ? (
        <div>
          <MeasurementInputs theme={theme} zFactor={Number(zFactor)||1} target={nomVol} tol={toleranceSystematic} idPrefix="f" values={fixedData} onChange={(i, v) => onUpdate('fixed', i, v)} label="Volume Fisso" icon={<Beaker size={14} />} />
          <StatsDashboard theme={theme} data={fixedData} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
        </div>
      ) : (
        <div className="space-y-10">
          {[
            { l: "Min (10%)", v: varMinData, t: nomVol*0.1, id: "min", i: <ArrowDownToLine size={14}/> },
            { l: "Medio (50%)", v: varMidData, t: nomVol*0.5, id: "mid", i: <Target size={14}/> },
            { l: "Max (100%)", v: varMaxData, t: nomVol, id: "max", i: <ArrowUpToLine size={14}/> }
          ].map(s => (
            <div key={s.id} className="space-y-4">
              <MeasurementInputs theme={theme} zFactor={Number(zFactor)||1} target={s.t} tol={toleranceSystematic} idPrefix={s.id} values={s.v} onChange={(i, v) => onUpdate(s.id as any, i, v)} label={s.l} icon={s.i} />
              <StatsDashboard theme={theme} data={s.v} zFactor={zFactor} targetVol={s.t} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
