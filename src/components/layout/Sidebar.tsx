import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, FileCheck, Lock, FileText, Settings, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string;
};

export function Sidebar({ isOpen, onClose, activeSection }: SidebarProps) {
  const { user, publicPages, siteSettings } = useAuth();
  const [activeModal, setActiveModal] = useState<'privacy' | 'cookie' | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          console.error('Expected array for products, got:', data);
          setProducts([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch products:', err);
        setProducts([]);
      });
  }, []);

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/' },
      ]
    },
    {
      title: 'Products',
      items: products.map(p => ({
        id: `product-${p.slug}`,
        label: p.name,
        path: `/product/${p.slug}`
      }))
    },
    {
      title: 'Security',
      items: [
        { id: 'security-overview', label: 'Security Overview', path: '/security-overview' },
        { id: 'controls', label: 'Controls', path: '/controls' },
      ]
    },
    {
      title: 'Compliance',
      items: [
        { id: 'certifications', label: 'Certifications and Reports', path: '/certifications' },
        { id: 'policies', label: 'Policies', path: '/policies' },
      ]
    },
    {
      title: 'Legal',
      items: [
        { id: 'legal', label: 'Legal Documents', path: '/legal' },
        { id: 'subprocessors', label: 'Subprocessors', path: '/subprocessors' },
      ]
    },
    {
      title: 'Documents',
      items: [
        { id: 'documents', label: 'All Documents', path: '/documents' },
      ]
    }
  ];

  const filterItems = (items: { id: string, label: string, path: string }[]) => {
    return items.filter(item => {
      if (user?.role === 'admin' || user?.role === 'moderator') return true;
      if (publicPages.includes(item.id)) return true;
      if (user?.role === 'viewer' && user.allowedModules?.includes(item.id)) return true;
      return false;
    });
  };

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: filterItems(group.items)
  })).filter(group => group.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200 
        overflow-y-auto transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <nav className="p-4 space-y-8" aria-label="Main Navigation">
          
          {/* Main Navigation Groups */}
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.title}>
                <h3 className="px-3 font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.path}
                        onClick={onClose}
                        aria-current={activeSection === item.id ? 'page' : undefined}
                        className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                          activeSection === item.id 
                            ? 'bg-slate-200 text-slate-900' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Admin Section */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div aria-label="Administration">
              <h3 className="px-3 font-bold text-slate-700 uppercase tracking-wider mb-2">
                Administration
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/admin"
                    onClick={onClose}
                    aria-current={activeSection === 'admin' ? 'page' : undefined}
                    className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                      activeSection === 'admin' 
                        ? 'bg-slate-200 text-slate-900' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Admin Portal
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/kpi"
                    onClick={onClose}
                    aria-current={activeSection === 'admin-kpi' ? 'page' : undefined}
                    className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                      activeSection === 'admin-kpi' 
                        ? 'bg-slate-200 text-slate-900' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    KPI Dashboard
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Legal Notices */}
          <div className="pt-4 border-t border-slate-200">
            <ul className="space-y-2">
              {siteSettings.privacy_notice && (
                <li>
                  <button
                    onClick={() => {
                      setActiveModal('privacy');
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Privacy Notice
                  </button>
                </li>
              )}
              {siteSettings.cookie_notice && (
                <li>
                  <button
                    onClick={() => {
                      setActiveModal('cookie');
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Cookie Notice
                  </button>
                </li>
              )}
            </ul>
          </div>

        </nav>
      </aside>

      <Modal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        title="Privacy Notice"
        maxWidth="max-w-3xl"
      >
        <div 
          className="prose prose-sm max-w-none text-slate-700"
          dangerouslySetInnerHTML={{ __html: siteSettings.privacy_notice || '' }}
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'cookie'}
        onClose={() => setActiveModal(null)}
        title="Cookie Notice"
        maxWidth="max-w-3xl"
      >
        <div 
          className="prose prose-sm max-w-none text-slate-700"
          dangerouslySetInnerHTML={{ __html: siteSettings.cookie_notice || '' }}
        />
      </Modal>
    </>
  );
}

