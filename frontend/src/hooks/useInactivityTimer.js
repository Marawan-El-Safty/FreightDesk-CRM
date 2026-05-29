import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const WARNING_MS  = 25 * 60 * 1000;  // 25 min → show warning
const TIMEOUT_MS  = 30 * 60 * 1000;  // 30 min → force logout
const PING_MS     =  5 * 60 * 1000;  // 5 min  → backend ping

export function useInactivityTimer({ enabled, onWarning, onTimeout }) {
  const warnTimer    = useRef(null);
  const logoutTimer  = useRef(null);
  const pingInterval = useRef(null);

  const clear = () => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
  };

  const reset = useCallback(() => {
    if (!enabled) return;
    clear();
    warnTimer.current   = setTimeout(onWarning, WARNING_MS);
    logoutTimer.current = setTimeout(onTimeout, TIMEOUT_MS);
  }, [enabled, onWarning, onTimeout]);

  // Attach activity listeners
  useEffect(() => {
    if (!enabled) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clear();
    };
  }, [enabled, reset]);

  // Ping backend every 5 min to keep session alive
  useEffect(() => {
    if (!enabled) return;
    pingInterval.current = setInterval(() => {
      api.post('/sessions/ping').catch(() => {});
    }, PING_MS);
    return () => clearInterval(pingInterval.current);
  }, [enabled]);

  return { reset };
}
