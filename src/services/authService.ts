import { AuthUser } from '../types';

const STORAGE_KEY_TOKEN = 'dypatil_session_token_v2';

class AuthService {
  private sessionToken: string | null = null;

  constructor() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        this.sessionToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
      }
    } catch (_) {}
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
    try {
      sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    } catch (_) {}
  }

  getSessionToken(): string | null {
    if (!this.sessionToken && typeof sessionStorage !== 'undefined') {
      this.sessionToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
    }
    return this.sessionToken;
  }

  clearSession() {
    this.sessionToken = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem('dypatil_auth_user_v1');
    } catch (_) {}
  }

  async validateCurrentSession(): Promise<{ valid: boolean; user?: AuthUser }> {
    const token = this.getSessionToken();
    if (!token) return { valid: false };

    try {
      const res = await fetch('/api/auth/session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        this.clearSession();
        return { valid: false };
      }
      const data = await res.json();
      return { valid: true, user: data.user };
    } catch {
      return { valid: false };
    }
  }

  async verifyHodAuthorization(): Promise<boolean> {
    const token = this.getSessionToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/hod/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();
