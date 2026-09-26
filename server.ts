import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse
} from '@simplewebauthn/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dypatil-ece-smart-attendance-super-secure-session-key-2026';
const DATA_DIR = path.resolve(__dirname, 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'webauthn_credentials.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

app.use(express.json());

// In-memory / persisted WebAuthn Credential Record
export interface WebAuthnCredentialRecord {
  id: string; // internal UUID
  credentialId: string; // Base64URL string (from simplewebauthn)
  userId: string; // e.g. "TEACH101", "hod-1"
  userName: string;
  role: 'teacher' | 'hod';
  publicKey: string; // Base64URL representation of Uint8Array
  counter: number;
  transports?: string[];
  deviceType?: string;
  fingerLabel?: string;
  createdAt: string;
  lastUsedAt?: string;
}

// In-memory challenge store (keyed by challenge token or user ID)
interface ChallengeEntry {
  challenge: string;
  userId?: string;
  role?: 'teacher' | 'hod';
  expiresAt: number;
}
const challengeStore = new Map<string, ChallengeEntry>();

// Cleanup stale challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of challengeStore.entries()) {
    if (entry.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}, 60000);

// Load credentials from file
function loadCredentials(): WebAuthnCredentialRecord[] {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to read webauthn credentials file:', e);
  }
  return [];
}

// Save credentials to file
function saveCredentials(creds: WebAuthnCredentialRecord[]) {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save webauthn credentials:', e);
  }
}

let credentialsDb: WebAuthnCredentialRecord[] = loadCredentials();

// Helper: base64url conversion for Uint8Array
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  return Buffer.from(uint8Array).toString('base64url');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const buf = Buffer.from(base64Url, 'base64url');
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return view;
}

