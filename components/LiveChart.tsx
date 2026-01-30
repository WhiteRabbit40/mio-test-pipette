
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

  const width = 500;
  const height = 150;
  const padding = 40;
  const activeColor = THEME_COLORS[theme];

  const allPoints = [...values, target];
  let min = Math.min(...allPoints);
  let max = Math.max(...allPoints);
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
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeColor }}></div>
          Andamento: {label}
        </h4>
        <span className="text-[10px] font-mono text-slate-400">{target.toFixed(2)} µl</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
        <line x1={padding} y1={getY(target)} x2={width - padding} y2={getY(target)} stroke={activeColor} strokeWidth="1" strokeDasharray="6 4" opacity="0.3" />
        <polyline points={points} fill="none" stroke={activeColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="drop-shadow-lg" />
        {values.map((v, i) => (
          <circle key={i} cx={getX(i)} cy={getY(v)} r="3.5" fill={activeColor} />
        ))}
      </svg>
    </div>
  );
};
