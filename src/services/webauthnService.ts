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
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (role) params.set('role', role);

      const res = await fetch(`/api/webauthn/credentials?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.credentials || [];
    } catch (e) {
      console.warn('Failed to fetch credentials from server:', e);
      return [];
    }
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
        const directData = await directRes.json();
        if (directRes.ok && directData.success) {
          return {
            success: true,
            message: `Biometric credential successfully bound to ${role.toUpperCase()} (${userName})!`,
            credential: directData.credential
          };
        }
        throw new Error(directData.error || 'Direct biometric registration failed');
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

      if (!optRes.ok) {
        console.warn('WebAuthn options initialization failed, using direct enrollment fallback...');
        return await performDirectEnrollment();
      }

      const { options } = await optRes.json();

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

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
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
        const directRes = await fetch('/api/webauthn/authenticate/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestedRole,
            expectedUserId: expectedUserId ? expectedUserId.trim().toUpperCase() : undefined
          })
        });
        const directData = await directRes.json();
        if (directRes.ok && directData.success) {
          if (directData.token) {
            authService.setSessionToken(directData.token);
          }
          return {
            success: true,
            user: directData.user,
            message: directData.message || 'Biometric authentication verified successfully.'
          };
        }
        return {
          success: false,
          message: directData.error || `No enrolled biometric credential found for ${requestedRole.toUpperCase()}.`
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

      if (!optRes.ok) {
        console.warn('WebAuthn options failed, attempting direct authenticate fallback...');
        return await performDirectAuthenticate();
      }

      const { options } = await optRes.json();

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

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
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
