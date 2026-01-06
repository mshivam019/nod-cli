import fs from 'fs-extra';
import * as path from 'path';
import { AuthMode } from '../../types/index.js';
import { getProjectConfig } from '../../utils/config.js';

/**
 * Generate auth database schema based on project ORM configuration and authMode
 * 
 * For Supabase: No schema needed - uses built-in auth.users table
 * For other databases: Users table adapted based on authMode:
 *   - email-password: includes passwordHash, no googleId
 *   - oauth-only: no passwordHash, includes googleId
 *   - both: includes both passwordHash and googleId
 */
export async function generateAuthSchema(projectPath: string, authMode: AuthMode, ext: string) {
  const config = await getProjectConfig(projectPath);
  
  const orm = config?.orm || 'raw';
  const database = config?.database || 'pg';
  
  // For Supabase, skip schema generation entirely
  // Supabase handles users table and password hashing internally
  if (database === 'supabase') {
    // No schema generation needed - Supabase auth.users handles everything
    return;
  }
  
  if (orm === 'drizzle') {
    await generateDrizzleAuthSchema(projectPath, authMode, ext);
  } else {
    await generateSqlAuthSchema(projectPath, database, authMode);
  }
}

/**
 * Generate Drizzle ORM schema for auth tables
 * 
 * Adapts based on authMode:
 * - email-password: includes passwordHash, no googleId
 * - oauth-only: no passwordHash, includes googleId  
 * - both: includes both passwordHash and googleId
 */
async function generateDrizzleAuthSchema(projectPath: string, authMode: AuthMode, ext: string) {
  const isTS = ext === 'ts';
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';
  
  // Build fields based on authMode
  const passwordField = needsPassword ? `  passwordHash: text('password_hash'),${needsPassword && authMode === 'email-password' ? ' // bcrypt hash' : ' // bcrypt hash, null for OAuth-only users'}` : '';
  const googleIdField = needsOAuth ? `  googleId: varchar('google_id', { length: 255 }).unique(),${authMode === 'oauth-only' ? ' // Required for OAuth-only' : ' // For Google OAuth linking'}` : '';
  
  const content = isTS
    ? `import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Users table - stores user account and profile information
 * 
 * Auth Mode: ${authMode}
 * JWT tokens are stateless - no sessions table required
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
${passwordField ? passwordField + '\n' : ''}  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
${googleIdField ? googleIdField + '\n' : ''}  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`
    : `import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Users table - stores user account and profile information
 * Auth Mode: ${authMode}
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
${passwordField ? passwordField + '\n' : ''}  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
${googleIdField ? googleIdField + '\n' : ''}  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
`;

  await fs.outputFile(path.join(projectPath, `src/db/schema/auth.${ext}`), content);
}

/**
 * Generate raw SQL schema for auth tables
 * 
 * Adapts based on authMode:
 * - email-password: includes password_hash, no google_id
 * - oauth-only: no password_hash, includes google_id
 * - both: includes both
 */
async function generateSqlAuthSchema(projectPath: string, database: string, authMode: AuthMode) {
  const isMySQL = database === 'mysql';
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';
  
  // Build field lines
  const passwordField = needsPassword ? `  password_hash TEXT,${authMode === 'email-password' ? ' -- bcrypt hash' : ' -- bcrypt hash, null for OAuth-only users'}` : '';
  const googleIdField = needsOAuth ? `  google_id VARCHAR(255) UNIQUE,${authMode === 'oauth-only' ? ' -- Required for OAuth' : ' -- For Google OAuth linking'}` : '';
  const googleIdIndex = needsOAuth ? (isMySQL ? `  INDEX idx_users_google_id (google_id)` : `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`) : '';
  
  const content = isMySQL
    ? `-- Auth Schema for MySQL
-- Auth Mode: ${authMode}
-- Run this in your MySQL database

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
${passwordField ? passwordField + '\n' : ''}  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
${googleIdField ? googleIdField + '\n' : ''}  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)${needsOAuth ? ',\n' + googleIdIndex : ''}
);
`
    : `-- Auth Schema for PostgreSQL
-- Auth Mode: ${authMode}
-- Run this in your PostgreSQL database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
${passwordField ? passwordField + '\n' : ''}  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
${googleIdField ? googleIdField + '\n' : ''}  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
${googleIdIndex}

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

  // Ensure sql directory exists
  await fs.ensureDir(path.join(projectPath, 'sql'));
  await fs.outputFile(path.join(projectPath, 'sql/auth-schema.sql'), content);
}
