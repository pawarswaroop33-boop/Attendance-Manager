// WebAuthn / FIDO2 Biometric Authentication Service
// Cryptographically verified, hardware-enclave bound passkey authentication

import { webauthnService, RegisteredCredentialInfo } from './webauthnService';

export interface BiometricCredential {
  credentialId: string;
  userId: string;
  userName: string;
  role: 'teacher' | 'hod';
  fingerLabel: string;
  registeredAt: string;
  deviceType: string;
}

export interface BiometricVerifyResult {
  success: boolean;
  enrolled: boolean;
  credential?: BiometricCredential;
  message: string;
}

class BiometricService {
  isWebAuthnSupported(): boolean {
    return webauthnService.isWebAuthnSupported();
  }

  async isHardwareBiometricsAvailable(): Promise<boolean> {
    return await webauthnService.isPlatformAuthenticatorAvailable();
  }

  getBiometricHardwareName(): string {
    return webauthnService.getHardwareName();
  }

  async getRegisteredCredentials(role?: 'teacher' | 'hod'): Promise<RegisteredCredentialInfo[]> {
    return await webauthnService.getCredentials(undefined, role);
  }

  async isUserEnrolled(userId: string, role?: 'teacher' | 'hod'): Promise<boolean> {
    const list = await webauthnService.getCredentials(userId, role);
    return list.length > 0;
  }
}

export const biometricService = new BiometricService();
