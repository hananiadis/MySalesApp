import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Supplier Orders', to: '/supplier-orders' },
  { label: 'Activity Log', to: '/activity-log' },
];

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Warehouse</p>
          <h1 className="text-xl font-bold">Operations</h1>
          <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
        </div>
        <nav className="px-3">
          {navItems.map((item) => (
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
          ))}
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Warehouse</p>
            <h1 className="text-lg font-bold">Operations</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
