import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Globe, Server, Mail, Activity, Trash2, Plus, Check, AlertCircle, History, ShieldCheck, Filter, ExternalLink, Info, Pencil, FileText } from 'lucide-react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useCountry } from '../hooks/useCountry';
import { COUNTRIES } from '../constants';

const categoryIcons: Record<string, React.ReactNode> = {
  'Hosting': <Server className="w-4 h-4" />,
  'Email Services': <Mail className="w-4 h-4" />,
  'Monitoring': <Activity className="w-4 h-4" />
};

type Subprocessor = {
  id: number;
  product_slug: string;
  name: string;
  category: string;
  region: string;
  purpose: string;
  website_url?: string;
  contact_details?: string;
  org_number?: string;
  lei_number?: string;
  nature_of_processing?: string;
  data_categories?: string;
  certifications?: string;
  dpa_url?: string;
  dpa_requestable?: number;
  countries?: string[];
};

type HistoryEntry = {
  id: number;
  product_slug: string;
  version: string;
  date: string;
  description: string;
};

export function Subprocessors() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(slug || null);
  const [subprocessors, setSubprocessors] = useState<Subprocessor[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [inspectingSub, setInspectingSub] = useState<Subprocessor | null>(null);
  
  // Admin states
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [editingSub, setEditingSub] = useState<Subprocessor | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Hosting',
    region: '',
    purpose: '',
    website_url: '',
    contact_details: '',
    org_number: '',
    lei_number: '',
    nature_of_processing: '',
    data_categories: '',
    certifications: '',
    dpa_url: '',
    dpa_requestable: false,
    countries: [] as string[]
  });
  const [newSub, setNewSub] = useState({ 
    name: '', 
    category: 'Hosting', 
    region: '', 
    purpose: '', 
    website_url: '', 
    contact_details: '',
    org_number: '',
    lei_number: '',
    nature_of_processing: '',
    data_categories: '',
    certifications: '',
    dpa_url: '',
    dpa_requestable: false,
    countries: [] as string[] 
  });
  
  const startEditSub = (sub: Subprocessor) => {
    setEditingSub(sub);
    setEditForm({
      name: sub.name,
      category: sub.category || 'Hosting',
      region: sub.region || '',
      purpose: sub.purpose || '',
      website_url: sub.website_url || '',
      contact_details: sub.contact_details || '',
      org_number: sub.org_number || '',
      lei_number: sub.lei_number || '',
      nature_of_processing: sub.nature_of_processing || '',
      data_categories: sub.data_categories || '',
      certifications: sub.certifications || '',
      dpa_url: sub.dpa_url || '',
      dpa_requestable: sub.dpa_requestable === 1,
      countries: sub.countries || []
    });
  };
  const [newHistory, setNewHistory] = useState({ version: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'sub' | 'history' } | null>(null);
  const country = useCountry();

  useEffect(() => {
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
      });
  }, []);

  useEffect(() => {
    if (slug) {
      setSelectedProduct(slug);
    }
  }, [slug]);

  const displayProducts = products.filter(p => {
    if (country !== 'all' && (!p.countries || !p.countries.includes(country))) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!slug && displayProducts.length > 0) {
      navigate(`/subprocessors/${displayProducts[0].slug}`, { replace: true });
    } else if (slug && displayProducts.length > 0 && !displayProducts.find(p => p.slug === slug)) {
      navigate(`/subprocessors/${displayProducts[0].slug}`, { replace: true });
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-subprocessors/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setSubprocessors(data.subprocessors);
          setHistory(data.history);
        });
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('subprocessors'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    try {
      const res = await fetch('/api/admin/pages/subprocessors', {
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setToast({ message: 'Only PDF files are allowed', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        if (isEditMode) {
          setEditForm(prev => ({ ...prev, dpa_url: data.url }));
        } else {
          setNewSub(prev => ({ ...prev, dpa_url: data.url }));
        }
        setToast({ message: 'File uploaded successfully!', type: 'success' });
      } else {
        setToast({ message: 'Failed to upload file.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Error uploading file.', type: 'error' });
    } finally {
      setUploadingPdf(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAddSub = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/admin/product-subprocessors/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newSub)
      });
      
      if (res.ok) {
        const data = await fetch(`/api/public/product-subprocessors/${selectedProduct}`).then(r => r.json());
        setSubprocessors(data.subprocessors);
        setIsAddingSub(false);
        setNewSub({ 
          name: '', 
          category: 'Hosting', 
          region: '', 
          purpose: '', 
          website_url: '', 
          contact_details: '',
          org_number: '',
          lei_number: '',
          nature_of_processing: '',
          data_categories: '',
          certifications: '',
          dpa_url: '',
          dpa_requestable: false,
          countries: [] 
        });
        setToast({ message: 'Subprocessor added successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to add subprocessor' }));
        setToast({ message: errorData.error || 'Failed to add subprocessor', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleUpdateSub = async () => {
    if (!editingSub || !selectedProduct) return;
    try {
      const res = await fetch(`/api/admin/product-subprocessors/${editingSub.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      
      if (res.ok) {
        const data = await fetch(`/api/public/product-subprocessors/${selectedProduct}`).then(r => r.json());
        setSubprocessors(data.subprocessors);
        setEditingSub(null);
        setToast({ message: 'Subprocessor updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update subprocessor' }));
        setToast({ message: errorData.error || 'Failed to update subprocessor', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteSub = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/product-subprocessors/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setSubprocessors(prev => prev.filter(s => s.id !== id));
        setToast({ message: 'Subprocessor removed!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to remove subprocessor' }));
        setToast({ message: errorData.error || 'Failed to remove subprocessor', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAddHistory = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/admin/subprocessor-history/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newHistory)
      });
      if (res.ok) {
        const data = await fetch(`/api/public/product-subprocessors/${selectedProduct}`).then(r => r.json());
        setHistory(data.history);
        setIsAddingHistory(false);
        setNewHistory({ version: '', date: new Date().toISOString().split('T')[0], description: '' });
        setToast({ message: 'History entry added!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to add history entry' }));
        setToast({ message: errorData.error || 'Failed to add history entry', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/subprocessor-history/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setHistory(prev => prev.filter(h => h.id !== id));
        setToast({ message: 'History entry removed!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to remove history entry' }));
        setToast({ message: errorData.error || 'Failed to remove history entry', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteConfirm}
        title={deleteConfirm?.type === 'sub' ? "Remove Subprocessor" : "Remove History Entry"}
        message="Are you sure? This action cannot be undone."
        onConfirm={() => deleteConfirm && (deleteConfirm.type === 'sub' ? handleDeleteSub(deleteConfirm.id) : handleDeleteHistory(deleteConfirm.id))}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Remove"
        variant="danger"
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Authorized Subprocessors</h1>
          <p className="text-slate-500 mt-2 max-w-2xl">Third-party services we use to deliver Bjorn Lunden products securely and reliably.</p>
        </div>
        
        {canEdit && (
          <Button 
            variant={isPublic ? "outline" : "primary"}
            onClick={togglePublic}
            className="flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {isPublic ? "Make Private" : "Make Public"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 py-3">
        {displayProducts.map((product) => (
          <button
            key={product.slug}
            onClick={() => navigate(`/subprocessors/${product.slug}`)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedProduct === product.slug
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {product.name}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            Current Subprocessors
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {canEdit && (
              <Button size="sm" onClick={() => setIsAddingSub(true)} className="flex items-center gap-1 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Subprocessor
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identity</th>
                <th className="w-1/6 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nature of Processing</th>
                <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categories of Data</th>
                <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Purpose</th>
                <th className="w-1/6 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Certifications</th>
                {canEdit && <th className="w-24 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subprocessors
                .filter(sub => country === 'all' || (sub.countries && sub.countries.includes(country)))
                .map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 align-top">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        {sub.website_url ? (
                          <a 
                            href={sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-semibold text-sm break-all"
                          >
                            {sub.name}
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                          </a>
                        ) : (
                          <span className="text-sm font-semibold text-slate-800">{sub.name}</span>
                        )}
                        
                        {sub.contact_details ? (
                          <div className="mt-2 text-xs text-slate-600 font-normal leading-relaxed break-words whitespace-pre-wrap text-left">
                            {sub.contact_details}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-1 font-normal">Contact info not listed</p>
                        )}
                        
                        {(sub.org_number || sub.lei_number) && (
                          <div className="mt-2 space-y-1 text-[11px] text-slate-500 font-normal">
                            {sub.org_number && <div className="flex items-center gap-1.5"><span className="font-medium text-slate-700 uppercase tracking-wider text-[10px]">Org No:</span> {sub.org_number}</div>}
                            {sub.lei_number && <div className="flex items-center gap-1.5"><span className="font-medium text-slate-700 uppercase tracking-wider text-[10px]">LEI:</span> {sub.lei_number}</div>}
                          </div>
                        )}
                      </div>
                      
                      <div className="shrink-0 pt-0.5 pointer-events-auto">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4 cursor-pointer" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 align-top">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800 text-sm">{sub.region}</span>
                        {sub.countries && sub.countries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sub.countries.map((c: string) => {
                              const countryObj = COUNTRIES.find(country => country.code === c);
                              return countryObj ? (
                                <span key={c} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200" title={countryObj.name}>
                                  {countryObj.flag} {countryObj.code.toUpperCase()}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 align-top">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs flex-1 text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {sub.nature_of_processing || sub.category}
                      </p>
                      
                      <div className="shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 align-top">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs flex-1 text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {sub.data_categories || 'Not specified'}
                      </p>
                      
                      <div className="shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 align-top">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs flex-1 text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {sub.purpose}
                      </p>
                      
                      <div className="shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 align-top">
                    {sub.certifications ? (
                      <div className="flex flex-wrap gap-1">
                        {sub.certifications.split(',').map((cert: string) => (
                          <span key={cert} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 shadow-sm" title={cert.trim()}>
                            🛡️ {cert.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-450 text-xs italic font-normal">None listed</span>
                    )}
                  </td>

                  {canEdit && (
                    <td className="px-6 py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          type="button"
                          onClick={() => startEditSub(sub)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-[5px] rounded hover:bg-slate-100"
                          title="Edit Subprocessor"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub' })}
                          className="text-slate-400 hover:text-red-600 transition-colors p-[5px] rounded hover:bg-slate-100"
                          title="Delete Subprocessor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {subprocessors.filter(sub => country === 'all' || (sub.countries && sub.countries.includes(country))).length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-6 py-8 text-center text-slate-500 italic">
                    {subprocessors.length === 0 ? "No subprocessors listed for this product." : "No subprocessors match the selected country."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* History Registry */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            Registry of Alterations
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setIsAddingHistory(true)} className="flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Version
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                {canEdit && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-900">
                    v{entry.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {entry.date}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {entry.description}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setDeleteConfirm({ id: entry.id, type: 'history' })}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="px-6 py-8 text-center text-slate-500 italic">
                    No history entries recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modals for Adding */}
      {isAddingSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-bold">Add Subprocessor</h3>
              <p className="text-xs text-slate-550 mt-1">Provide statutory identity and GDPR-compliant processing metrics.</p>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Company / Subprocessor Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newSub.name}
                  onChange={e => setNewSub({...newSub, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Amazon Web Services, Inc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Website URL</label>
                <input 
                  type="text" 
                  value={newSub.website_url}
                  onChange={e => setNewSub({...newSub, website_url: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. https://aws.amazon.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Details & Address</label>
                <textarea 
                  value={newSub.contact_details}
                  onChange={e => setNewSub({...newSub, contact_details: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="e.g. AWS Legal, 410 Terry Ave N, Seattle, WA 98109 / privacy@amazon.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Organisation Number (optional)</label>
                  <input 
                    type="text" 
                    value={newSub.org_number}
                    onChange={e => setNewSub({...newSub, org_number: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. 556xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">LEI Number (optional)</label>
                  <input 
                    type="text" 
                    value={newSub.lei_number}
                    onChange={e => setNewSub({...newSub, lei_number: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. 549300..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                  <select 
                    value={newSub.category}
                    onChange={e => setNewSub({...newSub, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="Hosting">Hosting</option>
                    <option value="Email Services">Email Services</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Security">Security</option>
                    <option value="Analytics">Analytics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Region (Location) <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={newSub.region}
                    onChange={e => setNewSub({...newSub, region: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. EU (Germany)"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nature of processing <span className="text-red-500">*</span></label>
                <textarea 
                  value={newSub.nature_of_processing}
                  onChange={e => setNewSub({...newSub, nature_of_processing: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="Describe what the subprocessor actually does with the data (e.g. Hosting and system-level backups for cloud application nodes)."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categories of data <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newSub.data_categories}
                  onChange={e => setNewSub({...newSub, data_categories: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. User IP address, email, account metrics, billing history"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose of Involvement <span className="text-red-500">*</span></label>
                <textarea 
                  value={newSub.purpose}
                  onChange={e => setNewSub({...newSub, purpose: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="Explain why they are involved in the processing chain (e.g. Essential hosting infrastructure to ensure high global availability of the application scaling)."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Certifications (comma separated)</label>
                <input 
                  type="text" 
                  value={newSub.certifications}
                  onChange={e => setNewSub({...newSub, certifications: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. ISO 27001, SOC 2 Type II, ISO 27018"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">Data Processing Agreement (DPA)</h4>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Signed DPA (PDF)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handlePdfUpload(e, false)}
                    disabled={uploadingPdf}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                  {newSub.dpa_url && (
                    <div className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> File uploaded successfully
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="dpa_requestable"
                    checked={newSub.dpa_requestable}
                    onChange={(e) => setNewSub({...newSub, dpa_requestable: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="dpa_requestable" className="text-sm font-medium text-slate-700">
                    Allow users to request this document if not public
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Applicable Countries / Jurisdictions</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg max-h-40 overflow-y-auto">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const currentCountries = newSub.countries || [];
                        const newCountries = currentCountries.includes(c.code)
                          ? currentCountries.filter(code => code !== c.code)
                          : [...currentCountries, c.code];
                        setNewSub({...newSub, countries: newCountries});
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                        (newSub.countries || []).includes(c.code)
                          ? 'bg-blue-100 text-blue-850 border border-blue-205'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {c.flag} {c.code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setIsAddingSub(false)}>Cancel</Button>
              <Button onClick={handleAddSub}>Add Subprocessor</Button>
            </div>
          </div>
        </div>
      )}

      {editingSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-bold">Edit Subprocessor</h3>
              <p className="text-xs text-slate-550 mt-1">Modify statutory identity and GDPR-compliant processing metrics.</p>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Company / Subprocessor Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Amazon Web Services, Inc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Website URL</label>
                <input 
                  type="text" 
                  value={editForm.website_url || ''}
                  onChange={e => setEditForm({...editForm, website_url: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. https://aws.amazon.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Details & Address</label>
                <textarea 
                  value={editForm.contact_details || ''}
                  onChange={e => setEditForm({...editForm, contact_details: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="e.g. AWS Legal, 410 Terry Ave N, Seattle, WA 98109 / privacy@amazon.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Organisation Number (optional)</label>
                  <input 
                    type="text" 
                    value={editForm.org_number || ''}
                    onChange={e => setEditForm({...editForm, org_number: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. 556xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">LEI Number (optional)</label>
                  <input 
                    type="text" 
                    value={editForm.lei_number || ''}
                    onChange={e => setEditForm({...editForm, lei_number: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. 549300..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                  <select 
                    value={editForm.category}
                    onChange={e => setEditForm({...editForm, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="Hosting">Hosting</option>
                    <option value="Email Services">Email Services</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Security">Security</option>
                    <option value="Analytics">Analytics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Region (Location) <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={editForm.region}
                    onChange={e => setEditForm({...editForm, region: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g. EU (Germany)"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nature of processing <span className="text-red-500">*</span></label>
                <textarea 
                  value={editForm.nature_of_processing || ''}
                  onChange={e => setEditForm({...editForm, nature_of_processing: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="Describe what the subprocessor actually does with the data (e.g. Hosting and system-level backups for cloud application nodes)."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categories of data <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={editForm.data_categories || ''}
                  onChange={e => setEditForm({...editForm, data_categories: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. User IP address, email, account metrics, billing history"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose of Involvement <span className="text-red-500">*</span></label>
                <textarea 
                  value={editForm.purpose}
                  onChange={e => setEditForm({...editForm, purpose: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="Explain why they are involved in the processing chain (e.g. Essential hosting infrastructure to ensure high global availability of the application scaling)."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Certifications (comma separated)</label>
                <input 
                  type="text" 
                  value={editForm.certifications || ''}
                  onChange={e => setEditForm({...editForm, certifications: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. ISO 27001, SOC 2 Type II, ISO 27018"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">Data Processing Agreement (DPA)</h4>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Signed DPA (PDF) <span className="font-normal text-slate-500">(Leave blank to keep existing)</span></label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handlePdfUpload(e, true)}
                    disabled={uploadingPdf}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                  {editForm.dpa_url && (
                    <div className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> DPA File Attached
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit_dpa_requestable"
                    checked={editForm.dpa_requestable}
                    onChange={(e) => setEditForm({...editForm, dpa_requestable: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="edit_dpa_requestable" className="text-sm font-medium text-slate-700">
                    Allow users to request this document if not public
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Applicable Countries / Jurisdictions</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg max-h-40 overflow-y-auto">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const currentCountries = editForm.countries || [];
                        const newCountries = currentCountries.includes(c.code)
                          ? currentCountries.filter(code => code !== c.code)
                          : [...currentCountries, c.code];
                        setEditForm({...editForm, countries: newCountries});
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                        (editForm.countries || []).includes(c.code)
                          ? 'bg-blue-100 text-blue-850 border border-blue-205'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {c.flag} {c.code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setEditingSub(null)}>Cancel</Button>
              <Button onClick={handleUpdateSub}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {inspectingSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col transition-all border border-slate-100">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-150 rounded uppercase tracking-wider mb-1">
                  Sub-processor Profile
                </span>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                  {inspectingSub.name}
                </h3>
                {inspectingSub.website_url && (
                  <a 
                    href={inspectingSub.website_url.startsWith('http') ? inspectingSub.website_url : `https://${inspectingSub.website_url}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                  >
                    View Official Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button 
                onClick={() => setInspectingSub(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all font-semibold text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-slate-705">
              {/* Identity & Contact Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Identity & Contact Info
                </h4>
                <div className="space-y-2">
                  <p className="text-slate-805"><strong className="text-slate-700 font-semibold">Legal Name:</strong> {inspectingSub.name}</p>
                  
                  {(inspectingSub.org_number || inspectingSub.lei_number) && (
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                      {inspectingSub.org_number && (
                        <p className="text-slate-600 text-sm">
                          <strong className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Organisation Number:</strong><br/>
                          {inspectingSub.org_number}
                        </p>
                      )}
                      {inspectingSub.lei_number && (
                        <p className="text-slate-600 text-sm">
                          <strong className="text-slate-700 font-semibold uppercase text-xs tracking-wider">LEI Number:</strong><br/>
                          {inspectingSub.lei_number}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2">
                    <p className="text-slate-800 mb-1"><strong className="text-slate-700 font-semibold uppercase text-xs tracking-wider">Contact & Address:</strong></p>
                    <p className="text-slate-600 bg-white p-2.5 border border-slate-200 rounded text-xs whitespace-pre-wrap leading-relaxed">
                      {inspectingSub.contact_details || 'No contact details specified.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location & Transfers */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Location & Cross-Border Transfers
                </h4>
                <div className="space-y-2">
                  <p className="text-slate-805"><strong className="text-slate-700 font-semibold">Hosting Region:</strong> {inspectingSub.region}</p>
                  <div>
                    <strong className="text-slate-700 font-semibold block mb-1">Applicable Countries / Jurisdictions:</strong>
                    {inspectingSub.countries && inspectingSub.countries.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {inspectingSub.countries.map((c: string) => {
                          const countryObj = COUNTRIES.find(country => country.code === c);
                          return countryObj ? (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white text-slate-700 border border-slate-200 shadow-sm">
                              {countryObj.flag} <span className="font-medium">{countryObj.name}</span> <span className="text-[10px] text-slate-400">({countryObj.code.toUpperCase()})</span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-450 text-xs italic">All regions</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Processing Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Nature of Processing
                  </h4>
                  <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">
                    {inspectingSub.nature_of_processing || inspectingSub.category}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Categories of Data
                  </h4>
                  <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">
                    {inspectingSub.data_categories || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Purpose & Certifications */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Purpose of Involvement
                </h4>
                <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap mb-3">
                  {inspectingSub.purpose}
                </p>
                
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Security Certifications
                </h4>
                {inspectingSub.certifications ? (
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingSub.certifications.split(',').map((cert: string) => (
                      <span key={cert} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        🛡️ {cert.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-450 text-xs italic">No security certifications listed</span>
                )}
                
                {/* DPA Section */}
                {(inspectingSub.dpa_url || inspectingSub.dpa_requestable === 1) && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Data Processing Agreement (DPA)
                    </h4>
                    {inspectingSub.dpa_url ? (
                      <a 
                        href={inspectingSub.dpa_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        Download Custom DPA Addendum
                      </a>
                    ) : inspectingSub.dpa_requestable === 1 ? (
                      <button 
                        className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        Request Document via NDA
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end shrink-0">
              <Button onClick={() => setInspectingSub(null)}>Close Profile</Button>
            </div>
          </div>
        </div>
      )}

      {isAddingHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Version Entry</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                  <input 
                    type="text" 
                    value={newHistory.version}
                    onChange={e => setNewHistory({...newHistory, version: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g. 1.2.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input 
                    type="date" 
                    value={newHistory.date}
                    onChange={e => setNewHistory({...newHistory, date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  value={newHistory.description}
                  onChange={e => setNewHistory({...newHistory, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Describe the changes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddingHistory(false)}>Cancel</Button>
              <Button onClick={handleAddHistory}>Add Entry</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
