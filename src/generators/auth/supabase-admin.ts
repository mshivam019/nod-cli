import fs from 'fs-extra';
import * as path from 'path';

/**
 * Supabase Admin Auth Service - Create users when signups are disabled
 */
export async function generateSupabaseAdminAuthService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let adminClient: SupabaseClient | null = null;

/**
 * Get Supabase admin client (uses service role key)
 */
function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required for admin operations');
    }

    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
  role?: string;
  emailConfirm?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at?: string;
  user_metadata: Record<string, unknown>;
}

/**
 * Create a new user via Supabase Admin API
 * Use this when signups are disabled in Supabase dashboard
 */
export async function createUser(data: CreateUserData): Promise<AdminUser> {
  const client = getAdminClient();

  const { data: userData, error } = await client.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: data.emailConfirm ?? true,
    user_metadata: {
      name: data.name,
      role: data.role || 'user'
    }
  });

  if (error) {
    logger.error('Failed to create user:', error.message);
    throw new Error(\`Failed to create user: \${error.message}\`);
  }

  logger.info(\`User created: \${userData.user.email}\`);

  return {
    id: userData.user.id,
    email: userData.user.email!,
    created_at: userData.user.created_at,
    email_confirmed_at: userData.user.email_confirmed_at,
    user_metadata: userData.user.user_metadata
  };
}

/**
 * Delete a user via Supabase Admin API
 */
export async function deleteUser(userId: string): Promise<void> {
  const client = getAdminClient();

  const { error } = await client.auth.admin.deleteUser(userId);

  if (error) {
    logger.error('Failed to delete user:', error.message);
    throw new Error(\`Failed to delete user: \${error.message}\`);
  }

  logger.info(\`User deleted: \${userId}\`);
}

/**
 * List all users via Supabase Admin API
 */
export async function listUsers(page = 1, perPage = 50): Promise<AdminUser[]> {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage
  });

  if (error) {
    logger.error('Failed to list users:', error.message);
    throw new Error(\`Failed to list users: \${error.message}\`);
  }

  return data.users.map(user => ({
    id: user.id,
    email: user.email!,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata
  }));
}

/**
 * Get user by ID via Supabase Admin API
 */
export async function getUserById(userId: string): Promise<AdminUser | null> {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error) {
    if (error.message.includes('not found')) {
      return null;
    }
    logger.error('Failed to get user:', error.message);
    throw new Error(\`Failed to get user: \${error.message}\`);
  }

  return {
    id: data.user.id,
    email: data.user.email!,
    created_at: data.user.created_at,
    email_confirmed_at: data.user.email_confirmed_at,
    user_metadata: data.user.user_metadata
  };
}

export default {
  createUser,
  deleteUser,
  listUsers,
  getUserById
};
`
    : `import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let adminClient = null;

/**
 * Get Supabase admin client (uses service role key)
 */
function getAdminClient() {
  if (!adminClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required for admin operations');
    }

    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

/**
 * Create a new user via Supabase Admin API
 * Use this when signups are disabled in Supabase dashboard
 */
export async function createUser(data) {
  const client = getAdminClient();

  const { data: userData, error } = await client.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: data.emailConfirm ?? true,
    user_metadata: {
      name: data.name,
      role: data.role || 'user'
    }
  });

  if (error) {
    logger.error('Failed to create user:', error.message);
    throw new Error(\`Failed to create user: \${error.message}\`);
  }

  logger.info(\`User created: \${userData.user.email}\`);

  return {
    id: userData.user.id,
    email: userData.user.email,
    created_at: userData.user.created_at,
    email_confirmed_at: userData.user.email_confirmed_at,
    user_metadata: userData.user.user_metadata
  };
}

/**
 * Delete a user via Supabase Admin API
 */
export async function deleteUser(userId) {
  const client = getAdminClient();

  const { error } = await client.auth.admin.deleteUser(userId);

  if (error) {
    logger.error('Failed to delete user:', error.message);
    throw new Error(\`Failed to delete user: \${error.message}\`);
  }

  logger.info(\`User deleted: \${userId}\`);
}

/**
 * List all users via Supabase Admin API
 */
export async function listUsers(page = 1, perPage = 50) {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage
  });

  if (error) {
    logger.error('Failed to list users:', error.message);
    throw new Error(\`Failed to list users: \${error.message}\`);
  }

  return data.users.map(user => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata
  }));
}

/**
 * Get user by ID via Supabase Admin API
 */
export async function getUserById(userId) {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error) {
    if (error.message.includes('not found')) {
      return null;
    }
    logger.error('Failed to get user:', error.message);
    throw new Error(\`Failed to get user: \${error.message}\`);
  }

  return {
    id: data.user.id,
    email: data.user.email,
    created_at: data.user.created_at,
    email_confirmed_at: data.user.email_confirmed_at,
    user_metadata: data.user.user_metadata
  };
}

export default {
  createUser,
  deleteUser,
  listUsers,
  getUserById
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/supabase-admin.service.${ext}`), content);
}
