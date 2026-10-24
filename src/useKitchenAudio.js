import { useEffect, useRef, useState } from 'react';
import { kitchenArrivals } from '../shared/kitchen-alerts.js';

export default function useKitchenAudio(data) {
  const audio = useRef(null), seen = useRef(null), pending = useRef(new Set()), enabled = useRef(false);
  const [state, setState] = useState('suspended');
  const flush = () => {
    const ctx = audio.current;
    if (!enabled.current || ctx?.state !== 'running' || !pending.current.size) return;
    // One two-tone alert per incoming batch, never on acceptance.
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i ? 880 : 660;
      gain.gain.setValueAtTime(.12, ctx.currentTime + i * .22);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .22 + .2);
      osc.start(ctx.currentTime + i * .22); osc.stop(ctx.currentTime + i * .22 + .2);
    }
    pending.current.clear();
  };
  const unlock = () => {
    if (!enabled.current) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { setState('unsupported'); return; }
    try {
      if (!audio.current) {
        audio.current = new Audio();
        audio.current.onstatechange = () => {
          setState(audio.current.state);
          flush();
        };
      }
      setState(audio.current.state);
      if (audio.current.state !== 'running') audio.current.resume().then(flush).catch(() => setState('suspended'));
      else flush();
    } catch { setState('suspended'); }
  };
  useEffect(() => {
    // The role-choice click also unlocks audio; no separate sound toggle is needed.
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); };
  }, []);
  const kitchen = data?.actor?.role === 'kitchen';
  useEffect(() => {
    enabled.current = kitchen;
    if (!kitchen) { seen.current = null; pending.current.clear(); return; }
    for (const id of kitchenArrivals(data.orders, seen.current)) pending.current.add(id);
    seen.current = new Set(data.orders.map(order => order.id));
    unlock();
  }, [data, kitchen]);
  // Called synchronously by the workspace choice, inside its browser gesture.
  const prepare = () => { enabled.current = true; unlock(); };
  return { state, prepare };
}
