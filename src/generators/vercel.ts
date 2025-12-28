import * as fs from 'fs-extra';
import * as path from 'path';

export interface VercelCronJob {
  path: string;
  schedule: string;
}

export async function generateVercelConfig(projectPath: string, cronJobs: VercelCronJob[] = []) {
  const vercelConfig: any = {
    '$schema': 'https://openapi.vercel.sh/vercel.json',
  };

  if (cronJobs.length > 0) {
    vercelConfig.crons = cronJobs;
  }

  await fs.outputFile(
    path.join(projectPath, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 4)
  );
}

export async function generateVercelCronRoutes(projectPath: string, ext: string, framework: 'express' | 'hono') {
  const cronRoutesContent = framework === 'express' 
    ? `import express from 'express';
// Import these when you add cron jobs:
// import { authenticateCron } from '../middleware/cronAuth.js';
// import { executeCronJob } from '../middleware/cronExecution.js';

const router = express.Router();

// =====CRON ENDPOINTS =====
// These endpoints are designed to be called by Vercel cron jobs
// They require authentication via CRON_SECRET in Authorization header

/**
 * Example Cron: Daily Task
 * Schedule: 0 3 * * * (3:00 AM daily)
 * Add to vercel.json: { "path": "/cron/daily-task", "schedule": "0 3 * * *" }
 */
// router.get('/daily-task', 
//     authenticateCron, 
//     executeCronJob(exampleCron, 'daily-task')
// );

export default router;
`
    : `import { Hono } from 'hono';
// Import these when you add cron jobs:
// import { authenticateCron } from '../middleware/cronAuth.js';
// import { executeCronJob } from '../middleware/cronExecution.js';

const cronRoutes = new Hono();

// =====CRON ENDPOINTS =====
// These endpoints are designed to be called by Vercel cron jobs
// They require authentication via CRON_SECRET in Authorization header

/**
 * Example Cron: Daily Task
 * Schedule: 0 3 * * * (3:00 AM daily)
 * Add to vercel.json: { "path": "/cron/daily-task", "schedule": "0 3 * * *" }
 */
// cronRoutes.get('/daily-task', authenticateCron, executeCronJob(exampleCron, 'daily-task'));

export default cronRoutes;
`;

  await fs.outputFile(path.join(projectPath, `src/routes/cron.routes.${ext}`), cronRoutesContent);
}

