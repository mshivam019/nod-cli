import { CodeBlock } from '@/components/CodeBlock'

export function AuthComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Auth</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Complete authentication module with custom JWT, JWKS, password hashing, Supabase Admin, Google OAuth, email service, and forgot password flows.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add auth`} language="bash" />
        <p className="text-muted-foreground">
          You'll first be prompted to select an <strong>Authentication Mode</strong>:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
          <li><strong>Email/Password + OAuth</strong> (Default) - Traditional login + social providers</li>
          <li><strong>Email/Password only</strong> - Traditional email/password login</li>
          <li><strong>OAuth only</strong> - Social login only (Google, etc.), no passwords</li>
        </ul>
        <p className="text-muted-foreground">
          Then select features to include (based on mode):
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Supabase Admin auth</strong> - Create users when public signups are disabled</li>
          <li><strong>Custom JWT signing</strong> - Roll your own tokens with RSA keys</li>
          <li><strong>JWKS auto-generation</strong> - Automatic RSA key pair generation with public JWKS endpoint</li>
          <li><strong>Forgot password flow</strong> - JWT-based password reset (Email/Password modes only)</li>
          <li><strong>Google OAuth</strong> - Server-side token verification using Google's API directly (OAuth modes only)</li>
          <li><strong>Email service</strong> - Nodemailer integration for password reset and verification emails (Email/Password modes only)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <div className="space-y-6">
           <div>
             <h3 className="font-semibold">Core Services</h3>
             <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
               <li><code>src/auth/jwks.service.ts</code> - RSA key pair auto-generation</li>
               <li><code>src/auth/jwt.service.ts</code> - Custom JWT signing/verification</li>
               <li><code>src/auth/auth.service.ts</code> - Main auth orchestration</li>
               <li><code>src/auth/auth.controller.ts</code> - Route handlers</li>
               <li><code>src/auth/auth.routes.ts</code> - Auth routes</li>
               <li><code>src/middleware/auth.middleware.ts</code> - JWT verification middleware</li>
             </ul>
           </div>

           <div>
             <h3 className="font-semibold">Conditional Services (based on auth mode and selections)</h3>
             <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
               <li><code>src/auth/password.service.ts</code> - Password hashing with bcrypt (Email/Password modes)</li>
               <li><code>src/auth/google-oauth.service.ts</code> - Google OAuth verification (OAuth modes)</li>
               <li><code>src/auth/forgot-password.service.ts</code> - Password reset flow (Email/Password modes)</li>
               <li><code>src/auth/email.service.ts</code> - Email service with templates (Email/Password modes)</li>
               <li><code>src/auth/supabase-admin.service.ts</code> - Supabase Admin API (if selected)</li>
             </ul>
           </div>
          
          <div>
            <h3 className="font-semibold">Database Schema</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
              <li><code>src/db/schema/auth.ts</code> - Drizzle schema (if using Drizzle ORM)</li>
              <li><code>sql/auth-schema.sql</code> - Raw SQL schema (if not using ORM)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Database Schema
        </h2>
        <p className="text-muted-foreground">
          The auth generator creates database schema based on your project configuration.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Supabase projects:</strong> No schema generation needed. Supabase's built-in <code>auth.users</code> table 
            handles user management, password hashing, and session management automatically.
          </p>
        </div>
        
        <h3 className="font-semibold mt-4">Drizzle Schema (TypeScript)</h3>
        <p className="text-muted-foreground text-sm mb-2">
          Only a users table is generated. JWT tokens are stateless - no sessions table required.
        </p>
        <CodeBlock
          code={`// src/db/schema/auth.ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Users table - stores user account and profile information
