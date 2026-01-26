
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
}> = ({ values, onChange, label, icon, idPrefix }) => {
  
  // Handle Enter key to jump to next input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextId = `${idPrefix}-${index + 1}`;
      const nextInput = document.getElementById(nextId);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-violet-500/30 transition-colors duration-300">
      <h3 className="text-violet-300 font-semibold mb-3 flex items-center gap-2.5">
        {icon && <span className="text-violet-400 opacity-80">{icon}</span>}
        <span className="flex-1">{label}</span>
        <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-600 flex items-center gap-1">
          <CheckCircle2 size={10} className={values.filter(v => typeof v === 'number').length === values.length ? "text-green-500" : "text-slate-500"} />
          {values.length} Misure
        </span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {values.map((val, idx) => (
          <div key={idx} className="relative group">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">
              {idx + 1}
            </span>
            <input
              id={`${idPrefix}-${idx}`}
              type="number"
              value={val}
              onChange={(e) => onChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-6 pr-2 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all placeholder-slate-600"
              placeholder="mg"
              step="0.0001"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- PASS/FAIL BADGE COMPONENT ---
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
  
  // Calculate Stats
  const volumes = validNums.map(m => m * z);
  const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  
  // SD
  const squaredDiffs = volumes.map(v => Math.pow(v - meanVol, 2));
  const variance = validNums.length > 1 ? squaredDiffs.reduce((a, b) => a + b, 0) / (validNums.length - 1) : 0;
  const sd = Math.sqrt(variance);

  // Inaccuracy
  const inaccuracy = meanVol - targetVol;

  const displayMean = meanVol.toFixed(4);

  // If no tolerances set, just show mean
  if (tolSys === '' || tolRand === '' || targetVol <= 0) {
     return (
        <div className="flex justify-end text-sm text-slate-400 items-center gap-2 px-1 mt-2">
           <span>Media: <span className="text-white font-mono font-medium">{displayMean} µl</span></span>
           <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">No Limits</span>
        </div>
     );
  }

  const isSysOk = Math.abs(inaccuracy) <= tolSys;
  const isRandOk = sd <= tolRand;
  const isPass = isSysOk && isRandOk;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mt-2 px-1 gap-2">
       {/* Details (Optional, simplified for UI) */}
       <div className="text-[10px] text-slate-500 hidden sm:flex gap-3">
          <span title="Inaccuratezza">E: <span className={isSysOk ? "text-slate-300" : "text-red-400"}>{inaccuracy.toFixed(3)}</span></span>
          <span title="Deviazione Standard">SD: <span className={isRandOk ? "text-slate-300" : "text-red-400"}>{sd.toFixed(3)}</span></span>
       </div>

       <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Media: <span className="text-white font-mono font-medium">{displayMean} µl</span></span>
          
          {isPass ? (
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
              <CheckCircle2 size={12} /> PASS
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/50 text-red-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
              <XCircle size={12} /> NO PASS
            </div>
          )}
       </div>
    </div>
  );
};


export const MeasurementSection: React.FC<Props> = ({ 
  type, fixedData, varMinData, varMidData, varMaxData, onUpdate, zFactor,
  toleranceSystematic, toleranceRandom, nominalVolume, nominalVolumeUnit
}) => {
  
  // Normalize volume to µl for calculation of targets
  let nomVol = parseFloat(nominalVolume) || 0;
  if (nominalVolumeUnit === 'ml') {
    nomVol = nomVol * 1000;
  }
  
  // Targets in µl
  const targetFixed = nomVol;
  const targetMin = nomVol * 0.1;
  const targetMid = nomVol * 0.5;
  const targetMax = nomVol;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
           Inserimento Masse
           <span className="text-xs font-normal text-slate-400 px-2 py-0.5 bg-slate-800 rounded border border-slate-700">mg</span>
        </h2>
        {(Number(zFactor) === 1 || !zFactor) && <span className="text-yellow-500 text-xs flex items-center gap-1"><AlertCircle size={12}/> Fattore Z non impostato</span>}
      </div>

      {type === PipetteType.FIXED ? (
        <div className="space-y-4">
          <MeasurementInputs 
            idPrefix="measure-fixed"
            values={fixedData} 
            onChange={(idx, val) => onUpdate('fixed', idx, val)} 
            label="Misure Volume Fisso" 
            icon={<Beaker size={18} />}
          />
          <ResultBadge 
             data={fixedData} 
             zFactor={zFactor} 
             targetVol={targetFixed} 
             tolSys={toleranceSystematic} 
             tolRand={toleranceRandom} 
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <MeasurementInputs 
              idPrefix="measure-min"
              values={varMinData} 
              onChange={(idx, val) => onUpdate('min', idx, val)} 
              label={`Volume Minimo (${targetMin} µl)`}
              icon={<ArrowDownToLine size={18} />}
            />
            <ResultBadge 
             data={varMinData} 
             zFactor={zFactor} 
             targetVol={targetMin} 
             tolSys={toleranceSystematic} 
             tolRand={toleranceRandom} 
            />
          </div>

          <div className="space-y-2">
            <MeasurementInputs 
              idPrefix="measure-mid"
              values={varMidData} 
              onChange={(idx, val) => onUpdate('mid', idx, val)} 
              label={`Volume Intermedio (${targetMid} µl)`}
              icon={<Target size={18} />}
            />
            <ResultBadge 
             data={varMidData} 
             zFactor={zFactor} 
             targetVol={targetMid} 
             tolSys={toleranceSystematic} 
             tolRand={toleranceRandom} 
            />
          </div>

          <div className="space-y-2">
            <MeasurementInputs 
              idPrefix="measure-max"
              values={varMaxData} 
              onChange={(idx, val) => onUpdate('max', idx, val)} 
              label={`Volume Massimo (${targetMax} µl)`} 
              icon={<ArrowUpToLine size={18} />}
            />
            <ResultBadge 
             data={varMaxData} 
             zFactor={zFactor} 
             targetVol={targetMax} 
             tolSys={toleranceSystematic} 
             tolRand={toleranceRandom} 
            />
          </div>
        </div>
      )}
    </div>
  );
};