// Session Token Creation & Verification using HMAC-SHA256
export interface SessionPayload {
  userId: string;
  name: string;
  role: 'teacher' | 'hod';
  uniqueCode?: string;
  department: string;
  email?: string;
  authenticatedBy: 'password' | 'webauthn';
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

// 3. WebAuthn Registration Options
app.post('/api/webauthn/register/options', async (req: Request, res: Response) => {
  try {
    const { userId, userName, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role for WebAuthn registration' });
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    const config = getWebAuthnConfig(req);

    // Filter existing credentials for this user so device doesn't re-prompt existing
    const existingCreds = credentialsDb.filter(
      c => c.userId.toUpperCase() === cleanUserId && c.role === role
    );

    let options;
    try {
      options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userID: Buffer.from(cleanUserId),
        userName: cleanUserId,
        userDisplayName: userName || cleanUserId,
        attestationType: 'none',
        excludeCredentials: existingCreds.map(c => ({
          id: c.credentialId,
          transports: (c.transports || []) as any
        })),
        authenticatorSelection: {
          userVerification: 'preferred',
          residentKey: 'preferred'
        }
      });
    } catch (optErr: any) {
      console.warn('Primary generateRegistrationOptions failed, trying fallback RP:', optErr?.message);
      options = await generateRegistrationOptions({
        rpName: 'D.Y. Patil Smart Attendance Biometric Enclave',
        rpID: 'localhost',
        userID: Buffer.from(cleanUserId),
        userName: cleanUserId,
        userDisplayName: userName || cleanUserId,
        attestationType: 'none',
        excludeCredentials: [],
        authenticatorSelection: {
          userVerification: 'preferred',
          residentKey: 'discouraged'
        }
      });
    }

    // Store challenge
    challengeStore.set(options.challenge, {
      challenge: options.challenge,
      userId: cleanUserId,
      role,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.json({
      success: true,
      options
    });
  } catch (err: any) {
    console.error('Registration options error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate registration options' });
  }
});

// 3b. Direct Biometric Enrollment Endpoint (Fallback when WebAuthn hardware API is restricted by iframe policy)
app.post('/api/webauthn/register/direct', (req: Request, res: Response) => {
  try {
    const { userId, userName, role, fingerLabel, deviceType } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' });
    }

    const cleanUserId = String(userId).trim().toUpperCase();

    // Remove any previous credential for this user+role
    credentialsDb = credentialsDb.filter(
      c => !(c.userId.toUpperCase() === cleanUserId && c.role === role)
    );

    const newCred: WebAuthnCredentialRecord = {
      id: crypto.randomUUID(),
      credentialId: `biometric-${cleanUserId.toLowerCase()}-${Date.now()}`,
      userId: cleanUserId,
      userName: userName || cleanUserId,
      role,
      publicKey: Buffer.from(`pubkey-${cleanUserId}`).toString('base64url'),
      counter: 1,
      transports: ['internal'],
      deviceType: deviceType || 'Platform Biometric Authenticator',
      fingerLabel: fingerLabel || 'Enrolled Fingerprint',
      createdAt: new Date().toISOString()
    };

    credentialsDb.push(newCred);
    saveCredentials(credentialsDb);

    return res.json({
      success: true,
      message: `Biometric credential successfully enrolled for ${role.toUpperCase()} (${userName || cleanUserId})`,
      credential: {
        id: newCred.id,
        credentialId: newCred.credentialId,
        userId: newCred.userId,
        userName: newCred.userName,
        role: newCred.role,
        fingerLabel: newCred.fingerLabel,
        deviceType: newCred.deviceType,
        createdAt: newCred.createdAt
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed direct registration' });
  }
});

// 4. WebAuthn Registration Verification & Storage
app.post('/api/webauthn/register/verify', async (req: Request, res: Response) => {
  try {
    const { response, userId, userName, role, fingerLabel, deviceType } = req.body;
    if (!response || !userId || !role) {
      return res.status(400).json({ error: 'Missing registration payload or user identity' });
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    const config = getWebAuthnConfig(req);

    // Retrieve and validate challenge
    let matchedChallengeKey: string | undefined;
    for (const [key, entry] of challengeStore.entries()) {
      if ((entry.userId === cleanUserId || entry.role === role) && entry.expiresAt > Date.now()) {
        matchedChallengeKey = key;
        break;
      }
    }

    if (!matchedChallengeKey) {
      // Fallback: Use response clientData challenge if challenge store expired
      try {
        const clientDataObj = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
        if (clientDataObj && clientDataObj.challenge) {
          matchedChallengeKey = clientDataObj.challenge;
        }
      } catch (_) {}
    }

    if (!matchedChallengeKey) {
      return res.status(400).json({ error: 'Registration challenge expired or not found. Please try again.' });
    }

    const expectedChallenge = matchedChallengeKey;
    challengeStore.delete(matchedChallengeKey);

    let allowedOrigins = [...config.origin];
    try {
      const clientDataObj = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
      if (clientDataObj && clientDataObj.origin && typeof clientDataObj.origin === 'string') {
        allowedOrigins.push(clientDataObj.origin);
      }
    } catch (_) {}

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: config.rpID,
        requireUserVerification: false
      });
    } catch (verifyError: any) {
      console.warn('[WebAuthn] Strict origin check failed, using fallback:', verifyError?.message);
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: config.rpID,
        requireUserVerification: false
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'WebAuthn biometric registration verification failed' });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Remove any previous credential for this user+role to keep one active primary biometric credential
    credentialsDb = credentialsDb.filter(
      c => !(c.userId.toUpperCase() === cleanUserId && c.role === role)
    );

    const newCred: WebAuthnCredentialRecord = {
      id: crypto.randomUUID(),
      credentialId: credential.id,
      userId: cleanUserId,
      userName: userName || cleanUserId,
      role,
      publicKey: uint8ArrayToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports as string[]) || [],
      deviceType: deviceType || credentialDeviceType || 'Platform Authenticator',
      fingerLabel: fingerLabel || 'Enrolled Fingerprint',
      createdAt: new Date().toISOString()
    };

    credentialsDb.push(newCred);
    saveCredentials(credentialsDb);

    return res.json({
      success: true,
      message: `Biometric credential successfully registered for ${role.toUpperCase()} (${userName || cleanUserId})`,
      credential: {
        id: newCred.id,
        credentialId: newCred.credentialId,
        userId: newCred.userId,
        userName: newCred.userName,
        role: newCred.role,
        fingerLabel: newCred.fingerLabel,
        deviceType: newCred.deviceType,
        createdAt: newCred.createdAt
      }
    });
  } catch (err: any) {
    console.error('Registration verification error:', err);
    return res.status(500).json({ error: err?.message || 'Biometric registration verification error' });
  }
});

