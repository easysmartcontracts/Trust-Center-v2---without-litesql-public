import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { COUNTRIES } from '../constants';

export function CountrySelector() {
  const [country, setCountry] = useState(localStorage.getItem('country') || 'all');
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const prevCountry = localStorage.getItem('country');
    if (prevCountry && prevCountry !== country) {
      setShowConfirmation(true);
      const timer = setTimeout(() => setShowConfirmation(false), 2000);
      localStorage.setItem('country', country);
      window.dispatchEvent(new Event('country-change'));
      return () => clearTimeout(timer);
    }
    localStorage.setItem('country', country);
    window.dispatchEvent(new Event('country-change'));
  }, [country]);

  return (
    <div className="relative flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5">
        <span className="text-sm font-medium text-slate-700">Purchase Region:</span>
        <div className="relative group flex items-center">
          <Info className="w-4 h-4 text-slate-400 cursor-help" />
          <div className="absolute top-full lg:-left-1/2 left-0 lg:ml-2 mt-2 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            Your selected region determines your Terms of Service and available Support channels. Please select the country where you purchased your product.
          </div>
        </div>
      </div>
      
      <div className="relative flex items-center">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="appearance-none bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 cursor-pointer pr-8"
        >
          <option value="all">🌍 Global</option>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code.toUpperCase()}
            </option>
          ))}
        </select>
        <div className="absolute right-2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-full mt-2 right-0 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg flex items-center gap-2 whitespace-nowrap z-50"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Country updated</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
