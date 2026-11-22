import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, InputAdornment, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress, Tooltip } from '@mui/material';
import {
  LuMail, LuLock, LuEye, LuEyeOff, LuArrowRight, LuChefHat, LuHouse, LuBike, LuZap, LuRadar, LuSprout, LuCopy, LuCheck,
} from 'react-icons/lu';
import { useAuth, HOME } from '../lib/auth';
import { api, errMsg } from '../lib/api';
import { ROLE_LABEL } from '../lib/format';
import { validateLogin } from '../lib/validation';
import { IS_DEMO } from '../lib/config';
import { Ambient } from '../components/Motion';
import Brand from '../components/Brand';
import { useToast } from '../lib/toast';

const ROLE_ICON = { DONOR: LuChefHat, RECEIVER: LuHouse, VOLUNTEER: LuBike };

const HIGHLIGHTS = [
  { icon: LuZap, text: 'Post in under a minute' },
  { icon: LuRadar, text: 'Smart nearby matching' },
  { icon: LuSprout, text: 'Live impact tracking' },
];

const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  const [role, setRole] = useState('DONOR');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!IS_DEMO) return;
    api.get('/auth/demo-accounts').then((r) => setDemo(r.data)).catch(() => {});
  }, []);

  const errors = validateLogin({ email, password });
  const show = (k) => (submitted || touched[k]) && errors[k];

  const submit = async (e, creds) => {
    e?.preventDefault();
    if (!creds) {
      setSubmitted(true);
      if (Object.keys(errors).length) return;
    }
    setBusy(true);
    try {
      const u = await login((creds?.email ?? email).trim(), creds?.password ?? password);
      nav(HOME[u.role]);
    } catch (e2) {
      toast.error(errMsg(e2));
      setBusy(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard?.writeText(demo.password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const grouped = demo?.users?.reduce((acc, u) => ((acc[u.role] ||= []).push(u), acc), {}) || {};
  const roles = Object.keys(ROLE_ICON).filter((r) => grouped[r]);
  const activeRole = roles.includes(role) ? role : roles[0];

  return (
    <Box className="relative flex min-h-screen flex-col">
      <Ambient />
      <Box className="relative z-[1] mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 md:px-8">
        <Brand />
        <Link to="/register" className="hidden text-sm font-medium text-gray-600 no-underline transition-colors hover:text-gray-900 sm:inline">Create an account</Link>
      </Box>

      <Box className="page-enter relative z-[1] mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-10 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        {/* ---------- Pitch ---------- */}
        <Box className="flex flex-col">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-solid border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur">
            <span className="live-dot" /> Rescuing food across the city, live
          </span>
          <h1 className="font-display m-0 text-[48px] leading-[0.98] text-gray-900 sm:text-[64px] lg:text-[76px]">
            Good food deserves <em className="text-accent pr-1">a second table.</em>
          </h1>
          <Typography className="!mt-6 max-w-md !text-[17px] !leading-relaxed text-gray-600">
            Surplus from kitchens and canteens, matched to shelters and volunteers nearby before it spoils.
          </Typography>
          <Box className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="icon-tile h-8 w-8 !rounded-[10px]"><Icon size={16} /></span>{text}
              </span>
            ))}
          </Box>
        </Box>

        {/* ---------- Sign-in panel ---------- */}
        <Box className="glass glow-border relative w-full max-w-[460px] justify-self-center rounded-[28px] p-6 sm:p-8 lg:justify-self-end">
          <Typography component="h2" className="!text-2xl !font-semibold !tracking-tight">Welcome back</Typography>
          <Typography variant="body2" color="text.secondary" className="!mt-1">Sign in to your account</Typography>

          <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-1">
            <TextField
              label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth autoComplete="username" required
              onBlur={() => setTouched((t) => ({ ...t, email: true }))} error={!!show('email')} helperText={show('email') || ' '}
              inputProps={{ maxLength: 120 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><LuMail /></InputAdornment> }}
            />
            <TextField
              label="Password" type={reveal ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth autoComplete="current-password" required
              onBlur={() => setTouched((t) => ({ ...t, password: true }))} error={!!show('password')} helperText={show('password') || ' '}
              inputProps={{ maxLength: 64 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LuLock /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end" aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal((v) => !v)}>
                      {reveal ? <LuEyeOff size={17} /> : <LuEye size={17} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}
              endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <LuArrowRight />}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <Typography variant="body2" color="text.secondary" className="!mt-4 text-center">
            New here? <Link to="/register" className="font-semibold text-brand-700 no-underline hover:underline">Create an account</Link>
          </Typography>

          {demo && roles.length > 0 && (
            <Box className="mt-7 border-0 border-t border-solid border-gray-200 pt-6">
              <Box className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Try a demo</span>
                <Tooltip title={copied ? 'Copied' : 'Copy demo password'}>
                  <button type="button" onClick={copyPassword} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-200">
                    {demo.password} {copied ? <LuCheck size={12} /> : <LuCopy size={12} />}
                  </button>
                </Tooltip>
              </Box>

              <ToggleButtonGroup exclusive fullWidth size="small" value={activeRole} onChange={(_, v) => v && setRole(v)} className="!mb-3">
                {roles.map((r) => {
                  const Icon = ROLE_ICON[r];
                  return <ToggleButton key={r} value={r}><Icon size={15} /> {ROLE_LABEL[r]}</ToggleButton>;
                })}
              </ToggleButtonGroup>

              <Box className="flex flex-col gap-1">
                {(grouped[activeRole] || []).slice(0, 3).map((u) => (
                  <button
                    key={u.email} type="button" disabled={busy}
                    onClick={() => submit(null, { email: u.email, password: demo.password })}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="bg-grad-brand grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white">{initials(u.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{u.name}</span>
                      <span className="block truncate text-xs text-gray-500">{u.organization?.name || u.title}</span>
                    </span>
                    <LuArrowRight size={16} className="text-gray-400 transition-all group-hover:translate-x-0.5 group-hover:text-brand-700" />
                  </button>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {IS_DEMO && <p className="relative z-[1] m-0 px-5 pb-6 text-center text-xs text-gray-500">Demo environment with sample data.</p>}
    </Box>
  );
}
