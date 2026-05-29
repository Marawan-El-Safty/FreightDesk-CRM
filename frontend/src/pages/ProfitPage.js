import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Badge from '../components/common/Badge';
import {
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, BanknotesIcon,
  ScaleIcon, DocumentTextIcon, CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const Q_STATUSES = ['Draft', 'Approved', 'Sent', 'Rejected'];
const INV_STATUSES = ['Pending', 'Paid', 'Overdue'];

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-slate-500 dark:text-gray-400 text-xs mb-0.5">{label}</p>
        <p className="text-slate-900 dark:text-white font-bold text-xl leading-tight">{value}</p>
        {sub && <p className="text-slate-500 dark:text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n, currency = 'USD') {
  return `${currency} ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ─── Quotations Tab ─────────────────────────────────────────────────────────
function QuotationsTab() {
  const [quotations, setQuotations] = useState([]);
  const [status, setStatus]         = useState('');
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: { status: status || undefined, limit: 200 } });
      setQuotations(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const withData    = quotations.filter(q => parseFloat(q.buying_total || 0) > 0);
  const withoutData = quotations.filter(q => !(parseFloat(q.buying_total || 0) > 0));

  const totalSelling = withData.reduce((s, q) => s + parseFloat(q.total_amount || 0), 0);
  const totalBuying  = withData.reduce((s, q) => s + parseFloat(q.buying_total  || 0), 0);
  const totalProfit  = totalSelling - totalBuying;
  const avgMargin    = totalSelling > 0 ? (totalProfit / totalSelling) * 100 : 0;

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={`$${(totalSelling/1000).toFixed(1)}k`}
          sub={`${withData.length} with cost data`} icon={BanknotesIcon} color="bg-blue-500/15 text-blue-400" />
        <StatCard label="Total Cost" value={`$${(totalBuying/1000).toFixed(1)}k`}
          sub="buying prices" icon={ArrowTrendingDownIcon} color="bg-orange-500/15 text-orange-400" />
        <StatCard label="Total Profit" value={`$${(totalProfit/1000).toFixed(1)}k`}
          sub={totalProfit >= 0 ? 'net positive' : 'net loss'} icon={ArrowTrendingUpIcon}
          color={totalProfit >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'} />
        <StatCard label="Avg Margin" value={`${avgMargin.toFixed(1)}%`}
          sub="across cost-entered" icon={ScaleIcon}
          color={avgMargin >= 20 ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'} />
      </div>

      {/* Sub-header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          {withData.length} quotation{withData.length !== 1 ? 's' : ''} with cost data
          {withoutData.length > 0 && ` · ${withoutData.length} pending cost entry`}
        </p>
        {/* Status filter */}
        <div className="flex gap-2">
          {['', ...Q_STATUSES].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${status === s ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Route</th>
                <th>Created By</th>
                <th>Status</th>
                <th className="text-right">Selling</th>
                <th className="text-right">Buying (Cost)</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map(q => {
                const selling = parseFloat(q.total_amount || 0);
                const buying  = parseFloat(q.buying_total  || 0);
                const profit  = selling - buying;
                const margin  = selling > 0 && buying > 0 ? (profit / selling) * 100 : null;
                const hasCost = buying > 0;

                return (
                  <tr key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                    <td className="font-mono text-gold-400 text-sm">{q.reference_no}</td>
                    <td className="text-slate-900 dark:text-white font-medium">{q.client_name || '—'}</td>
                    <td className="text-slate-500 dark:text-gray-400 text-xs">{q.origin} → {q.destination}</td>
                    <td className="text-slate-500 dark:text-gray-400 text-xs">{q.created_by_name || '—'}</td>
                    <td><Badge label={q.status} type="status" /></td>
                    <td className="text-right font-semibold text-slate-900 dark:text-white text-sm">
                      {fmt(selling, q.currency)}
                    </td>
                    <td className="text-right text-sm">
                      {hasCost
                        ? <span className="text-orange-400">{fmt(buying, q.currency)}</span>
                        : <span className="text-gray-600 text-xs">— not entered</span>}
                    </td>
                    <td className="text-right font-bold text-sm">
                      {hasCost
                        ? <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(profit, q.currency)}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right text-sm">
                      {margin !== null ? (
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                          margin >= 20 ? 'bg-green-500/15 text-green-400' :
                          margin >= 10 ? 'bg-yellow-500/15 text-yellow-400' :
                          margin >= 0  ? 'bg-orange-500/15 text-orange-400' :
                                         'bg-red-500/15 text-red-400'
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!quotations.length && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-500">No quotations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState([]);
  const [status, setStatus]    = useState('');
  const [loading, setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { paymentStatus: status || undefined } });
      setInvoices(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const withData = invoices.filter(i => parseFloat(i.buying_total || 0) > 0);

  const totalSelling = withData.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalBuying  = withData.reduce((s, i) => s + parseFloat(i.buying_total || 0), 0);
  const totalProfit  = totalSelling - totalBuying;
  const avgMargin    = totalSelling > 0 ? (totalProfit / totalSelling) * 100 : 0;

  // Confirmed (Paid only)
  const paidWithData  = withData.filter(i => i.payment_status === 'Paid');
  const confirmedRev  = paidWithData.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const confirmedCost = paidWithData.reduce((s, i) => s + parseFloat(i.buying_total || 0), 0);
  const confirmedProfit = confirmedRev - confirmedCost;

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Invoiced Revenue" value={`$${(totalSelling/1000).toFixed(1)}k`}
          sub={`${withData.length} with cost data`} icon={CurrencyDollarIcon} color="bg-blue-500/15 text-blue-400" />
        <StatCard label="Total Cost" value={`$${(totalBuying/1000).toFixed(1)}k`}
          sub="buying prices" icon={ArrowTrendingDownIcon} color="bg-orange-500/15 text-orange-400" />
        <StatCard label="Confirmed Profit" value={`$${(confirmedProfit/1000).toFixed(1)}k`}
          sub={`from ${paidWithData.length} paid invoices`} icon={ArrowTrendingUpIcon}
          color={confirmedProfit >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'} />
        <StatCard label="Avg Margin" value={`${avgMargin.toFixed(1)}%`}
          sub="across invoiced" icon={ScaleIcon}
          color={avgMargin >= 20 ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'} />
      </div>

      {/* Sub-header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          {withData.length} invoice{withData.length !== 1 ? 's' : ''} with cost data
          · {invoices.length - withData.length} pending cost entry
        </p>
        <div className="flex gap-2">
          {['', ...INV_STATUSES].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${status === s ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Description</th>
                <th>Created By</th>
                <th>Status</th>
                <th className="text-right">Selling</th>
                <th className="text-right">Buying (Cost)</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const selling = parseFloat(inv.amount || 0);
                const buying  = parseFloat(inv.buying_total || 0);
                const profit  = selling - buying;
                const margin  = selling > 0 && buying > 0 ? (profit / selling) * 100 : null;
                const hasCost = buying > 0;

                return (
                  <tr key={inv.id}>
                    <td className="font-mono text-gold-400 text-sm">{inv.invoice_no}</td>
                    <td className="text-slate-900 dark:text-white font-medium">{inv.client_name || '—'}</td>
                    <td className="text-gray-400 text-sm max-w-xs truncate">{inv.description}</td>
                    <td className="text-slate-500 dark:text-gray-400 text-xs">{inv.created_by_name || '—'}</td>
                    <td><Badge label={inv.payment_status} type="status" /></td>
                    <td className="text-right font-semibold text-slate-900 dark:text-white text-sm">
                      {fmt(selling, inv.currency)}
                    </td>
                    <td className="text-right text-sm">
                      {hasCost
                        ? <span className="text-orange-400">{fmt(buying, inv.currency)}</span>
                        : <span className="text-gray-600 text-xs">— not entered</span>}
                    </td>
                    <td className="text-right font-bold text-sm">
                      {hasCost
                        ? <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(profit, inv.currency)}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right text-sm">
                      {margin !== null ? (
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                          margin >= 20 ? 'bg-green-500/15 text-green-400' :
                          margin >= 10 ? 'bg-yellow-500/15 text-yellow-400' :
                          margin >= 0  ? 'bg-orange-500/15 text-orange-400' :
                                         'bg-red-500/15 text-red-400'
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!invoices.length && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-500">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProfitPage() {
  const [tab, setTab] = useState('quotations');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Profit & Margin</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Track revenue, costs, and profit across quotations and invoices</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl w-fit">
        <button
          onClick={() => setTab('quotations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'quotations'
              ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          Quotations
          <span className="text-xs opacity-60">(Estimated)</span>
        </button>
        <button
          onClick={() => setTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'invoices'
              ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CurrencyDollarIcon className="w-4 h-4" />
          Invoices
          <span className="text-xs opacity-60">(Confirmed)</span>
        </button>
      </div>

      {tab === 'quotations' ? <QuotationsTab /> : <InvoicesTab />}
    </div>
  );
}
