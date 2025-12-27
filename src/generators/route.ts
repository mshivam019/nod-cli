import prompts from 'prompts';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export async function addRoute(name: string) {
  const response = await prompts([
    {
      type: 'select',
      name: 'method',
      message: 'HTTP method:',
      choices: [
        { title: 'GET', value: 'get' },
        { title: 'POST', value: 'post' },
        { title: 'PUT', value: 'put' },
        { title: 'DELETE', value: 'delete' },
        { title: 'PATCH', value: 'patch' }
      ]
    },
    {
      type: 'text',
      name: 'path',
      message: 'Route path:',
      initial: `/${name}`
    },
    {
      type: 'confirm',
      name: 'createController',
      message: 'Create controller?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'createService',
      message: 'Create service?',
      initial: true
    },
    {
      type: 'multiselect',
      name: 'middleware',
      message: 'Include middleware (optional):',
      choices: [
        { title: 'Auth', value: 'authMiddleware' },
        { title: 'Logging', value: 'loggingMiddleware' },
        { title: 'Role Check', value: 'roleMiddleware' }
      ]
    }
  ]);

  const projectRoot = process.cwd();
  
  // Create service if requested
  if (response.createService) {
    await createService(projectRoot, name);
  }

  // Create controller if requested
  if (response.createController) {
    await createController(projectRoot, name, response.createService);
  }

  // Add route to routes file
  await addRouteToFile(projectRoot, name, response);
}

async function createService(projectRoot: string, name: string) {
  const servicePath = path.join(projectRoot, 'src/services', `${name}.ts`);
  
  const serviceContent = `export const ${name}Service = {
  async get${capitalize(name)}() {
    // TODO: Implement service logic
    return { message: 'Service ${name} response' };
  },

  async create${capitalize(name)}(data: any) {
    // TODO: Implement service logic
    return { success: true, data };
  },

  async update${capitalize(name)}(id: string, data: any) {
    // TODO: Implement service logic
    return { success: true, id, data };
  },

  async delete${capitalize(name)}(id: string) {
    // TODO: Implement service logic
    return { success: true, id };
  }
};
`;

  await fs.outputFile(servicePath, serviceContent);
  console.log(chalk.green(`✓ Created service: ${servicePath}`));
}

async function createController(projectRoot: string, name: string, hasService: boolean) {
  const controllerPath = path.join(projectRoot, 'src/controllers', `${name}.ts`);
  
  // Detect framework
  const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
  const isHono = packageJson.dependencies?.hono;

  let controllerContent = '';

  if (isHono) {
    controllerContent = `import { Context } from 'hono';
${hasService ? `import { ${name}Service } from '../services/${name}.js';` : ''}

export const ${name}Controller = {
  async get${capitalize(name)}(c: Context) {
    try {
      ${hasService ? `const data = await ${name}Service.get${capitalize(name)}();` : `const data = { message: 'Hello from ${name}' };`}
      return c.json(data);
    } catch (error) {
      return c.json({ error: 'Failed to get ${name}' }, 500);
    }
  },

  async create${capitalize(name)}(c: Context) {
    try {
      const body = await c.req.json();
      ${hasService ? `const data = await ${name}Service.create${capitalize(name)}(body);` : `const data = { success: true, body };`}
      return c.json(data, 201);
    } catch (error) {
      return c.json({ error: 'Failed to create ${name}' }, 500);
    }
  }
};
`;
  } else {
    controllerContent = `import { Request, Response } from 'express';
${hasService ? `import { ${name}Service } from '../services/${name}.js';` : ''}

export const ${name}Controller = {
  async get${capitalize(name)}(_req: Request, res: Response) {
    try {
      ${hasService ? `const data = await ${name}Service.get${capitalize(name)}();` : `const data = { message: 'Hello from ${name}' };`}
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get ${name}' });
    }
  },

  async create${capitalize(name)}(req: Request, res: Response) {
    try {
      ${hasService ? `const data = await ${name}Service.create${capitalize(name)}(req.body);` : `const data = { success: true, body: req.body };`}
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create ${name}' });
    }
  }
};
`;
  }

  await fs.outputFile(controllerPath, controllerContent);
  console.log(chalk.green(`✓ Created controller: ${controllerPath}`));
}