export async function generateCronMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  // Cron Auth Middleware
  const cronAuthContent = isTS
    ? `/**
 * Middleware to authenticate Vercel cron requests
 * Vercel cron jobs should include the CRON_SECRET in the Authorization header
 */

export const authenticateCron = (req: any, _res: any, next: any) => {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return _res.status(500).json({
      success: false,
      error: 'CRON_SECRET not configured'
    });
  }
  
  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.replace('Bearer ', '');
  
  if (!providedSecret || providedSecret !== cronSecret) {
    return _res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid cron secret'
    });
  }
  
  next();
};
`
    : `/**
 * Middleware to authenticate Vercel cron requests
 * Vercel cron jobs should include the CRON_SECRET in the Authorization header
 */

export const authenticateCron = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return res.status(500).json({
      success: false,
      error: 'CRON_SECRET not configured'
    });
  }
  
  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.replace('Bearer ', '');
  
  if (!providedSecret || providedSecret !== cronSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid cron secret'
    });
  }
  
  next();
};
`;

  // Cron Execution Middleware
  const cronExecutionContent = isTS
    ? `/**
 * Middleware to handle common cron execution logic
 * This reduces duplication across different cron endpoints
 */

import cronService from '../services/cronService.js';

export const executeCronJob = (jobFunction: Function, cronName: string) => {
  return async (_req: any, res: any) => {
    try {
      // Check if cron should run based on date range and active status
      const { shouldRun, reason, config } = await cronService.shouldCronRun(cronName);

      if (!shouldRun) {
        await cronService.logCronExecution(cronName, 'SKIPPED', reason);
        return res.json({
          success: true,
          message: \`Skipped: \${reason}\`,
          status: 'SKIPPED'
        });
      }

      // Check if cron is already running or paused
      const status = await cronService.checkCronStatus(cronName);

      if (status === 1) {
        const message = 'Cron already running';
        await cronService.logCronExecution(cronName, 'SKIPPED', message);
        return res.json({
          success: true,
          message: \`Skipped: \${message}\`,
          status: 'SKIPPED'
        });
      }

      if (status === 9) {
        const message = 'Cron is paused';
        await cronService.logCronExecution(cronName, 'SKIPPED', message);
        return res.json({
          success: true,
          message: \`Skipped: \${message}\`,
          status: 'SKIPPED'
        });
      }

      // Set status to running
      await cronService.updateCronStatus(cronName, 1);
      await cronService.logCronExecution(
        cronName,
        'STARTED',
        \`Vercel cron execution started. Config: \${JSON.stringify(config.config_data)}\`
      );

      // Execute the job with config data
      await jobFunction(config.config_data);

      // Set status back to idle
      await cronService.updateCronStatus(cronName, 0);
      await cronService.logCronExecution(
        cronName,
        'COMPLETED',
        'Vercel cron execution completed successfully'
      );

      res.json({
        success: true,
        message: \`\${cronName} cron executed successfully\`,
        status: 'COMPLETED'
      });

    } catch (error: any) {
      console.error(\`Error in Vercel cron \${cronName}:\`, error);
      await cronService.updateCronStatus(cronName, 0);
      await cronService.logCronExecution(
        cronName,
        'ERROR',
        \`Vercel cron execution failed: \${error.message}\`
      );
      
      res.status(500).json({
        success: false,
        error: error.message,
        status: 'ERROR'
      });
    }
  };
};
`
    : `/**
 * Middleware to handle common cron execution logic
 * This reduces duplication across different cron endpoints
 */

import cronService from '../services/cronService.js';

export const executeCronJob = (jobFunction, cronName) => {
  return async (req, res) => {
    try {
      // Check if cron should run based on date range and active status
      const { shouldRun, reason, config } = await cronService.shouldCronRun(cronName);

      if (!shouldRun) {
        await cronService.logCronExecution(cronName, 'SKIPPED', reason);
        return res.json({
          success: true,
          message: \`Skipped: \${reason}\`,
          status: 'SKIPPED'
        });
      }

      // Check if cron is already running or paused
      const status = await cronService.checkCronStatus(cronName);

      if (status === 1) {
        const message = 'Cron already running';
        await cronService.logCronExecution(cronName, 'SKIPPED', message);
        return res.json({
          success: true,
          message: \`Skipped: \${message}\`,
          status: 'SKIPPED'
        });
      }

      if (status === 9) {
        const message = 'Cron is paused';
        await cronService.logCronExecution(cronName, 'SKIPPED', message);
        return res.json({
          success: true,
          message: \`Skipped: \${message}\`,
          status: 'SKIPPED'
        });
      }

      // Set status to running
      await cronService.updateCronStatus(cronName, 1);
      await cronService.logCronExecution(
        cronName,
        'STARTED',
        \`Vercel cron execution started. Config: \${JSON.stringify(config.config_data)}\`
      );

      // Execute the job with config data
      await jobFunction(config.config_data);

      // Set status back to idle
      await cronService.updateCronStatus(cronName, 0);
      await cronService.logCronExecution(
        cronName,
        'COMPLETED',
        'Vercel cron execution completed successfully'
      );

      res.json({
        success: true,
        message: \`\${cronName} cron executed successfully\`,
        status: 'COMPLETED'
      });

    } catch (error) {
      console.error(\`Error in Vercel cron \${cronName}:\`, error);
      await cronService.updateCronStatus(cronName, 0);
      await cronService.logCronExecution(
        cronName,
        'ERROR',
        \`Vercel cron execution failed: \${error.message}\`
      );
      
      res.status(500).json({
        success: false,
        error: error.message,
        status: 'ERROR'
      });
    }
  };
};
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/cronAuth.${ext}`), cronAuthContent);
  await fs.outputFile(path.join(projectPath, `src/middleware/cronExecution.${ext}`), cronExecutionContent);
}

