
import React, { ReactNode } from 'react';
import { UiTheme } from '../types';

interface InputGroupProps {
  label: string;
  value: string | number;
  // Made optional to satisfy read-only usage in App.tsx
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

const THEME_FOCUS = {
  violet: 'focus:ring-violet-500/50 focus:border-violet-500',
  teal: 'focus:ring-teal-500/50 focus:border-teal-500',
  sky: 'focus:ring-sky-500/50 focus:border-sky-500',
  blue: 'focus:ring-blue-500/50 focus:border-blue-500'
};

const THEME_ICON = {
  violet: 'group-focus-within:text-violet-400',
  teal: 'group-focus-within:text-teal-400',
  sky: 'group-focus-within:text-sky-400',
  blue: 'group-focus-within:text-blue-400'
};

export const InputGroup: React.FC<InputGroupProps> = ({ 
  label, value, onChange, type = "text", placeholder, step, className, icon, unit, readOnly = false, theme = 'violet'
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${readOnly ? 'text-slate-500' : `text-slate-400 ${THEME_ICON[theme]}`}`}>
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
            w-full bg-slate-800 border rounded-xl py-3 text-white placeholder-slate-500 
            transition-all duration-200
            ${icon ? 'pl-10' : 'pl-3'} 
            ${unit ? 'pr-12' : 'pr-3'}
            ${readOnly 
              ? 'border-slate-700 bg-slate-800/50 text-slate-400 cursor-not-allowed' 
              : `border-slate-600 focus:outline-none focus:ring-2 ${THEME_FOCUS[theme]} hover:border-slate-500`
            }
          `}
        />
        {unit && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <span className="text-xs font-medium text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};