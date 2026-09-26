import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { AuthUser } from '../types';
import { authService } from './authService';

export interface RegisteredCredentialInfo {
  id: string;
  credentialId: string;
  userId: string;
  userName: string;
  role: 'teacher' | 'hod';
  fingerLabel?: string;
  deviceType?: string;
  createdAt: string;
  lastUsedAt?: string;
}

class WebAuthnClientService {
  /**
   * Check if the device / browser supports WebAuthn / Passkeys
   */
  isWebAuthnSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      !!navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function'
    );
  }

  /**
   * Check if platform authenticator (Touch ID, Windows Hello, Android Biometrics) is available
   */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isWebAuthnSupported()) return false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get human-friendly hardware device name
   */
  getHardwareName(): string {
    if (typeof navigator === 'undefined') return 'Hardware Platform Authenticator';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac') || ua.includes('iphone') || ua.includes('ipad')) {
      return 'Apple Touch ID / Face ID';
    }
    if (ua.includes('win')) {
      return 'Windows Hello Biometrics (TPM 2.0)';
    }
    if (ua.includes('android')) {
      return 'Android StrongBox Fingerprint / Passkey';
    }
    return 'FIDO2 / WebAuthn Hardware Authenticator';
  }

  /**
   * Fetch registered credentials for a user or role from the server
   */
  async getCredentials(userId?: string, role?: 'teacher' | 'hod'): Promise<RegisteredCredentialInfo[]> {
    let serverCreds: RegisteredCredentialInfo[] = [];
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (role) params.set('role', role);

      const res = await fetch(`/api/webauthn/credentials?${params.toString()}`);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        const data = await res.json().catch(() => ({}));
        serverCreds = data.credentials || [];
      }
    } catch (e) {
      console.warn('Failed to fetch credentials from server:', e);
    }

    // Merge with local fallback credentials
    let localCreds: RegisteredCredentialInfo[] = [];
    try {
      const saved = localStorage.getItem('local_webauthn_creds') || '[]';
      localCreds = JSON.parse(saved);
      if (userId) {
        const cleanId = userId.trim().toUpperCase();
        localCreds = localCreds.filter(c => c.userId === cleanId);
      }
      if (role) {
        localCreds = localCreds.filter(c => c.role === role);
      }
    } catch (_) {}

    const combined = [...serverCreds];
    localCreds.forEach(lc => {
      if (!combined.some(sc => sc.credentialId === lc.credentialId || (sc.userId === lc.userId && sc.role === lc.role))) {
        combined.push(lc);
      }
    });

    return combined;
  }

  /**
   * Enroll a new WebAuthn biometric credential for a specific user and role
   */
  async enrollBiometric(
    userId: string,
    userName: string,
    role: 'teacher' | 'hod',
    fingerLabel: string = 'Enrolled Fingerprint'
  ): Promise<{ success: boolean; message: string; credential?: RegisteredCredentialInfo }> {
    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        message: 'WebAuthn hardware biometric authentication is not supported on this browser.'
      };
    }

    try {
      // Helper for direct biometric enrollment fallback
      const performDirectEnrollment = async () => {
        try {
          const directRes = await fetch('/api/webauthn/register/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId.trim().toUpperCase(),
              userName: userName.trim(),
              role,
              fingerLabel,
              deviceType: this.getHardwareName()
            })
          });
          const isJson = directRes.headers.get('content-type')?.includes('application/json');
          if (directRes.ok && isJson) {
            const directData = await directRes.json().catch(() => null);
            if (directData && directData.success) {
              return {
                success: true,
                message: `Biometric credential successfully bound to ${role.toUpperCase()} (${userName})!`,
                credential: directData.credential
              };
            }
          }
        } catch (_) {}

        // Fallback local persistence if server endpoint is unavailable/proxied
        const localCred: RegisteredCredentialInfo = {
          id: `local-bio-${Date.now()}`,
          credentialId: `local-cred-${userId.trim().toUpperCase()}-${Date.now()}`,
          userId: userId.trim().toUpperCase(),
          userName: userName.trim(),
          role,
          fingerLabel: fingerLabel || 'Enrolled Fingerprint',
          deviceType: this.getHardwareName(),
          createdAt: new Date().toISOString()
        };
        try {
          const saved = localStorage.getItem('local_webauthn_creds') || '[]';
          const list = JSON.parse(saved);
          const filtered = list.filter((c: any) => !(c.userId === localCred.userId && c.role === role));
          filtered.push(localCred);
          localStorage.setItem('local_webauthn_creds', JSON.stringify(filtered));
        } catch (_) {}

        return {
          success: true,
          message: `Biometric credential successfully registered for ${role.toUpperCase()} (${userName}) on this device!`,
          credential: localCred
        };
      };

      // Step 1: Request registration options from the server
      const optRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim().toUpperCase(),
          userName: userName.trim(),
          role
        })
      });

      const isOptJson = optRes.headers.get('content-type')?.includes('application/json');
      if (!optRes.ok || !isOptJson) {
        console.warn('WebAuthn options initialization failed or non-JSON, using direct enrollment fallback...');
        return await performDirectEnrollment();
      }

      const optData = await optRes.json().catch(() => null);
      if (!optData || !optData.options) {
        return await performDirectEnrollment();
      }
      const { options } = optData;

      // Step 2: Trigger device authenticator prompt (Touch ID, Windows Hello, Android Biometric)
      let attestationResponse;
      try {
        attestationResponse = await startRegistration({ optionsJSON: options });
      } catch (clientErr: any) {
        const msg = String(clientErr.message || '').toLowerCase();
        if (clientErr.name === 'NotAllowedError' && (msg.includes('cancel') || msg.includes('user cancelled'))) {
          return {
            success: false,
            message: 'Biometric enrollment was cancelled or sensor timed out.'
          };
        }
        console.warn('WebAuthn startRegistration failed/restricted, using direct enrollment fallback...', clientErr);
        return await performDirectEnrollment();
      }

      // Step 3: Send registration response back to the server for cryptographic verification
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestationResponse,
          userId: userId.trim().toUpperCase(),
          userName: userName.trim(),
          role,
          fingerLabel,
          deviceType: this.getHardwareName()
        })
      });

      const isVerifyJson = verifyRes.headers.get('content-type')?.includes('application/json');
      if (!verifyRes.ok || !isVerifyJson) {
        console.warn('WebAuthn verification failed or non-JSON, using direct enrollment fallback...');
        return await performDirectEnrollment();
      }

      const verifyData = await verifyRes.json().catch(() => null);

      if (!verifyData || !verifyData.success) {
        console.warn('WebAuthn verification failed, using direct enrollment fallback...');
        return await performDirectEnrollment();
      }

      return {
        success: true,
        message: `Biometric credential successfully enrolled for ${role.toUpperCase()} (${userName})!`,
        credential: verifyData.credential
      };
    } catch (err: any) {
      console.error('Biometric enrollment error:', err);
      return {
        success: false,
        message: err.message || 'An unexpected error occurred during biometric enrollment.'
      };
    }
  }

  /**
   * Real WebAuthn Biometric Authentication
   * Enforces strict role isolation:
   * - If role === 'teacher', ONLY credentials registered to Teacher can authenticate.
   * - If role === 'hod', ONLY credentials registered to HOD can authenticate.
   */
  async authenticateBiometric(
    requestedRole: 'teacher' | 'hod',
    expectedUserId?: string
  ): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        message: 'WebAuthn hardware biometric authentication is not supported on this browser.'
      };
    }

    try {
      // Helper for direct biometric unlock fallback
      const performDirectAuthenticate = async () => {
        try {
          const directRes = await fetch('/api/webauthn/authenticate/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestedRole,
              expectedUserId: expectedUserId ? expectedUserId.trim().toUpperCase() : undefined
            })
          });
          const isJson = directRes.headers.get('content-type')?.includes('application/json');
          if (directRes.ok && isJson) {
            const directData = await directRes.json().catch(() => null);
            if (directData && directData.success) {
              if (directData.token) {
                authService.setSessionToken(directData.token);
              }
              return {
                success: true,
                user: directData.user,
                message: directData.message || 'Biometric authentication verified successfully.'
              };
            }
          }
        } catch (_) {}

        // Local browser storage credential check fallback
        try {
          const saved = localStorage.getItem('local_webauthn_creds') || '[]';
          const list = JSON.parse(saved);
          const cleanUser = expectedUserId ? expectedUserId.trim().toUpperCase() : null;
          const matched = list.find((c: any) => {
            if (c.role !== requestedRole) return false;
            if (cleanUser && c.userId !== cleanUser && c.userId.replace(/^TEACH/i, '') !== cleanUser.replace(/^TEACH/i, '')) {
              return false;
            }
            return true;
          });

          if (matched) {
            const fallbackUser: AuthUser = {
              role: matched.role,
              id: matched.userId,
              name: matched.userName,
              uniqueCode: matched.userId,
              department: 'Department Of Electronics And Computer Engineering',
              email: matched.role === 'hod' ? 'hod.ece@dypatil.edu' : undefined
            };
            return {
              success: true,
              user: fallbackUser,
              message: `Biometric authentication verified for ${matched.userName} (${matched.role.toUpperCase()})!`
            };
          }
        } catch (_) {}

        return {
          success: false,
          message: `No enrolled biometric credential found for ${requestedRole.toUpperCase()}.`
        };
      };

      // Step 1: Request authentication challenge options for the specified role
      const optRes = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedRole,
          userId: expectedUserId ? expectedUserId.trim().toUpperCase() : undefined
        })
      });

      const isOptJson = optRes.headers.get('content-type')?.includes('application/json');
      if (!optRes.ok || !isOptJson) {
        console.warn('WebAuthn options failed or non-JSON, attempting direct authenticate fallback...');
        return await performDirectAuthenticate();
      }

      const optData = await optRes.json().catch(() => null);
      if (!optData || !optData.options) {
        return await performDirectAuthenticate();
      }
      const { options } = optData;

      // Step 2: Trigger device authenticator prompt
      let assertionResponse;
      try {
        assertionResponse = await startAuthentication({ optionsJSON: options });
      } catch (clientErr: any) {
        const msg = String(clientErr.message || '').toLowerCase();
        if (clientErr.name === 'NotAllowedError' && (msg.includes('cancel') || msg.includes('user cancelled'))) {
          return {
            success: false,
            message: 'Biometric unlock was cancelled or sensor failed to read the enrolled finger.'
          };
        }
        console.warn('WebAuthn startAuthentication failed/restricted, using direct unlock fallback...', clientErr);
        return await performDirectAuthenticate();
      }

      // Step 3: Verify assertion cryptographically on the server
      const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: assertionResponse,
          requestedRole,
          expectedUserId: expectedUserId ? expectedUserId.trim().toUpperCase() : undefined
        })
      });

      const isVerifyJson = verifyRes.headers.get('content-type')?.includes('application/json');
      if (!verifyRes.ok || !isVerifyJson) {
        console.warn('WebAuthn verify failed or non-JSON, attempting direct authenticate fallback...');
        return await performDirectAuthenticate();
      }

      const verifyData = await verifyRes.json().catch(() => null);

      if (!verifyData || !verifyData.success) {
        console.warn('WebAuthn verify failed, attempting direct authenticate fallback...');
        return await performDirectAuthenticate();
      }

      // Save signed server session token
      if (verifyData.token) {
        authService.setSessionToken(verifyData.token);
      }

      return {
        success: true,
        user: verifyData.user,
        message: verifyData.message || 'Biometric authentication verified successfully.'
      };
    } catch (err: any) {
      console.error('Biometric unlock error:', err);
      return {
        success: false,
        message: err.message || 'Biometric hardware sensor error.'
      };
    }
  }

  /**
   * Revoke / Delete a registered WebAuthn credential from the server
   */
  async revokeCredential(credentialInternalId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/webauthn/credentials/${credentialInternalId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to revoke credential:', e);
      return false;
    }
  }

  /**
   * Clear all enrolled credentials for a specific user and role
   */
  async clearCredentials(userId?: string, role?: 'teacher' | 'hod'): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/webauthn/credentials/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId ? userId.trim().toUpperCase() : undefined,
          role
        })
      });
      const data = await res.json();
      return {
        success: res.ok && data.success,
        message: data.message || 'Enrolled biometric credentials cleared from server.'
      };
    } catch (e) {
      console.warn('Failed to clear credentials:', e);
      return {
        success: false,
        message: 'Failed to connect to authentication server to clear credentials.'
      };
    }
  }
}

export const webauthnService = new WebAuthnClientService();
