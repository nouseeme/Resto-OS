import { useEffect, useRef, useState } from 'react';

// Keep the existing dialog mounted (and focus contained) until its exit ends.
export default function useModalDismiss(onClose, publicMenu) {
  const [closing, setClosing] = useState(false);
  const pending = useRef(false);
  const callback = useRef(onClose);
  const timer = useRef();
  useEffect(() => { callback.current = onClose; }, [onClose]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function dismiss() {
    if (pending.current) return;
    pending.current = true;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      pending.current = false;
      setClosing(false);
      callback.current();
    }, reduced ? 100 : publicMenu ? 500 : 125);
  }

  return { closing, dismiss };
}
