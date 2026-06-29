import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { BjornLogo } from '../components/BjornLogo';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { Check, AlertCircle, Edit2, Trash2, Plus, ExternalLink, X } from 'lucide-react';
import { COUNTRIES } from '../constants';

export function AdminDashboard() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings, refreshSiteSettings } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Site Branding states
  const [brandingForm, setBrandingForm] = useState({
    site_logo: siteSettings.site_logo,
    site_name: siteSettings.site_name,
    header_text: siteSettings.header_text,
    mailto_certifications: siteSettings.mailto_certifications,
    mailto_policies: siteSettings.mailto_policies,
    mailto_legal: siteSettings.mailto_legal,
    privacy_notice: siteSettings.privacy_notice,
    cookie_notice: siteSettings.cookie_notice
  });
  const [uploading, setUploading] = useState(false);

  // Product Management states
  const [products, setProducts] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] as string[] });
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCountryFilter, setProductCountryFilter] = useState<string>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');

  useEffect(() => {
    setBrandingForm({
      site_logo: siteSettings.site_logo,
      site_name: siteSettings.site_name,
      header_text: siteSettings.header_text,
      mailto_certifications: siteSettings.mailto_certifications,
      mailto_policies: siteSettings.mailto_policies,
      mailto_legal: siteSettings.mailto_legal,
      privacy_notice: siteSettings.privacy_notice,
      cookie_notice: siteSettings.cookie_notice
    });
  }, [siteSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setBrandingForm(prev => ({ ...prev, site_logo: data.url }));
        setToast({ message: 'Logo uploaded successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Upload failed', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error during upload', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/dashboard-settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(brandingForm)
      });
      if (res.ok) {
        refreshSiteSettings();
        setToast({ message: 'Site branding updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to update branding', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const allModules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'security-overview', label: 'Security Overview' },
    { id: 'controls', label: 'Controls' },
    { id: 'certifications', label: 'Certifications and Reports' },
    { id: 'policies', label: 'Policies' },
    { id: 'legal', label: 'Legal Documents' },
    { id: 'subprocessors', label: 'Subprocessors' },
    { id: 'documents', label: 'All Documents' },
  ];

  useEffect(() => {
    fetchUsers();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/public/products');
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      setToast({ 
        message: 'Password does not meet the minimum requirements.', 
        type: 'error' 
      });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
        setToast({ message: 'User created successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to create user', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        fetchUsers();
        setToast({ message: 'User deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to delete user', type: 'error' });
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

  const handleUpdatePermissions = async (id: number, allowedModules: string[], allowedProducts: string[]) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/permissions`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ allowedModules, allowedProducts })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePublicPage = async (pageId: string, isPublic: boolean) => {
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ is_public: isPublic })
      });
      if (res.ok) refreshPublicPages();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditProductClick = (product: any) => {
    setProductForm({
      slug: product.slug,
      name: product.name,
      category: product.category,
      status_url: product.status_url,
      color: product.color,
      countries: product.countries || []
    });
    setEditingProduct(product);
    setIsAddingProduct(false);
  };

  const handleAddProductClick = () => {
    setProductForm({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] });
    setEditingProduct(null);
    setIsAddingProduct(true);
  };

  const handleSaveProduct = async () => {
    try {
      if (!productForm.slug) {
        setToast({ message: 'Slug is required', type: 'error' });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const isNew = isAddingProduct;
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${encodeURIComponent(productForm.slug)}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          slug: productForm.slug,
          name: productForm.name,
          category: productForm.category,
          url: productForm.status_url,
          color: productForm.color,
          countries: productForm.countries
        })
      });
      
      if (res.ok) {
        fetchProducts();
        setEditingProduct(null);
        setIsAddingProduct(false);
        setToast({ 
          message: isNew ? 'Product added successfully!' : 'Product updated successfully!', 
          type: 'success' 
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Invalid server response' }));
        setToast({ message: data.error || 'Failed to save product', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to save product', err);
      setToast({ message: 'Error: ' + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteProduct = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        fetchProducts();
        setToast({ message: 'Product deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Delete failed' }));
        setToast({ message: data.error || 'Failed to delete product', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error('Failed to delete product', err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteProductConfirm(null);
    }
  };

  if (loading) return <div>Loading...</div>;

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

      <ConfirmationModal 
        isOpen={!!deleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete this user? This action cannot be undone.`}
        onConfirm={() => deleteConfirm && handleDeleteUser(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={!!deleteProductConfirm}
        title="Delete Product"
        message={`Are you sure you want to delete "${products.find(p => p.slug === deleteProductConfirm)?.name}"? This action cannot be undone.`}
        onConfirm={() => deleteProductConfirm && handleDeleteProduct(deleteProductConfirm)}
        onCancel={() => setDeleteProductConfirm(null)}
        confirmText="Delete"
        variant="danger"
      />

      {(editingProduct || isAddingProduct) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{isAddingProduct ? 'Add New Product' : 'Edit Product Details'}</h3>
              <button onClick={() => { setEditingProduct(null); setIsAddingProduct(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {isAddingProduct && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (Unique ID)</label>
                  <input 
                    type="text" 
                    value={productForm.slug}
                    onChange={e => setProductForm({...productForm, slug: e.target.value})}
                    placeholder="e.g. my-product"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Category</label>
                <input 
                  type="text" 
                  value={productForm.category}
                  onChange={e => setProductForm({...productForm, category: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status Page URL</label>
                <input 
                  type="url" 
                  value={productForm.status_url}
                  onChange={e => setProductForm({...productForm, status_url: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={productForm.color}
                    onChange={e => setProductForm({...productForm, color: e.target.value})}
                    className="h-9 w-9 rounded border border-slate-300 cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={productForm.color}
                    onChange={e => setProductForm({...productForm, color: e.target.value})}
                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Countries</label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const newCountries = productForm.countries.includes(c.code)
                          ? productForm.countries.filter(code => code !== c.code)
                          : [...productForm.countries, c.code];
                        setProductForm({...productForm, countries: newCountries});
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        productForm.countries.includes(c.code)
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {c.flag} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => { setEditingProduct(null); setIsAddingProduct(false); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProduct}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
        <p className="text-slate-500 mt-1">Manage users, roles, and access permissions.</p>
      </div>

      <div className="mb-8">
        <AnalyticsPanel />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Create New User</h2>
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input required type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Enter password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="viewer">Viewer</option>
                {user?.role === 'admin' && <option value="moderator">Moderator</option>}
                {user?.role === 'admin' && <option value="admin">Admin</option>}
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-100">
            <p className="font-semibold mb-1 text-slate-700">Password Requirements:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li className={newPassword.length >= 12 ? 'text-emerald-600 font-medium' : ''}>At least 12 characters long</li>
              <li className={/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-medium' : ''}>At least one uppercase letter</li>
              <li className={/\d/.test(newPassword) ? 'text-emerald-600 font-medium' : ''}>At least one number</li>
              <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-emerald-600 font-medium' : ''}>At least one special character</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create User</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Site Branding</h2>
        <form onSubmit={handleUpdateBranding} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden">
                    {brandingForm.site_logo ? (
                      <img src={brandingForm.site_logo} alt="Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <BjornLogo className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden" 
                      id="logo-upload"
                      disabled={uploading}
                    />
                    <label 
                      htmlFor="logo-upload"
                      className={`inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploading ? 'Uploading...' : 'Upload New Logo'}
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Recommended: Square PNG or SVG (max 2MB).</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL (Optional)</label>
                <input 
                  type="text" 
                  value={brandingForm.site_logo} 
                  onChange={e => setBrandingForm({ ...brandingForm, site_logo: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="https://example.com/logo.png" 
                />
                <p className="text-xs text-slate-500 mt-1">Or paste a direct link to an image hosted elsewhere.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={brandingForm.site_name} 
                  onChange={e => setBrandingForm({ ...brandingForm, site_name: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="Bjorn Lunden" 
                />
                <p className="text-xs text-slate-500 mt-1">The main name displayed in the header.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Header Text</label>
                <input 
                  type="text" 
                  value={brandingForm.header_text} 
                  onChange={e => setBrandingForm({ ...brandingForm, header_text: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="Trust Center" 
                />
                <p className="text-xs text-slate-500 mt-1">This text appears in the header next to the company name.</p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Preview</h4>
                <div className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200 shadow-sm scale-90 origin-left">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {brandingForm.site_logo ? (
                      <img src={brandingForm.site_logo} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <BjornLogo className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{brandingForm.site_name || 'Bjorn Lunden'}</span>
                    <span className="text-[10px] text-slate-600 font-bold uppercase">{brandingForm.header_text || 'Trust Center'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Email Subscriptions (mailto)</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Certifications Email</label>
                <input 
                  type="email" 
                  value={brandingForm.mailto_certifications} 
                  onChange={e => setBrandingForm({ ...brandingForm, mailto_certifications: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="security@bjornlunden.com" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Policies Email</label>
                <input 
                  type="email" 
                  value={brandingForm.mailto_policies} 
                  onChange={e => setBrandingForm({ ...brandingForm, mailto_policies: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="security@bjornlunden.com" 
                />
              </div>
            </div>
            
            <div className="space-y-6 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Privacy Notice</label>
                <div className="bg-white">
                  <ReactQuill 
                    theme="snow" 
                    value={brandingForm.privacy_notice} 
                    onChange={(content) => setBrandingForm({ ...brandingForm, privacy_notice: content })} 
                    className="h-48 mb-12"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 mt-8">Cookie Notice</label>
                <div className="bg-white">
                  <ReactQuill 
                    theme="snow" 
                    value={brandingForm.cookie_notice} 
                    onChange={(content) => setBrandingForm({ ...brandingForm, cookie_notice: content })} 
                    className="h-48 mb-12"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={uploading}>Save Branding Changes</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-6">
          {users.map(u => (
            <div key={u.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase">
                    {u.username.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{u.username}</div>
                    <div className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase tracking-wider inline-block mt-1">{u.role}</div>
                  </div>
                </div>
                {u.id !== user?.id && (
                  <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto" onClick={() => setDeleteConfirm(u.id)}>
                    Delete User
                  </Button>
                )}
              </div>

              {u.role === 'viewer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Allowed Modules</h4>
                    <div className="space-y-2.5">
                      {allModules.map(mod => (
                        <label key={mod.id} className="flex items-start gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={u.allowedModules?.includes(mod.id) || false}
                            onChange={(e) => {
                              const newModules = e.target.checked 
                                ? [...(u.allowedModules || []), mod.id]
                                : (u.allowedModules || []).filter((m: string) => m !== mod.id);
                              handleUpdatePermissions(u.id, newModules, u.allowedProducts || []);
                            }}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Allowed Products</h4>
                    <div className="space-y-2.5">
                      {products.map(prod => (
                        <label key={prod.slug} className="flex items-start gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={u.allowedProducts?.includes(prod.slug) || false}
                            onChange={(e) => {
                              const newProds = e.target.checked 
                                ? [...(u.allowedProducts || []), prod.slug]
                                : (u.allowedProducts || []).filter((p: string) => p !== prod.slug);
                              handleUpdatePermissions(u.id, u.allowedModules || [], newProds);
                            }}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{prod.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Product Management</h2>
            <p className="text-sm text-slate-500 mt-1">Add, edit, or remove products from the platform.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search products..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            <select
              value={productCountryFilter}
              onChange={(e) => setProductCountryFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
            >
              <option value="all">All Countries</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.code.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={productCategoryFilter}
              onChange={(e) => setProductCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Button onClick={handleAddProductClick} className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products
            .filter(p => {
              const matchesSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                                    p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
              const matchesCountry = productCountryFilter === 'all' || (p.countries && p.countries.includes(productCountryFilter));
              const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
              return matchesSearch && matchesCountry && matchesCategory;
            })
            .map((product) => (
            <div key={product.slug} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                <button 
                  onClick={() => handleEditProductClick(product)}
                  className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm"
                  title="Edit Product"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setDeleteProductConfirm(product.slug)}
                  className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600 hover:border-red-200 shadow-sm"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div 
                    className="w-3 h-3 rounded-full mt-1 shrink-0" 
                    style={{ backgroundColor: product.color }}
                  />
                  <div className="flex items-center gap-2">
                    <a 
                      href={product.status_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 text-right"
                    >
                      Status Page <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>
                <h4 className="font-semibold text-slate-900 pr-12">{product.name}</h4>
                <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">{product.category}</p>
                {product.countries && product.countries.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {product.countries.map((c: string) => {
                      const countryObj = COUNTRIES.find(country => country.code === c);
                      return countryObj ? (
                        <span key={c} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200" title={countryObj.name}>
                          {countryObj.flag} {countryObj.code.toUpperCase()}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {products.filter(p => {
              const matchesSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                                    p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
              const matchesCountry = productCountryFilter === 'all' || (p.countries && p.countries.includes(productCountryFilter));
              const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
              return matchesSearch && matchesCountry && matchesCategory;
            }).length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">
              {products.length === 0 ? "No products found. Add a product to get started." : "No products match your search or filter."}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-2 text-slate-900">Public Pages</h2>
        <p className="text-sm text-slate-500 mb-6">Select which pages are visible to unauthenticated visitors.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Core Modules</h4>
            <div className="space-y-2.5">
              {allModules.map(mod => (
                <label key={mod.id} className="flex items-start gap-3 text-sm cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={publicPages.includes(mod.id)}
                    onChange={(e) => togglePublicPage(mod.id, e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{mod.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Product Pages</h4>
            <div className="space-y-2.5">
              {products.map(prod => (
                <label key={`product-${prod.slug}`} className="flex items-start gap-3 text-sm cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={publicPages.includes(`product-${prod.slug}`)}
                    onChange={(e) => togglePublicPage(`product-${prod.slug}`, e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{prod.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
