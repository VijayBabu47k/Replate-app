/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

// Theme-aware colour scales. Pages use utility names like bg-green-50 / text-gray-500; each shade
// resolves to a CSS variable that is defined per theme below (dark = default, light = [data-theme=light]).
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const scale = (name, shades = SHADES) => Object.fromEntries(shades.map((s) => [s, `var(--c-${name}-${s})`]));

// tint(): translucent 50-300 backgrounds + solid 600 + readable 700/800 text, per theme
const tintVars = (name, dark, light) => {
  const mk = ([rgb, t7, t8], strong) => ({
    [`--c-${name}-50`]: `rgba(${rgb},${strong ? 0.12 : 0.1})`,
    [`--c-${name}-100`]: `rgba(${rgb},${strong ? 0.16 : 0.16})`,
    [`--c-${name}-200`]: `rgba(${rgb},${strong ? 0.28 : 0.28})`,
    [`--c-${name}-300`]: `rgba(${rgb},${strong ? 0.42 : 0.42})`,
    [`--c-${name}-600`]: `rgb(${rgb})`,
    [`--c-${name}-700`]: t7,
    [`--c-${name}-800`]: t8,
  });
  return { dark: mk(dark, true), light: mk(light, false) };
};

const TINTS = {
  green: tintVars('green', ['74,222,128', '#86efac', '#bbf7d0'], ['22,163,74', '#15803d', '#166534']),
  lime: tintVars('lime', ['163,230,53', '#bef264', '#d9f99d'], ['101,163,13', '#4d7c0f', '#3f6212']),
  emerald: tintVars('emerald', ['52,211,153', '#6ee7b7', '#a7f3d0'], ['5,150,105', '#047857', '#065f46']),
  amber: tintVars('amber', ['251,191,36', '#fcd34d', '#fde68a'], ['217,119,6', '#b45309', '#92400e']),
  red: tintVars('red', ['248,113,113', '#fca5a5', '#fecaca'], ['220,38,38', '#b91c1c', '#991b1b']),
  orange: tintVars('orange', ['251,146,60', '#fdba74', '#fed7aa'], ['234,88,12', '#c2410c', '#9a3412']),
  blue: tintVars('blue', ['96,165,250', '#93c5fd', '#bfdbfe'], ['37,99,235', '#1d4ed8', '#1e40af']),
  teal: tintVars('teal', ['45,212,191', '#5eead4', '#99f6e4'], ['13,148,136', '#0f766e', '#115e59']),
};

const GRAY = {
  dark: {
    50: 'rgba(255,255,255,0.035)', 100: 'rgba(255,255,255,0.06)', 200: 'rgba(255,255,255,0.10)', 300: 'rgba(255,255,255,0.16)',
    400: '#7d8a84', 500: '#8e9a94', 600: '#a8b3ae', 700: '#c6cfcb', 800: '#e2e8e5', 900: '#f4f8f6',
  },
  light: {
    50: 'rgba(10,31,22,0.035)', 100: 'rgba(10,31,22,0.06)', 200: 'rgba(10,31,22,0.10)', 300: 'rgba(10,31,22,0.17)',
    400: '#66756e', 500: '#55645d', 600: '#45534c', 700: '#2f3b35', 800: '#1b2620', 900: '#0b1510',
  },
};

const BRAND = {
  dark: { 50: 'rgba(52,211,153,0.10)', 100: 'rgba(52,211,153,0.18)', 500: '#34d399', 600: '#10b981', 700: '#6ee7b7', 800: '#a7f3d0' },
  light: { 50: 'rgba(5,150,105,0.08)', 100: 'rgba(5,150,105,0.14)', 500: '#059669', 600: '#047857', 700: '#047857', 800: '#065f46' },
};

const themeVars = (mode) => {
  const v = {};
  Object.entries(GRAY[mode]).forEach(([k, val]) => { v[`--c-gray-${k}`] = val; });
  Object.entries(BRAND[mode]).forEach(([k, val]) => { v[`--c-brand-${k}`] = val; });
  Object.values(TINTS).forEach((t) => Object.assign(v, t[mode]));
  return v;
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Tone classes are built from data (diet, storage, stat tones), so keep them in the build
  safelist: [{ pattern: /^(bg|text|ring)-(green|lime|emerald|amber|red|orange|blue|teal|brand|gray)-(50|100|200|700)$/ }],
  // MUI provides CssBaseline; disable Tailwind's reset so the two don't fight
  corePlugins: { preflight: false },
  important: '#root',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '"Segoe UI"', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        gray: scale('gray'),
        brand: scale('brand', [50, 100, 500, 600, 700, 800]),
        ...Object.fromEntries(Object.keys(TINTS).map((n) => [n, scale(n, [50, 100, 200, 300, 600, 700, 800])])),
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': themeVars('dark'),
        ':root[data-theme="light"]': themeVars('light'),
      });
    }),
  ],
};