// Fields are generated based on authMode:
// - password_hash: Included in Email/Password modes
// - google_id: Included in OAuth modes
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'), // bcrypt hash (Email/Password modes only)
  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  googleId: varchar('google_id', { length: 255 }).unique(), // Google ID (OAuth modes only)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;`}
          language="typescript"
        />
        
        <h3 className="font-semibold mt-4">Raw SQL Schema</h3>
        <CodeBlock
          code={`-- sql/auth-schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores user account and profile information
-- Fields are generated based on authMode:
-- - password_hash: Included in Email/Password modes
-- - google_id: Included in OAuth modes
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT, -- bcrypt hash (Email/Password modes only)
  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  google_id VARCHAR(255) UNIQUE, -- Google ID (OAuth modes only)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);`}
          language="sql"
        />
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            <strong>After generation:</strong> If using Drizzle, run <code>npm run db:generate && npm run db:push</code> to create tables. 
            For raw SQL, execute the schema file against your database.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          JWKS Auto-Generation
        </h2>
        <p className="text-muted-foreground">
          On first run, the service automatically generates an RSA-2048 key pair and stores it in <code>.keys/</code>. 
          The public key is exposed via a JWKS endpoint for other services to verify your tokens.
        </p>
        <CodeBlock
          tsCode={`import { initializeJWKS } from './auth/jwks.service.js';

// Initialize JWKS before starting server
await initializeJWKS();

// Keys are stored in:
// .keys/private.pem - Private key (chmod 600)
// .keys/public.pem  - Public key

// JWKS endpoint: GET /api/auth/.well-known/jwks.json`}
          jsCode={`import { initializeJWKS } from './auth/jwks.service.js';

// Initialize JWKS before starting server
await initializeJWKS();

// Keys are stored in:
// .keys/private.pem - Private key (chmod 600)
// .keys/public.pem  - Public key

// JWKS endpoint: GET /api/auth/.well-known/jwks.json`}
        />
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            <strong>Important:</strong> The <code>.keys/</code> directory is automatically added to <code>.gitignore</code>. 
            Never commit your private keys. In production, consider using environment variables or a secrets manager.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Custom JWT Service
        </h2>
        <p className="text-muted-foreground">
          Sign and verify JWTs using your own RSA keys. Supports access tokens, refresh tokens, and reset tokens.
        </p>
        <CodeBlock
          tsCode={`import {
  generateTokenPair,
  verifyAccessToken,
  signResetToken
} from './auth/jwt.service.js';

// Generate access + refresh token pair
const tokens = await generateTokenPair({
  sub: user.id,
  email: user.email,
  name: user.name,
  role: 'user'
});
// Returns: { accessToken, refreshToken, expiresIn }

// Verify an access token
const payload = await verifyAccessToken(token);
// Returns: { sub, email, name, role, type: 'access', ... }

// Sign a password reset token (1h expiry)
const resetToken = await signResetToken(userId, email);`}
          jsCode={`import {
  generateTokenPair,
  verifyAccessToken,
  signResetToken
} from './auth/jwt.service.js';

// Generate access + refresh token pair
const tokens = await generateTokenPair({
  sub: user.id,
  email: user.email,
  name: user.name,
  role: 'user'
});
// Returns: { accessToken, refreshToken, expiresIn }

// Verify an access token
const payload = await verifyAccessToken(token);
// Returns: { sub, email, name, role, type: 'access', ... }

// Sign a password reset token (1h expiry)
const resetToken = await signResetToken(userId, email);`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Password Service
        </h2>
        <p className="text-muted-foreground">
          Secure password hashing with bcrypt. Includes password strength validation to enforce security requirements.
        </p>
        <CodeBlock
          tsCode={`import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength
} from './auth/password.service.js';

// Validate password meets requirements
const validation = validatePasswordStrength('MyP@ssw0rd!');
if (!validation.valid) {
  console.log(validation.errors);
  // ['Password must be at least 8 characters']
}

// Hash password before storing
const hash = await hashPassword('MyP@ssw0rd!');
// Returns: $2b$10$...

// Verify password during login
const isValid = await verifyPassword('MyP@ssw0rd!', hash);
// Returns: true/false`}
          jsCode={`import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength
} from './auth/password.service.js';

// Validate password meets requirements
const validation = validatePasswordStrength('MyP@ssw0rd!');
if (!validation.valid) {
  console.log(validation.errors);
  // ['Password must be at least 8 characters']
}

// Hash password before storing
const hash = await hashPassword('MyP@ssw0rd!');
// Returns: $2b$10$...

// Verify password during login
const isValid = await verifyPassword('MyP@ssw0rd!', hash);
// Returns: true/false`}
        />
        <h3 className="font-semibold mt-4">Password Requirements</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Minimum 8 characters</li>
          <li>At least one uppercase letter</li>
          <li>At least one lowercase letter</li>
          <li>At least one number</li>
          <li>At least one special character (@$!%*?&)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Supabase Admin Auth
        </h2>
        <p className="text-muted-foreground">
          Create users programmatically using Supabase's Admin API. This works even when public signups are disabled in the Supabase dashboard.
        </p>
        <CodeBlock
          tsCode={`import { createUser, getUserByEmail } from './auth/supabase-admin.service.js';

// Create a user (bypasses disabled signups)
const { user, error } = await createUser({
  email: 'user@example.com',
  password: 'securepassword',
  emailConfirm: true, // Auto-confirm email
  userData: {
    name: 'John Doe'
  },
  appMetadata: {
    role: 'admin'
  }
});

// Get user by email
const { user } = await getUserByEmail('user@example.com');`}
          jsCode={`import { createUser, getUserByEmail } from './auth/supabase-admin.service.js';

// Create a user (bypasses disabled signups)
const { user, error } = await createUser({
  email: 'user@example.com',
  password: 'securepassword',
  emailConfirm: true, // Auto-confirm email
  userData: {
    name: 'John Doe'
  },
  appMetadata: {
    role: 'admin'
  }
});

// Get user by email
const { user } = await getUserByEmail('user@example.com');`}
        />
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Requires:</strong> <code>SUPABASE_SERVICE_ROLE_KEY</code> environment variable. 
            This is different from the anon key - find it in your Supabase dashboard under Settings → API.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Email Service
        </h2>
        <p className="text-muted-foreground">
          Nodemailer integration for transactional emails. Includes pre-built templates for password reset, verification, and welcome emails.
        </p>
        <CodeBlock
          tsCode={`import {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail
} from './auth/email.service.js';

// Send password reset email
await sendPasswordResetEmail(
  'user@example.com',
  'John Doe',
  'https://yourapp.com/reset?token=xxx'
);

// Send email verification
await sendVerificationEmail(
  'user@example.com',
  'John Doe',
  'https://yourapp.com/verify?token=xxx'
);

// Send welcome email
await sendWelcomeEmail('user@example.com', 'John Doe');

// Send custom email
await sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  text: 'Plain text content',
  html: '<h1>HTML content</h1>'
});`}
          jsCode={`import {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail
} from './auth/email.service.js';

// Send password reset email
await sendPasswordResetEmail(
  'user@example.com',
  'John Doe',
  'https://yourapp.com/reset?token=xxx'
);

// Send email verification
await sendVerificationEmail(
  'user@example.com',
  'John Doe',
  'https://yourapp.com/verify?token=xxx'
);

// Send welcome email
await sendWelcomeEmail('user@example.com', 'John Doe');

// Send custom email
await sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  text: 'Plain text content',
  html: '<h1>HTML content</h1>'
});`}
        />
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Requires SMTP configuration:</strong> Set up environment variables for your email provider (see Environment Variables section).
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Google OAuth (Server-Side)
        </h2>
        <p className="text-muted-foreground">
          Verify Google ID tokens server-side using Google's official tokeninfo endpoint. No third-party OAuth libraries required.
        </p>
        
        <h3 className="font-semibold mt-4">Google Cloud Setup</h3>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Go to <a href="https://console.cloud.google.com/apis/credentials" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">Google Cloud Console → Credentials</a></li>
          <li>Create OAuth 2.0 Client ID (Web application type)</li>
          <li>Add authorized JavaScript origins (your frontend URL)</li>
          <li>Add authorized redirect URIs (your callback URL)</li>
          <li>Copy Client ID and Client Secret to your environment</li>
        </ol>

        <h3 className="font-semibold mt-4">Frontend: Get ID Token</h3>
        <CodeBlock
          code={`// Using Google Sign-In for Web
google.accounts.id.initialize({
  client_id: 'YOUR_CLIENT_ID',
  callback: async (response) => {
    // Send ID token to your backend
    const result = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential })
    });
  }
});`}
          language="javascript"
        />

        <h3 className="font-semibold mt-4">Backend: Verify Token</h3>
        <CodeBlock
          tsCode={`import { verifyGoogleIdToken } from './auth/google-oauth.service.js';

// Verify the ID token server-side
const result = await verifyGoogleIdToken(idToken);

if (result.success) {
  const { user } = result;
  // user = { id, email, emailVerified, name, picture, ... }

  // Create or get existing user, then issue your JWT
  const tokens = await generateTokenPair({
    sub: user.id,
    email: user.email,
    name: user.name
  });
}`}
          jsCode={`import { verifyGoogleIdToken } from './auth/google-oauth.service.js';

// Verify the ID token server-side
const result = await verifyGoogleIdToken(idToken);

if (result.success) {
  const { user } = result;
  // user = { id, email, emailVerified, name, picture, ... }

  // Create or get existing user, then issue your JWT
  const tokens = await generateTokenPair({
    sub: user.id,
    email: user.email,
    name: user.name
  });
}`}
        />

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            <strong>Note:</strong> Currently only ID token verification is implemented. Authorization code flow
            and callback handling are not yet generated by the CLI.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Forgot Password Flow
        </h2>
        <p className="text-muted-foreground">
          JWT-based password reset flow. Issue a short-lived reset token, send it via email, then verify and update the password.
        </p>
        <CodeBlock
          tsCode={`import {
  initiateForgotPassword,
  resetPassword,
  validateResetToken
} from './auth/forgot-password.service.js';

// 1. User requests password reset
const result = await initiateForgotPassword('user@example.com');
if (result.success && result.resetToken) {
  // Send email with reset link containing the token
  // e.g., https://yourapp.com/reset-password?token=xxx
  await sendResetEmail(email, result.resetToken);
}

// 2. Validate token (optional - for UI feedback)
const { valid, email } = await validateResetToken(token);

// 3. Reset password with token
const resetResult = await resetPassword(token, newPassword);
// Returns: { success, message }`}
          jsCode={`import {
  initiateForgotPassword,
  resetPassword,
  validateResetToken
} from './auth/forgot-password.service.js';

// 1. User requests password reset
const result = await initiateForgotPassword('user@example.com');
if (result.success && result.resetToken) {
  // Send email with reset link containing the token
  // e.g., https://yourapp.com/reset-password?token=xxx
  await sendResetEmail(email, result.resetToken);
}

// 2. Validate token (optional - for UI feedback)
const { valid, email } = await validateResetToken(token);

// 3. Reset password with token
const resetResult = await resetPassword(token, newPassword);
// Returns: { success, message }`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          API Routes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Method</th>
                <th className="text-left py-2 px-4">Endpoint</th>
                <th className="text-left py-2 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {/* Common Routes */}
              <tr className="bg-muted/50">
                <td colSpan={3} className="py-2 px-4 font-semibold text-foreground">Common Routes (All Modes)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/refresh</code></td>
                <td className="py-2 px-4">Refresh access token</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>GET</code></td>
                <td className="py-2 px-4"><code>/.well-known/jwks.json</code></td>
                <td className="py-2 px-4">Public JWKS endpoint</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>GET</code></td>
                <td className="py-2 px-4"><code>/me</code></td>
                <td className="py-2 px-4">Get current user (protected)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/logout</code></td>
                <td className="py-2 px-4">Logout user (protected)</td>
              </tr>

              {/* Email/Password Routes */}
              <tr className="bg-muted/50">
                <td colSpan={3} className="py-2 px-4 font-semibold text-foreground">Email/Password Routes (Email/Password & Both Modes)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/register</code></td>
                <td className="py-2 px-4">Register new user</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/login</code></td>
                <td className="py-2 px-4">Login with email/password</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>PUT</code></td>
                <td className="py-2 px-4"><code>/change-password</code></td>
                <td className="py-2 px-4">Change password (protected)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/forgot-password</code></td>
                <td className="py-2 px-4">Request password reset</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/reset-password</code></td>
                <td className="py-2 px-4">Reset password with token</td>
              </tr>

              {/* OAuth Routes */}
              <tr className="bg-muted/50">
                <td colSpan={3} className="py-2 px-4 font-semibold text-foreground">OAuth Routes (OAuth-Only & Both Modes)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>POST</code></td>
                <td className="py-2 px-4"><code>/google</code></td>
                <td className="py-2 px-4">Google OAuth with ID token</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`# JWT Settings
JWT_ISSUER=your-api
JWT_AUDIENCE=your-api

# Supabase (for admin auth)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Platform-specific Google client IDs
GOOGLE_CLIENT_ID_WEB=
GOOGLE_CLIENT_ID_IOS=
GOOGLE_CLIENT_ID_ANDROID=

# Email Service (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="Your App <noreply@yourapp.com>"
APP_URL=https://yourapp.com`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage Example
        </h2>
        <CodeBlock
          code={`// app.ts
import express from 'express';
import authRoutes from './auth/auth.routes.js';
import { initializeJWKS } from './auth/jwks.service.js';

const app = express();
app.use(express.json());

// Initialize JWKS (generates keys on first run)
await initializeJWKS();

// Mount auth routes
app.use('/api/auth', authRoutes);

// Protected route example
import authMiddleware from './middleware/auth.middleware.js';

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.listen(3000);`}
          language="typescript"
        />
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Note:</strong> Imported services and routes are generated based on your selected auth mode and features.
            The example shows a full setup - your actual imports may vary depending on configuration.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Security Considerations
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Private Keys:</strong> Never commit <code>.keys/</code> to git. Use environment variables or secrets managers in production.</li>
          <li><strong>Token Expiry:</strong> Access tokens expire in 15 minutes, refresh tokens in 7 days, reset tokens in 1 hour.</li>
          <li><strong>Service Role Key:</strong> The Supabase service role key bypasses Row Level Security. Keep it secret.</li>
          <li><strong>Google Client Secret:</strong> Never expose in frontend code. Use only server-side.</li>
          <li><strong>Password Hashing:</strong> When not using Supabase, implement proper password hashing (bcrypt/argon2).</li>
        </ul>
      </section>
    </div>
  )
}
