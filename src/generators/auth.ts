/**
 * Auth Generator Module
 * 
 * This file re-exports from the split auth modules for backward compatibility.
 * The actual implementation has been split into smaller, focused modules in ./auth/
 * 
 * Auth modes supported:
 * - 'email-password': Traditional email/password authentication only
 * - 'oauth-only': Only OAuth providers (Google), no password operations
 * - 'both': Email/password + OAuth (default)
 */

// Re-export types
export { AuthOptions } from './auth/types.js';

// Re-export main generator
export { generateAuth } from './auth/index.js';