async function addRouteToFile(projectRoot: string, name: string, config: any) {
  const routesPath = path.join(projectRoot, 'src/routes/index.ts');
  
  // Detect framework
  const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
  const isHono = packageJson.dependencies?.hono;
  
  try {
    let content = await fs.readFile(routesPath, 'utf-8') as string;
    
    // Add controller import at the top with other imports
    const importLine = `import { ${name}Controller } from '../controllers/${name}.js';`;
    if (!content.includes(importLine)) {
      // Find the last import statement
      const importMatches = content.match(/^import .+$/gm);
      if (importMatches && importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLastImport + 1) + importLine + '\n' + content.slice(endOfLastImport + 1);
      } else {
        content = importLine + '\n' + content;
      }
    }

    if (isHono) {
      // For Hono, add route to the routesList array
      const routeEntry = `  {
    method: METHODS.${config.method.toUpperCase()},
    path: '${config.path}',
    handler: ${name}Controller.get${capitalize(name)}
  }`;
      
      // Find the routesList array and add the new route
      const routesListMatch = content.match(/const routesList = \[/);
      if (routesListMatch) {
        const routesListIndex = content.indexOf(routesListMatch[0]);
        const insertIndex = routesListIndex + routesListMatch[0].length;
        content = content.slice(0, insertIndex) + '\n' + routeEntry + ',' + content.slice(insertIndex);
      } else {
        // Fallback: add a simple route
        const routesMatch = content.match(/export const routes = new Hono\(\);/);
        if (routesMatch) {
          const routesIndex = content.indexOf(routesMatch[0]);
          const endOfRoutes = content.indexOf('\n', routesIndex);
          const routeLine = `\nroutes.${config.method}('${config.path}', ${name}Controller.get${capitalize(name)});`;
          content = content.slice(0, endOfRoutes + 1) + routeLine + content.slice(endOfRoutes + 1);
        }
      }
    } else {
      // For Express, add middleware imports if needed
      if (config.middleware && config.middleware.length > 0) {
        const middlewareFileMap: Record<string, string> = {
          'authMiddleware': 'auth',
          'loggingMiddleware': 'logging',
          'roleMiddleware': 'auth'
        };
        
        for (const mw of config.middleware) {
          const mwFile = middlewareFileMap[mw] || 'auth';
          const mwImport = `import { ${mw} } from '../middlewares/${mwFile}.js';`;
          if (!content.includes(`import { ${mw} }`)) {
            const importMatches = content.match(/^import .+$/gm);
            if (importMatches && importMatches.length > 0) {
              const lastImport = importMatches[importMatches.length - 1];
              const lastImportIndex = content.lastIndexOf(lastImport);
              const endOfLastImport = content.indexOf('\n', lastImportIndex);
              content = content.slice(0, endOfLastImport + 1) + mwImport + '\n' + content.slice(endOfLastImport + 1);
            }
          }
        }
      }

      // Add route after the export statement
      const middlewareChain = config.middleware && config.middleware.length > 0 
        ? config.middleware.join(', ') + ', ' 
        : '';
      
      const routeLine = `router.${config.method}('${config.path}', ${middlewareChain}${name}Controller.get${capitalize(name)});`;
      
      // Find the export const router line and add route after it
      const exportRouterMatch = content.match(/export const router = Router\(\);/);
      if (exportRouterMatch) {
        const exportIndex = content.indexOf(exportRouterMatch[0]);
        const endOfExport = content.indexOf('\n', exportIndex);
        content = content.slice(0, endOfExport + 1) + '\n' + routeLine + '\n' + content.slice(endOfExport + 1);
      } else {
        // Fallback: add at the end
        content += '\n' + routeLine + '\n';
      }
    }

    await fs.outputFile(routesPath, content);
    console.log(chalk.green(`✓ Added route to: ${routesPath}`));
  } catch (error) {
    console.error(chalk.red('Failed to update routes file:'), error);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