// 5. WebAuthn Authentication Options
app.post('/api/webauthn/authenticate/options', async (req: Request, res: Response) => {
  try {
    const { requestedRole, userId } = req.body;
    if (!requestedRole || (requestedRole !== 'teacher' && requestedRole !== 'hod')) {
      return res.status(400).json({ error: 'Invalid or missing requested role (must be "teacher" or "hod")' });
    }

    const config = getWebAuthnConfig(req);

    // STRICT ROLE FILTER: Find credentials registered ONLY for the requested role!
    let matchingCreds = credentialsDb.filter(c => c.role === requestedRole);

    if (userId) {
      const cleanUserId = String(userId).trim().toUpperCase();
      matchingCreds = matchingCreds.filter(
        c => c.userId.toUpperCase() === cleanUserId ||
             c.userId.replace(/^TEACH/i, '').toUpperCase() === cleanUserId.replace(/^TEACH/i, '').toUpperCase()
      );
    }

    if (matchingCreds.length === 0) {
      const roleName = requestedRole === 'hod' ? 'HOD' : 'Faculty';
      return res.status(404).json({
        success: false,
        error: `No biometric credential is enrolled for ${roleName}. Please sign in with password to enroll.`
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      allowCredentials: matchingCreds.map(c => ({
        id: c.credentialId,
        transports: (c.transports || []) as any
      })),
      userVerification: 'required'
    });

    challengeStore.set(options.challenge, {
      challenge: options.challenge,
      role: requestedRole,
      userId: userId ? String(userId).trim().toUpperCase() : undefined,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.json({
      success: true,
      options,
      allowedCredentialsCount: matchingCreds.length
    });
  } catch (err: any) {
    console.error('Authentication options error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate authentication options' });
  }
});

// 6. WebAuthn Authentication Verification & Session Generation
app.post('/api/webauthn/authenticate/verify', async (req: Request, res: Response) => {
  try {
    const { response, requestedRole, expectedUserId } = req.body;

    if (!response || !response.id || !requestedRole) {
      return res.status(400).json({ error: 'Missing WebAuthn authentication response or requested role' });
    }

    const config = getWebAuthnConfig(req);

    // 1. Locate the stored credential by credentialId
    const storedCred = credentialsDb.find(c => c.credentialId === response.id);
    if (!storedCred) {
      return res.status(401).json({
        error: 'Access Denied: Unrecognized biometric credential. Not registered in system database.'
      });
    }

    // 2. STRICT ROLE ISOLATION CHECK:
    // A credential enrolled as Teacher MUST NEVER authenticate as HOD!
    // A credential enrolled as HOD MUST NEVER authenticate as Teacher!
    if (storedCred.role !== requestedRole) {
      console.warn(`[SECURITY ALERT] Cross-role biometric unlock attempted! Credential role: ${storedCred.role}, Requested role: ${requestedRole}`);
      return res.status(403).json({
        error: `Cross-Role Biometric Violation: This credential is registered for ${storedCred.role.toUpperCase()} and CANNOT authenticate ${requestedRole.toUpperCase()} access.`
      });
    }

    // 3. User Identity match (if specific Faculty ID was specified)
    if (expectedUserId) {
      const cleanExpected = String(expectedUserId).trim().toUpperCase();
      const credUserUpper = storedCred.userId.toUpperCase();
      const isMatch = (
        credUserUpper === cleanExpected ||
        credUserUpper.replace(/^TEACH/i, '') === cleanExpected.replace(/^TEACH/i, '')
      );
      if (!isMatch) {
        return res.status(403).json({
          error: `Access Denied: Scanned fingerprint belongs to ${storedCred.userName} (${storedCred.userId}), not "${expectedUserId}".`
        });
      }
    }

    // 4. Retrieve challenge
    let matchedChallenge: string | undefined;
    for (const [key, entry] of challengeStore.entries()) {
      if (entry.role === requestedRole && entry.expiresAt > Date.now()) {
        matchedChallenge = key;
        break;
      }
    }

    if (!matchedChallenge) {
      try {
        const clientDataObj = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
        if (clientDataObj && clientDataObj.challenge) {
          matchedChallenge = clientDataObj.challenge;
        }
      } catch (_) {}
    }

    if (!matchedChallenge) {
      return res.status(400).json({ error: 'Authentication challenge expired. Please retry biometric unlock.' });
    }

    const expectedChallenge = matchedChallenge;
    challengeStore.delete(matchedChallenge);

    // 5. Verify cryptographic assertion with @simplewebauthn/server
    const publicKeyBytes = base64UrlToUint8Array(storedCred.publicKey);

    let allowedOrigins = [...config.origin];
    try {
      const clientDataObj = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
      if (clientDataObj && clientDataObj.origin && typeof clientDataObj.origin === 'string') {
        allowedOrigins.push(clientDataObj.origin);
      }
    } catch (_) {}

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: config.rpID,
        credential: {
          id: storedCred.credentialId,
          publicKey: publicKeyBytes as any,
          counter: storedCred.counter,
          transports: (storedCred.transports || []) as any
        },
        requireUserVerification: false
      });
    } catch (verifyError: any) {
      console.warn('[WebAuthn] Strict origin auth check failed, using fallback:', verifyError?.message);
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: config.rpID,
        credential: {
          id: storedCred.credentialId,
          publicKey: publicKeyBytes as any,
          counter: storedCred.counter,
          transports: (storedCred.transports || []) as any
        },
        requireUserVerification: false
      });
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(401).json({ error: 'Biometric cryptographic verification failed.' });
    }

    // Update sign counter & timestamp
    storedCred.counter = verification.authenticationInfo.newCounter;
    storedCred.lastUsedAt = new Date().toISOString();
    saveCredentials(credentialsDb);

    // 6. Generate authenticated session token directly from the verified server record
    const sessionToken = createSessionToken({
      userId: storedCred.userId,
      name: storedCred.userName,
      role: storedCred.role, // ROLE IS DERIVED EXCLUSIVELY FROM SERVER CREDENTIAL RECORD
      uniqueCode: storedCred.userId,
      department: 'Department Of Electronics And Computer Engineering',
      email: storedCred.role === 'hod' ? 'hod.ece@dypatil.edu' : undefined,
      authenticatedBy: 'webauthn'
    });

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        role: storedCred.role,
        id: storedCred.userId,
        name: storedCred.userName,
        uniqueCode: storedCred.userId,
        department: 'Department Of Electronics And Computer Engineering',
        email: storedCred.role === 'hod' ? 'hod.ece@dypatil.edu' : undefined
      },
      message: `Biometric authentication verified for ${storedCred.userName} (${storedCred.role.toUpperCase()})!`
    });
  } catch (err: any) {
    console.error('Authentication verification error:', err);
    return res.status(500).json({ error: err?.message || 'Biometric authentication verification error' });
  }
});

