import React, { useState, useEffect } from 'react';
import { Shield, Download, Mail, Globe, CheckCircle2, XCircle, Plus, Trash2, FileText, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { COUNTRIES } from '../constants';

type Certification = {
  id: number;
  product_slug: string;
  name: string;
  certificate_url: string;
  soa_available: number;
  type: 'certificate' | 'report';
};

type CertSummary = {
  product_slug: string;
  is_applicable: number;
  summary: string;
};

export function Certifications() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [summary, setSummary] = useState<CertSummary | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState<CertSummary | null>(null);
  const [newCert, setNewCert] = useState<{ name: string; certificate_url: string; soa_available: boolean; type: 'certificate' | 'report' }>({ name: '', certificate_url: '', soa_available: false, type: 'certificate' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const country = useCountry();

  useEffect(() => {
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
      });
  }, [user]);

  const displayProducts = (user ? products : products.filter(p => p.is_applicable === 1)).filter(p => {
    if (country !== 'all' && (!p.countries || !p.countries.includes(country))) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (displayProducts.length > 0) {
      if (!selectedProduct || !displayProducts.find(p => p.slug === selectedProduct)) {
        setSelectedProduct(displayProducts[0].slug);
      }
    } else {
      setSelectedProduct(null);
    }
  }, [country, displayProducts, selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-certifications/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setSummary(data.summary);
          setCertifications(data.certifications || []);
          setEditSummary(data.summary || {
            product_slug: selectedProduct,
            is_applicable: 0,
            summary: ''
          });
        });
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('certifications'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/certifications', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ is_public: !isPublic })
      });
      if (res.ok) {
        refreshPublicPages();
        setToast({ message: `Page is now ${!isPublic ? 'public' : 'private'}`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to update page status', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSaveSummary = async () => {
    if (!selectedProduct || !editSummary) return;
    
    try {
      const res = await fetch(`/api/admin/product-certifications/${selectedProduct}/summary`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editSummary)
      });
      
      if (res.ok) {
        setSummary(editSummary);
        setIsEditing(false);
        setToast({ message: 'Overview updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to save overview', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAddCert = async () => {
    if (!selectedProduct || !newCert.name) return;
    
    try {
      const res = await fetch(`/api/admin/product-certifications/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newCert)
      });
      
      if (res.ok) {
        // Refresh certs
        const certsRes = await fetch(`/api/public/product-certifications/${selectedProduct}`);
        const data = await certsRes.json();
        setCertifications(data.certifications);
        setNewCert({ name: '', certificate_url: '', soa_available: false, type: 'certificate' });
        setToast({ message: 'Added successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to add', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteCert = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/product-certifications/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        setCertifications(certifications.filter(c => c.id !== id));
        setToast({ message: 'Certification deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete certification', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRequestSoA = (certName: string) => {
    const subject = encodeURIComponent(`Request for Statement of Applicability - ${certName}`);
    const body = encodeURIComponent(`Hello,\n\nI would like to request a copy of the Statement of Applicability for ${certName} related to ${products.find(p => p.slug === selectedProduct)?.name}.\n\nThank you.`);
    const email = siteSettings?.mailto_certifications || 'security@bjornlunden.com';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleRequestISAE = (certName: string) => {
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    const subject = encodeURIComponent(`Request for ISAE 3000 Report - ${productName}`);
    const body = encodeURIComponent(`Hello,\n\nI would like to request a copy of the ${certName} report for ${productName}.\n\nThank you.`);
    const email = siteSettings?.mailto_certifications || 'security@bjornlunden.com';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleSubscribeCertifications = () => {
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    const subject = encodeURIComponent(`Subscribe to Certification Updates - ${productName}`);
    const body = encodeURIComponent(`Hello,\n\nI would like to subscribe to notifications regarding new certifications and reports for ${productName}.\n\nThank you.`);
    const email = siteSettings?.mailto_certifications || 'security@bjornlunden.com';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Certifications and Reports</h1>
          <p className="text-slate-600 mt-1">Compliance, certifications, and reports for our product portfolio.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit Overview"}
              </Button>
              <Button 
                variant={isPublic ? "outline" : "primary"}
                onClick={togglePublic}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {isPublic ? "Make Private" : "Make Public"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Product Selector Buttons */}
      <div className="flex flex-wrap gap-3 py-3 -mx-4 px-4 md:mx-0 md:px-0">
        {displayProducts.map((product) => (
          <button
            key={product.slug}
            onClick={() => {
              setSelectedProduct(product.slug);
              setIsEditing(false);
            }}
            aria-pressed={selectedProduct === product.slug}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
              selectedProduct === product.slug
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {product.name}
          </button>
        ))}
      </div>

      {displayProducts.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Certifications or Reports Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            {products.length === 0 
              ? "There are currently no products with applicable certifications or reports to display."
              : "No products match your selected country filter."}
          </p>
        </div>
      )}

      {/* Applicability & Summary */}
      {selectedProduct && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700">
              <Shield className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Applicability</h2>
              <p className="text-slate-600 text-sm">Overview of compliance standards and reports for this product.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Status</span>
                {isEditing ? (
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Certification Status">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="is_applicable" 
                        checked={editSummary?.is_applicable === 1} 
                        onChange={() => setEditSummary(prev => prev ? {...prev, is_applicable: 1} : null)}
                        className="text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-800">Applicable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="is_applicable" 
                        checked={editSummary?.is_applicable === 0} 
                        onChange={() => setEditSummary(prev => prev ? {...prev, is_applicable: 0} : null)}
                        className="text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-800">Not Applicable</span>
                    </label>
                  </div>
                ) : (
                  summary?.is_applicable ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-2" aria-hidden="true" />
                      <span className="text-lg font-bold text-slate-900">Applicable</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <XCircle className="w-12 h-12 text-slate-400 mb-2" aria-hidden="true" />
                      <span className="text-lg font-bold text-slate-900">Not Applicable</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-900 mb-2">Overview</h4>
              {isEditing ? (
                <textarea
                  value={editSummary?.summary || ''}
                  onChange={(e) => setEditSummary(prev => prev ? {...prev, summary: e.target.value} : null)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[120px]"
                  placeholder="Enter a short overview of certifications for this product..."
                />
              ) : (
                <p className="text-slate-600 leading-relaxed">
                  {summary?.summary || "No specific certification overview provided for this product."}
                </p>
              )}
              
              {isEditing && (
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveSummary}>Save Overview</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certification List */}
      {selectedProduct && summary?.is_applicable === 1 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 px-2">Active Certifications and Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                      {cert.type === 'report' ? <FileText className="w-5 h-5" aria-hidden="true" /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
                    </div>
                    <h4 className="font-bold text-slate-900">{cert.name}</h4>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'moderator') && (
                    <button 
                      onClick={() => handleDeleteCert(cert.id)}
                      className="text-slate-500 hover:text-red-600 transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Delete ${cert.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-auto">
                  {cert.certificate_url && (
                    <a 
                      href={cert.certificate_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {cert.type === 'report' ? 'Download Report' : 'Download Certificate'}
                    </a>
                  )}
                  {cert.soa_available === 1 && (
                    <button 
                      onClick={() => handleRequestSoA(cert.name)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Request SoA
                    </button>
                  )}
                  {cert.name.includes('ISAE 3000') && (
                    <button 
                      onClick={() => handleRequestISAE(cert.name)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors mt-2 w-fit"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Request Report
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Admin Add Cert */}
            {(user?.role === 'admin' || user?.role === 'moderator') && (
              <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 flex flex-col gap-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5" /> Add Item
                </h4>
                <div className="space-y-2">
                  <select
                    value={newCert.type}
                    onChange={(e) => setNewCert({...newCert, type: e.target.value as 'certificate' | 'report'})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="certificate">Certification</option>
                    <option value="report">Report</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Name (e.g. ISO 27001 or SOC 2)"
                    value={newCert.name}
                    onChange={(e) => setNewCert({...newCert, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <input 
                    type="text" 
                    placeholder="Document URL"
                    value={newCert.certificate_url}
                    onChange={(e) => setNewCert({...newCert, certificate_url: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input 
                      type="checkbox" 
                      checked={newCert.soa_available}
                      onChange={(e) => setNewCert({...newCert, soa_available: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-sm text-slate-600">Statement of Applicability available</span>
                  </label>
                </div>
                <Button onClick={handleAddCert} className="w-full">Add to List</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProduct && summary?.is_applicable === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
          <div className="inline-flex p-4 bg-white rounded-full shadow-sm mb-4">
            <Shield className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Certifications or Reports Required</h3>
          <p className="text-slate-700 max-w-md mx-auto font-medium">
            This product does not currently require specific external certifications or reports based on its scope and data processing activities.
          </p>
        </div>
      )}

      {selectedProduct && summary?.is_applicable === 1 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-blue-900 mt-8">
          <h4 className="font-semibold mb-2">Subscribe to Certification Updates</h4>
          <p className="text-sm text-blue-800 mb-4">We will notify you when new certifications or reports are added or updated for this product.</p>
          <button 
            onClick={handleSubscribeCertifications}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Subscribe Now
          </button>
        </div>
      )}
    </div>
  );
}
