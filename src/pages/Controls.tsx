import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Server, Users, ClipboardList, Cpu, Package, Lock, Globe, CheckCircle2, AlertCircle, XCircle, Check, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { COUNTRIES } from '../constants';

type ControlTopic = {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
};

const CONTROL_TOPICS: ControlTopic[] = [
  { 
    id: 'infrastructure-security', 
    title: 'Infrastructure Security', 
    icon: <Server className="w-5 h-5 text-blue-500" />,
    description: 'Security of the physical and cloud infrastructure hosting our services.'
  },
  { 
    id: 'organization-security', 
    title: 'Organization Security', 
    icon: <Users className="w-5 h-5 text-emerald-500" />,
    description: 'Security policies and practices at the organizational level.'
  },
  { 
    id: 'internal-security-procedures', 
    title: 'Internal Security Procedures', 
    icon: <ClipboardList className="w-5 h-5 text-indigo-500" />,
    description: 'Standard operating procedures for maintaining internal security.'
  },
  { 
    id: 'ai-security-compliance', 
    title: 'AI Security & Compliance', 
    icon: <Cpu className="w-5 h-5 text-amber-500" />,
    description: 'Security and regulatory compliance for our AI-driven features.'
  },
  { 
    id: 'product-security', 
    title: 'Product Security', 
    icon: <Package className="w-5 h-5 text-rose-500" />,
    description: 'Security measures built directly into our software products.'
  },
  { 
    id: 'data-and-privacy', 
    title: 'Data and Privacy', 
    icon: <Lock className="w-5 h-5 text-slate-500" />,
    description: 'Controls for protecting user data and ensuring privacy compliance.'
  }
];

type Control = {
  topic_id: string;
  status: string;
  description: string;
};

export function Controls() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(slug || null);
  const [isPublic, setIsPublic] = useState(false);
  const [controls, setControls] = useState<Control[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Control[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
      navigate(`/controls/${displayProducts[0].slug}`, { replace: true });
    } else if (slug && displayProducts.length > 0 && !displayProducts.find(p => p.slug === slug)) {
      navigate(`/controls/${displayProducts[0].slug}`, { replace: true });
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-controls/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setControls(data);
          setEditData(data);
        });
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('controls'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/controls', {
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
        setToast({ message: 'Failed to update page visibility', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSave = async () => {
    if (!selectedProduct) return;
    
    try {
      const res = await fetch(`/api/admin/product-controls/${selectedProduct}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editData)
      });
      
      if (res.ok) {
        setControls(editData);
        setIsEditing(false);
        setToast({ message: 'Controls updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Update failed' }));
        setToast({ message: data.error || 'Failed to update controls', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Implemented': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'Partial': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'Not Implemented': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Controls</h1>
          <p className="text-slate-600 mt-1">Security controls and compliance status for our products.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit Controls"}
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

      <div className="flex flex-wrap gap-3 py-3 -mx-4 px-4 md:mx-0 md:px-0">
        {displayProducts.map((product) => (
          <button
            key={product.slug}
            onClick={() => {
              navigate(`/controls/${product.slug}`);
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
          <h3 className="text-lg font-semibold text-slate-900">No Controls Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            {products.length === 0 
              ? "There are currently no products with applicable controls to display."
              : "No products match your selected country filter."}
          </p>
        </div>
      )}

      {/* Controls Details */}
      {selectedProduct && (
        <div className="grid grid-cols-1 gap-6">
          {(isEditing ? editData : controls).map((control, index) => {
            const topic = CONTROL_TOPICS.find(t => t.id === control.topic_id);
            const title = topic ? topic.title : control.topic_id;
            const topicDesc = topic ? topic.description : 'Custom security control measure.';
            const icon = topic ? topic.icon : <ClipboardList className="w-5 h-5 text-indigo-500" />;
            const status = control.status || 'Implemented';
            const description = control.description || '';
            
            return (
              <div key={isEditing ? index : control.topic_id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
                {isEditing && (
                  <button 
                    onClick={() => setEditData(editData.filter((_, i) => i !== index))}
                    className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-2 rounded-full"
                    title="Remove Control"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex items-start gap-4 md:w-1/3">
                    <div className="p-2 bg-slate-50 rounded-lg shrink-0" aria-hidden="true">
                      {icon}
                    </div>
                    <div className="w-full">
                      {isEditing && !topic ? (
                        <input
                          type="text"
                          value={control.topic_id}
                          onChange={(e) => {
                             const newData = [...editData];
                             newData[index] = { ...newData[index], topic_id: e.target.value };
                             setEditData(newData);
                          }}
                          placeholder="Custom Control Title"
                          className="font-bold text-slate-900 w-full border-b border-slate-300 focus:border-slate-900 focus:outline-none bg-transparent"
                        />
                      ) : (
                        <h3 className="font-bold text-slate-900">{title}</h3>
                      )}
                      <p className="text-sm text-slate-600 mt-1">{topicDesc}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status</span>
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <label htmlFor={`status-${index}`} className="sr-only">Status</label>
                          <select 
                            id={`status-${index}`}
                            value={status}
                            onChange={(e) => {
                              const newData = [...editData];
                              newData[index] = { ...newData[index], status: e.target.value };
                              setEditData(newData);
                            }}
                            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            <option value="Implemented">Implemented</option>
                            <option value="Partial">Partial</option>
                            <option value="Not Implemented">Not Implemented</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div aria-hidden="true">{getStatusIcon(status)}</div>
                          <span className="text-sm font-bold text-slate-900">{status}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <label htmlFor={`desc-${index}`} className="sr-only">Description</label>
                          <textarea
                            id={`desc-${index}`}
                            value={description}
                            onChange={(e) => {
                              const newData = [...editData];
                              newData[index] = { ...newData[index], description: e.target.value };
                              setEditData(newData);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            rows={3}
                            placeholder="Describe control measures..."
                          />
                        </div>
                      ) : (
                        <p className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                          {description || 'No detailed information provided for this control.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!isEditing && controls.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">No Controls Set</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                No security controls have been added for this product yet.
              </p>
            </div>
          )}

          {isEditing && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Add Control</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    if (e.target.value === 'custom') {
                      setEditData([...editData, { topic_id: `New Custom Control`, status: 'Implemented', description: '' }]);
                    } else {
                      const topicList = CONTROL_TOPICS.find(t => t.id === e.target.value);
                      if (topicList && !editData.some(c => c.topic_id === topicList.id)) {
                         setEditData([...editData, { topic_id: topicList.id, status: 'Implemented', description: '' }]);
                      }
                    }
                    e.target.value = ''; // Reset select
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select a predefined topic...</option>
                  {CONTROL_TOPICS.filter(t => !editData.some(c => c.topic_id === t.id)).map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.title}</option>
                  ))}
                  <option value="custom">Add Custom Control...</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Controls</Button>
        </div>
      )}
    </div>
  );
}
