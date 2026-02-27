import prompts from "prompts";
import fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";

interface AddRouteOptions {
  nonInteractive?: boolean;
  method?: "get" | "post" | "put" | "delete" | "patch";
  path?: string;
  createController?: boolean;
  createService?: boolean;
  middleware?: string[];
}

export async function addRoute(name: string, options: AddRouteOptions = {}) {
  const defaults = {
    method: options.method || "get",
    path: options.path || `/${name}`,
    createController: options.createController ?? true,
    createService: options.createService ?? true,
    middleware: options.middleware || [],
  };

  const response = options.nonInteractive
    ? defaults
    : await prompts([
        {
          type: options.method ? null : "select",
          name: "method",
          message: "HTTP method:",
          choices: [
            { title: "GET", value: "get" },
            { title: "POST", value: "post" },
            { title: "PUT", value: "put" },
            { title: "DELETE", value: "delete" },
            { title: "PATCH", value: "patch" },
          ],
          initial: ["get", "post", "put", "delete", "patch"].indexOf(
            defaults.method,
          ),
        },
        {
          type: options.path ? null : "text",
          name: "path",
          message: "Route path:",
          initial: defaults.path,
        },
        {
          type: options.createController !== undefined ? null : "confirm",
          name: "createController",
          message: "Create controller?",
          initial: defaults.createController,
        },
        {
          type: options.createService !== undefined ? null : "confirm",
          name: "createService",
          message: "Create service?",
          initial: defaults.createService,
        },
        {
          type: options.middleware ? null : "multiselect",
          name: "middleware",
          message: "Include middleware (optional):",
          choices: [
            { title: "Auth", value: "authMiddleware" },
            { title: "Logging", value: "loggingMiddleware" },
            { title: "Role Check", value: "roleMiddleware" },
          ],
        },
      ]);

  const resolved = {
    method: response.method || defaults.method,
    path: normalizeRoutePath(response.path || defaults.path),
    createController: response.createController ?? defaults.createController,
    createService: response.createService ?? defaults.createService,
    middleware: response.middleware || defaults.middleware,
  };

  const projectRoot = process.cwd();
  const ext = await detectProjectExt(projectRoot);

  // Create service if requested
  if (resolved.createService) {
    await createService(projectRoot, name, ext);
  }

  // Create controller if requested
  if (resolved.createController) {
    await createController(projectRoot, name, resolved.createService, ext);
  }

  // Add route to routes file
  await addRouteToFile(projectRoot, name, resolved, ext);
}

async function createService(
  projectRoot: string,
  name: string,
  ext: "ts" | "js",
) {
  const servicePath = path.join(
    projectRoot,
    "src/services",
    `${name}.service.${ext}`,
  );

  const serviceContent =
    ext === "ts"
      ? `export const ${name}Service = {
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
`
      : `export const ${name}Service = {
  async get${capitalize(name)}() {
    // TODO: Implement service logic
    return { message: 'Service ${name} response' };
  },

  async create${capitalize(name)}(data) {
    // TODO: Implement service logic
    return { success: true, data };
  },

  async update${capitalize(name)}(id, data) {
    // TODO: Implement service logic
    return { success: true, id, data };
  },

  async delete${capitalize(name)}(id) {
    // TODO: Implement service logic
    return { success: true, id };
  }
};
`;

  await fs.outputFile(servicePath, serviceContent);
  console.log(chalk.green(`✓ Created service: ${servicePath}`));
}

