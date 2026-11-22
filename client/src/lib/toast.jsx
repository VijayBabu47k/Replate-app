import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCircleCheck, LuCircleX, LuTriangleAlert, LuInfo, LuX } from 'react-icons/lu';

const Ctx = createContext(null);

const KIND = {
  success: { Icon: LuCircleCheck, color: '#16a34a' },
  error: { Icon: LuCircleX, color: '#e11d48' },
  warning: { Icon: LuTriangleAlert, color: '#d97706' },
  info: { Icon: LuInfo, color: '#0284c7' },
};

/** App-wide toasts, stacked in the top-right corner. Use: const toast = useToast(); toast.success('Saved'). */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 220);
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const show = useCallback((kind, message, { duration = kind === 'error' ? 6000 : 3500 } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((list) => [...list.slice(-3), { id, kind, message }]); // keep at most 4 on screen
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (m, o) => show('success', m, o),
    error: (m, o) => show('error', m, o),
    warning: (m, o) => show('warning', m, o),
    info: (m, o) => show('info', m, o),
  }), [show, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="region" aria-label="Notifications">
          {items.map((t) => {
            const { Icon, color } = KIND[t.kind] || KIND.info;
            return (
              <div key={t.id} className={`toast ${t.leaving ? 'toast-out' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'} style={{ '--toast-color': color }}>
                <span className="toast-icon"><Icon size={18} /></span>
                <span className="toast-msg">{t.message}</span>
                <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}><LuX size={16} /></button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
