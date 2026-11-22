import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import donorRoutes from './routes/donor.js';
import receiverRoutes from './routes/receiver.js';
import volunteerRoutes from './routes/volunteer.js';
import impactRoutes from './routes/impact.js';
import miscRoutes from './routes/misc.js';
import { startWatchdog } from './jobs/watchdog.js';
import { verifyMailer } from './lib/mailer.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/receiver', receiverRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api', miscRoutes);

app.use((req, res) => res.status(404).json({ error: `No route ${req.method} ${req.path}` }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startWatchdog();
  verifyMailer();
});
