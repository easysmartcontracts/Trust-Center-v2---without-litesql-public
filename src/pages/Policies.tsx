import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Mail, Globe, CheckCircle2, XCircle, Plus, Trash2, FileText, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';

type Policy = {
  id: number;
  product_slug: string;
  name: string;
  description: string;
  is_requestable: number;
  effective_date?: string;
  version?: string;
};

export function Policies() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const country = useCountry();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(slug || null);
  const [isPublic, setIsPublic] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [newPolicy, setNewPolicy] = useState({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [editPolicyState, setEditPolicyState] = useState({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
    // If no slug is present, pick the first product and navigate to it
    if (!slug && displayProducts.length > 0) {
      navigate(`/policies/${displayProducts[0].slug}`, { replace: true });
    } else if (slug && displayProducts.length > 0 && !displayProducts.find(p => p.slug === slug)) {
      // If slug is invalid for current country, reset to first available
      navigate(`/policies/${displayProducts[0].slug}`, { replace: true });
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-policies/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setPolicies(data);
        });
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('policies'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/policies', {
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

  const handleAddPolicy = async () => {
    if (!selectedProduct || !newPolicy.name) return;
    
    try {
      const res = await fetch(`/api/admin/product-policies/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newPolicy)
      });
      
      if (res.ok) {
        // Refresh policies
        const policiesRes = await fetch(`/api/public/product-policies/${selectedProduct}`);
        const data = await policiesRes.json();
        setPolicies(data);
        setNewPolicy({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
        setToast({ message: 'Policy added successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to add policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleUpdatePolicy = async (id: number) => {
    if (!editPolicyState.name) return;
    
    try {
      const res = await fetch(`/api/admin/product-policies/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editPolicyState)
      });
      
      if (res.ok) {
        const policiesRes = await fetch(`/api/public/product-policies/${selectedProduct}`);
        const data = await policiesRes.json();
        setPolicies(data);
        setEditingPolicyId(null);
        setToast({ message: 'Policy updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to update policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeletePolicy = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/product-policies/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        setPolicies(policies.filter(p => p.id !== id));
        setToast({ message: 'Policy deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRequestPolicy = (policyName: string) => {
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    const subject = encodeURIComponent(`Request for Policy - ${policyName}`);
    const body = encodeURIComponent(`Hello,\n\nI would like to request a copy of the ${policyName} related to ${productName}.\n\nThank you.`);
    const email = siteSettings?.mailto_policies || 'security@bjornlunden.com';
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Policies</h1>
          <p className="text-slate-600 mt-1">Security and compliance policies for our product portfolio.</p>
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
            onClick={() => navigate(`/policies/${product.slug}`)}
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
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">There are currently no products to display.</p>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Product Policies</h2>
              <p className="text-slate-600 text-sm">Policies applicable to this product.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((policy) => (
                <div key={policy.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group">
                  {editingPolicyId === policy.id ? (
                    <div className="flex flex-col h-full">
                      <div className="space-y-3 flex-grow">
                        <input 
                          type="text" 
                          value={editPolicyState.name}
                          onChange={(e) => setEditPolicyState({...editPolicyState, name: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Policy Name"
                        />
                        <textarea 
                          value={editPolicyState.description}
                          onChange={(e) => setEditPolicyState({...editPolicyState, description: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20"
                          placeholder="Description"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="date" 
                            value={editPolicyState.effective_date}
                            onChange={(e) => setEditPolicyState({...editPolicyState, effective_date: e.target.value})}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder="Effective Date"
                          />
                          <input 
                            type="text" 
                            value={editPolicyState.version}
                            onChange={(e) => setEditPolicyState({...editPolicyState, version: e.target.value})}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder="Version (e.g. 1.0)"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1 pb-2">
                          <input 
                            type="checkbox" 
                            id={`policy-edit-requestable-${policy.id}`}
                            checked={editPolicyState.is_requestable === 1}
                            onChange={(e) => setEditPolicyState({...editPolicyState, is_requestable: e.target.checked ? 1 : 0})}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <label htmlFor={`policy-edit-requestable-${policy.id}`} className="text-sm font-medium text-slate-700">
                            Allow users to request this policy
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                        <Button variant="outline" size="sm" onClick={() => setEditingPolicyId(null)} className="flex-1">
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleUpdatePolicy(policy.id)} className="flex-1">
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-4 flex-grow">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-700 shrink-0">
                            <FileText className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{policy.name}</h4>
                            {policy.description && (
                              <p className="text-sm text-slate-500 mt-1 line-clamp-3">{policy.description}</p>
                            )}
                            <div className="flex gap-3 text-xs font-medium text-slate-500 mt-2">
                              {policy.version && <span>Version: {policy.version}</span>}
                              {policy.effective_date && <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>
                        {(user?.role === 'admin' || user?.role === 'moderator') && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => {
                                setEditingPolicyId(policy.id);
                                setEditPolicyState({
                                  name: policy.name,
                                  description: policy.description,
                                  is_requestable: policy.is_requestable,
                                  effective_date: policy.effective_date || '',
                                  version: policy.version || ''
                                });
                              }}
                              className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={`Edit ${policy.name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeletePolicy(policy.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                              aria-label={`Delete ${policy.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-auto pt-4">
                        {policy.is_requestable === 1 && (
                          <button 
                            onClick={() => handleRequestPolicy(policy.name)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Request Policy
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Admin Add Policy */}
              {(user?.role === 'admin' || user?.role === 'moderator') && (
                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 flex flex-col gap-4">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Add Policy
                  </h4>
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Policy Name (e.g. Information Security Policy)"
                      value={newPolicy.name}
                      onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <textarea 
                      placeholder="Description (optional)"
                      value={newPolicy.description}
                      onChange={(e) => setNewPolicy({...newPolicy, description: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="date" 
                        value={newPolicy.effective_date}
                        onChange={(e) => setNewPolicy({...newPolicy, effective_date: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Effective Date"
                      />
                      <input 
                        type="text" 
                        value={newPolicy.version}
                        onChange={(e) => setNewPolicy({...newPolicy, version: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Version (e.g. 1.0)"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1 pb-2">
                      <input 
                        type="checkbox" 
                        id="policy-requestable"
                        checked={newPolicy.is_requestable === 1}
                        onChange={(e) => setNewPolicy({...newPolicy, is_requestable: e.target.checked ? 1 : 0})}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="policy-requestable" className="text-sm font-medium text-slate-700">
                        Allow users to request this policy
                      </label>
                    </div>
                  </div>
                  <Button onClick={handleAddPolicy} className="w-full">Add to List</Button>
                </div>
              )}
            </div>

            {policies.length === 0 && !(user?.role === 'admin' || user?.role === 'moderator') && (
              <div className="text-center py-8 text-slate-500">
                No policies available for this product.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
