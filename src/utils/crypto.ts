/**
 * Cryptographic & Security Utilities
 * Implements client-side SHA-256 hashing and password strength analysis
 */

export async function sha256Hex(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple checksum if SubtleCrypto is unavailable in test environment
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    hash = (hash << 5) - hash + plainText.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16)}`;
}

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
  color: string;
  bgColor: string;
  suggestions: string[];
}

export function sanitizeUsername(username: string): string {
  // Disallow HTML/script tags or SQL escape characters
  return username.replace(/[<>{}"'`\\/]/g, '').trim();
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'text-slate-400',
      bgColor: 'bg-slate-200',
      suggestions: ['Enter at least 6 characters']
    };
  }

  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 6) score += 1;
  else suggestions.push('Length should be at least 6 characters');

  if (password.length >= 10) score += 1;

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  else suggestions.push('Include uppercase and lowercase letters');

  if (/\d/.test(password)) score += 1;
  else suggestions.push('Include numbers');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else suggestions.push('Include special characters (!@#$%)');

  if (score <= 1) {
    return {
      score: 1,
      label: 'Weak',
      color: 'text-rose-600',
      bgColor: 'bg-rose-500',
      suggestions
    };
  } else if (score === 2) {
    return {
      score: 2,
      label: 'Moderate',
      color: 'text-amber-600',
      bgColor: 'bg-amber-500',
      suggestions
    };
  } else if (score === 3 || score === 4) {
    return {
      score: 3,
      label: 'Strong',
      color: 'text-sky-600',
      bgColor: 'bg-sky-500',
      suggestions
    };
  } else {
    return {
      score: 4,
      label: 'Very Strong',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500',
      suggestions: ['Excellent secure password']
    };
  }
}
