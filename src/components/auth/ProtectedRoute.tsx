import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  sectionId: string;
}

export function ProtectedRoute({ children, sectionId }: ProtectedRouteProps) {
  const { user, isLoading, publicPages } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Check if page is public
  if (publicPages.includes(sectionId)) {
    return <>{children}</>;
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin and moderator have full access
  if (user.role === 'admin' || user.role === 'moderator') {
    return <>{children}</>;
  }

  // Viewer access control
  if (user.role === 'viewer') {
    const isModule = !sectionId.startsWith('product-');
    const isProduct = sectionId.startsWith('product-');
    
    const hasModuleAccess = isModule && user.allowedModules?.includes(sectionId);
    const hasProductAccess = isProduct && user.allowedProducts?.includes(sectionId.replace('product-', ''));
    
    if (hasModuleAccess || hasProductAccess) {
      return <>{children}</>;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-slate-500">You do not have permission to view this section.</p>
    </div>
  );
}
