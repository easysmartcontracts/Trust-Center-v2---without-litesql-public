import crypto from 'crypto';

let resolvedSecret = process.env.JWT_SECRET;

export function getJwtSecret(): string {
  if (resolvedSecret) {
    return resolvedSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set in production.');
  }

  // Development mode fallback
  resolvedSecret = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: JWT_SECRET not set. Using a random in-memory secret for development. Tokens will invalidate on restart.');
  
  return resolvedSecret;
}
