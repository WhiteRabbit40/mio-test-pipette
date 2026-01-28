
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to today
  const selectedDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  // Adjust for Monday start (0=Sun -> 0=Mon, 6=Sun)
  const getAdjustedFirstDay = (day: number) => (day === 0 ? 6 : day - 1);

  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const formatted = newDate.toISOString().split('T')[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day &&
           selectedDate.getMonth() === viewDate.getMonth() &&
           selectedDate.getFullYear() === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day &&
           today.getMonth() === viewDate.getMonth() &&
           today.getFullYear() === viewDate.getFullYear();
  };

  const renderDays = () => {
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getAdjustedFirstDay(firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()));
    const days = [];

    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-9 w-9"></div>);
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const selected = isSelected(d);
      const today = isToday(d);
      
      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateSelect(d)}
          className={`
            h-9 w-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center
            ${selected 
              ? 'ring-2 ring-emerald-500 bg-violet-600 text-white shadow-lg shadow-emerald-500/20' 
              : today 
                ? 'text-violet-400 bg-violet-500/10' 
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }
          `}
        >
          {d}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="flex flex-col relative" ref={containerRef}>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-slate-800 border border-slate-600 rounded-xl py-3 pl-10 pr-4 text-left text-sm text-white
          hover:border-slate-500 transition-all flex items-center justify-between group
          ${isOpen ? 'ring-2 ring-violet-500/50 border-violet-500' : ''}
        `}
      >
        <CalendarIcon className={`absolute left-3 transition-colors ${isOpen ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-400'}`} size={16} />
        <span className={value ? 'text-white' : 'text-slate-500'}>
          {value ? new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Seleziona data...'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-4 z-[150] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-bold text-white uppercase tracking-tight">
              {months[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'].map(d => (
              <div key={d} className="text-[10px] font-bold text-slate-500 text-center uppercase py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {renderDays()}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between">
             <button 
               type="button" 
               onClick={() => { onChange(new Date().toISOString().split('T')[0]); setIsOpen(false); }}
               className="text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest"
             >
               Oggi
             </button>
             <button 
               type="button" 
               onClick={() => setIsOpen(false)}
               className="text-[10px] font-bold text-slate-500 hover:text-slate-400 uppercase tracking-widest"
             >
               Chiudi
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
