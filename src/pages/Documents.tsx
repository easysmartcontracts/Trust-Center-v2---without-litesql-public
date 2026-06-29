import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FileText, Lock, Download, ShieldAlert, FileCheck, Plus, Pencil, Trash2, ExternalLink, X, Check, Search } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

type Document = {
  id: number;
  name: string;
  slug: string;
  type: string;
  category: string;
  requires_nda: number;
  url: string;
  provider?: string;
  findings_status?: string;
  products: string[];
  description?: string;
};

export function Documents() {
  const { user, getAuthHeaders, siteSettings } = useAuth();
  const country = useCountry();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const trackMetric = async (event_type: string, product_slug: string, item_name?: string) => {
    try {
      await fetch('/api/public/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type, product_slug, item_name, user_email: user?.username || user?.email })
      });
    } catch (err) {
      console.error('Failed to track metric', err);
    }
  };
  const [documents, setDocuments] = useState<Document[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState<Partial<Document>>({
    name: '',
    slug: '',
    type: 'compliance',
    category: '',
    requires_nda: 0,
    url: '',
    provider: '',
    findings_status: '',
    products: [],
    description: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchDocuments = () => {
    fetch('/api/public/documents')
      .then(res => res.json())
      .then(data => setDocuments(data));
  };

  useEffect(() => {
    fetchDocuments();
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (doc?: Document) => {
    if (doc) {
      setEditingDoc(doc);
      setFormData({ ...doc });
    } else {
      setEditingDoc(null);
      setFormData({
        name: '',
        slug: '',
        type: 'compliance',
        category: '',
        requires_nda: 0,
        url: '',
        provider: '',
        findings_status: '',
        products: [],
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingDoc ? `/api/admin/documents/${editingDoc.id}` : '/api/admin/documents';
    const method = editingDoc ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        showToast(`Document ${editingDoc ? 'updated' : 'created'} successfully`);
        setIsModalOpen(false);
        fetchDocuments();
      } else {
        const error = await res.json();
        showToast(error.error || 'Failed to save document', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        showToast('Document deleted successfully');
        fetchDocuments();
      } else {
        showToast('Failed to delete document', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const searchLower = searchQuery.toLowerCase();
  const searchFilter = (d: Document) => 
    !searchQuery || 
    d.name.toLowerCase().includes(searchLower) || 
    (d.description && d.description.toLowerCase().includes(searchLower));

  const countryFilter = (d: Document) => {
    if (country === 'all') return true;
    if (!d.products || d.products.length === 0) return true; // Global docs
    return d.products.some(slug => {
      const p = products.find(prod => prod.slug === slug);
      return p?.countries?.includes(country);
    });
  };

  const filteredDocs = documents.filter(searchFilter).filter(countryFilter);
  const complianceDocs = filteredDocs.filter(d => d.type === 'compliance');
  const policyDocs = filteredDocs.filter(d => d.type === 'policy');
  const pentestDocs = filteredDocs.filter(d => d.type === 'pentest');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Document Center</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">Access compliance reports, security whitepapers, and policies.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-lg w-full sm:w-auto overflow-x-auto">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('compliance')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === 'compliance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Compliance
            </button>
            <button 
              onClick={() => setFilter('policies')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filter === 'policies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Policies
            </button>
          </div>
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Add Document
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(filter === 'all' || filter === 'compliance') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-slate-400" />
                Compliance & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {complianceDocs.length > 0 ? complianceDocs.map((doc) => (
                  <div key={doc.slug} className="p-5 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                          {doc.name}
                          {doc.requires_nda === 1 && <Lock className="w-3.5 h-3.5 text-amber-500" title="Requires NDA" />}
                        </h4>
                        <Badge className="bg-slate-100 text-slate-700 mt-1">{doc.category || 'Security'}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {(user?.role === 'admin' || user?.role === 'moderator') && (
                          <>
                            <button onClick={() => handleOpenModal(doc)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(doc.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-slate-600 mb-3">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {doc.products?.map(p => {
                        const product = products.find(sp => sp.slug === p);
                        return product ? (
                          <span key={p} className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {product.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant={doc.requires_nda === 1 ? 'secondary' : 'outline'} 
                        size="sm" 
                        className="flex-1 sm:flex-none flex items-center gap-2"
                        onClick={async () => {
                          if (doc.requires_nda === 1) {
                            await trackMetric('request_document', doc.products?.[0] || 'general', doc.name);
                            window.location.href = `mailto:${siteSettings?.mailto_legal || 'security@bjornlunden.com'}?subject=${encodeURIComponent(`Request for Document - ${doc.name}`)}&body=${encodeURIComponent(`Hello,\n\nI would like to request a copy of the document: ${doc.name}.\n\nThank you.`)}`;
                          } else if (doc.url) {
                            await trackMetric('download_document', doc.products?.[0] || 'general', doc.name);
                            const finalUrl = doc.url.startsWith('http') ? doc.url : `https://${doc.url}`;
                            window.open(finalUrl, '_blank');
                          }
                        }}
                      >
                        {doc.requires_nda === 1 ? 'Request Access' : (
                          <>
                            <Download className="w-4 h-4" />
                            Download PDF
                          </>
                        )}
                      </Button>
                      {doc.url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex items-center gap-2"
                          onClick={async () => {
                            await trackMetric('download_document', doc.products?.[0] || 'general', doc.name);
                            const finalUrl = doc.url.startsWith('http') ? doc.url : `https://${doc.url}`;
                            window.open(finalUrl, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-500 text-sm">No compliance documents found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(filter === 'all' || filter === 'policies') && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-400" />
                  Corporate Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {policyDocs.length > 0 ? policyDocs.map((policy) => (
                    <div key={policy.slug} className="p-4 hover:bg-slate-50 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900">{policy.name}</h4>
                          <p className="text-sm text-slate-600 mb-2">{policy.category}</p>
                          {policy.description && (
                            <p className="text-sm text-slate-600 mb-3">{policy.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(user?.role === 'admin' || user?.role === 'moderator') && (
                            <>
                              <button onClick={() => handleOpenModal(policy)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(policy.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => policy.url && window.open(policy.url.startsWith('http') ? policy.url : `https://${policy.url}`, '_blank')}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-slate-500 text-sm">No policies found.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-slate-400" />
                  Pentest Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {pentestDocs.length > 0 ? pentestDocs.map((report) => (
                    <div key={report.slug} className="p-5 hover:bg-slate-50 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            {report.name}
                            <Lock className="w-3.5 h-3.5 text-amber-500" title="Requires NDA" />
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">Conducted by: {report.provider}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(user?.role === 'admin' || user?.role === 'moderator') && (
                            <>
                              <button onClick={() => handleOpenModal(report)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(report.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {report.description && (
                        <p className="text-sm text-slate-600 mb-3">{report.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <Badge className="bg-amber-50 text-amber-700 border-amber-100">{report.findings_status}</Badge>
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={async () => {
                              await trackMetric('request_pentest', report.products?.[0] || 'general', report.name);
                              window.location.href = `mailto:${siteSettings?.mailto_legal || 'security@bjornlunden.com'}?subject=${encodeURIComponent(`Request for Pentest Summary - ${report.name}`)}&body=${encodeURIComponent(`Hello,\n\nI would like to request the summary for the pentest report: ${report.name}.\n\nThank you.`)}`;
                            }}
                          >
                            Request Summary
                          </Button>
                          {report.url && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                await trackMetric('download_pentest', report.products?.[0] || 'general', report.name);
                                const finalUrl = report.url.startsWith('http') ? report.url : `https://${report.url}`;
                                window.open(finalUrl, '_blank');
                              }}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-slate-500 text-sm">No pentest reports found.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Admin Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingDoc ? 'Edit Document' : 'Add New Document'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Document Name</label>
              <input 
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="e.g. SOC 2 Type II Report"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Slug (unique ID)</label>
              <input 
                type="text"
                required
                value={formData.slug}
                onChange={e => setFormData({...formData, slug: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="e.g. soc2-report"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Type</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="compliance">Compliance</option>
                <option value="policy">Policy</option>
                <option value="pentest">Pentest Report</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Category / Provider</label>
              <input 
                type="text"
                value={formData.type === 'pentest' ? formData.provider : formData.category}
                onChange={e => {
                  if (formData.type === 'pentest') {
                    setFormData({...formData, provider: e.target.value});
                  } else {
                    setFormData({...formData, category: e.target.value});
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder={formData.type === 'pentest' ? "e.g. Bishop Fox" : "e.g. Privacy"}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Description</label>
            <textarea 
              value={formData.description || ''}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px]"
              placeholder="Brief description of the document..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">HTML URL (External Link)</label>
            <input 
              type="url"
              value={formData.url}
              onChange={e => setFormData({...formData, url: e.target.value})}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="https://example.com/view/document"
            />
          </div>

          <div className="flex items-center gap-4 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.requires_nda === 1}
                onChange={e => setFormData({...formData, requires_nda: e.target.checked ? 1 : 0})}
                className="rounded text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-medium text-slate-700">Requires NDA / Approval</span>
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Applicable Products</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-100 rounded-lg bg-slate-50">
              {products.map(p => (
                <label key={p.slug} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.products?.includes(p.slug)}
                    onChange={e => {
                      const current = formData.products || [];
                      if (e.target.checked) {
                        setFormData({...formData, products: [...current, p.slug]});
                      } else {
                        setFormData({...formData, products: current.filter(s => s !== p.slug)});
                      }
                    }}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Document</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
