import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Filter } from 'lucide-react';
import { COUNTRIES } from '../constants';

type PageCountryFilterProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function PageCountryFilter({ value, onChange, className = "" }: PageCountryFilterProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // We only want to show confirmation if the value actually changes from a previous value
    // But since this is a controlled component, we need to track the previous value
  }, [value]);

  const handleChange = (newValue: string) => {
    if (newValue !== value) {
      onChange(newValue);
      setShowConfirmation(true);
      setTimeout(() => setShowConfirmation(false), 2000);
    }
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      <Filter className="w-5 h-5 text-slate-400" />
      <div className="relative">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="appearance-none px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white min-w-[180px] pr-10"
        >
          <option value="all">All Countries</option>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-full mt-2 left-0 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg flex items-center gap-1.5 whitespace-nowrap z-50"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Filter applied</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
