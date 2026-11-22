import { useState } from 'react';
import { Box, Card, Typography } from '@mui/material';
import { LuMailOpen, LuExternalLink, LuMail } from 'react-icons/lu';
import { useFetch } from '../lib/hooks';
import { Loading, Empty } from '../components/Feedback';
import { PageHeader } from '../components/Layout';
import { fmtDateTime, fromNow } from '../lib/format';

const STATUS_TONE = { sent: 'bg-green-50 text-green-700', logged: 'bg-gray-100 text-gray-600', skipped: 'bg-amber-50 text-amber-700' };
const statusKey = (s) => s.split(':')[0];

export default function Outbox() {
  const { data } = useFetch('/emails', { poll: 20000 });
  const [sel, setSel] = useState(null);
  if (!data) return <Loading />;
  const current = sel || data.items[0];

  return (
    <Box>
      <PageHeader title="Email outbox" />
      {!data.items.length ? <Empty icon={LuMailOpen} title="No emails yet" text="Updates about your rescues will appear here." /> : (
        <Box className="grid gap-5 md:grid-cols-[minmax(260px,1fr)_2fr]">
          <Card className="!p-2 md:max-h-[640px] md:overflow-y-auto">
            {data.items.map((m) => {
              const on = current?.id === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setSel(m)}
                  className={`flex w-full cursor-pointer gap-3 rounded-xl border-0 p-3 text-left transition-colors ${on ? 'bg-brand-50' : 'bg-transparent hover:bg-gray-50'}`}>
                  <LuMail size={16} className={`mt-0.5 shrink-0 ${on ? 'text-brand-700' : 'text-gray-400'}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{m.subject}</span>
                    <span className="block text-xs text-gray-500">{fromNow(m.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </Card>
          {current && (
            <Card className="!p-5">
              <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <Box className="min-w-0">
                  <Typography className="!font-semibold">{current.subject}</Typography>
                  <Typography variant="caption" color="text.secondary">To {current.to} · {fmtDateTime(current.createdAt)}</Typography>
                </Box>
                <Box className="flex items-center gap-2">
                  <span className={`pill capitalize ${STATUS_TONE[statusKey(current.status)] || 'bg-red-50 text-red-700'}`}>{statusKey(current.status)}</span>
                  {current.previewUrl && <a href={current.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 no-underline">Preview <LuExternalLink size={13} /></a>}
                </Box>
              </Box>
              {current.status.includes(':') && <div className={`mb-3 rounded-xl p-3 text-xs ${current.status.startsWith('failed') ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{current.status}</div>}
              <iframe title="email" srcDoc={current.html} sandbox="" className="h-[520px] w-full rounded-xl border border-solid border-gray-200 bg-white" />
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
