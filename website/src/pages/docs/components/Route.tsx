import { CodeBlock } from '@/components/CodeBlock'

export function RouteComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Route</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Generate routes with controllers and services using a declarative pattern.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock
          code={`nod add route <name>`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Declarative Route Pattern
        </h2>
        <p>
          Routes use a declarative configuration with default middlewares and role-based access control.
          Each route can override defaults using <code>disabled</code>, <code>enabled</code>, and <code>roles</code>.
        </p>
        
        <h3 className="font-semibold mt-4">Route Configuration</h3>
        <CodeBlock
          filename="src/routes/index.ts"
          tsCode={`import { Router } from 'express';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { usersController } from '../controllers/users.js';

export const router = Router();

/**
 * Default middlewares applied to all routes in this file
 * Can be overridden per-route using disabled/enabled arrays
 */
const defaultMiddlewares: string[] = ['jwtAuth', 'auditLogger'];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles/excludeRoles arrays
 */
const defaultRoles: string[] = [];

/**
 * Route definitions with declarative middleware and role configuration
 * 
 * Each route can have:
 * - method: METHODS.GET, METHODS.POST, etc.
 * - path: Route path
 * - handler: Controller method
 * - disabled: Array of middleware names to exclude from defaults
 * - enabled: Array of additional middleware names to include
 * - roles: Override default roles (e.g., ['admin', 'superAdmin'])
 * - excludeRoles: Roles to exclude from defaults
 */
const routes = [
  // Protected route (uses all default middlewares)
  {
    method: METHODS.GET,
    path: '/users',
    handler: usersController.getUsers
  },
  
  // Public route (disable auth and audit)
  {
    method: METHODS.GET,
    path: '/users/public',
    handler: usersController.getPublic,
    disabled: ['jwtAuth', 'auditLogger']
  },
  
  // Admin only route
  {
    method: METHODS.POST,
    path: '/users/admin',
    handler: usersController.adminAction,
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({ 
  defaultMiddlewares, 
  defaultRoles, 
  routes 
});
configuredRouter.applyToExpress(router);`}
          jsCode={`import { Router } from 'express';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { usersController } from '../controllers/users.js';

export const router = Router();

/**
 * Default middlewares applied to all routes in this file
 * Can be overridden per-route using disabled/enabled arrays
 */
const defaultMiddlewares = ['jwtAuth', 'auditLogger'];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles/excludeRoles arrays
 */
const defaultRoles = [];

/**
 * Route definitions with declarative middleware and role configuration
 */
const routes = [
  // Protected route (uses all default middlewares)
  {
    method: METHODS.GET,
    path: '/users',
    handler: usersController.getUsers
  },
  
  // Public route (disable auth and audit)
  {
    method: METHODS.GET,
    path: '/users/public',
    handler: usersController.getPublic,
    disabled: ['jwtAuth', 'auditLogger']
  },
  
  // Admin only route
  {
    method: METHODS.POST,
    path: '/users/admin',
    handler: usersController.adminAction,
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({ 
  defaultMiddlewares, 
  defaultRoles, 
  routes 
});
configuredRouter.applyToExpress(router);`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Route Options
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>method</strong> - METHODS.GET, METHODS.POST, METHODS.PUT, METHODS.DELETE, METHODS.PATCH</li>
          <li><strong>path</strong> - The URL path for the route</li>
          <li><strong>handler</strong> - Controller method to handle the request</li>
          <li><strong>disabled</strong> - Array of middleware names to exclude from defaults</li>
          <li><strong>enabled</strong> - Array of additional middleware names to include</li>
          <li><strong>roles</strong> - Override default roles (e.g., ['admin', 'superAdmin'])</li>
          <li><strong>excludeRoles</strong> - Roles to exclude from defaults</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Service</h3>
        <CodeBlock
          filename="src/services/users.ts"
          tsCode={`export const usersService = {
  async getUsers() {
    // TODO: Implement service logic
    return { message: 'Service users response' };
  },

  async createUsers(data: any) {
    // TODO: Implement service logic
    return { success: true, data };
  },

  async updateUsers(id: string, data: any) {
    // TODO: Implement service logic
    return { success: true, id, data };
  },

  async deleteUsers(id: string) {
    // TODO: Implement service logic
    return { success: true, id };
  }
};`}
          jsCode={`export const usersService = {
  async getUsers() {
    // TODO: Implement service logic
    return { message: 'Service users response' };
  },

  async createUsers(data) {
    // TODO: Implement service logic
    return { success: true, data };
  },

  async updateUsers(id, data) {
    // TODO: Implement service logic
    return { success: true, id, data };
  },

  async deleteUsers(id) {
    // TODO: Implement service logic
    return { success: true, id };
  }
};`}
        />

        <h3 className="font-semibold mt-6">Controller - Express</h3>
        <CodeBlock
          filename="src/controllers/users.ts"
          tsCode={`import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/users.js';

export const usersController = {
  async getUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await usersService.getUsers();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'Public endpoint - no auth required' });
    } catch (error) {
      next(error);
    }
  },

  async adminAction(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'Admin action performed' });
    } catch (error) {
      next(error);
    }
  },
};`}
          jsCode={`import { usersService } from '../services/users.js';

export const usersController = {
  async getUsers(_req, res, next) {
    try {
      const data = await usersService.getUsers();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getPublic(_req, res, next) {
    try {
      res.json({ message: 'Public endpoint - no auth required' });
    } catch (error) {
      next(error);
    }
  },

  async adminAction(_req, res, next) {
    try {
      res.json({ message: 'Admin action performed' });
    } catch (error) {
      next(error);
    }
  },
};`}
        />

        <h3 className="font-semibold mt-6">Controller - Hono</h3>
        <CodeBlock
          filename="src/controllers/users.ts"
          tsCode={`import { Context } from 'hono';
import { usersService } from '../services/users.js';

export const usersController = {
  async getUsers(c: Context) {
    try {
      const data = await usersService.getUsers();
      return c.json({ success: true, data });
    } catch (error) {
      return c.json({ error: 'Failed to get users' }, 500);
    }
  },

  async getPublic(c: Context) {
    return c.json({ message: 'Public endpoint - no auth required' });
  },

  async adminAction(c: Context) {
    return c.json({ message: 'Admin action performed' });
  },
};`}
          jsCode={`import { usersService } from '../services/users.js';

export const usersController = {
  async getUsers(c) {
    try {
      const data = await usersService.getUsers();
      return c.json({ success: true, data });
    } catch (error) {
      return c.json({ error: 'Failed to get users' }, 500);
    }
  },

  async getPublic(c) {
    return c.json({ message: 'Public endpoint - no auth required' });
  },

  async adminAction(c) {
    return c.json({ message: 'Admin action performed' });
  },
};`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Hono Route Pattern
        </h2>
        <p>For Hono projects, the same declarative pattern is used:</p>
        <CodeBlock
          filename="src/routes/index.ts"
          tsCode={`import { Hono } from 'hono';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { usersController } from '../controllers/users.js';

export const routes = new Hono();

const routesList = [
  {
    method: METHODS.GET,
    path: '/users',
    handler: usersController.getUsers
  },
  
  {
    method: METHODS.GET,
    path: '/users/public',
    handler: usersController.getPublic,
    disabled: ['auth']
  },
  
  {
    method: METHODS.POST,
    path: '/users/admin',
    handler: usersController.adminAction,
    roles: ['admin', 'superAdmin']
  }
];

const dr = createConfiguredRouter({ routes: routesList });
dr.applyToHono(routes);`}
          jsCode={`import { Hono } from 'hono';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { usersController } from '../controllers/users.js';

export const routes = new Hono();

const routesList = [
  {
    method: METHODS.GET,
    path: '/users',
    handler: usersController.getUsers
  },
  
  {
    method: METHODS.GET,
    path: '/users/public',
    handler: usersController.getPublic,
    disabled: ['auth']
  },
  
  {
    method: METHODS.POST,
    path: '/users/admin',
    handler: usersController.adminAction,
    roles: ['admin', 'superAdmin']
  }
];

const dr = createConfiguredRouter({ routes: routesList });
dr.applyToHono(routes);`}
        />
      </section>
    </div>
  )
}