async function createController(
  projectRoot: string,
  name: string,
  hasService: boolean,
  ext: "ts" | "js",
) {
  const controllerPath = path.join(
    projectRoot,
    "src/controllers",
    `${name}.controller.${ext}`,
  );

  // Detect framework
  const packageJson = await fs.readJson(path.join(projectRoot, "package.json"));
  const isHono = packageJson.dependencies?.hono;

  let controllerContent = "";

  if (isHono && ext === "ts") {
    controllerContent = `import { Context } from 'hono';
${hasService ? `import { ${name}Service } from '../services/${name}.service.js';` : ""}

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
  } else if (isHono) {
    controllerContent = `${hasService ? `import { ${name}Service } from '../services/${name}.service.js';` : ""}

export const ${name}Controller = {
  async get${capitalize(name)}(c) {
    try {
      ${hasService ? `const data = await ${name}Service.get${capitalize(name)}();` : `const data = { message: 'Hello from ${name}' };`}
      return c.json(data);
    } catch (error) {
      return c.json({ error: 'Failed to get ${name}' }, 500);
    }
  },

  async create${capitalize(name)}(c) {
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
  } else if (ext === "ts") {
    controllerContent = `import { Request, Response } from 'express';
${hasService ? `import { ${name}Service } from '../services/${name}.service.js';` : ""}

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
  } else {
    controllerContent = `${hasService ? `import { ${name}Service } from '../services/${name}.service.js';` : ""}

export const ${name}Controller = {
  async get${capitalize(name)}(_req, res) {
    try {
      ${hasService ? `const data = await ${name}Service.get${capitalize(name)}();` : `const data = { message: 'Hello from ${name}' };`}
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get ${name}' });
    }
  },

  async create${capitalize(name)}(req, res) {
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

async function addRouteToFile(
  projectRoot: string,
  name: string,
  config: any,
  ext: "ts" | "js",
) {
  const routesPath = path.join(projectRoot, `src/routes/index.${ext}`);

  // Detect framework
  const packageJson = await fs.readJson(path.join(projectRoot, "package.json"));
  const isHono = packageJson.dependencies?.hono;

  try {
    let content = (await fs.readFile(routesPath, "utf-8")) as string;

    if (isHono) {
      let disabledStr = "";
      let rolesStr = "";

      if (config.middleware && !config.middleware.includes("authMiddleware")) {
        disabledStr = `,\n    disabled: ['auth']`;
      }

      if (config.middleware && config.middleware.includes("roleMiddleware")) {
        rolesStr = `,\n    roles: ['admin']`;
      }

      const routeModulePath = path.join(
        projectRoot,
        "src/routes",
        `${name}.routes.${ext}`,
      );
      const routeModuleContent =
        ext === "ts"
          ? `import { ${name}Controller } from '../controllers/${name}.controller.js';
import { METHODS } from '../config/router.js';
import type { RouteDefinition } from '../helpers/route-builder.js';

export const ${name}Routes: RouteDefinition[] = [
  {
    method: METHODS.${config.method.toUpperCase()},
    path: '${config.path}',
    handler: ${name}Controller.get${capitalize(name)}${disabledStr}${rolesStr}
  }
];
`
          : `import { ${name}Controller } from '../controllers/${name}.controller.js';
import { METHODS } from '../config/router.js';

export const ${name}Routes = [
  {
    method: METHODS.${config.method.toUpperCase()},
    path: '${config.path}',
    handler: ${name}Controller.get${capitalize(name)}${disabledStr}${rolesStr}
  }
];
`;

      await fs.outputFile(routeModulePath, routeModuleContent);
      console.log(chalk.green(`✓ Created route module: ${routeModulePath}`));

      const routeImportLine = `import { ${name}Routes } from './${name}.routes.js';`;
      if (!content.includes(routeImportLine)) {
        const importMatches = content.match(/^import .+$/gm);
        if (importMatches && importMatches.length > 0) {
          const lastImport = importMatches[importMatches.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImport);
          const endOfLastImport = content.indexOf("\n", lastImportIndex);
          content =
            content.slice(0, endOfLastImport + 1) +
            routeImportLine +
            "\n" +
            content.slice(endOfLastImport + 1);
        } else {
          content = routeImportLine + "\n" + content;
        }
      }

      const routesListMatch = content.match(/const routesList = \[/);
      if (routesListMatch) {
        const routesListIndex = content.indexOf(routesListMatch[0]);
        const insertIndex = routesListIndex + routesListMatch[0].length;
        const spreadEntry = `\n  ...${name}Routes,\n  `;
        if (!content.includes(spreadEntry.trim())) {
          content =
            content.slice(0, insertIndex) +
            spreadEntry +
            content.slice(insertIndex);
        }
      }
    } else {
      // For Express, generate a dedicated route module and aggregate it in routes/index.ts
      let disabledStr = "";
      let rolesStr = "";

      if (config.middleware && !config.middleware.includes("authMiddleware")) {
        if (content.includes("'jwtAuth'") || content.includes("'auth'")) {
          disabledStr = `,\n    disabled: ['jwtAuth', 'auditLogger']`;
        }
      }

      if (config.middleware && config.middleware.includes("roleMiddleware")) {
        rolesStr = `,\n    roles: ['admin']`;
      }

      const routeModulePath = path.join(
        projectRoot,
        "src/routes",
        `${name}.routes.${ext}`,
      );
      const routeModuleContent =
        ext === "ts"
          ? `import { ${name}Controller } from '../controllers/${name}.controller.js';
import { METHODS } from '../config/router.js';
import type { RouteDefinition } from '../helpers/route-builder.js';

export const ${name}Routes: RouteDefinition[] = [
  {
    method: METHODS.${config.method.toUpperCase()},
    path: '${config.path}',
    handler: ${name}Controller.get${capitalize(name)}${disabledStr}${rolesStr}
  }
];
`
          : `import { ${name}Controller } from '../controllers/${name}.controller.js';
import { METHODS } from '../config/router.js';

export const ${name}Routes = [
  {
    method: METHODS.${config.method.toUpperCase()},
    path: '${config.path}',
    handler: ${name}Controller.get${capitalize(name)}${disabledStr}${rolesStr}
  }
];
`;

      await fs.outputFile(routeModulePath, routeModuleContent);
      console.log(chalk.green(`✓ Created route module: ${routeModulePath}`));

      const routeImportLine = `import { ${name}Routes } from './${name}.routes.js';`;
      if (!content.includes(routeImportLine)) {
        const importMatches = content.match(/^import .+$/gm);
        if (importMatches && importMatches.length > 0) {
          const lastImport = importMatches[importMatches.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImport);
          const endOfLastImport = content.indexOf("\n", lastImportIndex);
          content =
            content.slice(0, endOfLastImport + 1) +
            routeImportLine +
            "\n" +
            content.slice(endOfLastImport + 1);
        } else {
          content = routeImportLine + "\n" + content;
        }
      }

      const routesArrayMatch = content.match(/const routes = \[/);
      if (routesArrayMatch) {
        const routesArrayIndex = content.indexOf(routesArrayMatch[0]);
        const insertIndex = routesArrayIndex + routesArrayMatch[0].length;
        const spreadEntry = `\n  ...${name}Routes,\n  `;
        if (!content.includes(spreadEntry.trim())) {
          content =
            content.slice(0, insertIndex) +
            spreadEntry +
            content.slice(insertIndex);
        }
      }
    }

    await fs.outputFile(routesPath, content);
    console.log(chalk.green(`✓ Added route to: ${routesPath}`));
  } catch (error) {
    console.error(chalk.red("Failed to update routes file:"), error);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function normalizeRoutePath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/").trim();

  if (/^[A-Za-z]:\//.test(normalized)) {
    const parts = normalized.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return `/${last}`;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

async function detectProjectExt(projectRoot: string): Promise<"ts" | "js"> {
  if (await fs.pathExists(path.join(projectRoot, "src/routes/index.ts"))) {
    return "ts";
  }
  return "js";
}
