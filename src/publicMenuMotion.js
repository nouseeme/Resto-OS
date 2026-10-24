import { useEffect, useRef } from 'react';

export const menuEase = () => getComputedStyle(document.documentElement).getPropertyValue('--ease-menu').trim();
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Snapshot the current frame before cancelling so repeated input retargets smoothly.
export function animateMenuElement(element, previous, from, to, options = {}) {
  if (!element?.animate) return null;
  if (previous?.playState === 'running') {
    const style = getComputedStyle(element);
    from = { opacity: style.opacity, transform: style.transform };
  }
  previous?.cancel();
  return element.animate([from, to], { duration: 320, easing: menuEase(), ...options });
}

export function useMenuCartFeedback(root) {
  const feedback = useRef(new Map());
  const flights = useRef(new Set());
  useEffect(() => () => {
    feedback.current.forEach(animation => animation?.cancel());
    flights.current.forEach(({ element, animation }) => { animation.cancel(); element.remove(); });
    flights.current.clear();
  }, []);

  return function addedToCart(source) {
    const scope = root.current;
    if (!scope) return;
    const target = [...scope.querySelectorAll('.mobile-cart, .cart-panel')]
      .find(element => element.getClientRects().length && getComputedStyle(element).display !== 'none');
    if (!target) return;
    const reduce = reducedMotion();
    const bag = target.matches('.mobile-cart') ? target.querySelector('svg') : target.querySelector('.section-head h2');
    const land = () => feedback.current.set(bag, animateMenuElement(bag, feedback.current.get(bag),
      reduce ? { opacity: .65 } : { opacity: .8, transform: 'translateY(-3%) scale(1.012)' },
      { opacity: 1, transform: 'none' }, { duration: reduce ? 100 : 600 }));
    // Input always updates the cart immediately. Only its visual acknowledgement travels.
    if (reduce || !source?.animate || !bag || flights.current.size >= 3) { land(); return; }
    const photo = source.closest('.dish, .dish-detail')?.querySelector('.photo img');
    const origin = source.getBoundingClientRect();
    const destination = bag.getBoundingClientRect();
    const start = { x: origin.x + origin.width / 2 - 28, y: origin.y + origin.height / 2 - 22 };
    const end = {
      x: Math.max(0, Math.min(innerWidth - 56, destination.x + destination.width / 2 - 28)),
      y: Math.max(0, Math.min(innerHeight - 44, destination.y + destination.height / 2 - 22)),
    };
    const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - Math.min(64, Math.hypot(end.x - start.x, end.y - start.y) * .12) };
    const element = document.createElement('div');
    element.className = 'menu-flight';
    element.setAttribute('aria-hidden', 'true');
    if (photo) element.append(photo.cloneNode());
    else element.textContent = '+';
    document.body.append(element);
    // A sampled quadratic curve avoids the abrupt direction change of a three-point flight.
    const frames = Array.from({ length: 33 }, (_, index) => {
      const t = index / 32, u = 1 - t;
      const x = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
      const y = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
      return { offset: t, transform: `translate3d(${x}px, ${y}px, 0) scale(${1 - .28 * t})`, opacity: Math.min(1, t / .12, (1 - t) / .2) };
    });
    const animation = element.animate(frames, { duration: 450, easing: menuEase() });
    const flight = { element, animation };
    flights.current.add(flight);
    animation.finished.then(land).catch(() => {}).finally(() => {
      element.remove();
      flights.current.delete(flight);
    });
  };
}
