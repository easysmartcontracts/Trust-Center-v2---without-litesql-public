import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scale, FileText, Mail, Globe, CheckCircle2, XCircle, Plus, Trash2, ExternalLink, Calendar, History, Edit2, X, Save, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { COUNTRIES } from '../constants';

type LegalDocument = {
  id: number;
  product_slug: string;
  document_type: string;
  url: string;
  file_url?: string;
  effective_date: string | null;
  version: string | null;
  is_current: number;
};

const DOCUMENT_TYPES = [
  { id: 'tc', title: 'Terms and Conditions', description: 'General terms of service and usage conditions.' },
  { id: 'privacy', title: 'Privacy Notice', description: 'Details on how personal data is collected and processed.' },
  { id: 'dpa', title: 'Data Protection Agreement (DPA)', description: 'Standard agreement outlining data processing commitments.', requestable: true },
  { id: 'exit', title: 'Data Exit Strategy Addendum', description: 'Procedures for data retrieval and deletion upon termination.' },
  { id: 'sla', title: 'Service Level Agreement (SLA)', description: 'Service availability, support response times, and performance guarantees.' }
];

export function Legal() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(slug || null);
  const [isPublic, setIsPublic] = useState(false);
  
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customerNumber: '',
    name: '',
    function: ''
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const country = useCountry();

  // Admin state
  const [isAdding, setIsAdding] = useState<string | null>(null); // document_type
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);
  const [newDoc, setNewDoc] = useState<Partial<LegalDocument>>({
    url: '',
    file_url: '',
    effective_date: '',
    version: '',
    is_current: 1
  });

  const customTypes = Array.from(new Set(
    documents
      .map(d => d.document_type)
      .filter(type => !DOCUMENT_TYPES.find(dt => dt.id === type))
  )).map((typeId: unknown) => ({
    id: typeId as string,
    title: typeId as string,
    description: 'Custom document section.',
    requestable: false
  }));

  const allDocumentSections = [...DOCUMENT_TYPES, ...customTypes];

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
      navigate(`/legal/${displayProducts[0].slug}`, { replace: true });
    } else if (slug && displayProducts.length > 0 && !displayProducts.find(p => p.slug === slug)) {
      navigate(`/legal/${displayProducts[0].slug}`, { replace: true });
    }
  }, [country, displayProducts, slug, navigate]);

  const fetchDocuments = () => {
    if (selectedProduct) {
      fetch(`/api/public/product-legal/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setDocuments(data);
        });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('legal'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/legal', {
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

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    const subject = encodeURIComponent(`Request for Signed DPA - ${productName}`);
    const body = encodeURIComponent(
      `Hello,\n\nI would like to request a signed copy of the Data Protection Agreement for ${productName}.\n\nDetails:\nName: ${formData.name}\nFunction: ${formData.function}\nCustomer Number: ${formData.customerNumber}\n\nThank you.`
    );
    const email = siteSettings?.mailto_legal || 'security@bjornlunden.com';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    setShowModal(false);
    setFormData({ customerNumber: '', name: '', function: '' });
  };

  const handleSaveDoc = async (document_type: string) => {
    if (!selectedProduct) return;
    
    try {
      const isUpdate = !!editingDoc;
      const url = isUpdate ? `/api/admin/product-legal/${editingDoc.id}` : `/api/admin/product-legal/${selectedProduct}`;
      const method = isUpdate ? 'PUT' : 'POST';
      const body = {
        ...newDoc,
        document_type,
        product_slug: selectedProduct
      };

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        fetchDocuments();
        setIsAdding(null);
        setEditingDoc(null);
        setNewDoc({ url: '', effective_date: '', version: '', is_current: 1 });
        setToast({ message: `Document ${isUpdate ? 'updated' : 'added'} successfully!`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to save document', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteDoc = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document version?')) return;
    
    try {
      const res = await fetch(`/api/admin/product-legal/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        fetchDocuments();
        setToast({ message: 'Document deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete document', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const startEdit = (doc: LegalDocument) => {
    setEditingDoc(doc);
    setNewDoc({
      url: doc.url,
      effective_date: doc.effective_date || '',
      version: doc.version || '',
      is_current: doc.is_current
    });
    setIsAdding(doc.document_type);
  };

  const cancelEdit = () => {
    setIsAdding(null);
    setEditingDoc(null);
    setNewDoc({ url: '', file_url: '', effective_date: '', version: '', is_current: 1 });
    setCustomSectionTitle('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
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
        setNewDoc(prev => ({ ...prev, file_url: data.url }));
        setToast({ message: 'File uploaded successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to upload file', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred during upload', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const renderDocumentSection = (typeDef: typeof DOCUMENT_TYPES[0]) => {
    const typeDocs = documents.filter(d => d.document_type === typeDef.id);
    const currentDoc = typeDocs.find(d => d.is_current === 1) || typeDocs[0]; // Fallback to first if no current
    const previousDocs = typeDocs.filter(d => d.id !== currentDoc?.id);
    const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
    const isEditingThis = isAdding === typeDef.id;

    return (
      <div key={typeDef.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-700 shrink-0">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-900">{typeDef.title}</h4>
                <p className="text-sm text-slate-500 mt-1">{typeDef.description}</p>
              </div>
              {isAdmin && !isEditingThis && (
                <Button variant="outline" size="sm" onClick={() => {
                  setIsAdding(typeDef.id);
                  setEditingDoc(null);
                  setNewDoc({ url: '', file_url: '', effective_date: '', version: '', is_current: 1 });
                }}>
                  <Plus className="w-4 h-4 mr-1" /> Add Version
                </Button>
              )}
            </div>
          </div>
        </div>

        {isEditingThis ? (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 mb-4">
            <h5 className="font-medium text-sm text-slate-900 flex items-center gap-2">
              {editingDoc ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingDoc ? 'Edit Version' : 'Add New Version'}
            </h5>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Document URL</label>
                <input 
                  type="url" 
                  value={newDoc.url}
                  onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Or Upload PDF Document</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {newDoc.file_url && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md shrink-0 border border-green-200">
                      Uploaded
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Effective Date</label>
                  <input 
                    type="date" 
                    value={newDoc.effective_date || ''}
                    onChange={(e) => setNewDoc({...newDoc, effective_date: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Version (e.g. v1.2)</label>
                  <input 
                    type="text" 
                    value={newDoc.version || ''}
                    onChange={(e) => setNewDoc({...newDoc, version: e.target.value})}
                    placeholder="v1.0"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id={`current-${typeDef.id}`}
                  checked={newDoc.is_current === 1}
                  onChange={(e) => setNewDoc({...newDoc, is_current: e.target.checked ? 1 : 0})}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor={`current-${typeDef.id}`} className="text-sm text-slate-700">
                  Set as current version
                </label>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={cancelEdit} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleSaveDoc(typeDef.id)} className="flex-1" disabled={!newDoc.url && !newDoc.file_url}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {currentDoc ? (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Current</span>
                      {currentDoc.version && (
                        <span className="text-xs font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded">{currentDoc.version}</span>
                      )}
                    </div>
                    <a 
                      href={currentDoc.file_url || currentDoc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                    >
                      View Document <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {currentDoc.effective_date && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Effective: {new Date(currentDoc.effective_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(currentDoc)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteDoc(currentDoc.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic mb-4">No documents available.</div>
            )}

            {previousDocs.length > 0 && (
              <div className="mt-2">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <History className="w-3 h-3" /> Previous Versions
                </h5>
                <ul className="space-y-2">
                  {previousDocs.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          {doc.version || 'Previous Version'} <ExternalLink className="w-3 h-3" />
                        </a>
                        {doc.effective_date && (
                          <span className="text-xs text-slate-500">
                            Effective: {new Date(doc.effective_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(doc)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {typeDef.requestable && !isEditingThis && currentDoc && (
          <div className="mt-auto pt-4 border-t border-slate-100">
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors w-full justify-center"
            >
              <Mail className="w-4 h-4" />
              Request Signed Copy
            </button>
          </div>
        )}
      </div>
    );
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Legal Documents</h1>
          <p className="text-slate-600 mt-1">Review terms, privacy notices, SLAs, and data protection agreements.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'moderator') && (
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
      </div>

      <div className="flex flex-wrap gap-3 py-3 -mx-4 px-4 md:mx-0 md:px-0">
        {displayProducts.map((product) => (
          <button
            key={product.slug}
            onClick={() => navigate(`/legal/${product.slug}`)}
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

      {products.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Scale className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">There are currently no products to display.</p>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700">
                <Scale className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Legal & Privacy Documents</h2>
                <p className="text-slate-600 text-sm">Documents applicable to this product.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allDocumentSections.map(typeDef => renderDocumentSection(typeDef))}
          </div>

          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="mt-8 pt-8 border-t border-slate-100">
              {isAdding === 'new_custom' ? (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" /> Add Custom Document Section
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Document Title / Type Name *</label>
                      <input 
                        type="text" 
                        value={customSectionTitle}
                        onChange={(e) => setCustomSectionTitle(e.target.value)}
                        placeholder="e.g. Master Services Agreement"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Document URL</label>
                      <input 
                        type="url" 
                        value={newDoc.url}
                        onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Or Upload PDF Document</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          accept="application/pdf"
                          onChange={handleFileUpload}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                        {newDoc.file_url && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md shrink-0 border border-green-200">
                            Uploaded
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                        <input 
                          type="date" 
                          value={newDoc.effective_date || ''}
                          onChange={(e) => setNewDoc({...newDoc, effective_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                        <input 
                          type="text" 
                          value={newDoc.version || ''}
                          onChange={(e) => setNewDoc({...newDoc, version: e.target.value})}
                          placeholder="e.g. v1.0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="custom-current"
                        checked={newDoc.is_current === 1}
                        onChange={(e) => setNewDoc({...newDoc, is_current: e.target.checked ? 1 : 0})}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="custom-current" className="text-sm font-medium text-slate-700">
                        Set as current active version
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200 mt-6">
                      <Button variant="outline" onClick={cancelEdit} className="bg-white">
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleSaveDoc(customSectionTitle)} 
                        disabled={!customSectionTitle.trim() || (!newDoc.url && !newDoc.file_url)}
                        className="flex-1"
                      >
                        Save Custom Document
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-sm text-slate-500 mb-3 text-center">Need to add a different type of legal document not listed above?</p>
                  <Button variant="outline" onClick={() => {
                    setIsAdding('new_custom');
                    setEditingDoc(null);
                    setNewDoc({ url: '', effective_date: '', version: '', is_current: 1 });
                    setCustomSectionTitle('');
                  }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Custom Document Section
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Request Signed DPA</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Please provide your details to request a signed copy of the Data Protection Agreement for <strong>{products.find(p => p.slug === selectedProduct)?.name}</strong>.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Number</label>
                <input 
                  type="text" 
                  required
                  value={formData.customerNumber}
                  onChange={(e) => setFormData({...formData, customerNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="e.g. CUST-12345"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Your full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Function / Title</label>
                <input 
                  type="text" 
                  required
                  value={formData.function}
                  onChange={(e) => setFormData({...formData, function: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="e.g. Data Protection Officer"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Generate Email Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