export async function generateCronService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const cronServiceContent = isTS
    ? `import { supabase } from '../helpers/supabase.helper.js';

class CronService {
  /**
   * Check the current status of a cron job
   * @param cronName - Name of the cron job
   * @returns Status: 0 (idle), 1 (running), 9 (paused)
   */
  async checkCronStatus(cronName: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('cron_status')
        .select('status')
        .eq('cron_name', cronName)
        .single();

      if (error && error.code === 'PGRST116') {
        await this.createCronStatus(cronName, 0);
        return 0;
      }

      if (error) throw error;
      return data.status;
    } catch (error) {
      console.error('Error checking cron status:', error);
      return 0;
    }
  }

  /**
   * Update the status of a cron job
   */
  async updateCronStatus(cronName: string, status: number): Promise<void> {
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('cron_status')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('cron_name', cronName)
        .select();

      if (updateData && updateData.length === 0) {
        await supabase
          .from('cron_status')
          .insert({
            cron_name: cronName,
            status: status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } else if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Error updating cron status:', error);
    }
  }

  /**
   * Create a new cron status entry
   */
  async createCronStatus(cronName: string, status: number = 0): Promise<void> {
    try {
      await supabase
        .from('cron_status')
        .insert({
          cron_name: cronName,
          status: status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error: any) {
      if (error.code !== '23505') {
        console.error('Error creating cron status:', error);
        throw error;
      }
    }
  }

  /**
   * Log cron execution details
   */
  async logCronExecution(cronName: string, status: string, message: string = ''): Promise<void> {
    try {
      await supabase
        .from('cron_logs')
        .insert({
          cron_name: cronName,
          status: status,
          message: message,
          executed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging cron execution:', error);
    }
  }

  /**
   * Get cron configuration including date range and parameters
   */
  async getCronConfig(cronName: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('cron_config')
        .select('*')
        .eq('cron_name', cronName)
        .single();

      if (error && error.code === 'PGRST116') {
        return {
          cron_name: cronName,
          config_data: {},
          is_active: true
        };
      }

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting cron config:', error);
      throw error;
    }
  }

  /**
   * Check if cron should run based on date range in config_data
   */
  async shouldCronRun(cronName: string): Promise<{ shouldRun: boolean; reason: string; config: any }> {
    try {
      const config = await this.getCronConfig(cronName);
      const today = new Date().toISOString().split('T')[0];

      if (!config.is_active) {
        return { shouldRun: false, reason: 'Cron is marked as inactive', config };
      }

      const startDate = config.config_data?.start_date;
      if (startDate && today < startDate) {
        return { shouldRun: false, reason: \`Before start date \${startDate}\`, config };
      }

      const endDate = config.config_data?.end_date;
      if (endDate && today > endDate) {
        return { shouldRun: false, reason: \`After end date \${endDate}\`, config };
      }

      return { shouldRun: true, reason: 'Cron is within valid date range and active', config };
    } catch (error) {
      console.error('Error checking if cron should run:', error);
      return { shouldRun: true, reason: 'Error checking config, defaulting to allow', config: { config_data: {} } };
    }
  }
}

export default new CronService();
`
    : `import { supabase } from '../helpers/supabase.helper.js';

class CronService {
  /**
   * Check the current status of a cron job
   * @param cronName - Name of the cron job
   * @returns Status: 0 (idle), 1 (running), 9 (paused)
   */
  async checkCronStatus(cronName) {
    try {
      const { data, error } = await supabase
        .from('cron_status')
        .select('status')
        .eq('cron_name', cronName)
        .single();

      if (error && error.code === 'PGRST116') {
        await this.createCronStatus(cronName, 0);
        return 0;
      }

      if (error) throw error;
      return data.status;
    } catch (error) {
      console.error('Error checking cron status:', error);
      return 0;
    }
  }

  /**
   * Update the status of a cron job
   */
  async updateCronStatus(cronName, status) {
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('cron_status')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('cron_name', cronName)
        .select();

      if (updateData && updateData.length === 0) {
        await supabase
          .from('cron_status')
          .insert({
            cron_name: cronName,
            status: status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } else if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Error updating cron status:', error);
    }
  }

  /**
   * Create a new cron status entry
   */
  async createCronStatus(cronName, status = 0) {
    try {
      await supabase
        .from('cron_status')
        .insert({
          cron_name: cronName,
          status: status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      if (error.code !== '23505') {
        console.error('Error creating cron status:', error);
        throw error;
      }
    }
  }

  /**
   * Log cron execution details
   */
  async logCronExecution(cronName, status, message = '') {
    try {
      await supabase
        .from('cron_logs')
        .insert({
          cron_name: cronName,
          status: status,
          message: message,
          executed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging cron execution:', error);
    }
  }

  /**
   * Get cron configuration including date range and parameters
   */
  async getCronConfig(cronName) {
    try {
      const { data, error } = await supabase
        .from('cron_config')
        .select('*')
        .eq('cron_name', cronName)
        .single();

      if (error && error.code === 'PGRST116') {
        return {
          cron_name: cronName,
          config_data: {},
          is_active: true
        };
      }

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting cron config:', error);
      throw error;
    }
  }

  /**
   * Check if cron should run based on date range in config_data
   */
  async shouldCronRun(cronName) {
    try {
      const config = await this.getCronConfig(cronName);
      const today = new Date().toISOString().split('T')[0];

      if (!config.is_active) {
        return { shouldRun: false, reason: 'Cron is marked as inactive', config };
      }

      const startDate = config.config_data?.start_date;
      if (startDate && today < startDate) {
        return { shouldRun: false, reason: \`Before start date \${startDate}\`, config };
      }

      const endDate = config.config_data?.end_date;
      if (endDate && today > endDate) {
        return { shouldRun: false, reason: \`After end date \${endDate}\`, config };
      }

      return { shouldRun: true, reason: 'Cron is within valid date range and active', config };
    } catch (error) {
      console.error('Error checking if cron should run:', error);
      return { shouldRun: true, reason: 'Error checking config, defaulting to allow', config: { config_data: {} } };
    }
  }
}

export default new CronService();
`;

  await fs.outputFile(path.join(projectPath, `src/services/cronService.${ext}`), cronServiceContent);
}
