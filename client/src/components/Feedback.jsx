import { Box, Alert, Typography } from '@mui/material';
import { LuInbox } from 'react-icons/lu';
import { Skeleton } from './Motion';

export const Loading = () => (
  <Box className="flex flex-col gap-4 py-2" role="status" aria-label="Loading">
    <Skeleton h={44} className="w-64 max-w-full" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Skeleton h={112} /><Skeleton h={112} /><Skeleton h={112} /><Skeleton h={112} /></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Skeleton h={240} /><Skeleton h={240} /><Skeleton h={240} /></div>
  </Box>
);

export const ErrorBox = ({ error }) => <Alert severity="error">{error}</Alert>;

/** Empty state. `icon` is a react-icons component. */
export const Empty = ({ icon: Icon = LuInbox, title, text, action }) => (
  <Box className="glass pop-in flex flex-col items-center rounded-3xl px-6 py-12 text-center" sx={{ borderStyle: 'dashed !important' }}>
    <span className="icon-tile mb-4 h-14 w-14 !rounded-2xl"><Icon size={24} /></span>
    <Typography className="!font-semibold">{title}</Typography>
    {text && <Typography variant="body2" color="text.secondary" className="!mt-1 max-w-sm">{text}</Typography>}
    {action && <Box className="mt-4">{action}</Box>}
  </Box>
);
