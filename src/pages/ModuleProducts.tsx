import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';

type Product = {
  slug: string;
  name: string;
  category: string;
  color: string;
  status_url: string;
};

type ModuleProductsProps = {
  moduleName: string;
};

export function ModuleProducts({ moduleName }: ModuleProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const { user, publicPages } = useAuth();
  const country = useCountry();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/public/products?country=${country}&t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Failed to fetch products', err));
  }, [country]);

  const filteredProducts = products.filter(product => {
    if (user?.role === 'admin' || user?.role === 'moderator') return true;
    if (publicPages.includes(`product-${product.slug}`)) return true;
    if (user?.role === 'viewer' && user.allowedProducts?.includes(product.slug)) return true;
    return false;
  });

  const getModuleTitle = (name: string) => {
    switch (name) {
      case 'security-overview': return 'Security Overview';
      case 'controls': return 'Controls';
      case 'certifications': return 'Certifications and Reports';
      case 'policies': return 'Policies';
      case 'dpa': return 'DPA & DPIA';
      case 'subprocessors': return 'Subprocessors';
      default: return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{getModuleTitle(moduleName)}</h1>
          <p className="text-slate-500 mt-1">Select a product to view its {getModuleTitle(moduleName).toLowerCase()}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div 
            key={product.slug} 
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer relative group"
            onClick={() => navigate(`/product/${product.slug}`)}
          >
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
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 text-right"
                  >
                    Status Page <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <h4 className="font-semibold text-slate-900 pr-12">{product.name}</h4>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{product.category}</p>
            </div>
          </div>
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No products available.
        </div>
      )}
    </div>
  );
}
