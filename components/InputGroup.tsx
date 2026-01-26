import React, { ReactNode } from 'react';

interface InputGroupProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  step?: string;
  className?: string;
  icon?: ReactNode;
  unit?: string;
  readOnly?: boolean;
}

export const InputGroup: React.FC<InputGroupProps> = ({ 
  label, value, onChange, type = "text", placeholder, step, className, icon, unit, readOnly = false
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative group">
        {/* Icon (Left) */}
        {icon && (
          <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${readOnly ? 'text-slate-500' : 'text-slate-400 group-focus-within:text-violet-400'}`}>
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
              ? 'border-slate-700 bg-slate-800/50 text-slate-400 cursor-not-allowed focus:ring-0' 
              : 'border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 hover:border-slate-500'
            }
          `}
        />
        
        {/* Unit (Right) */}
        {unit && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <span className="text-xs font-medium text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};