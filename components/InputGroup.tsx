
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
  violet: { focus: 'focus:ring-violet-500/30 focus:border-violet-500', icon: 'group-focus-within:text-violet-400', bg: 'bg-black/20' },
  teal: { focus: 'focus:ring-teal-500/30 focus:border-teal-500', icon: 'group-focus-within:text-teal-400', bg: 'bg-teal-900/20' },
  sky: { focus: 'focus:ring-sky-500/30 focus:border-sky-500', icon: 'group-focus-within:text-sky-400', bg: 'bg-sky-900/20' },
  blue: { focus: 'focus:ring-blue-500/30 focus:border-blue-500', icon: 'group-focus-within:text-blue-400', bg: 'bg-blue-900/20' }
};

export const InputGroup: React.FC<InputGroupProps> = ({ 
  label, value, onChange, type = "text", placeholder, step, className, icon, unit, readOnly = false, theme = 'violet'
}) => {
  const styles = THEME_STYLES[theme];
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.1em] mb-2 ml-1">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${readOnly ? 'text-white/20' : `text-white/30 ${styles.icon}`}`}>
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
            w-full ${styles.bg} border rounded-2xl py-3.5 text-sm text-white placeholder-white/10 
            transition-all duration-300 backdrop-blur-sm font-medium
            ${icon ? 'pl-11' : 'pl-4'} 
            ${unit ? 'pr-14' : 'pr-4'}
            ${readOnly 
              ? 'border-white/5 text-white/40 cursor-not-allowed italic' 
              : `border-white/10 focus:outline-none focus:ring-4 ${styles.focus} hover:border-white/20`
            }
          `}
        />
        {unit && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <span className="text-[9px] font-black text-white/20 bg-white/5 px-2 py-1 rounded-lg uppercase tracking-tighter">{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};
