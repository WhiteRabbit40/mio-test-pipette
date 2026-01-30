
import React from 'react';
import { UiTheme } from '../types';

interface Props {
  data: (number | '')[];
  target: number;
  label: string;
  zFactor: number;
  theme?: UiTheme;
}

const THEME_COLORS = {
  violet: '#8b5cf6',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  blue: '#3b82f6'
};

export const LiveChart: React.FC<Props> = ({ data, target, label, zFactor, theme = 'violet' }) => {
  const values = data.filter((v): v is number => typeof v === 'number' && v > 0).map(v => v * zFactor);
  if (values.length === 0) return null;

  const width = 600;
  const height = 180;
  const paddingL = 50;
  const paddingR = 20;
  const paddingT = 30;
  const paddingB = 30;
  const activeColor = THEME_COLORS[theme];

  const allPoints = [...values, target];
  let min = Math.min(...allPoints);
  let max = Math.max(...allPoints);
  const spread = max - min || target * 0.01;
  min -= spread * 0.3;
  max += spread * 0.3;
  const range = max - min;

  const getX = (i: number) => paddingL + (i * (width - paddingL - paddingR) / 9);
  const getY = (v: number) => height - paddingB - ((v - min) / (range || 1) * (height - paddingT - paddingB));
  
  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  return (
    <div className="bg-black/40 p-6 rounded-[32px] border border-white/5 my-6 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ backgroundColor: activeColor }}></div>
          <h4 className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em]">
            Analisi Real-Time: {label}
          </h4>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Target</span>
            <span className="text-xs font-mono text-white/80">{target.toFixed(2)} µl</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Ultima</span>
            <span className="text-xs font-mono text-white" style={{ color: activeColor }}>{values[values.length - 1].toFixed(3)} µl</span>
          </div>
        </div>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
        {/* Griglia orizzontale */}
        <line x1={paddingL} y1={getY(target)} x2={width - paddingR} y2={getY(target)} stroke={activeColor} strokeWidth="1" strokeDasharray="6 4" opacity="0.3" />
        <text x={paddingL - 10} y={getY(target) + 3} textAnchor="end" className="text-[10px] fill-white/20 font-mono">{target.toFixed(1)}</text>
        
        {/* Griglia verticale */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
          <g key={i}>
            <line x1={getX(i)} y1={paddingT} x2={getX(i)} y2={height - paddingB} stroke="white" strokeWidth="0.5" opacity="0.05" />
            <text x={getX(i)} y={height - 10} textAnchor="middle" className="text-[10px] fill-white/20 font-bold">{i + 1}</text>
          </g>
        ))}

        {/* Linea dati */}
        <polyline points={points} fill="none" stroke={activeColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
        
        {/* Punti dati */}
        {values.map((v, i) => (
          <g key={i} className="group cursor-help">
            <circle cx={getX(i)} cy={getY(v)} r="5" fill={activeColor} className="transition-all duration-300 hover:r-7" />
            <circle cx={getX(i)} cy={getY(v)} r="2" fill="white" />
          </g>
        ))}
      </svg>
    </div>
  );
};
