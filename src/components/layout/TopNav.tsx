import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BjornLogo } from '../BjornLogo';
import { CountrySelector } from '../CountrySelector';

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout, siteSettings } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 w-full">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              {siteSettings.site_logo ? (
                <img src={siteSettings.site_logo} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <BjornLogo className="w-8 h-8" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold leading-tight text-slate-900">{siteSettings.site_name}</h1>
              <span className="text-xs text-slate-600 font-bold tracking-wide uppercase hidden sm:inline-block">
                {siteSettings.header_text}
              </span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <CountrySelector />
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.username}</span>
                <button 
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-slate-900 p-1 rounded-md hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link 
                to="/login"
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
                title="Log in"
              >
                <LogIn className="w-4 h-4" />
                <span>Log in</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

