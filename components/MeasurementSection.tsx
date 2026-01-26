
import React, { ReactNode } from 'react';
import { PipetteType } from '../types';
import { ArrowDownToLine, ArrowUpToLine, Target, Beaker, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

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
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-violet-500/30 transition-colors duration-300">
      <h3 className="text-violet-300 font-semibold mb-3 flex items-center gap-2.5">
        {icon && <span className="text-violet-400 opacity-80">{icon}</span>}
        <span className="flex-1 text-sm">{label}</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {values.map((val, idx) => {
          // Validazione singola cella
          let isError = false;
          if (val !== '' && tol !== '' && target > 0) {
            const vol = (val as number) * zFactor;
            if (Math.abs(vol - target) > tol) isError = true;
          }

          return (
            <div key={idx} className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-mono pointer-events-none">
                {idx + 1}
              </span>
              <input
                id={`${idPrefix}-${idx}`}
                type="number"
                value={val}
                onChange={(e) => onChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`w-full bg-slate-900 border rounded-lg py-1.5 pl-5 pr-1 text-xs text-white focus:outline-none transition-all ${isError ? 'border-red-500/50 focus:ring-red-500 bg-red-950/20' : 'border-slate-700 focus:ring-violet-500 focus:border-violet-500'}`}
                placeholder="mg"
                step="0.0001"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ResultBadge: React.FC<{
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
  const isPass = (tolSys === '' || tolRand === '' || targetVol <= 0) ? true : (Math.abs(inaccuracy) <= tolSys && sd <= tolRand);

  return (
    <div className="flex justify-between items-center mt-2 px-1">
       <div className="text-[10px] text-slate-500 flex gap-2">
          <span>E: {inaccuracy.toFixed(3)}</span>
          <span>SD: {sd.toFixed(3)}</span>
       </div>
       <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-mono">{meanVol.toFixed(3)} µl</span>
          <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {isPass ? 'OK' : 'FAIL'}
          </div>
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
    <div className="space-y-4">
      {type === PipetteType.FIXED ? (
        <div className="space-y-1">
          <MeasurementInputs zFactor={z} target={nomVol} tol={toleranceSystematic} idPrefix="f" values={fixedData} onChange={(i, v) => onUpdate('fixed', i, v)} label="Volume Fisso" icon={<Beaker size={14} />} />
          <ResultBadge data={fixedData} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <MeasurementInputs zFactor={z} target={nomVol*0.1} tol={toleranceSystematic} idPrefix="min" values={varMinData} onChange={(i, v) => onUpdate('min', i, v)} label="10% Vol" icon={<ArrowDownToLine size={14} />} />
            <ResultBadge data={varMinData} zFactor={zFactor} targetVol={nomVol*0.1} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
          <div className="space-y-1">
            <MeasurementInputs zFactor={z} target={nomVol*0.5} tol={toleranceSystematic} idPrefix="mid" values={varMidData} onChange={(i, v) => onUpdate('mid', i, v)} label="50% Vol" icon={<Target size={14} />} />
            <ResultBadge data={varMidData} zFactor={zFactor} targetVol={nomVol*0.5} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
          <div className="space-y-1">
            <MeasurementInputs zFactor={z} target={nomVol} tol={toleranceSystematic} idPrefix="max" values={varMaxData} onChange={(i, v) => onUpdate('max', i, v)} label="100% Vol" icon={<ArrowUpToLine size={14} />} />
            <ResultBadge data={varMaxData} zFactor={zFactor} targetVol={nomVol} tolSys={toleranceSystematic} tolRand={toleranceRandom} />
          </div>
        </div>
      )}
    </div>
  );
};
