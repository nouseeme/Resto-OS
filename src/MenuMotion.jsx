import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animateMenuElement, reducedMotion } from './publicMenuMotion.js';

export function MenuValue({ value, children, as: Tag = 'span', className = '' }) {
  const ref = useRef(null);
  const previous = useRef(value);
  const animation = useRef(null);
  useLayoutEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    animation.current = animateMenuElement(ref.current, animation.current,
      reducedMotion() ? { opacity: .5 } : { opacity: .65, transform: 'translateY(10%)' },
      { opacity: 1, transform: 'none' }, { duration: reducedMotion() ? 100 : 480 });
  }, [value]);
  useEffect(() => () => animation.current?.cancel(), []);
  return <Tag ref={ref} className={`menu-value ${className}`}>{children}</Tag>;
}

export function MenuGrid({ category, searching, children }) {
  const ref = useRef(null);
  const animations = useRef(new Map());
  useLayoutEffect(() => {
    const running = animations.current;
    // Search and keyboard category changes stay immediate.
    if (searching || ref.current.closest('.portal-shell')?.dataset.keyboard === 'true') {
      running.forEach(animation => animation?.cancel());
      running.clear();
      return;
    }
    for (const [element, animation] of running) {
      if (!element.isConnected) { animation?.cancel(); running.delete(element); }
    }
    const reduce = reducedMotion();
    [...ref.current.children].forEach((element, index) => {
      running.set(element, animateMenuElement(element, running.get(element),
        reduce ? { opacity: .4 } : { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' }, { duration: reduce ? 100 : 650, delay: reduce ? 0 : Math.min(index, 2) * 70 }));
    });
  }, [category, searching]);
  useEffect(() => () => animations.current.forEach(animation => animation?.cancel()), []);
  return <div ref={ref} className="dishes menu-choreography" data-searching={searching}>{children}</div>;
}

export function MenuCategories({ items, selected, onSelect }) {
  const ref = useRef(null);
  const [marker, setMarker] = useState(null);
  const [instant, setInstant] = useState(false);
  const signature = items.join('\0');
  useLayoutEffect(() => {
    const root = ref.current;
    const update = () => {
      const active = root.querySelector('[aria-pressed=true]');
      if (active) setMarker({ x: active.offsetLeft, width: active.offsetWidth });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    root.querySelectorAll('button').forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [selected, signature]);
  return <div ref={ref} className="tabs category-tabs menu-categories" data-instant={instant} role="group" aria-label="Kategori hidangan">
    {items.map(item => <button type="button" key={item} className={selected === item ? 'selected' : ''}
      aria-pressed={selected === item} onClick={event => { setInstant(event.detail === 0); onSelect(item); }}>{item}</button>)}
    {marker && <span className="category-glider" aria-hidden="true"
      style={{ transform: `translateX(${marker.x}px) scaleX(${marker.width})` }}/>}
  </div>;
}
