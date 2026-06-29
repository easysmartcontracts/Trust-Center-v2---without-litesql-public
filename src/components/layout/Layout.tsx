import React, { useState } from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function Layout({ children, activeSection }: { children: React.ReactNode, activeSection: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="print:hidden">
        <TopNav 
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
      </div>
      
      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        <div className="print:hidden">
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            activeSection={activeSection}
          />
        </div>
        
        <main id="main-content" className="flex-1 lg:ml-64 print:ml-0 overflow-y-auto print:overflow-visible bg-slate-50/50 print:bg-white outline-none flex flex-col" tabIndex={-1}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 print:py-0 flex-1 w-full">
            {children}
          </div>
        </main>
      </div>

      <Modal 
        isOpen={isAccessModalOpen} 
        onClose={() => setIsAccessModalOpen(false)}
        title="Request Document Access"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsAccessModalOpen(false); }}>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Work Email</label>
            <input 
              type="email" 
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Company</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Company Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Reason for Access</label>
            <textarea 
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              rows={3}
              placeholder="Please describe why you need access to restricted documents..."
            ></textarea>
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setIsAccessModalOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
