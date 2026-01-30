
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { PipetteType, UiTheme } from '../types';
import { ArrowDownToLine, ArrowUpToLine, Target, Beaker, CheckCircle2, XCircle, AlertCircle, Gauge, Activity, Percent, Ruler, ShieldCheck, HelpCircle, X } from 'lucide-react';

interface Props {
  type: PipetteType;
  measurementsFixed: (number | '')[];
  measurementsVarMin: (number | '')[];
  measurementsVarMid: (number | '')[];
  measurementsVarMax: (number | '')[];
  onUpdate: (type: 'fixed' | 'min' | 'mid' | 'max', index: number, value: string) => void;
  zFactor: number | '';
  toleranceSystematic: number | '';
  toleranceRandom: number | '';
  nominalVolume: string;
  nominalVolumeUnit: 'ul' | 'ml';
  theme?: UiTheme;
}

const THEME_STYLES = {
  violet: { accent: 'text-violet-400', bgLight: 'bg-violet-500/15', focus: 'focus:border-violet-500 focus:ring-violet-500/20', hover: 'hover:border-violet-500/40', progress: 'bg-violet-500' },
  teal: { accent: 'text-teal-400', bgLight: 'bg-teal-500/15', focus: 'focus:border-teal-500 focus:ring-teal-500/20', hover: 'hover:border-teal-500/40', progress: 'bg-teal-500' },
  sky: { accent: 'text-sky-400', bgLight: 'bg-sky-500/15', focus: 'focus:border-sky-500 focus:ring-sky-500/20', hover: 'hover:border-sky-500/40', progress: 'bg-sky-500' },
  blue: { accent: 'text-blue-400', bgLight: 'bg-blue-500/15', focus: 'focus:border-blue-500 focus:ring-blue-500/20', hover: 'hover:border-blue-500/40', progress: 'bg-blue-500' }
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
  const style = THEME_STYLES[theme];
  return (
    <div className={`bg-black/20 p-5 rounded-[28px] border border-white/5 ${style.hover} transition-all duration-300 shadow-inner group/section`}>
      <h3 className="text-white/70 font-black mb-5 flex items-center gap-3">
        {icon && <span className={`p-2 rounded-xl ${style.bgLight} ${style.accent} group-hover/section:scale-110 transition-transform`}>{icon}</span>}
        <span className="flex-1 text-[11px] uppercase tracking-[0.2em]">{label}</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {values.map((val, idx) => {
          let isError = false;
          if (val !== '' && tol !== '' && target > 0) {
            if (Math.abs((val as number) * zFactor - target) > tol) isError = true;
          }
          return (
            <div key={idx} className="relative group">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[8px] text-white/20 font-black pointer-events-none group-focus-within:text-white/60">{idx + 1}</span>
              <input id={`${idPrefix}-${idx}`} type="number" value={val} onChange={(e) => onChange(idx, e.target.value)} 
                className={`w-full bg-black/40 border rounded-xl py-2.5 pl-7 pr-1 text-xs text-white focus:outline-none transition-all ${isError ? 'border-red-500/50 focus:ring-red-500/20 bg-red-900/10' : `border-white/10 ${style.focus} hover:border-white/20`}`}
                placeholder="0.000" step="0.0001" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string; value: string | number; unit: string; icon: ReactNode; status?: 'pass' | 'fail' | 'neutral';
  tolerance?: number; currentDiff?: number; explanation: string; theme: UiTheme;
}> = ({ label, value, unit, icon, status = 'neutral', tolerance, currentDiff, explanation, theme }) => {
  const style = THEME_STYLES[theme];
  const isPass = status === 'pass';
  const isFail = status === 'fail';
  const [showTooltip, setShowTooltip] = useState(false);
  const usage = (tolerance && currentDiff) ? Math.min(100, (Math.abs(currentDiff) / tolerance) * 100) : 0;

  return (
    <div className={`p-5 rounded-3xl border transition-all duration-300 relative group/kpi ${isFail ? 'bg-red-500/10 border-red-500/30' : isPass ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/20 border-white/5 shadow-lg'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${isFail ? 'bg-red-500/20 text-red-400' : isPass ? 'bg-emerald-500/20 text-emerald-400' : `${style.bgLight} ${style.accent}`}`}>{icon}</div>
        <HelpCircle size={14} className="text-white/10 group-hover/kpi:text-white/40 cursor-help" />
      </div>
      <div>
        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.1em] mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-black tracking-tighter ${isFail ? 'text-red-400' : isPass ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
          <span className="text-[10px] font-black text-white/20 uppercase">{unit}</span>
        </div>
      </div>
      {tolerance && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[8px] font-black text-white/30 uppercase tracking-tighter"><span>In Spec</span><span>{usage.toFixed(0)}%</span></div>
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
            <div className={`h-full transition-all duration-700 rounded-full ${isFail ? 'bg-red-500' : usage > 80 ? 'bg-amber-500' : style.progress}`} style={{ width: `${usage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

const StatsDashboard: React.FC<{
  data: (number | '')[]; zFactor: number | ''; targetVol: number; tolSys: number | ''; tolRand: number | ''; theme: UiTheme;
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
    <div className="mt-8 animate-in fade-in slide-in-from-top-6 duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard theme={theme} label="Volume Medio" value={meanVol.toFixed(3)} unit="µl" icon={<Beaker size={16} />} explanation="Volume medio erogato." />
        <KpiCard theme={theme} label="Err. Sist. (E)" value={inaccuracy.toFixed(3)} unit="µl" icon={<Activity size={16} />} status={isPassSys ? 'pass' : 'fail'} tolerance={Number(tolSys)} currentDiff={inaccuracy} explanation="Differenza dal nominale." />
        <KpiCard theme={theme} label="Err. Rel. (%)" value={(targetVol > 0 ? (inaccuracy/targetVol)*100 : 0).toFixed(2)} unit="%" icon={<Percent size={16} />} explanation="Errore percentuale." />
        <KpiCard theme={theme} label="Ripetib. (SD)" value={sd.toFixed(4)} unit="µl" icon={<Gauge size={16} />} status={isPassRand ? 'pass' : 'fail'} tolerance={Number(tolRand)} currentDiff={sd} explanation="Deviazione standard." />
        <KpiCard theme={theme} label="Incert. (k=2)" value={(sd * 2).toFixed(3)} unit="µl" icon={<ShieldCheck size={16} />} explanation="Incertezza estesa." />
      </div>
    </div>
  );
};

export const MeasurementSection: React.FC<Props> = ({ 
  type, measurementsFixed, measurementsVarMin, measurementsVarMid, measurementsVarMax, onUpdate, zFactor, toleranceSystematic, toleranceRandom, nominalVolume, nominalVolumeUnit, theme = 'violet'
}) => {
  let nomVol = parseFloat(nominalVolume) || 0; if (nominalVolumeUnit === 'ml') nomVol *= 1000;
  return (
    <div className="space-y-8">
      {type === PipetteType.FIXED ? (
        <div>
          <MeasurementInputs theme={theme} zFactor={Number(zFactor)||1} target={nomVol} tol={toleranceSystematic} idPrefix="f" values={measurementsFixed} onChange={(i, v) => onUpdate('fixed', i, v)} label="Volume Fisso (100%)" icon={<Target size={14} />} />
          <StatsDashboard theme={theme} data={measurementsFixed} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
        </div>
      ) : (
        <div className="space-y-12">
          {[
            { l: "Volume Minimo (10%)", v: measurementsVarMin, t: nomVol*0.1, id: "min", i: <ArrowDownToLine size={14}/> },
            { l: "Volume Medio (50%)", v: measurementsVarMid, t: nomVol*0.5, id: "mid", i: <Activity size={14}/> },
            { l: "Volume Massimo (100%)", v: measurementsVarMax, t: nomVol, id: "max", i: <ArrowUpToLine size={14}/> }
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
