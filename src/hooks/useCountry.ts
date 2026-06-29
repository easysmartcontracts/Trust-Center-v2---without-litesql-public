import { useState, useEffect } from 'react';

export function useCountry() {
  const [country, setCountry] = useState(localStorage.getItem('country') || 'all');

  useEffect(() => {
    const handleCountryChange = () => {
      setCountry(localStorage.getItem('country') || 'all');
    };
    window.addEventListener('country-change', handleCountryChange);
    return () => window.removeEventListener('country-change', handleCountryChange);
  }, []);

  return country;
}
