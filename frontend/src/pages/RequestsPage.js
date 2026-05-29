import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, BriefcaseIcon, PaperAirplaneIcon,
  ChatBubbleLeftRightIcon, UserIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { useAuth } from '../store/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { formatDistanceToNow } from 'date-fns';

const STATUSES   = ['Open', 'In Progress', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

// ── New Request Form ──────────────────────────────────────────────────────────
function RequestForm({ onSave, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'Medium', clientId: '' });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/clients', { params: { limit: 100 } }).then(r => setClients(r.data.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/requests', form);
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error creating request'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label">Title *</label>
        <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Priority</label>
          <select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Linked Client</label>
          <select className="select" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
            <option value="">Optional...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</button>
      </div>
    </form>
  );
}

// ── Request Detail + Reply Thread ─────────────────────────────────────────────
function RequestDetailModal({ requestId, onClose, onUpdated, canManage, users, currentUser }) {
  const [req, setReq]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply]   = useState('');
  const [sending, setSending] = useState(false);
  const [resolution, setResolution] = useState('');
  const scrollRef = useRef(null);

  const loadDetail = useCallback(async () => {
    try {
      const res = await api.get(`/requests/${requestId}`);
      setReq(res.data.data);
      setResolution(res.data.data.resolution || '');
    } catch (_) {}
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Auto-scroll replies to bottom when loaded
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [req?.replies?.length]);

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/requests/${requestId}/replies`, { message: reply.trim() });
      setReply('');
      loadDetail();
    } catch (err) { toast.error(err.response?.data?.error || 'Error sending reply'); }
    finally { setSending(false); }
  };

  const handleStatusChange = async (status) => {
    try {
      await api.put(`/requests/${requestId}`, { status });
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  const handleAssign = async (assignedTo) => {
    try {
      await api.put(`/requests/${requestId}`, { assignedTo });
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  const handleSaveResolution = async () => {
    try {
      await api.put(`/requests/${requestId}`, { resolution });
      toast.success('Resolution saved');
      loadDetail();
      onUpdated();
    } catch (_) {}
  };

  if (loading) return <div className="py-12 text-center text-slate-500 dark:text-gray-500">Loading...</div>;
  if (!req)    return <div className="py-12 text-center text-slate-500 dark:text-gray-500">Request not found</div>;

  const isManagerRole = ['Admin', 'Sales Manager'].includes(currentUser?.role);

  return (
    <div className="flex flex-col gap-0 flex-1 overflow-hidden">
      {/* ── Top: Request info ── */}
      <div className="p-5 border-b border-slate-200 dark:border-navy-700 space-y-4">
        {/* Title + badges */}
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{req.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge label={req.status}   type="status"   />
            <Badge label={req.priority} type="priority" />
            {req.client_name && (
              <span className="text-xs text-gold-600 dark:text-gold-400">🏢 {req.client_name}</span>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
            <UserIcon className="w-3.5 h-3.5" />
            <span>Submitted by <span className="font-medium text-slate-700 dark:text-gray-300">{req.submitted_by_name}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          {req.assigned_to_name && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
              <UserIcon className="w-3.5 h-3.5" />
              <span>Assigned to <span className="font-medium text-slate-700 dark:text-gray-300">{req.assigned_to_name}</span></span>
            </div>
          )}
          {req.closed_at && (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <ClockIcon className="w-3.5 h-3.5" />
              <span>Closed {new Date(req.closed_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {req.description && (
          <p className="text-sm text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-navy-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700">
            {req.description}
          </p>
        )}

        {/* Manager controls */}
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {/* Status */}
            {STATUSES.filter(s => s !== req.status).map(s => (
              <button key={s}
                onClick={() => handleStatusChange(s)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300
                  hover:bg-gold-500/15 hover:text-gold-600 dark:hover:text-gold-400 transition-colors border border-slate-200 dark:border-navy-700">
                → {s}
              </button>
            ))}
            {/* Assign */}
            <select
              className="select text-xs w-44"
              value={req.assigned_to || ''}
              onChange={e => handleAssign(e.target.value)}
            >
              <option value="">Assign to...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}

        {/* Resolution (managers only) */}
        {canManage && (
          <div>
            <label className="label">Resolution / Notes</label>
            <div className="flex gap-2">
              <textarea
                className="input text-xs flex-1"
                rows={2}
                placeholder="Add resolution notes visible to the requester..."
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
              <button className="btn-primary text-xs px-3 self-end" onClick={handleSaveResolution}>Save</button>
            </div>
          </div>
        )}
        {!canManage && req.resolution && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-0.5">Manager's Resolution</p>
            <p className="text-sm text-green-800 dark:text-green-300">{req.resolution}</p>
          </div>
        )}
      </div>

      {/* ── Middle: Reply thread ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50 dark:bg-navy-950/50" style={{ minHeight: '180px', maxHeight: '280px' }}>
        {req.replies?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400 dark:text-gray-600">
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No replies yet. Start the conversation.</p>
          </div>
        ) : (
          req.replies.map((r) => {
            const isMine = String(r.author_id) === String(currentUser?.id);
            const isManager = ['Admin', 'Sales Manager'].includes(r.role_name);
            return (
              <div key={r.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                  ${isManager ? 'bg-gold-500 text-navy-950' : 'bg-blue-500 text-white'}`}>
                  {r.author_name?.[0]?.toUpperCase()}
                </div>
                {/* Bubble */}
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-slate-600 dark:text-gray-400">{r.author_name}</span>
                    {isManager && (
                      <span className="text-xs px-1.5 py-0 rounded bg-gold-500/15 text-gold-600 dark:text-gold-400 font-medium">Manager</span>
                    )}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-snug
                    ${isMine
                      ? 'bg-gold-500 text-navy-950 rounded-tr-sm'
                      : 'bg-white dark:bg-navy-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-navy-700 rounded-tl-sm'}`}>
                    {r.message}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-gray-600 px-1">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Bottom: Reply input ── */}
      <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex gap-2">
          <textarea
            className="input text-sm flex-1 resize-none"
            rows={2}
            placeholder={isManagerRole ? 'Reply to this request…' : 'Reply to the manager…'}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
          />
          <button
            onClick={handleSendReply}
            disabled={sending || !reply.trim()}
            className="btn-primary px-3 self-end flex items-center gap-1.5 disabled:opacity-50"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RequestsPage() {
  const [requests, setRequests]     = useState([]);
  const [statusFilter]              = useState('');
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { canManage, user } = useAuth();
  const [users, setUsers]           = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests', { params: { status: statusFilter || undefined } });
      setRequests(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    if (canManage) api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, [canManage]);

  const openCounts = STATUSES.reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Open Requests</h2>
          <div className="flex gap-3 mt-1">
            {STATUSES.map(s => (
              <span key={s} className="text-xs text-slate-500 dark:text-gray-400">
                {s}: <span className="text-slate-900 dark:text-white font-medium">{openCounts[s] || 0}</span>
              </span>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />New Request
        </button>
      </div>

      {/* Manager: kanban columns */}
      {canManage ? (
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <Badge label={status} type="status" />
                <span className="text-slate-500 dark:text-gray-500 text-xs font-medium">{openCounts[status] || 0}</span>
              </div>
              <div className="space-y-2">
                {requests.filter(r => r.status === status).map(req => (
                  <div
                    key={req.id}
                    className="card p-3 text-sm cursor-pointer hover:border-gold-500/40 transition-all"
                    onClick={() => setSelectedId(req.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-900 dark:text-white text-xs line-clamp-2">{req.title}</span>
                      <Badge label={req.priority} type="priority" />
                    </div>
                    {req.client_name && <div className="text-gold-600 dark:text-gold-400 text-xs mb-1">{req.client_name}</div>}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-gray-500 text-xs">by {req.submitted_by_name}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-600">
                        <ChatBubbleLeftRightIcon className="w-3 h-3" />
                        Reply
                      </span>
                    </div>
                  </div>
                ))}
                {!requests.filter(r => r.status === status).length && (
                  <div className="text-center py-6 text-slate-400 dark:text-gray-600 text-xs">No requests</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Sales rep: list view */
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <BriefcaseIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
              <p className="text-slate-900 dark:text-white font-medium">No requests submitted</p>
            </div>
          ) : requests.map(req => (
            <div
              key={req.id}
              className="card flex items-start gap-4 cursor-pointer hover:border-gold-500/40 transition-all"
              onClick={() => setSelectedId(req.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-slate-900 dark:text-white">{req.title}</span>
                  <Badge label={req.priority} type="priority" />
                  <Badge label={req.status}   type="status"   />
                </div>
                {req.description && (
                  <p className="text-slate-500 dark:text-gray-400 text-sm line-clamp-2">{req.description}</p>
                )}
                {req.client_name && <p className="text-gold-600 dark:text-gold-400 text-xs mt-1">{req.client_name}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-slate-400 dark:text-gray-600 text-xs">{new Date(req.created_at).toLocaleDateString()}</p>
                  <span className="flex items-center gap-1 text-xs text-gold-600 dark:text-gold-400">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    Click to view & reply
                  </span>
                </div>
              </div>
              {req.resolution && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg px-2 py-1 max-w-[200px]">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">Resolution:</p>
                  <p className="text-xs text-green-800 dark:text-green-300 line-clamp-2">{req.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Open Request" size="md">
        <RequestForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>

      {/* Detail + Reply Modal */}
      <Modal
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Request Details"
        size="lg"
        flush
      >
        {selectedId && (
          <RequestDetailModal
            requestId={selectedId}
            onClose={() => setSelectedId(null)}
            onUpdated={load}
            canManage={canManage}
            users={users}
            currentUser={user}
          />
        )}
      </Modal>
    </div>
  );
}
