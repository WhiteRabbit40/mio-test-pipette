
import React, { ReactNode } from 'react';
import { UiTheme } from '../types';

interface InputGroupProps {
  label: string;
  value: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  step?: string;
  className?: string;
  icon?: ReactNode;
  unit?: string;
  readOnly?: boolean;
  theme?: UiTheme;
}

const THEME_STYLES = {
  violet: { 
    focus: 'focus:ring-violet-500/50 focus:border-violet-500', 
    icon: 'group-focus-within:text-violet-400',
    bg: 'bg-black/20'
  },
  teal: { 
    focus: 'focus:ring-teal-500/50 focus:border-teal-500', 
    icon: 'group-focus-within:text-teal-400',
    bg: 'bg-[#115e59]/30'
  },
  sky: { 
    focus: 'focus:ring-sky-500/50 focus:border-sky-500', 
    icon: 'group-focus-within:text-sky-400',
    bg: 'bg-[#0369a1]/30'
  },
  blue: { 
    focus: 'focus:ring-blue-500/50 focus:border-blue-500', 
    icon: 'group-focus-within:text-blue-400',
    bg: 'bg-[#1e40af]/30'
  }
};

export const InputGroup: React.FC<InputGroupProps> = ({ 
  label, value, onChange, type = "text", placeholder, step, className, icon, unit, readOnly = false, theme = 'violet'
}) => {
  const styles = THEME_STYLES[theme];
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${readOnly ? 'text-slate-500' : `text-slate-400 ${styles.icon}`}`}>
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          step={step}
          className={`
            w-full ${styles.bg} border rounded-xl py-3 text-white placeholder-white/20 
            transition-all duration-200 backdrop-blur-sm
            ${icon ? 'pl-10' : 'pl-3'} 
            ${unit ? 'pr-12' : 'pr-3'}
            ${readOnly 
              ? 'border-white/5 text-white/40 cursor-not-allowed' 
              : `border-white/10 focus:outline-none focus:ring-2 ${styles.focus} hover:border-white/30`
            }
          `}
        />
        {unit && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <span className="text-[10px] font-bold text-white/40 bg-white/5 px-1.5 py-0.5 rounded uppercase">{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};