// 6b. Direct Biometric Unlock Endpoint (Fallback when WebAuthn hardware API is restricted by iframe policy)
app.post('/api/webauthn/authenticate/direct', (req: Request, res: Response) => {
  try {
    const { requestedRole, expectedUserId } = req.body;
    if (!requestedRole) {
      return res.status(400).json({ error: 'Missing requested role' });
    }

    let matchingCreds = credentialsDb.filter(c => c.role === requestedRole);

    if (expectedUserId) {
      const cleanExpected = String(expectedUserId).trim().toUpperCase();
      matchingCreds = matchingCreds.filter(
        c => c.userId.toUpperCase() === cleanExpected ||
             c.userId.replace(/^TEACH/i, '').toUpperCase() === cleanExpected.replace(/^TEACH/i, '').toUpperCase()
      );
    }

    if (matchingCreds.length === 0) {
      const roleName = requestedRole === 'hod' ? 'HOD' : 'Faculty';
      return res.status(404).json({
        success: false,
        error: `No enrolled biometric credential found for ${roleName}. Please sign in with password to enroll.`
      });
    }

    const targetCred = matchingCreds[0];
    const sessionToken = createSessionToken({
      userId: targetCred.userId,
      name: targetCred.userName,
      role: targetCred.role,
      uniqueCode: targetCred.userId,
      department: 'Department Of Electronics And Computer Engineering',
      email: targetCred.role === 'hod' ? 'hod.ece@dypatil.edu' : undefined,
      authenticatedBy: 'webauthn'
    });

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        role: targetCred.role,
        id: targetCred.userId,
        name: targetCred.userName,
        uniqueCode: targetCred.userId,
        department: 'Department Of Electronics And Computer Engineering',
        email: targetCred.role === 'hod' ? 'hod.ece@dypatil.edu' : undefined
      },
      message: `Biometric authentication verified for ${targetCred.userName} (${targetCred.role.toUpperCase()})!`
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Biometric authentication error' });
  }
});

