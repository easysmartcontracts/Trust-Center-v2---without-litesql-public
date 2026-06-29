import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: number;
  username: string;
  role: 'admin' | 'moderator' | 'viewer';
  allowedModules?: string[];
  allowedProducts?: string[];
  token?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  publicPages: string[];
  siteSettings: {
    site_logo: string;
    site_name: string;
    header_text: string;
    mailto_certifications: string;
    mailto_policies: string;
    mailto_legal: string;
    privacy_notice: string;
    cookie_notice: string;
  };
  login: (user: User) => void;
  logout: () => void;
  refreshPublicPages: () => void;
  refreshSiteSettings: () => void;
  getAuthHeaders: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [publicPages, setPublicPages] = useState<string[]>([]);
  const [siteSettings, setSiteSettings] = useState({
    site_logo: '',
    site_name: 'Bjorn Lunden',
    header_text: 'Trust Center',
    mailto_certifications: 'security@bjornlunden.com',
    mailto_policies: 'security@bjornlunden.com',
    mailto_legal: 'security@bjornlunden.com',
    privacy_notice: '',
    cookie_notice: ''
  });

  const getAuthHeaders = () => {
    const token = user?.token || localStorage.getItem('auth_token');
    if (!token || token === 'undefined' || token === 'null') return {};
    return { 'Authorization': `Bearer ${token}` };
  };

  const refreshPublicPages = async () => {
    try {
      const res = await fetch('/api/public/pages');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setPublicPages(data);
        } else {
          setPublicPages(['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal']);
        }
      } else {
        setPublicPages(['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal']);
      }
    } catch (err) {
      console.error('Failed to fetch public pages', err);
      setPublicPages(['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal']);
    }
  };

  const refreshSiteSettings = async () => {
    try {
      const res = await fetch('/api/public/dashboard-settings');
      if (res.ok) {
        const data = await res.json();
        setSiteSettings({
          site_logo: data.site_logo || '',
          site_name: data.site_name || 'Bjorn Lunden',
          header_text: data.header_text || 'Trust Center',
          mailto_certifications: data.mailto_certifications || 'security@bjornlunden.com',
          mailto_policies: data.mailto_policies || 'security@bjornlunden.com',
          mailto_legal: data.mailto_legal || 'security@bjornlunden.com',
          privacy_notice: data.privacy_notice || '',
          cookie_notice: data.cookie_notice || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch site settings', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Starting Auth initialization...');
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // Run both fetches in parallel
        console.log('Fetching auth, pages, and settings...');
        const [authRes, pagesRes, settingsRes] = await Promise.all([
          fetch('/api/auth/me', { headers }).catch(() => null),
          fetch('/api/public/pages').catch(() => null),
          fetch('/api/public/dashboard-settings').catch(() => null)
        ]);
        console.log('Fetches completed.');

        if (authRes && authRes.ok) {
          const data = await authRes.json();
          setUser({ ...data, token: token || undefined });
          console.log('User authenticated.');
        } else {
          console.log('User not authenticated.');
        }

        if (pagesRes && pagesRes.ok) {
          const data = await pagesRes.json();
          if (data && data.length > 0) {
            setPublicPages(data);
          } else {
            setPublicPages(['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal']);
          }
          console.log('Public pages fetched.');
        } else {
          setPublicPages(['dashboard', 'security-overview', 'dpa', 'subprocessors', 'policies', 'certifications', 'controls', 'legal']);
        }

        if (settingsRes && settingsRes.ok) {
          const data = await settingsRes.json();
          setSiteSettings({
            site_logo: data.site_logo || '',
            site_name: data.site_name || 'Bjorn Lunden',
            header_text: data.header_text || 'Trust Center',
            mailto_certifications: data.mailto_certifications || 'security@bjornlunden.com',
            mailto_policies: data.mailto_policies || 'security@bjornlunden.com',
            mailto_legal: data.mailto_legal || 'security@bjornlunden.com',
            privacy_notice: data.privacy_notice || '',
            cookie_notice: data.cookie_notice || ''
          });
          console.log('Site settings fetched.');
        }
      } catch (err) {
        console.error('Initialization failed', err);
      } finally {
        console.log('Auth initialization finished.');
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (userData: User) => {
    if (userData.token && userData.token !== 'undefined' && userData.token !== 'null') {
      localStorage.setItem('auth_token', userData.token);
    }
    setUser(userData);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  useEffect(() => {
    let timeoutId: number | NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId as any);
      if (user) {
        timeoutId = setTimeout(() => {
          logout();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    if (user) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('scroll', resetTimer);
    }

    return () => {
      clearTimeout(timeoutId as any);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, publicPages, siteSettings, login, logout, refreshPublicPages, refreshSiteSettings, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
