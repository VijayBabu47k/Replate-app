import { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Box, Typography, MenuItem,
  ToggleButtonGroup, ToggleButton, CircularProgress, InputAdornment, Tooltip,
} from '@mui/material';
import {
  LuHandHeart, LuMoon, LuBan, LuBike, LuKeyRound, LuPackageCheck, LuClipboardCheck, LuX, LuCircleCheck, LuCircleX, LuTruck, LuHouse,
} from 'react-icons/lu';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { validateOtp, validateReceived } from '../lib/validation';
import { useToast } from '../lib/toast';

function OtpDialog({ open, title, help, onClose, onSubmit }) {
  const [otp, setOtp] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const vErr = validateOtp(otp);
  const close = () => { setOtp(''); setTouched(false); onClose(); };
  const submit = async (e) => {
    e?.preventDefault();
    setTouched(true);
    if (vErr) return;
    setBusy(true);
    try {
      await onSubmit(otp);
      close();
    } catch {
      // error already shown as a toast by the caller
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}><LuKeyRound /> {title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{help}</Typography>
          <TextField
            autoFocus fullWidth label="4-digit code" placeholder="••••" value={otp} name="otp" autoComplete="one-time-code"
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={() => setTouched(true)}
            error={touched && !!vErr} helperText={touched && vErr ? vErr : ' '}
            inputProps={{ inputMode: 'numeric', maxLength: 4, 'aria-label': 'Four digit code', style: { fontFamily: '"Geist Mono", monospace', fontSize: 30, letterSpacing: 18, textAlign: 'center', paddingLeft: 18 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}>Verify</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

const REASONS = ['Food was lukewarm on arrival', 'Smelled off, not safe to serve', 'Container broken or spilled', 'Allergen information was wrong', 'Other'];

function ConfirmQualityDialog({ open, listing, onClose, onDone }) {
  const toast = useToast();
  const [accepted, setAccepted] = useState(true);
  const [kg, setKg] = useState(String(listing.quantityKg));
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = validateReceived({ accepted, kg, maxKg: listing.quantityKg, reason, details });
  const show = (k) => submitted && errors[k];

  const submit = async (e) => {
    e?.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) { toast.warning('Please fix the highlighted field.'); return; }
    setBusy(true);
    try {
      const r = await api.post(`/listings/${listing.id}/confirm`, {
        accepted, receivedKg: Number(kg), reason: reason === 'Other' ? details.trim() : reason,
      });
      onDone(r.data);
      onClose();
    } catch (e2) {
      toast.error(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}><LuClipboardCheck /> Check the food</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Look, smell and check the temperature. If in doubt, don't accept it.
          </Typography>
          <ToggleButtonGroup exclusive fullWidth value={accepted} onChange={(_, v) => v !== null && setAccepted(v)} sx={{ mb: 2.5 }}>
            <ToggleButton value={true} sx={{ py: 1.25 }}><LuCircleCheck size={17} /> Looks fine, accept</ToggleButton>
            <ToggleButton value={false} sx={{ py: 1.25 }}><LuCircleX size={17} /> Reject</ToggleButton>
          </ToggleButtonGroup>
          {accepted ? (
            <TextField
              fullWidth label="Quantity received" placeholder="e.g. 12" value={kg} name="kg" required
              onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
              error={!!show('kg')} helperText={show('kg') || `Up to ${listing.quantityKg} kg was sent`}
              inputProps={{ inputMode: 'decimal' }}
              InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
            />
          ) : (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField select fullWidth label="Reason" value={reason} name="reason" required onChange={(e) => setReason(e.target.value)}
                error={!!show('reason')} helperText={show('reason') || ' '}>
                {REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              {reason === 'Other' && (
                <TextField fullWidth multiline minRows={2} label="What was wrong?" placeholder="Describe the problem for the donor" value={details} name="details" required
                  onChange={(e) => setDetails(e.target.value.slice(0, 200))}
                  error={!!show('details')} helperText={show('details') || `${details.trim().length}/200`} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" color={accepted ? 'primary' : 'error'} disabled={busy}>
            {accepted ? 'Accept food' : 'Reject food'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ConfirmDialog({ open, title, text, confirmLabel, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary">{text}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Keep it</Button>
        <Button variant="contained" color="error" onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** All role-specific actions for a listing, in one place. */
export default function ListingActions({ listing: l, onChange, compact }) {
  const { user } = useAuth();
  const [dialog, setDialog] = useState(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const c = l.claim;

  const call = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const r = await api.post(`/listings/${l.id}/${path}`, body);
      toast.success(okMsg);
      onChange?.(r.data);
      return r.data;
    } catch (e) {
      toast.error(errMsg(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const quiet = (p) => p.catch(() => {});

  const buttons = [];
  const live = ['POSTED', 'CLAIMED', 'ASSIGNED'].includes(l.status);

  if (user.role === 'DONOR' && l.viewer?.isDonor && live) {
    buttons.push(<Button key="cancel" color="error" variant="outlined" size="small" startIcon={<LuX size={15} />} disabled={busy} onClick={() => setDialog('cancel')}>Cancel</Button>);
  }

  if (user.role === 'RECEIVER') {
    if (l.status === 'POSTED') {
      const eligible = l.match?.eligible !== false;
      buttons.push(
        <Button key="claim" variant="contained" size="small" startIcon={<LuTruck size={15} />} disabled={busy || !eligible} onClick={() => quiet(call('claim', { selfPickup: false }, 'Claimed. Finding a volunteer now.'))}>Claim for delivery</Button>,
      );
      // Only offered when the receiver has turned on "We can collect ourselves" in Needs & capacity
      if (l.viewer?.canSelfPickup) {
        buttons.push(<Button key="self" variant="outlined" size="small" startIcon={<LuHouse size={15} />} disabled={busy || !eligible} onClick={() => quiet(call('claim', { selfPickup: true }, 'Claimed for self pickup'))}>We'll collect</Button>);
      }
    }
    if (l.viewer?.isReceiver && c?.selfPickup && l.status === 'CLAIMED')
      buttons.push(<Button key="collect" variant="contained" size="small" startIcon={<LuKeyRound size={15} />} onClick={() => setDialog('collect')}>Enter pickup code</Button>);
    if (l.viewer?.isReceiver && c?.selfPickup && l.status === 'COLLECTED')
      buttons.push(<Button key="back" variant="contained" size="small" startIcon={<LuPackageCheck size={15} />} disabled={busy} onClick={() => quiet(call('deliver', {}, 'Marked as arrived'))}>Mark arrived</Button>);
    if (l.viewer?.isReceiver && l.status === 'DELIVERED' && c?.qualityAccepted == null)
      buttons.push(<Button key="confirm" variant="contained" size="small" startIcon={<LuClipboardCheck size={15} />} onClick={() => setDialog('confirm')}>Check & confirm</Button>);
  }

  if (user.role === 'VOLUNTEER') {
    if (l.status === 'CLAIMED' && c && !c.selfPickup && !c.volunteer) {
      const offDuty = l.viewer?.onDuty === false;
      const blockers = l.task && !l.task.eligible ? l.task.blockers : [];
      buttons.push(offDuty ? (
        <Tooltip key="accept" title="You're off duty. Switch on duty to accept pickups.">
          <span><Button variant="contained" size="small" startIcon={<LuMoon size={15} />} disabled>Off duty</Button></span>
        </Tooltip>
      ) : blockers.length ? (
        <Tooltip key="accept" title={`You can't take this pickup: ${blockers.join(', ').toLowerCase()}.`}>
          <span><Button variant="contained" size="small" startIcon={<LuBan size={15} />} disabled>Can't accept</Button></span>
        </Tooltip>
      ) : (
        <Button key="accept" variant="contained" size="small" startIcon={<LuHandHeart size={15} />} disabled={busy} onClick={() => quiet(call('accept-task', {}, 'Task accepted. Head to the pickup point.'))}>Accept pickup</Button>
      ));
    }
    if (l.viewer?.isVolunteer && l.status === 'ASSIGNED') {
      buttons.push(
        <Button key="pick" variant="contained" size="small" startIcon={<LuKeyRound size={15} />} onClick={() => setDialog('collect')}>Enter pickup code</Button>,
        <Button key="rel" color="inherit" size="small" disabled={busy} onClick={() => setDialog('release')}>Can't make it</Button>,
      );
    }
    if (l.viewer?.isVolunteer && l.status === 'COLLECTED')
      buttons.push(<Button key="drop" variant="contained" size="small" startIcon={<LuBike size={15} />} onClick={() => setDialog('deliver')}>Enter delivery code</Button>);
  }

  const showCodes = (c?.pickupOtp || c?.deliveryOtp) && !compact && ['CLAIMED', 'ASSIGNED', 'COLLECTED'].includes(l.status);

  return (
    <>
      {showCodes && (
        <Box className="flex flex-wrap gap-3">
          {c.pickupOtp && (
            <Box className="sunk flex flex-1 items-center justify-between gap-3 rounded-2xl p-3.5">
              <div><div className="text-sm font-semibold text-gray-900">Pickup code</div><div className="text-xs text-gray-500">Give to the collector</div></div>
              <span className="otp text-xl">{c.pickupOtp}</span>
            </Box>
          )}
          {c.deliveryOtp && (
            <Box className="sunk flex flex-1 items-center justify-between gap-3 rounded-2xl p-3.5">
              <div><div className="text-sm font-semibold text-gray-900">Delivery code</div><div className="text-xs text-gray-500">Share only on arrival</div></div>
              <span className="otp text-xl">{c.deliveryOtp}</span>
            </Box>
          )}
        </Box>
      )}
      {l.status === 'POSTED' && user.role === 'RECEIVER' && l.match && !l.match.eligible && !compact && (
        <Alert severity="warning">Not available to you: {l.match.excluded.join('; ')}</Alert>
      )}
      {buttons.length > 0 && <Box className="flex flex-wrap gap-2">{buttons}</Box>}

      <OtpDialog open={dialog === 'collect'} title="Confirm pickup" help="Ask the donor's kitchen staff for the 4-digit pickup code." onClose={() => setDialog(null)} onSubmit={(otp) => call('collect', { otp }, 'Pickup verified. Food is on the way.')} />
      <OtpDialog open={dialog === 'deliver'} title="Confirm delivery" help="Ask the receiver for their 4-digit delivery code." onClose={() => setDialog(null)} onSubmit={(otp) => call('deliver', { otp }, 'Delivered. Thank you!')} />
      {dialog === 'confirm' && <ConfirmQualityDialog open listing={l} onClose={() => setDialog(null)} onDone={(d) => { toast.success(d?.claim?.qualityAccepted === false ? 'Rejection recorded. The donor has been told.' : 'Food accepted. Thank you!'); onChange?.(d); }} />}
      <ConfirmDialog open={dialog === 'cancel'} title="Cancel this listing?" text="Receivers and volunteers on this rescue will be notified." confirmLabel="Cancel listing"
        onClose={() => setDialog(null)} onConfirm={() => quiet(call('cancel', { reason: 'Cancelled by donor' }, 'Listing cancelled'))} />
      <ConfirmDialog open={dialog === 'release'} title="Drop this task?" text="Another volunteer nearby will be alerted to pick it up." confirmLabel="Drop task"
        onClose={() => setDialog(null)} onConfirm={() => quiet(call('release', { reason: 'Unable to make it' }, 'Task released'))} />
    </>
  );
}
