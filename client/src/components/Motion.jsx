import { useEffect } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Fixed cinematic background: mesh light, sweeping beam, drifting orbs, grain and vignette. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="orb orb-a"><i /></div>
      <div className="orb orb-b"><i /></div>
    </div>
  );
}

const TARGETS = '.MuiCard-root, .MuiTableContainer-root, .reveal';

/**
 * Scroll-triggered, staggered reveal for every card/table inside `ref`, including ones that
 * mount later (after data loads). State lives in a data attribute so React re-renders can't reset it.
 */
export function useAutoReveal(ref, key) {
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced() || !('IntersectionObserver' in window)) return undefined;
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        e.target.style.setProperty('--rv-delay', `${Math.min(i, 8) * 60}ms`);
        e.target.dataset.rv = 'in';
        io.unobserve(e.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });

    const watch = (el) => {
      if (el.dataset.rv || el.parentElement?.closest('[data-rv]')) return; // nested cards reveal with their parent
      el.dataset.rv = 'out';
      io.observe(el);
    };
    const scan = () => root.querySelectorAll(TARGETS).forEach(watch);
    scan();
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 30); });
    mo.observe(root, { childList: true, subtree: true });
    // pointer spotlight on cards
    const move = (e) => {
      const c = e.target.closest?.('.MuiCard-root');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    root.addEventListener('pointermove', move, { passive: true });
    return () => { io.disconnect(); mo.disconnect(); clearTimeout(timer); root.removeEventListener('pointermove', move); };
  }, [ref, key]);
}

export function Skeleton({ h = 120, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height: h }} />;
}
