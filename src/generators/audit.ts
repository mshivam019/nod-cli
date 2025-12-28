import * as fs from 'fs-extra';
import * as path from 'path';

export async function generateApiAudit(projectPath: string, ext: string, tableName: string = 'api_audit') {
  const isTS = ext === 'ts';
  
  // Generate audit logger utility
  const auditLoggerContent = isTS
    ? `import { supabase } from '../helpers/supabase.helper.js';

/**
 * Logs an audit event to the ${tableName} table
 */
export const logAuditEvent = async (
  eventType: string, 
  eventData: any, 
  userId: string | null = null, 
  req?: any
): Promise<{ success: boolean; error: any }> => {
  try {
    const effectiveUserId = userId || req?.user?.id || null;
    
    const stringifiedData = typeof eventData === 'object' 
      ? JSON.stringify(eventData) 
      : eventData;
    
    const { error } = await supabase
      .from('${tableName}')
      .insert({
        user_id: effectiveUserId,
        event_type: eventType,
        event_data: stringifiedData
      });
    
    if (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Exception in audit logging:', error);
    return { success: false, error };
  }
};

export const logAuditEventWithLLM = async (
  eventType: string, 
  eventData: any, 
  llmResponse: any = null,
  userId: string | null = null, 
  req?: any
): Promise<{ success: boolean; error: any }> => {
  try {
    const effectiveUserId = userId || req?.user?.id || null;
    
    const stringifiedData = typeof eventData === 'object' 
      ? JSON.stringify(eventData) 
      : eventData;
    
    const { error } = await supabase
      .from('${tableName}')
      .insert({
        user_id: effectiveUserId,
        event_type: eventType,
        event_data: stringifiedData,
        llm_response: llmResponse
      });
    
    if (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Exception in audit logging:', error);
    return { success: false, error };
  }
};

export default logAuditEvent;
`
    : `import { supabase } from '../helpers/supabase.helper.js';

/**
 * Logs an audit event to the ${tableName} table
 */
export const logAuditEvent = async (eventType, eventData, userId = null, req = null) => {
  try {
    const effectiveUserId = userId || req?.user?.id || null;
    
    const stringifiedData = typeof eventData === 'object' 
      ? JSON.stringify(eventData) 
      : eventData;
    
    const { error } = await supabase
      .from('${tableName}')
      .insert({
        user_id: effectiveUserId,
        event_type: eventType,
        event_data: stringifiedData
      });
    
    if (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Exception in audit logging:', error);
    return { success: false, error };
  }
};

export const logAuditEventWithLLM = async (eventType, eventData, llmResponse = null, userId = null, req = null) => {
  try {
    const effectiveUserId = userId || req?.user?.id || null;
    
    const stringifiedData = typeof eventData === 'object' 
      ? JSON.stringify(eventData) 
      : eventData;
    
    const { error } = await supabase
      .from('${tableName}')
      .insert({
        user_id: effectiveUserId,
        event_type: eventType,
        event_data: stringifiedData,
        llm_response: llmResponse
      });
    
    if (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Exception in audit logging:', error);
    return { success: false, error };
  }
};

export default logAuditEvent;
`;

  // Generate audit middleware
  const auditMiddlewareContent = isTS
    ? `import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Middleware to log all route access to ${tableName} table
 */
export const auditLogger = (req: any, _res: any, next: any) => {
  try {
    const userId = req.user?.id || null;
    const routePath = req.originalUrl;
    const method = req.method;
    const eventType = \`\${method}:\${routePath}\`;
    const eventData = method === 'GET' ? {} : req.body;
    
    logAuditEvent(eventType, eventData, userId, req)
      .catch(err => console.error('Error in audit logging middleware:', err));
    
    next();
  } catch (error) {
    console.error('Exception in audit logging middleware:', error);
    next();
  }
};

export default auditLogger;
`
    : `import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Middleware to log all route access to ${tableName} table
 */
export const auditLogger = (req, _res, next) => {
  try {
    const userId = req.user?.id || null;
    const routePath = req.originalUrl;
    const method = req.method;
    const eventType = \`\${method}:\${routePath}\`;
    const eventData = method === 'GET' ? {} : req.body;
    
    logAuditEvent(eventType, eventData, userId, req)
      .catch(err => console.error('Error in audit logging middleware:', err));
    
    next();
  } catch (error) {
    console.error('Exception in audit logging middleware:', error);
    next();
  }
};

export default auditLogger;
`;

  await fs.outputFile(path.join(projectPath, `src/utils/auditLogger.${ext}`), auditLoggerContent);
  await fs.outputFile(path.join(projectPath, `src/middleware/auditLog.middleware.${ext}`), auditMiddlewareContent);
}

export async function generateAuditSchema(projectPath: string, tableName: string = 'api_audit') {
  const schemaContent = `-- Audit table for API request logging
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS ${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  llm_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id ON ${tableName}(user_id);

-- Index for faster queries by event type
CREATE INDEX IF NOT EXISTS idx_${tableName}_event_type ON ${tableName}(event_type);

-- Index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON ${tableName}
  FOR INSERT WITH CHECK (true);
`;

  await fs.ensureDir(path.join(projectPath, 'sql'));
  await fs.outputFile(path.join(projectPath, `sql/${tableName}.sql`), schemaContent);
}
