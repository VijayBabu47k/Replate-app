import { createTheme, alpha } from '@mui/material/styles';

// Design tokens (mirrored as CSS variables in index.css)
export const tokens = {
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#0d9488',
  lime: '#a3e635',
  // Primary action gradient: dark enough for white text (≥ 4.5:1 across the ramp)
  gradBrand: 'linear-gradient(120deg, #16a34a 0%, #047857 55%, #0f766e 100%)',
  // Decorative gradient (logo, accents, chart fills)
  gradGlow: 'linear-gradient(135deg, #a3e635 0%, #22c55e 45%, #0d9488 100%)',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

const FONT = 'Geist, Inter, "Segoe UI", sans-serif';
export const DISPLAY = '"Instrument Serif", Georgia, serif';

// Per-mode surfaces. `ink` is the RGB used for hairlines and hover washes.
const MODES = {
  dark: {
    bg: '#060907', surface: '#0c120f', ink: '255,255,255', text: '#f4f8f6', textSecondary: '#a8b3ae',
    toggleText: '#c6cfcb', headText: '#8e9a94', panel: 'rgba(12,18,15,0.92)', bar: 'rgba(6,9,7,0.72)', drawer: 'rgba(8,12,10,0.86)',
    tooltip: 'rgba(14,22,18,0.97)', backdrop: 'rgba(2,5,3,0.66)', autofill: '#101a15', shadow: 'rgba(0,0,0,0.65)',
    primary: { main: '#34d399', light: '#6ee7b7', dark: '#059669' },
    secondary: { main: '#2dd4bf', light: '#5eead4', dark: '#0d9488' },
    info: '#38bdf8', success: '#4ade80', warning: '#fbbf24', error: '#fb7185',
    cardTop: 'rgba(255,255,255,0.055)', cardBottom: 'rgba(255,255,255,0.02)',
  },
  light: {
    bg: '#f4f7f5', surface: '#ffffff', ink: '10,31,22', text: '#0b1510', textSecondary: '#45534c',
    toggleText: '#2f3b35', headText: '#55645d', panel: 'rgba(255,255,255,0.97)', bar: 'rgba(255,255,255,0.8)', drawer: 'rgba(255,255,255,0.9)',
    tooltip: 'rgba(11,21,16,0.95)', backdrop: 'rgba(11,21,16,0.35)', autofill: '#ecfdf5', shadow: 'rgba(16,60,40,0.18)',
    primary: { main: '#059669', light: '#10b981', dark: '#047857' },
    secondary: { main: '#0d9488', light: '#14b8a6', dark: '#0f766e' },
    info: '#0284c7', success: '#16a34a', warning: '#d97706', error: '#e11d48',
    cardTop: 'rgba(255,255,255,1)', cardBottom: 'rgba(255,255,255,0.88)',
  },
};

export function buildTheme(mode = 'dark') {
  const m = MODES[mode] || MODES.dark;
  const dark = mode !== 'light';
  const i = (a) => `rgba(${m.ink},${a})`;
  const line = i(dark ? 0.08 : 0.09);
  const lineStrong = i(dark ? 0.16 : 0.18);
  const focusRing = `0 0 0 4px ${alpha(m.primary.main, dark ? 0.18 : 0.16)}`;

  const glassPaper = {
    backgroundColor: m.panel,
    backgroundImage: 'none',
    border: `1px solid ${line}`,
    backdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: `0 32px 64px -24px ${m.shadow}, 0 1px 0 ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)'} inset`,
  };

  return createTheme({
    palette: {
      mode,
      primary: { ...m.primary, contrastText: dark ? '#03150c' : '#fff' },
      secondary: m.secondary,
      info: { main: m.info },
      success: { main: m.success },
      warning: { main: m.warning },
      error: { main: m.error },
      background: { default: m.bg, paper: m.surface },
      text: { primary: m.text, secondary: m.textSecondary },
      divider: line,
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: FONT,
      h4: { fontWeight: 600, letterSpacing: '-0.03em' },
      h5: { fontWeight: 600, letterSpacing: '-0.025em' },
      h6: { fontWeight: 600, letterSpacing: '-0.015em', fontSize: '1.05rem' },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.005em' },
    },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { backgroundColor: m.bg } } },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 20,
            background: `linear-gradient(180deg, ${m.cardTop}, ${m.cardBottom})`,
            border: `1px solid ${line}`,
            backdropFilter: 'blur(18px) saturate(140%)',
            boxShadow: dark
              ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -30px rgba(0,0,0,0.8)'
              : '0 1px 0 rgba(255,255,255,1) inset, 0 1px 2px rgba(16,60,40,0.04), 0 16px 32px -24px rgba(16,60,40,0.22)',
            transition: `transform .35s ${tokens.ease}, border-color .3s, box-shadow .35s ${tokens.ease}`,
          },
        },
      },
      MuiCardContent: { styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: 16 } } },
      MuiMenu: { styleOverrides: { paper: { ...glassPaper, borderRadius: 16 } } },
      MuiPopover: { styleOverrides: { paper: { ...glassPaper, borderRadius: 16 } } },
      MuiDialog: { styleOverrides: { paper: { ...glassPaper, borderRadius: 24 } } },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600, fontSize: '1.15rem', letterSpacing: '-0.015em', paddingTop: 22 } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '8px 24px 20px', gap: 4 } } },
      MuiBackdrop: { styleOverrides: { root: { backgroundColor: m.backdrop, backdropFilter: 'blur(6px)' } } },
      MuiMenuItem: {
        styleOverrides: { root: { borderRadius: 10, margin: '2px 6px', transition: 'background .2s', '&:hover': { backgroundColor: i(0.06) } } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: m.bar, backgroundImage: 'none', color: m.text,
            backdropFilter: 'blur(20px) saturate(160%)', borderBottom: `1px solid ${line}`, boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: m.drawer, backgroundImage: 'none', borderRight: `1px solid ${line}`, backdropFilter: 'blur(24px) saturate(150%)' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 12, paddingInline: 16,
            transition: `transform .25s ${tokens.ease}, box-shadow .3s, background .3s, border-color .3s, color .2s`,
            '&:active': { transform: 'scale(0.97)' },
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
          sizeSmall: { borderRadius: 10, paddingInline: 12 },
          sizeLarge: { borderRadius: 14, paddingBlock: 11, fontSize: '0.975rem' },
          contained: {
            background: tokens.gradBrand, backgroundSize: '180% 100%', backgroundPosition: '0% 0', color: '#fff',
            boxShadow: '0 10px 24px -10px rgba(16,185,129,0.65), 0 1px 0 rgba(255,255,255,0.22) inset',
            '&:hover': { backgroundPosition: '100% 0', transform: 'translateY(-1px)', boxShadow: '0 14px 30px -10px rgba(16,185,129,0.8), 0 1px 0 rgba(255,255,255,0.28) inset' },
            '&.Mui-disabled': { background: i(dark ? 0.07 : 0.07), color: i(dark ? 0.32 : 0.38), boxShadow: 'none' },
          },
          containedSecondary: { background: 'linear-gradient(120deg,#0f766e,#0e7490)' },
          containedSuccess: { background: 'linear-gradient(120deg,#15803d,#0f766e)' },
          containedError: { background: 'linear-gradient(120deg,#be123c,#c2410c)', boxShadow: '0 10px 24px -10px rgba(225,29,72,0.6)' },
          containedWarning: { background: 'linear-gradient(120deg,#d97706,#ea580c)', color: '#fff' },
          outlined: {
            borderColor: lineStrong, color: m.text,
            '&:hover': { borderColor: alpha(m.primary.main, 0.6), backgroundColor: alpha(m.primary.main, 0.07), transform: 'translateY(-1px)' },
          },
          outlinedError: { color: m.error, borderColor: alpha(m.error, 0.4), '&:hover': { borderColor: m.error, backgroundColor: alpha(m.error, 0.07) } },
          text: { '&:hover': { backgroundColor: i(0.06) } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: `transform .25s ${tokens.ease}, background .25s, color .2s`,
            '&:hover': { backgroundColor: i(0.07) },
            '&:active': { transform: 'scale(0.92)' },
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
        },
      },
      MuiToggleButtonGroup: { styleOverrides: { root: { gap: 6 }, grouped: { borderRadius: '10px !important', border: `1px solid ${line} !important`, margin: '0 !important' } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: line, color: m.toggleText, transition: 'all .25s', textTransform: 'none', fontWeight: 500, gap: 6,
            '&:hover': { backgroundColor: i(0.05) },
            '&.Mui-selected': {
              color: dark ? m.primary.light : m.primary.dark,
              backgroundColor: alpha(m.primary.main, dark ? 0.14 : 0.1),
              borderColor: `${alpha(m.primary.main, 0.55)} !important`,
            },
            '&.Mui-selected:hover': { backgroundColor: alpha(m.primary.main, dark ? 0.2 : 0.15) },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: ({ ownerState: o, theme: t }) => {
            const c = o.color && o.color !== 'default' ? t.palette[o.color] : null;
            const base = { fontWeight: 600, borderRadius: 999, transition: 'all .2s', letterSpacing: '-0.005em' };
            const fg = dark ? c?.light : c?.dark;
            if (!c) {
              return {
                ...base,
                '&.MuiChip-filled': { backgroundColor: i(dark ? 0.08 : 0.06), color: m.toggleText },
                '&.MuiChip-outlined': { borderColor: line, color: m.toggleText },
              };
            }
            return {
              ...base,
              ...(o.variant === 'filled' && {
                backgroundColor: alpha(c.main, dark ? 0.14 : 0.1), color: fg, border: `1px solid ${alpha(c.main, 0.3)}`,
                // MUI's default hover/focus uses the solid colour, which hides the label; keep it a tint
                '&.MuiChip-clickable:hover, &.MuiChip-clickable.Mui-focusVisible': { backgroundColor: alpha(c.main, dark ? 0.22 : 0.16) },
                '& .MuiChip-icon': { color: fg },
              }),
              ...(o.variant === 'outlined' && { borderColor: alpha(c.main, 0.5), color: fg }),
            };
          },
          clickable: { '&:hover': { transform: 'translateY(-1px)' } },
        },
      },

      // Labels always sit on the border so placeholders are visible before the user types
      MuiTextField: { defaultProps: { variant: 'outlined', slotProps: { inputLabel: { shrink: true } } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12, backgroundColor: i(dark ? 0.035 : 0.02), transition: 'background .25s, box-shadow .25s',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: i(dark ? 0.12 : 0.16), transition: 'border-color .25s' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: i(dark ? 0.24 : 0.3) },
            '&.Mui-focused': { backgroundColor: alpha(m.primary.main, 0.05), boxShadow: focusRing },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: m.primary.main, borderWidth: 1 },
            '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(m.error, 0.16)}` },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: alpha(m.error, 0.8) },
            '& input:-webkit-autofill': { WebkitBoxShadow: `0 0 0 100px ${m.autofill} inset`, WebkitTextFillColor: m.text, borderRadius: 12 },
          },
        },
      },
      MuiInputAdornment: { styleOverrides: { root: { color: m.headText, '& svg': { fontSize: 18 } } } },
      MuiFormLabel: { styleOverrides: { root: { '&.Mui-focused': { color: dark ? m.primary.light : m.primary.dark }, '&.Mui-error': { color: m.error } } } },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 4, fontSize: 12, '&.Mui-error': { color: m.error } } } },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${i(dark ? 0.06 : 0.07)}`, paddingTop: 12, paddingBottom: 12 },
          head: { color: m.headText, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', backgroundColor: i(dark ? 0.02 : 0.025) },
        },
      },
      MuiTableRow: { styleOverrides: { root: { transition: 'background .2s', '&:hover:not(.MuiTableRow-head)': { backgroundColor: alpha(m.primary.main, 0.05) } } } },
      MuiTablePagination: { styleOverrides: { root: { borderTop: `1px solid ${line}` } } },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 14, alignItems: 'center', border: '1px solid transparent' },
          standardSuccess: { borderColor: alpha(m.success, 0.25) },
          standardInfo: { borderColor: alpha(m.info, 0.25) },
          standardWarning: { borderColor: alpha(m.warning, 0.3) },
          standardError: { borderColor: alpha(m.error, 0.3) },
          icon: { '& svg': { fontSize: 20 } },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 150 },
        styleOverrides: {
          tooltip: { backgroundColor: m.tooltip, color: '#f4f8f6', border: `1px solid ${lineStrong}`, backdropFilter: 'blur(12px)', borderRadius: 10, fontSize: 12, lineHeight: 1.5, padding: '8px 12px', boxShadow: `0 12px 30px -8px ${m.shadow}` },
          arrow: { color: m.tooltip },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 99, backgroundColor: i(dark ? 0.08 : 0.08) }, bar: { borderRadius: 99 }, barColorPrimary: { background: tokens.gradGlow } },
      },
      MuiCircularProgress: { styleOverrides: { colorPrimary: { color: m.primary.main } } },
      MuiStepIcon: {
        styleOverrides: {
          root: { color: i(dark ? 0.14 : 0.16), '&.Mui-active': { color: m.primary.main, filter: `drop-shadow(0 0 8px ${alpha(m.primary.main, 0.7)})` }, '&.Mui-completed': { color: m.primary.main } },
          text: { fontWeight: 700, fill: dark ? '#03150c' : '#fff' },
        },
      },
      MuiStepLabel: { styleOverrides: { label: { fontSize: 13, '&.Mui-active, &.Mui-completed': { fontWeight: 600 } } } },
      MuiStepConnector: { styleOverrides: { line: { borderColor: i(dark ? 0.12 : 0.16), borderTopWidth: 2 } } },
      MuiSwitch: {
        styleOverrides: {
          track: { backgroundColor: i(dark ? 0.25 : 0.28), opacity: 1 },
          switchBase: { '&.Mui-checked + .MuiSwitch-track': { opacity: 1, background: tokens.gradGlow } },
        },
      },
      MuiSlider: { styleOverrides: { track: { background: tokens.gradGlow, border: 0 }, thumb: { boxShadow: `0 0 0 6px ${alpha(m.primary.main, 0.15)}` } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, transition: 'color .25s' } } },
      MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, background: tokens.gradGlow } } },
      MuiAvatar: { styleOverrides: { colorDefault: { background: tokens.gradBrand, color: '#fff' } } },
      MuiBadge: { styleOverrides: { colorSecondary: { background: tokens.gradBrand, color: '#fff', fontWeight: 700 } } },
      MuiDivider: { styleOverrides: { root: { borderColor: line } } },
      MuiListItemButton: { styleOverrides: { root: { '&.Mui-selected': { backgroundColor: alpha(m.primary.main, 0.1) }, '&.Mui-selected:hover': { backgroundColor: alpha(m.primary.main, 0.14) } } } },
    },
  });
}
