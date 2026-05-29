import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import OfflineBanner from '../common/OfflineBanner';
import GlobalSearch from '../common/GlobalSearch';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/leads': 'Leads Pipeline',
  '/quotations': 'Quotations',
  '/calculator': 'Freight Rate Calculator',
  '/activities': 'Activities & Follow-ups',
  '/tasks': 'Tasks',
  '/requests': 'Open Requests',
  '/invoices': 'Invoices',
  '/reports': 'Reports & KPIs',
  '/users': 'User Management',
};

export default function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'FreightDesk CRM';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-navy-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <OfflineBanner />
      <GlobalSearch />
    </div>
  );
}
