import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { ProductDetail } from './pages/ProductDetail';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { ModuleProducts } from './pages/ModuleProducts';
import { SecurityOverview } from './pages/SecurityOverview';
import { Certifications } from './pages/Certifications';
import { Policies } from './pages/Policies';
import { Legal } from './pages/Legal';
import { Controls } from './pages/Controls';
import { Subprocessors } from './pages/Subprocessors';
import { AdminKPI } from './pages/AdminKPI';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

export default function App() {
  const { isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Determine active section from path for the Layout
  const getActiveSection = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path === '/login') return 'login';
    if (path === '/admin/kpi') return 'admin-kpi';
    if (path === '/admin') return 'admin';
    if (path.startsWith('/product/')) {
      return `product-${path.split('/')[2]}`;
    }
    // Handle paths like /policies/lundify -> policies
    return path.split('/')[1];
  };

  const activeSection = getActiveSection();

  return (
    <Layout activeSection={activeSection}>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute sectionId="dashboard">
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/documents" element={
          <ProtectedRoute sectionId="documents">
            <Documents />
          </ProtectedRoute>
        } />
        <Route path="/security-overview" element={
          <ProtectedRoute sectionId="security-overview">
            <SecurityOverview />
          </ProtectedRoute>
        } />
        <Route path="/controls/:slug?" element={
          <ProtectedRoute sectionId="controls">
            <Controls />
          </ProtectedRoute>
        } />
        <Route path="/certifications" element={
          <ProtectedRoute sectionId="certifications">
            <Certifications />
          </ProtectedRoute>
        } />
        <Route path="/subprocessors/:slug?" element={
          <ProtectedRoute sectionId="subprocessors">
            <Subprocessors />
          </ProtectedRoute>
        } />
        <Route path="/policies/:slug?" element={
          <ProtectedRoute sectionId="policies">
            <Policies />
          </ProtectedRoute>
        } />
        <Route path="/legal/:slug?" element={
          <ProtectedRoute sectionId="legal">
            <Legal />
          </ProtectedRoute>
        } />
        <Route path="/dpa" element={
          <ProtectedRoute sectionId="dpa">
            <ModuleProducts moduleName="dpa" />
          </ProtectedRoute>
        } />
        <Route path="/product/:slug" element={<ProductDetailWrapper />} />
        <Route path="/admin" element={
          <ProtectedRoute sectionId="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/kpi" element={
          <ProtectedRoute sectionId="admin-kpi">
            <AdminKPI />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function ProductDetailWrapper() {
  const location = useLocation();
  const slug = location.pathname.split('/')[2];
  
  return (
    <ProtectedRoute sectionId={`product-${slug}`}>
      <ProductDetail />
    </ProtectedRoute>
  );
}

