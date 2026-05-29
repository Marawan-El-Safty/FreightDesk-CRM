import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const QuotationFormPage = lazy(() => import('./pages/QuotationFormPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const FreightCalculatorPage = lazy(() => import('./pages/FreightCalculatorPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const ProfitPage = lazy(() => import('./pages/ProfitPage'));
const BankAccountsPage = lazy(() => import('./pages/BankAccountsPage'));
const ShippingRatesPage = lazy(() => import('./pages/ShippingRatesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/new" element={<QuotationFormPage />} />
          <Route path="quotations/:id/edit" element={<QuotationFormPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="invoices" element={
            <ProtectedRoute roles={['Admin', 'Finance']}>
              <InvoicesPage />
            </ProtectedRoute>
          } />
          <Route path="calculator" element={<FreightCalculatorPage />} />
          <Route path="profit" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager']}>
              <ProfitPage />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute roles={['Admin', 'Sales Manager']}>
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute roles={['Admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="bank-accounts" element={
            <ProtectedRoute roles={['Admin']}>
              <BankAccountsPage />
            </ProtectedRoute>
          } />
          <Route path="shipping-rates" element={<ShippingRatesPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                borderRadius: '14px',
                padding: '14px 18px',
                fontSize: '14px',
                fontWeight: '500',
                maxWidth: '420px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
                style: {
                  background: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #bbf7d0',
                },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
                style: {
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                },
                duration: 6000,
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
