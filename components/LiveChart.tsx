
import React from 'react';

interface Props {
  data: (number | '')[];
  target: number;
  label: string;
  zFactor: number;
}

export const LiveChart: React.FC<Props> = ({ data, target, label, zFactor }) => {
  const values = data.filter((v): v is number => typeof v === 'number' && v > 0).map(v => v * zFactor);
  if (values.length === 0) return null;

  const width = 500;
  const height = 150;
  const padding = 40;

  const allPoints = [...values, target];
  let min = Math.min(...allPoints);
  let max = Math.max(...allPoints);
  
  // Aggiungi un piccolo margine
  const spread = max - min || target * 0.01;
  min -= spread * 0.2;
  max += spread * 0.2;
  const range = max - min;

  const getX = (i: number) => padding + (i * (width - 2 * padding) / (data.length - 1 || 1));
  const getY = (v: number) => height - padding - ((v - min) / (range || 1) * (height - 2 * padding));

  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  return (
    <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 my-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
          Andamento Live: {label}
        </h4>
        <span className="text-[10px] font-mono text-slate-400">Valore Target: {target.toFixed(2)} µl</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
        {/* Linee di griglia orizzontali */}
        {[0, 0.5, 1].map(f => {
          const val = min + f * range;
          const y = getY(val);
          return (
            <g key={f}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padding - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="500">{val.toFixed(2)}</text>
            </g>
          );
        })}
        
        {/* Linea Target (Nominale) */}
        <line x1={padding} y1={getY(target)} x2={width - padding} y2={getY(target)} stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
        
        {/* Percorso delle misure */}
        <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="drop-shadow-lg" />
        
        {/* Punti (Cerchi) */}
        {values.map((v, i) => (
          <g key={i} className="group cursor-help">
            <circle cx={getX(i)} cy={getY(v)} r="4" fill="#8b5cf6" className="transition-all group-hover:r-6" />
            <circle cx={getX(i)} cy={getY(v)} r="2" fill="white" />
          </g>
        ))}
      </svg>
    </div>
  );
};