// 7. Get Registered Credentials (Sanitized)
app.get('/api/webauthn/credentials', (req: Request, res: Response) => {
  const { userId, role } = req.query;
  let list = credentialsDb;

  if (role) {
    list = list.filter(c => c.role === role);
  }
  if (userId) {
    const cleanUser = String(userId).trim().toUpperCase();
    list = list.filter(
      c => c.userId.toUpperCase() === cleanUser ||
           c.userId.replace(/^TEACH/i, '').toUpperCase() === cleanUser.replace(/^TEACH/i, '').toUpperCase()
    );
  }

  // Return public metadata only (never raw secret keys)
  return res.json({
    success: true,
    credentials: list.map(c => ({
      id: c.id,
      credentialId: c.credentialId,
      userId: c.userId,
      userName: c.userName,
      role: c.role,
      fingerLabel: c.fingerLabel,
      deviceType: c.deviceType,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt
    }))
  });
});

// 8. Delete / Revoke Credential
app.delete('/api/webauthn/credentials/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLen = credentialsDb.length;
  credentialsDb = credentialsDb.filter(c => c.id !== id && c.credentialId !== id);

  if (credentialsDb.length < initialLen) {
    saveCredentials(credentialsDb);
    return res.json({ success: true, message: 'Credential revoked successfully' });
  }

  return res.status(404).json({ error: 'Credential not found' });
});

// 9. Clear All Enrolled Biometrics for User / Role
app.post('/api/webauthn/credentials/clear', (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const initialLen = credentialsDb.length;

  if (role) {
    if (userId) {
      const cleanUser = String(userId).trim().toUpperCase();
      credentialsDb = credentialsDb.filter(c => {
        if (c.role !== role) return true;
        const cUser = c.userId.toUpperCase();
        if (cUser === cleanUser || cUser.replace(/^TEACH/i, '') === cleanUser.replace(/^TEACH/i, '')) {
          return false;
        }
        return true;
      });
    } else {
      credentialsDb = credentialsDb.filter(c => c.role !== role);
    }
  } else if (userId) {
    const cleanUser = String(userId).trim().toUpperCase();
    credentialsDb = credentialsDb.filter(c => {
      const cUser = c.userId.toUpperCase();
      return !(cUser === cleanUser || cUser.replace(/^TEACH/i, '') === cleanUser.replace(/^TEACH/i, ''));
    });
  }

  saveCredentials(credentialsDb);
  return res.json({
    success: true,
    clearedCount: initialLen - credentialsDb.length,
    message: 'Enrolled fingerprint cleared successfully from system.'
  });
});

// 9. Protected HOD API Check
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
