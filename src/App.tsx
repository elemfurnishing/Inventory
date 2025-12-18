import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import History from './components/History';
import Settings from './components/Settings';


function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem('current_app_page') || 'dashboard');
  
  useEffect(() => {
    if (user && user.pageAccess && user.pageAccess.length > 0) {
        const allowedPages = user.pageAccess.map(p => p.toLowerCase());
        const savedPage = localStorage.getItem('current_app_page');

        if (savedPage && allowedPages.includes(savedPage)) {
            setCurrentPage(savedPage);
        } else if (!allowedPages.includes(currentPage)) {
            setCurrentPage(allowedPages[0]);
        }
    }
  }, [user]);

  if (!user) {
    return <Login />;
  }

  const handleNavigate = (page: string) => {
    if (page === currentPage) return;
    setCurrentPage(page);
    localStorage.setItem('current_app_page', page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <Inventory />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
