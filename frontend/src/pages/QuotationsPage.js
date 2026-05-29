import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlusIcon, DocumentArrowDownIcon, TrashIcon, XCircleIcon, ArrowUturnLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import { useAuth } from '../store/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

// Pending Review added for Sales Rep → Manager approval workflow
const STATUSES = ['Draft', 'Pending Review', 'Approved', 'Sent', 'Rejected'];

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnNotes, setReturnNotes] = useState('');
  const navigate = useNavigate();
  const { canManage, isAdmin, isRep } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: { status: status || undefined, limit: 50 } });
      setQuotations(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const handleDelete = async () => {
    try {
      await api.delete(`/quotations/${deleteTarget.id}`);
      toast.success('Quotation deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting quotation'); }
  };

  const handleReject = async () => {
    try {
      await api.put(`/quotations/${rejectTarget.id}`, { status: 'Rejected' });
      toast.success('Quotation marked as rejected');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error rejecting quotation'); }
  };

  const downloadPdf = async (e, id, ref) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${ref}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Error generating PDF');
    }
  };

  const submit = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/submit`);
      toast.success('Quotation submitted for review');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error submitting quotation');
    }
  };

  const approve = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/approve`);
      toast.success('Quotation approved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error approving quotation');
    }
  };

  const handleReturn = async () => {
    try {
      await api.patch(`/quotations/${returnTarget.id}/return`, { notes: returnNotes });
      toast.success('Quotation returned for revision');
      setReturnTarget(null);
      setReturnNotes('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error returning quotation');
    }
  };

  const markSent = async (e, id) => {
    e.stopPropagation();
    try {
      await api.put(`/quotations/${id}`, { status: 'Sent' });
      toast.success('Quotation marked as sent');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error updating quotation');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Quotations</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{quotations.length} quotations</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/quotations/new')}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />New Quotation
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {['', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${status === s ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {s || 'All'}
          </button>
        ))}
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
                <th>Service</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                  <td className="font-mono text-gold-400 text-sm">{q.reference_no}</td>
                  <td className="text-slate-900 dark:text-white font-medium">{q.client_name || '—'}</td>
                  <td className="text-slate-500 dark:text-gray-400 text-xs">{q.service_type}</td>
                  <td className="text-slate-500 dark:text-gray-400 text-xs">{q.origin} → {q.destination}</td>
                  <td className="font-semibold text-slate-900 dark:text-white">{q.currency} {parseFloat(q.total_amount || 0).toLocaleString()}</td>
                  <td>
                    <Badge label={q.status} type="status" />
                    {q.review_notes && q.status === 'Draft' && (
                      <div className="mt-1 text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
                        <ArrowUturnLeftIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[120px]" title={q.review_notes}>Returned for revision</span>
                      </div>
                    )}
                  </td>
                  <td className="text-gray-500 text-xs">
                    <div>{new Date(q.created_at).toLocaleDateString()}</div>
                    <div className="text-slate-500 dark:text-gray-400">{new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {q.created_by_name && <div className="text-gold-500 mt-0.5 font-medium">{q.created_by_name}</div>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                      {/* PDF download — always */}
                      <button
                        className="btn-ghost text-xs p-1.5"
                        title="Download PDF"
                        onClick={e => downloadPdf(e, q.id, q.reference_no)}
                      >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                      </button>

                      {/* Submit for Review — Sales Reps only, Draft quotations */}
                      {isRep && q.status === 'Draft' && (
                        <button
                          className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                          title="Submit for manager review"
                          onClick={e => submit(e, q.id)}
                        >
                          <PaperAirplaneIcon className="w-3.5 h-3.5" />Submit
                        </button>
                      )}

                      {/* Approve — managers only, Draft or Pending Review */}
                      {canManage && (q.status === 'Draft' || q.status === 'Pending Review') && (
                        <button className="btn-primary text-xs px-2 py-1" onClick={e => approve(e, q.id)}>
                          Approve
                        </button>
                      )}

                      {/* Return for Revision — managers only, Pending Review */}
                      {canManage && q.status === 'Pending Review' && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-1"
                          title="Return to Sales Rep for revision"
                          onClick={e => { e.stopPropagation(); setReturnTarget(q); setReturnNotes(''); }}
                        >
                          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />Return
                        </button>
                      )}

                      {/* Mark Sent — ALL users, once Approved by manager */}
                      {q.status === 'Approved' && (
                        <button className="btn-secondary text-xs px-2 py-1" onClick={e => markSent(e, q.id)}>
                          Mark Sent
                        </button>
                      )}

                      {/* Reject — managers on Approved, all users on Sent */}
                      {((canManage && q.status === 'Approved') || q.status === 'Sent') && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
                          onClick={e => { e.stopPropagation(); setRejectTarget(q); }}
                        >
                          <XCircleIcon className="w-3.5 h-3.5" />Reject
                        </button>
                      )}

                      {/* Delete — admin only */}
                      {isAdmin && (
                        <button className="btn-ghost text-xs text-red-400 hover:text-red-500 p-1" onClick={e => { e.stopPropagation(); setDeleteTarget(q); }}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!quotations.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">No quotations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message={`Delete quotation ${deleteTarget?.reference_no}? This cannot be undone.`}
        danger
      />
      <ConfirmDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Quotation"
        message={`Mark quotation ${rejectTarget?.reference_no} as Rejected? This means the client declined.`}
        danger
      />

      {/* Return for Revision Modal */}
      <Modal
        isOpen={!!returnTarget}
        onClose={() => { setReturnTarget(null); setReturnNotes(''); }}
        title="Return for Revision"
        size="sm"
      >
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
          Return <span className="font-semibold text-slate-900 dark:text-white">{returnTarget?.reference_no}</span> to the Sales Rep with optional revision notes.
        </p>
        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
          Revision Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={returnNotes}
          onChange={e => setReturnNotes(e.target.value)}
          rows={4}
          placeholder="Explain what needs to be changed…"
          className="input w-full resize-none text-sm"
        />
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleReturn}
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />Return for Revision
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={() => { setReturnTarget(null); setReturnNotes(''); }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
