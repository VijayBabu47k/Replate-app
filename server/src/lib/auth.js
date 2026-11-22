import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export const ROLES = ['DONOR', 'RECEIVER', 'VOLUNTEER'];
const SECRET = () => process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET(), { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const payload = jwt.verify(token, SECRET());
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: { include: { receiverProfile: true } }, volunteerProfile: true },
    });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: `Only ${roles.join('/')} users can do this` });

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return { ...rest, phone: maskPhone(u.phone) };
}

export function maskPhone(p = '') {
  const d = p.replace(/\D/g, '');
  if (d.length < 6) return 'hidden';
  return `+${d.slice(0, 2)} ${d.slice(2, 4)}XXX XX${d.slice(-3)}`;
}
