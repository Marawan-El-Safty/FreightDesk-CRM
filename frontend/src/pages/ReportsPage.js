import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTheme } from '../store/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#C9A84C', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function fmtHours(h) {
  const total = Math.round(parseFloat(h || 0) * 60);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs === 0 && mins === 0) return '—';
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function ReportsPage() {
  const { theme } = useTheme();
  const [tab, setTab] = useState('performance');
  const [performance, setPerformance] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [userTime, setUserTime] = useState([]);
  const [timeLoading, setTimeLoading] = useState(false);

  const chartGrid = theme === 'dark' ? '#1e3a5f' : '#e2e8f0';
  const chartTick = theme === 'dark' ? '#9ca3af' : '#64748b';
  const chartTooltip = theme === 'dark'
    ? { background: '#0d2144', border: '1px solid #1e3a5f', borderRadius: 8, color: '#fff' }
    : { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = async () => {
    setLoading(true);
    try {
      const [perfRes, pipeRes] = await Promise.all([
        api.get('/reports/performance', { params: { from, to } }),
        api.get('/reports/pipeline'),
      ]);
      setPerformance(perfRes.data.data || []);
      setPipeline(pipeRes.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const loadUserTime = async () => {
    setTimeLoading(true);
    try {
      const res = await api.get('/sessions/user-time');
      setUserTime(res.data.data || []);
    } catch (_) {}
    finally { setTimeLoading(false); }
  };

  useEffect(() => { load(); }, [from, to]);
  useEffect(() => { if (tab === 'time') loadUserTime(); }, [tab]);

  const exportPerformance = async () => {
    try {
      const res = await api.get('/reports/export/performance', {
        params: { from, to },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `performance-${from}-${to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Reports & KPIs</h2>
        </div>
        {tab === 'performance' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="text-slate-500 dark:text-gray-400">From:</label>
              <input className="input w-36 text-xs" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              <label className="text-slate-500 dark:text-gray-400">To:</label>
              <input className="input w-36 text-xs" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={exportPerformance}>
              <ArrowDownTrayIcon className="w-4 h-4 inline mr-1.5" />Export Excel
            </button>
          </div>
        )}
        {tab === 'time' && (
          <button className="btn-secondary" onClick={loadUserTime} disabled={timeLoading}>
            <ArrowPathIcon className={`w-4 h-4 inline mr-1.5 ${timeLoading ? 'animate-spin' : ''}`} />Refresh
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-900 rounded-lg p-1 w-fit">
        {[
          { key: 'performance', label: 'Performance' },
          { key: 'time', label: 'User Time' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── USER TIME TAB ─────────────────────────────── */}
      {tab === 'time' && (
        <div className="card">
          <h3 className="section-title mb-4">User Time Tracker</h3>
          {timeLoading ? (
            <div className="text-center py-10 text-slate-500 dark:text-gray-500">Loading...</div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Today</th>
                    <th>This Week</th>
                    <th>Sessions Today</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {userTime.map(u => (
                    <tr key={u.id}>
                      <td className="font-medium text-slate-900 dark:text-white">{u.full_name}</td>
                      <td className="text-slate-500 dark:text-gray-400 text-xs">{u.role_name}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.is_online ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-navy-600'}`} />
                          {u.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>
                        <span className={`font-semibold ${parseFloat(u.today_hours) > 0 ? 'text-gold-500' : 'text-slate-400 dark:text-gray-500'}`}>
                          {fmtHours(u.today_hours)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 dark:bg-navy-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min((parseFloat(u.week_hours || 0) / 40) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-slate-600 dark:text-gray-300 font-medium text-xs">{fmtHours(u.week_hours)}</span>
                        </div>
                      </td>
                      <td className="text-slate-500 dark:text-gray-400">{u.today_sessions || 0}</td>
                      <td className="text-slate-400 dark:text-gray-500 text-xs">
                        {u.last_login ? new Date(u.last_login).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!userTime.length && (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500 dark:text-gray-500">No session data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-400 dark:text-gray-600 mt-3">
            Week bar is relative to 40h/week. Online users show live duration.
          </p>
        </div>
      )}

      {/* ── PERFORMANCE TAB ───────────────────────────── */}
      {tab === 'performance' && <>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reps', value: performance.length, color: 'text-slate-900 dark:text-white' },
          { label: 'Total Won Deals', value: performance.reduce((s, r) => s + parseInt(r.won_deals || 0), 0), color: 'text-green-400' },
          { label: 'Total Activities', value: performance.reduce((s, r) => s + parseInt(r.total_activities || 0), 0), color: 'text-blue-400' },
          { label: 'Avg Conversion', value: `${(performance.reduce((s, r) => s + parseFloat(r.conversion_rate || 0), 0) / Math.max(performance.length, 1)).toFixed(1)}%`, color: 'text-gold-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className={`stat-value ${color}`}>{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Performance Table */}
      <div className="card">
        <h3 className="section-title mb-4">Performance by Rep</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-500">Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Sales Rep</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Total Leads</th>
                  <th>Activities</th>
                  <th>Calls</th>
                  <th>Meetings</th>
                  <th>Emails</th>
                  <th>Quotations</th>
                  <th>Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {performance.map(rep => (
                  <tr key={rep.id}>
                    <td className="font-medium text-slate-900 dark:text-white">{rep.full_name}</td>
                    <td className="text-green-400 font-semibold">{rep.won_deals || 0}</td>
                    <td className="text-red-400">{rep.lost_deals || 0}</td>
                    <td>{rep.total_leads || 0}</td>
                    <td className="text-blue-400">{rep.total_activities || 0}</td>
                    <td>{rep.calls || 0}</td>
                    <td>{rep.meetings || 0}</td>
                    <td>{rep.emails || 0}</td>
                    <td>{rep.quotations_sent || 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-navy-700 rounded-full h-1.5">
                          <div
                            className="bg-gold-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(parseFloat(rep.conversion_rate || 0), 100)}%` }}
                          />
                        </div>
                        <span className="text-gold-400 font-medium text-xs">{rep.conversion_rate || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!performance.length && (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-500 dark:text-gray-500">No data for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Won deals chart */}
        <div className="card">
          <h3 className="section-title mb-4">Won Deals by Rep</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={performance}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="full_name" tick={{ fill: chartTick, fontSize: 10 }} />
              <YAxis tick={{ fill: chartTick, fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltip} />
              <Bar dataKey="won_deals" name="Won" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost_deals" name="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline stages */}
        <div className="card">
          <h3 className="section-title mb-4">Current Pipeline</h3>
          {pipeline?.stages?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipeline.stages}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="stage" tick={{ fill: chartTick, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTick, fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 dark:text-gray-500">No pipeline data</div>
          )}
        </div>

        {/* Shipment types */}
        {pipeline?.shipmentTypes?.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="section-title mb-4">Leads by Shipment Type</h3>
            <div className="flex items-center gap-8">
              <PieChart width={180} height={180}>
                <Pie data={pipeline.shipmentTypes} cx={85} cy={85} outerRadius={70} dataKey="count">
                  {pipeline.shipmentTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {pipeline.shipmentTypes.map((st, i) => (
                  <div key={st.shipment_type} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-700 dark:text-gray-300">{st.shipment_type || 'Unknown'}</span>
                    <span className="text-slate-900 dark:text-white font-semibold">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      </>}
    </div>
  );
}
