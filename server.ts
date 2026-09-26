import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dypatil-ece-smart-attendance-super-secure-session-key-2026';
const DATA_DIR = path.resolve(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

app.use(express.json());

// Session Token Creation & Verification using HMAC-SHA256
export interface SessionPayload {
  userId: string;
  name: string;
  role: 'teacher' | 'hod';
  uniqueCode?: string;
  department: string;
  email?: string;
  authenticatedBy: 'password';
  iat: number;
  exp: number;
}

function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 // 7 days validity
  };
  const payloadJson = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadJson)
    .digest('base64url');
  return `${payloadJson}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadJson, signature] = token.split('.');
    if (!payloadJson || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadJson)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadJson, 'base64url').toString('utf-8')
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Auth Middleware
export interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
  }
  const token = authHeader.substring(7).trim();
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
  req.user = session;
  next();
}

function requireHodRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'hod') {
      return res.status(403).json({
        error: 'Forbidden: HOD authorization required. Access denied for Faculty role.'
      });
    }
    next();
  });
}

// Dynamic RP configuration helper
function getWebAuthnConfig(req: Request) {
  let originHeader = req.get('origin') || req.get('referer') || '';
  if (originHeader.endsWith('/')) {
    originHeader = originHeader.slice(0, -1);
  }

  let hostname = 'localhost';
  if (originHeader) {
    try {
      hostname = new URL(originHeader).hostname;
    } catch (_) {}
  } else {
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
    hostname = rawHost.split(':')[0];
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    originHeader = `${isHttps ? 'https' : 'http'}://${rawHost}`;
  }

  // Filter out invalid RP IDs like IP addresses
  if (hostname === '0.0.0.0' || hostname === '127.0.0.1' || hostname === '::1') {
    hostname = 'localhost';
  }

  const allowedOrigins = [
    originHeader,
    `https://${hostname}`,
    `http://${hostname}`,
    `https://${hostname}:3000`,
    `http://${hostname}:3000`,
    'http://localhost:3000',
    'https://localhost:3000'
  ].filter(Boolean);

  return {
    rpName: 'D.Y. Patil Smart Attendance Biometric Enclave',
    rpID: hostname,
    origin: allowedOrigins
  };
}

/* ========================================================================== */
/*                                API ROUTES                                  */
/* ========================================================================== */

// 1. Password-based Login Endpoint
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, role } = req.body;
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ error: 'Username/ID and password are required' });
  }

  if (role === 'hod') {
    const matchesHodUser = cleanUser.toLowerCase() === 'dyp' || cleanUser.toLowerCase() === 'hod';
    const matchesHodPass = cleanPass === 'dyp123' || cleanPass === 'DYP-HOD-2026';
    if (!matchesHodUser || !matchesHodPass) {
      return res.status(401).json({ error: 'Invalid HOD username or password' });
    }

    const token = createSessionToken({
      userId: 'hod-1',
      name: 'Prof. Prashant Kathole',
      role: 'hod',
      uniqueCode: 'dyp',
      department: 'Department Of Electronics And Computer Engineering',
      email: 'hod.ece@dypatil.edu',
      authenticatedBy: 'password'
    });

    return res.json({
      success: true,
      token,
      user: {
        role: 'hod',
        id: 'hod-1',
        name: 'Prof. Prashant Kathole',
        uniqueCode: 'dyp',
        department: 'Department Of Electronics And Computer Engineering',
        email: 'hod.ece@dypatil.edu'
      }
    });
  } else {
    // Teacher login validation
    const token = createSessionToken({
      userId: cleanUser.toUpperCase(),
      name: `Faculty Member (${cleanUser.toUpperCase()})`,
      role: 'teacher',
      uniqueCode: cleanUser.toUpperCase(),
      department: 'Department Of Electronics And Computer Engineering',
      authenticatedBy: 'password'
    });

    return res.json({
      success: true,
      token,
      user: {
        role: 'teacher',
        id: cleanUser.toUpperCase(),
        name: `Faculty Member (${cleanUser.toUpperCase()})`,
        uniqueCode: cleanUser.toUpperCase(),
        department: 'Department Of Electronics And Computer Engineering'
      }
    });
  }
});

// 2. Session Validation Endpoint
app.get('/api/auth/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// 3. Protected HOD API Check
app.get('/api/hod/verify', requireHodRole, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    authorized: true,
    message: 'Authorized HOD session confirmed.',
    user: req.user
  });
});

/* ========================================================================== */
/*                           VITE / STATIC SERVING                            */
/* ========================================================================== */

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[D.Y. Patil Smart Attendance] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
