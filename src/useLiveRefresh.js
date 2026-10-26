import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

export function useLiveRefresh({ refresh, identity, portal, onOffline }) {
  const latest = useRef({ refresh, onOffline });
  latest.current = { refresh, onOffline };
  useEffect(() => {
    let stopped = false, client, channel, source, checkTimer, credentialsTimer, eventTimer;
    let connected = false, connecting = false;
    const visible = () => !document.hidden && navigator.onLine !== false;
    const read = () => visible() ? latest.current.refresh() : Promise.resolve(null);
    const changed = () => {
      clearTimeout(eventTimer);
      eventTimer = setTimeout(read, 120);
    };
    const scheduleCheck = () => {
      clearTimeout(checkTimer);
      // Healthy connections only reconcile periodically. The endpoint returns a
      // tiny unchanged response instead of fetching the full application state.
      checkTimer = setTimeout(async () => {
        if (stopped) return;
        await read();
        if (!connected) await connect();
        if (!stopped) scheduleCheck();
      }, connected ? 60000 : 15000);
    };
    const closeConnection = async () => {
      source?.close(); source = null;
      if (client) { const previous = client; client = null; await previous.removeAllChannels(); }
      channel = null;
    };
    const connect = async () => {
      if (stopped || connecting || !visible()) return;
      connecting = true;
      clearTimeout(credentialsTimer);
      try {
        const response = await fetch(`/api/live-config${portal ? '?portal=1' : ''}`);
        if (!response.ok) throw Error('Live unavailable');
        const config = await response.json();
        if (stopped) return;
        await closeConnection();
        connected = false;
        if (config.mode === 'local') {
          source = new EventSource(`/api/changes${portal ? '?portal=1' : ''}`);
          source.addEventListener('ready', () => { connected = true; read(); scheduleCheck(); });
          source.addEventListener('changed', changed);
          source.onerror = () => { connected = false; scheduleCheck(); };
        } else if (config.mode === 'supabase') {
          client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
          if (config.accessToken) await client.realtime.setAuth(config.accessToken);
          if (stopped || !client) return;
          channel = client.channel(config.topic, { config: { private: true } });
          channel.on('broadcast', { event: 'changed' }, changed).subscribe(status => {
            if (stopped) return;
            connected = status === 'SUBSCRIBED';
            // Subscribe first, then reconcile: changes during the initial fetch
            // or a disconnected interval cannot silently disappear.
            if (connected) read();
            scheduleCheck();
          });
          if (config.expiresAt) credentialsTimer = setTimeout(connect, Math.max(1000, config.expiresAt * 1000 - Date.now() - 90000));
        }
      } catch { connected = false; }
      finally { connecting = false; }
    };
    const resume = () => { if (visible()) { read(); if (!connected) connect(); } };
    const offline = () => { connected = false; latest.current.onOffline(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', offline);
    connect(); scheduleCheck();
    return () => { stopped = true; clearTimeout(checkTimer); clearTimeout(credentialsTimer); clearTimeout(eventTimer); closeConnection(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('offline', offline); };
  }, [identity, portal]);
}
