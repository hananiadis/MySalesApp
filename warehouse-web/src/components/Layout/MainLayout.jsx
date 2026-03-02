import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import t from '../../utils/translations';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';

const navItems = [
  { label: t.nav.dashboard, to: '/dashboard' },
  {
    label: t.nav.stock,
    children: [
      { label: t.nav.stockList, to: '/stock' },
      { label: t.nav.stockAdjustment, to: '/stock/adjust' },
      { label: t.nav.inventoryCount, to: '/stock/count' },
    ],
  },
  {
    label: t.nav.orders,
    children: [
      { label: t.nav.ordersList, to: '/orders' },
    ],
  },
  { label: t.nav.supplierOrders, to: '/supplier-orders' },
  { label: t.nav.activityLog, to: '/activity-log' },
];

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({ Stock: true, 'Customer Orders': false });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canDebug = ['warehouse_manager', 'owner', 'admin'].includes(user?.role);

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:hidden ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Warehouse</p>
            <h1 className="text-xl font-bold">Operations</h1>
            <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={closeMobileMenu}
            className="p-1 rounded hover:bg-slate-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navItems.map((item) => {
            if (item.children) {
              const isAnyChildActive = item.children.some((child) =>
                location.pathname.startsWith(child.to),
              );
              const isOpen = openMenus[item.label];

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isAnyChildActive
                        ? 'bg-sky-50 text-sky-700 border border-sky-100'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={closeMobileMenu}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? 'bg-sky-100 text-sky-800 font-semibold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => {
              logout();
              closeMobileMenu();
            }}
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {t.nav.logout}
          </button>
        </nav>
        
        {/* Language Switcher */}
        <div className="px-4 py-3 border-t border-slate-200">
          <LanguageSwitcher />
        </div>
        
        {canDebug ? (
          <div className="px-4 py-4 border-t border-slate-200 space-y-2">
            <Link 
              to="/settings/cache" 
              onClick={closeMobileMenu}
              className="block text-xs text-gray-600 hover:text-blue-600 font-medium"
            >
              ⚙️ Cache Settings
            </Link>
            <Link 
              to="/debug-firestore" 
              onClick={closeMobileMenu}
              className="block text-xs text-gray-400 hover:text-gray-700"
            >
              🐛 Debug
            </Link>
          </div>
        ) : null}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Warehouse</p>
          <h1 className="text-xl font-bold">Operations</h1>
          <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
        </div>
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            if (item.children) {
              const isAnyChildActive = item.children.some((child) =>
                location.pathname.startsWith(child.to),
              );
              const isOpen = openMenus[item.label];

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isAnyChildActive
                        ? 'bg-sky-50 text-sky-700 border border-sky-100'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? 'bg-sky-100 text-sky-800 font-semibold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {t.nav.logout}
          </button>
        </nav>
        
        {/* Language Switcher */}
        <div className="px-4 py-3 border-t border-slate-200">
          <LanguageSwitcher />
        </div>
        
        {canDebug ? (
          <div className="px-4 py-4 border-t border-slate-200 space-y-2">
            <Link 
              to="/settings/cache" 
              className="block text-xs text-gray-600 hover:text-blue-600 font-medium"
            >
              ⚙️ Cache Settings
            </Link>
            <Link 
              to="/debug-firestore" 
              className="block text-xs text-gray-400 hover:text-gray-700"
            >
              🐛 Debug
            </Link>
          </div>
        ) : null}
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded hover:bg-slate-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Warehouse</p>
              <h1 className="text-lg font-bold">Operations</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {t.nav.logout}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;

