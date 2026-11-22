import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Badge, Menu, Drawer, Box, Avatar, Tooltip, useMediaQuery, Typography } from '@mui/material';
import {
  LuMenu, LuBell, LuLayoutDashboard, LuCirclePlus, LuList, LuChartLine, LuSprout, LuMail, LuStore, LuPackage,
  LuSlidersHorizontal, LuRoute, LuUser, LuWallet, LuLogOut, LuMoon, LuSun, LuArrowLeft, LuBellOff,
} from 'react-icons/lu';
import { useThemeMode } from '../lib/themeMode';
import { useAuth } from '../lib/auth';
import { useFetch } from '../lib/hooks';
import { api } from '../lib/api';
import { ROLE_LABEL, fromNow } from '../lib/format';
import { Ambient, useAutoReveal } from './Motion';
import Brand from './Brand';

const NAV = {
  DONOR: [
    { to: '/donor', label: 'Dashboard', icon: LuLayoutDashboard, end: true },
    { to: '/donor/post', label: 'Post surplus', icon: LuCirclePlus },
    { to: '/donor/listings', label: 'My listings', icon: LuList },
    { to: '/donor/analytics', label: 'Insights', icon: LuChartLine },
  ],
  RECEIVER: [
    { to: '/receiver', label: 'Available food', icon: LuStore, end: true },
    { to: '/receiver/claims', label: 'My claims', icon: LuPackage },
    { to: '/receiver/profile', label: 'Needs & capacity', icon: LuSlidersHorizontal },
  ],
  VOLUNTEER: [
    { to: '/volunteer', label: 'Pickup tasks', icon: LuRoute, end: true },
    { to: '/volunteer/earnings', label: 'Earnings', icon: LuWallet },
    { to: '/volunteer/profile', label: 'My profile', icon: LuUser },
  ],
};

const COMMON = [
  { to: '/impact', label: 'Impact', icon: LuSprout },
  { to: '/outbox', label: 'Email outbox', icon: LuMail },
];

const DRAWER = 256;
const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-all duration-300 ${
          isActive ? 'bg-brand-50 text-gray-900 shadow-[inset_0_0_0_1px_var(--c-brand-100)]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="bg-grad-glow absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" />}
          <Icon size={18} className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-brand-700' : ''}`} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggle: toggleMode } = useThemeMode();
  const nav = useNavigate();
  const desktop = useMediaQuery('(min-width:900px)');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  useAutoReveal(mainRef, pathname);
  const notif = useFetch('/notifications', { poll: 15000 });

  const signOut = () => { logout(); nav('/login'); };

  const drawer = (
    <Box className="flex h-full flex-col">
      <Box className="px-5 pb-6 pt-5">
        <Link to="/" className="no-underline"><Brand sub="Food rescue network" /></Link>
      </Box>
      <Box component="nav" className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
        <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400">{ROLE_LABEL[user.role]}</div>
        {(NAV[user.role] || []).map((i) => <NavItem key={i.to} item={i} onClick={() => setOpen(false)} />)}
        <div className="mt-5 px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400">General</div>
        {COMMON.map((i) => <NavItem key={i.to} item={i} onClick={() => setOpen(false)} />)}
      </Box>
      <Box className="m-3 flex items-center gap-3 rounded-2xl border border-solid border-gray-200 bg-gray-50 p-3">
        <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>{initials(user.name)}</Avatar>
        <Box className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-gray-900">{user.name}</div>
          <div className="truncate text-xs text-gray-500">{user.title || ROLE_LABEL[user.role]}</div>
        </Box>
        <Tooltip title="Sign out"><IconButton size="small" onClick={signOut} aria-label="Sign out"><LuLogOut size={17} /></IconButton></Tooltip>
      </Box>
    </Box>
  );

  const openNotifs = (e) => {
    setAnchor(e.currentTarget);
    if (notif.data?.unread) api.post('/notifications/read-all').then(() => setTimeout(notif.reload, 3000));
  };
  const items = notif.data?.items || [];

  return (
    <Box className="relative flex min-h-screen">
      <Ambient />
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ ml: desktop ? `${DRAWER}px` : 0, width: desktop ? `calc(100% - ${DRAWER}px)` : '100%' }}>
        <Toolbar className="gap-1" sx={{ minHeight: { xs: 60, sm: 64 } }}>
          {!desktop && <IconButton onClick={() => setOpen(true)} edge="start" aria-label="Open menu"><LuMenu size={20} /></IconButton>}
          <Box className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900">{user.organization?.name || user.name}</div>
            {user.organization?.zone && <div className="hidden truncate text-xs text-gray-500 sm:block">{user.organization.zone}{user.organization.city ? `, ${user.organization.city}` : ''}</div>}
          </Box>
          <Tooltip title={mode === 'light' ? 'Dark theme' : 'Light theme'}>
            <IconButton onClick={toggleMode} aria-label="Toggle light or dark theme">{mode === 'light' ? <LuMoon size={19} /> : <LuSun size={19} />}</IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton onClick={openNotifs} aria-label={`Notifications${notif.data?.unread ? `, ${notif.data.unread} unread` : ''}`}>
              <Badge color="secondary" badgeContent={notif.data?.unread || 0} max={9}><LuBell size={19} /></Badge>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)', maxHeight: 480, mt: 1 } } }}>
            <Box sx={{ px: 2.5, pt: 1.5, pb: 1, fontWeight: 600, fontSize: 14 }}>Notifications</Box>
            {!items.length && (
              <Box sx={{ px: 2.5, py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                <LuBellOff size={22} style={{ opacity: 0.6 }} /><div>You're all caught up</div>
              </Box>
            )}
            {items.map((n) => (
              <Box key={n.id} component="button" type="button" onClick={() => { setAnchor(null); if (n.link) nav(n.link); }}
                sx={{ all: 'unset', boxSizing: 'border-box', display: 'flex', gap: 1.5, width: 'calc(100% - 12px)', mx: '6px', px: 1.75, py: 1.25, borderRadius: 2.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}>
                <Box sx={{ mt: '7px', width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: n.read ? 'transparent' : 'primary.main' }} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: 13.5, lineHeight: 1.45, color: 'text.primary' }}>{n.message}</Box>
                  <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{fromNow(n.createdAt)}</Box>
                </Box>
              </Box>
            ))}
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        sx={{ width: DRAWER, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER, boxSizing: 'border-box' } }}
      >
        {drawer}
      </Drawer>

      <Box component="main" ref={mainRef} className="relative z-[1] w-full min-w-0 flex-1 px-4 pb-16 pt-[88px] md:px-8 lg:px-10">
        <div key={pathname} className="page-enter mx-auto max-w-[1320px]"><Outlet /></div>
      </Box>
    </Box>
  );
}

/** Page title block. Large serif title for a cinematic, editorial feel. */
export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <Box className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <Box className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</div>}
        <Typography component="h1" className="font-display text-gradient !text-[34px] !leading-[1.05] sm:!text-[42px]">{title}</Typography>
        {subtitle && <Typography color="text.secondary" className="!mt-1.5 !text-[15px]">{subtitle}</Typography>}
      </Box>
      {action && <Box className="flex flex-wrap items-center gap-2">{action}</Box>}
    </Box>
  );
}

export function SectionTitle({ children, count, action }) {
  return (
    <Box className="mb-3.5 mt-9 flex items-center justify-between gap-3">
      <h2 className="section-title !m-0">{children}{count != null && <span className="count tabular">{count}</span>}</h2>
      {action}
    </Box>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-900">
      <LuArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> {children}
    </Link>
  );
}
