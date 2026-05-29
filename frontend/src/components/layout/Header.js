import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, SunIcon, MoonIcon, KeyIcon, ArrowRightOnRectangleIcon, UserCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import Modal from '../common/Modal';
import { playNotificationSound } from '../../utils/notificationSound';

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('New passwords do not match');
    if (form.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await api.post('/users/me/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">Current Password</label>
        <input type="password" className="input" required value={form.currentPassword}
          onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="label">New Password</label>
        <input type="password" className="input" required minLength={8} value={form.newPassword}
          onChange={e => setForm({ ...form, newPassword: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="label">Confirm New Password</label>
        <input type="password" className="input" required value={form.confirm}
          onChange={e => setForm({ ...form, confirm: e.target.value })} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial load
    api.get('/notifications')
      .then(res => { setNotifs(res.data.data || []); setUnread(res.data.unreadCount || 0); })
      .catch(() => {});

    // SSE for real-time updates
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const apiBase = process.env.REACT_APP_API_URL || '/api';
    const es = new EventSource(`${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`);

    es.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      setUnread(data.unreadCount || 0);
    });

    es.addEventListener('notification', (e) => {
      const notif = JSON.parse(e.data);
      setNotifs(prev => [notif, ...prev].slice(0, 50));
      setUnread(prev => prev + 1);

      // Play chime
      playNotificationSound();

      // Big custom toast
      toast.custom(
        (t) => (
          <div
            className={`
              flex items-start gap-4 w-full max-w-md
              bg-white dark:bg-navy-900
              border border-slate-200 dark:border-navy-700
              rounded-2xl shadow-2xl p-5
              transition-all duration-300
              ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            `}
          >
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-gold-500/15 flex items-center justify-center flex-shrink-0">
              <BellIcon className="w-5 h-5 text-gold-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                {notif.title}
              </p>
              {notif.body && (
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 leading-snug">
                  {notif.body}
                </p>
              )}
              <p className="text-xs text-slate-400 dark:text-gray-600 mt-2">
                Just now
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors flex-shrink-0 mt-0.5"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ),
        { duration: 6000, position: 'top-right' }
      );
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    await api.post('/notifications/mark-all-read');
    setNotifs(notifs.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifs(notifs.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (notif.link) navigate(notif.link);
    setShowNotifs(false);
  };

  return (
    <>
      <header className="h-16 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
              className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            >
              <BellIcon className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-500 text-navy-950 text-xs font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-gold-600 dark:text-gold-400 hover:text-gold-500">Mark all read</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-sm">No notifications</div>
                  ) : notifs.map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors border-b border-slate-100 dark:border-navy-800 last:border-0 ${!n.is_read ? 'bg-slate-50 dark:bg-navy-800/50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <div className="w-2 h-2 bg-gold-500 rounded-full mt-1.5 flex-shrink-0" />}
                        <div className={!n.is_read ? '' : 'ml-4'}>
                          <div className="text-xs font-medium text-slate-900 dark:text-white">{n.title}</div>
                          {n.body && <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{n.body}</div>}
                          <div className="text-xs text-slate-400 dark:text-gray-600 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-sm">
                {user?.fullName?.[0]?.toUpperCase()}
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-52 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl z-50 py-1">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-800">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.fullName}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 truncate">{user?.role}</div>
                </div>
                <button
                  onClick={() => { setShowProfile(false); setShowChangePwd(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <KeyIcon className="w-4 h-4" /> Change Password
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal isOpen={showChangePwd} onClose={() => setShowChangePwd(false)} title="Change Password" size="sm">
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      </Modal>
    </>
  );
}
