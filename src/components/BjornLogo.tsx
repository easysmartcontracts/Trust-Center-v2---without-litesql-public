import React from 'react';

export const BjornLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M22 2 L78 2 L98 55 L50 98 L2 55 Z" 
      fill="#F5A623" 
      stroke="#F5A623" 
      strokeWidth="4" 
      strokeLinejoin="round" 
    />
    <circle cx="50" cy="55" r="18" fill="#FFFFFF" />
    <path d="M36 46 Q50 40 64 46 Q64 56 50 56 Q36 56 36 46 Z" fill="#231F20" />
  </svg>
);
