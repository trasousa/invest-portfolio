import { useEffect, useState } from 'react';
import axios from 'axios';
import { Navigation } from './components/Navigation';

import { AddAssetModal } from './components/AddAssetModal';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { DashboardPage } from './pages/DashboardPage';
import { WealthPage } from './pages/WealthPage';
import { AssetsPage } from './pages/AssetsPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { DiversificationPage } from './pages/DiversificationPage';
import { DebtsPage } from './pages/DebtsPage';
import { CashPage } from './pages/CashPage';
import { PensionsPage } from './pages/PensionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatWidget } from './components/ChatWidget';
import type { PortfolioSummary, HoldingCreate, UserProfile } from './types';
import { formatCurrency } from './utils/currency';
import './styles/main.css';

const API_URL = '/api';

type View = 'dashboard' | 'wealth' |
  'stocks' | 'stocks-holdings' | 'stocks-dividends' | 'stocks-diversification' |
  'crypto' | 'crypto-holdings' | 'crypto-diversification' |
  'properties' | 'properties-holdings' | 'properties-diversification' |
  'bonds' | 'bonds-holdings' | 'bonds-diversification' |
  'debts' | 'cash' |
  'diversification' | 'settings' | 'pensions';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    total_value: 0,
    total_assets: 0,
    total_debt: 0,
    annual_income: 0,
    dividend_yield: 0,
    yield_on_cost: 0,
  });
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isAddCryptoModalOpen, setIsAddCryptoModalOpen] = useState(false);
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false);
  const [isAddBondModalOpen, setIsAddBondModalOpen] = useState(false);

  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Set a timeout of 5 seconds
        await axios.get('/api/', { timeout: 5000 });
        setBackendUp(true);
      } catch (error) {
        console.error('Backend health check failed:', error);
        setBackendUp(false);
      }
    };
    checkHealth();
  }, []);

  // Load user profile
  useEffect(() => {
    if (token && backendUp) {
      loadUserProfile();
    }
  }, [token, backendUp]);

  // Apply theme
  useEffect(() => {
    if (userProfile?.theme_preference) {
      document.documentElement.setAttribute('data-theme', userProfile.theme_preference);
    } else {
      document.documentElement.setAttribute('data-theme', 'ocean-dark');
    }
  }, [userProfile?.theme_preference]);

  const loadUserProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(res.data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      // If profile load fails (e.g. invalid token), logout immediately
      logout();
    }
  };

  const fetchData = (force: boolean = false) => {
    if (!token || !backendUp) return;

    const config = { headers: { Authorization: `Bearer ${token}` } };

    axios
      .get(`${API_URL}/holdings/`, config)
      .then(res => setHoldings(res.data))
      .catch(error => {
        console.error('Error fetching holdings:', error);
        if (error.response?.status === 401) {
          logout();
        }
      });

    axios
      .get(`${API_URL}/portfolio/summary${force ? '?force_refresh=true' : ''}`, config)
      .then(res => setSummary(res.data))
      .catch(error => {
        console.error('Error fetching summary:', error);
        if (error.response?.status === 401) {
          logout();
        }
      });
  };

  useEffect(() => {
    if (backendUp && token) {
      fetchData();
    }
  }, [token, backendUp]);

  useEffect(() => {
    const handleOpenAddStock = () => setIsAddStockModalOpen(true);
    const handleOpenAddCrypto = () => setIsAddCryptoModalOpen(true);
    const handleOpenAddProperty = () => setIsAddPropertyModalOpen(true);
    const handleOpenAddBond = () => setIsAddBondModalOpen(true);

    document.addEventListener('openAddStockModal', handleOpenAddStock);
    document.addEventListener('openAddCryptoModal', handleOpenAddCrypto);
    document.addEventListener('openAddPropertyModal', handleOpenAddProperty);
    document.addEventListener('openAddBondModal', handleOpenAddBond);

    return () => {
      document.removeEventListener('openAddStockModal', handleOpenAddStock);
      document.removeEventListener('openAddCryptoModal', handleOpenAddCrypto);
      document.removeEventListener('openAddPropertyModal', handleOpenAddProperty);
      document.removeEventListener('openAddBondModal', handleOpenAddBond);
    };
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserProfile(null);
    setAuthView('login');
  };

  const handleAddHolding = async (holding: HoldingCreate) => {
    try {
      await axios.post(`${API_URL}/holdings/`, holding, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (error) {
      console.error('Error adding holding:', error);
      alert('Failed to add holding.');
    }
  };

  const handleDeleteHolding = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/holdings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (error) {
      console.error('Error deleting holding:', error);
      alert('Failed to delete holding.');
    }
  };

  const renderContent = () => {
    if (currentView === 'dashboard') {
      return <DashboardPage token={token!} holdings={holdings} userProfile={userProfile} currency={userProfile?.currency || 'USD'} onLogout={logout} />;
    }

    if (currentView === 'wealth') {
      return <WealthPage currency={userProfile?.currency || 'USD'} />;
    }

    if (currentView.startsWith('stocks') || currentView.startsWith('crypto') || currentView.startsWith('bonds')) {
      return (
        <AssetsPage
          holdings={holdings}
          token={token!}
          onRefresh={fetchData}
          view={currentView}
          currency={userProfile?.currency || 'USD'}
        />
      );
    }

    if (currentView.startsWith('properties')) {
      return (
        <PropertiesPage
          holdings={holdings}
          token={token!}
          onRefresh={fetchData}
          currency={userProfile?.currency || 'USD'}
        />
      );
    }

    if (currentView === 'debts') {
      return <DebtsPage token={token!} />;
    }

    if (currentView === 'cash') {
      return <CashPage token={token!} />;
    }

    if (currentView === 'diversification') {
      return <DiversificationPage token={token!} holdings={holdings} />;
    }

    if (currentView === 'settings') {
      return (
        <SettingsPage
          token={token!}
          userProfile={userProfile}
          onProfileUpdate={loadUserProfile}
          onLogout={logout}
        />
      );
    }

    if (currentView === 'pensions') {
      return (
        <PensionsPage
          holdings={holdings}
          currency={userProfile?.currency || 'USD'}
          onAddHolding={handleAddHolding}
          onDeleteHolding={handleDeleteHolding}
        />
      );
    }

    return <div>Page not found</div>;
  };

  if (backendUp === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-white animate-pulse">Loading system...</div>
      </div>
    );
  }

  if (backendUp === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary text-center p-4">
        <div className="bg-surface p-8 rounded-2xl border border-border shadow-2xl max-w-md w-full backdrop-blur-xl animate-fade-in">
          <div className="text-6xl mb-6">🙈</div>
          <h2 className="text-2xl font-bold text-white mb-2">Oops! System Unavailable</h2>
          <p className="text-text-secondary mb-6">
            The backend server seems to be taking a nap. It might still be waking up (installing dependencies).
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full py-3 text-lg shadow-lg hover:scale-105 transition-transform"
            >
              Wake Up & Retry
            </button>
            <p className="text-xs text-text-muted mt-2">
              If this persists, check your terminal for backend errors.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return authView === 'login' ?
      <Login onLogin={login} onSwitchToSignup={() => setAuthView('signup')} /> :
      <Signup onSignupSuccess={() => setAuthView('login')} onSwitchToLogin={() => setAuthView('login')} />;
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col font-sans">
      <Navigation
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        userProfile={userProfile}
        onLogout={logout}
      />
      <main className="flex-1 pt-16 pb-20 md:pb-0 relative overflow-hidden flex flex-col">
        {/* Top Info Bar (Below Nav on Desktop) */}
        <div className="px-6 py-2 border-b border-border bg-surface/50 backdrop-blur-sm flex items-center justify-between text-sm hidden md:flex">
          <div className="flex items-center gap-4 text-text-secondary">
             <span className="capitalize font-medium text-white">{currentView.replace('-', ' ')}</span>
             <span className="w-1 h-1 bg-text-muted rounded-full"></span>
             <span>Total: <span className="text-primary font-mono">{formatCurrency(summary.total_value, userProfile?.currency || 'USD')}</span></span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="text-xs hover:text-primary transition-colors flex items-center gap-1"
          >
            ↻ Refresh Data
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {renderContent()}
        </div>
      </main>

      <ChatWidget token={token!} userProfile={userProfile} />


      <AddAssetModal
        isOpen={isAddStockModalOpen}
        onClose={() => setIsAddStockModalOpen(false)}
        onAdd={handleAddHolding}
        type="stock"
      />

      <AddAssetModal
        isOpen={isAddCryptoModalOpen}
        onClose={() => setIsAddCryptoModalOpen(false)}
        onAdd={handleAddHolding}
        type="crypto"
      />

      <AddAssetModal
        isOpen={isAddPropertyModalOpen}
        onClose={() => setIsAddPropertyModalOpen(false)}
        onAdd={handleAddHolding}
        type="property"
      />
      <AddAssetModal
        isOpen={isAddBondModalOpen}
        onClose={() => setIsAddBondModalOpen(false)}
        onAdd={handleAddHolding}
        type="bond"
      />
    </div>
  );
}

export default App;
