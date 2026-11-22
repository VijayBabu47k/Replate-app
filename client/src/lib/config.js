// Client build-time flags from client/.env (Vite only exposes VITE_* variables)
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v ?? '').trim());

/** VITE_IS_DEMO=true shows demo accounts and demo notices. Defaults to true when unset. */
export const IS_DEMO = import.meta.env.VITE_IS_DEMO === undefined ? true : truthy(import.meta.env.VITE_IS_DEMO);
