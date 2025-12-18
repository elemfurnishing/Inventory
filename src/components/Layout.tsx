import { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Package, History, LogOut, Menu, X, Settings, Loader } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavigation = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white shadow-sm flex-none z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600" />
              <h1 className="ml-3 text-xl font-bold text-gray-800">Inventory System</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-800">{user?.displayName || user?.username}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-800 bg-opacity-50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center">
             <Package className="w-8 h-8 text-blue-600" />
             <h1 className="ml-3 text-xl font-bold text-gray-800">Inventory System</h1>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.filter(item => {
            if (!user?.pageAccess || user.pageAccess.length === 0) return true;
            return user.pageAccess.includes(item.label);
          }).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${currentPage === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/30">
          <div className="mb-4 px-4">
             <div className="text-sm font-medium text-gray-800">{user?.displayName || user?.username}</div>
             <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition font-medium"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.filter(item => {
              if (!user?.pageAccess || user.pageAccess.length === 0) return true; // Default to all if not specified or empty (for backward compatibility or admins) -> Actually prompt says "match in sidebar... then show this page only".
              // But what about Admin? Usually Admins see all. The Sheet has "Page Access" for all roles.
              // Logic: If pageAccess is present, filter. If empty/undefined, maybe show nothing or all?
              // Let's assume empty means "Use Default" or "No Access".
              // Prompt: "in this column data store 'Dashboard', 'Inventory'... match in side bar then after login show this page only"
              // So we strict filter.
              return user.pageAccess.includes(item.label);
            }).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={logout}
              className="w-full flex items-center px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full h-full">
              {children}
            </div>
          </main>

          <footer className="bg-gray-800 text-white py-2 flex-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <p className="text-xs">
                Powered By{' '}
                <a
                  href="https://www.botivate.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-semibold underline"
                >
                  Botivate
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
