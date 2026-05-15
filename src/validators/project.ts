import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

export interface ValidationError {
  type:
    | 'orphaned-route'
    | 'orphaned-middleware'
    | 'missing-service'
    | 'missing-controller'
    | 'missing-dependency'
    | 'missing-env'
    | 'missing-file'
    | 'invalid-config'
    | 'typescript-syntax-in-js';
  message: string;
  file?: string;
}

const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https',
  'net', 'os', 'path', 'process', 'stream', 'url', 'util', 'zlib'
]);

const TS_SYNTAX_PATTERNS = [
  /\binterface\s+\w+/,
  /\btype\s+\w+\s*=/,
  /\bas\s+const\b/,
  /:\s*(string|number|boolean|any|void|unknown)\b/,
  /:\s*Promise</,
  /\)\s*:\s*\w+/,
];

export async function validateProject(projectPath: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  try {
    const routesPath = path.join(projectPath, 'src/routes');
    const controllersPath = path.join(projectPath, 'src/controllers');
    const servicesPath = path.join(projectPath, 'src/services');
    const middlewarePath = path.join(projectPath, 'src/middleware');

    const routeFiles = await getFiles(routesPath);
    const controllerFiles = await getFiles(controllersPath);
    const serviceFiles = await getFiles(servicesPath);
    const middlewareFiles = await getFiles(middlewarePath);

    // Extract names without extensions
    const controllers = new Set(controllerFiles.map(fileBaseName));
    const services = new Set(serviceFiles.map(fileBaseName));
    const middlewares = new Set(middlewareFiles.map(fileBaseName));

    // Check routes for missing controllers
    for (const routeFile of routeFiles) {
      const content = await fs.readFile(routeFile, 'utf-8');
      const controllerImports = extractImports(content, 'controllers');
      
      for (const controller of controllerImports) {
        if (!controllers.has(controller)) {
          errors.push({
            type: 'missing-controller',
            message: `Route references controller '${controller}' but it doesn't exist`,
            file: routeFile
          });
        }
      }
    }

    // Check controllers for missing services
    for (const controllerFile of controllerFiles) {
      const content = await fs.readFile(controllerFile, 'utf-8');
      const serviceImports = extractImports(content, 'services');
      
      for (const service of serviceImports) {
        if (!services.has(service)) {
          errors.push({
            type: 'missing-service',
            message: `Controller references service '${service}' but it doesn't exist`,
            file: controllerFile
          });
        }
      }
    }

    // Check for unused middleware
    const usedMiddlewares = new Set<string>();
    for (const routeFile of routeFiles) {
      const content = await fs.readFile(routeFile, 'utf-8');
      const middlewareImports = extractImports(content, 'middleware');
      middlewareImports.forEach(m => usedMiddlewares.add(m));
    }

    for (const middleware of middlewares) {
      if (!['auth', 'logging', 'jwtAuth.middleware', 'sessionAuth.middleware'].includes(middleware) && !usedMiddlewares.has(middleware)) {
        errors.push({
          type: 'orphaned-middleware',
          message: `Middleware '${middleware}' is defined but never used`,
          file: path.join(middlewarePath, `${middleware}.ts`)
        });
      }
    }

    await validateRequiredProjectFiles(projectPath, errors);
    await validatePackageImports(projectPath, errors);
    await validateEnvExample(projectPath, errors);
    await validateNodConfig(projectPath, errors);
    await validateJsSyntax(projectPath, errors);

  } catch (error) {
    console.error('Validation error:', error);
  }

  return errors;
}

async function getFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(entry => {
        const fullPath = path.join(dir, entry.name);
        return entry.isDirectory() ? getFiles(fullPath) : [fullPath];
      })
    );
    return files.flat().filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  } catch {
    return [];
  }
}

function fileBaseName(filePath: string): string {
  return path.basename(filePath).replace(/\.(ts|js)$/, '');
}

function extractImports(content: string, folder: string): string[] {
  const regex = new RegExp(`from ['"]\\.\\./${folder}/([^'"]+)['"]`, 'g');
  const imports: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1].replace(/\.(js|ts)$/, ''));
  }
  
  return imports;
}

async function validateRequiredProjectFiles(projectPath: string, errors: ValidationError[]) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!await exists(packageJsonPath)) {
    errors.push({ type: 'missing-file', message: 'package.json is missing', file: packageJsonPath });
    return;
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  const isTypeScript = await exists(path.join(projectPath, 'tsconfig.json'));
  const ext = isTypeScript ? 'ts' : 'js';
  const expectedEntry = packageJson.scripts?.start?.includes('dist/server.js') || packageJson.scripts?.start?.includes(`src/server.${ext}`)
    ? `src/server.${ext}`
    : null;

  for (const file of ['.env.example', 'README.md', `src/app.${ext}`, expectedEntry].filter(Boolean) as string[]) {
    const fullPath = path.join(projectPath, file);
    if (!await exists(fullPath)) {
      errors.push({ type: 'missing-file', message: `Missing expected file: ${file}`, file: fullPath });
    }
  }
}

async function validatePackageImports(projectPath: string, errors: ValidationError[]) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!await exists(packageJsonPath)) return;

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const srcFiles = await getFiles(path.join(projectPath, 'src'));
  const importRegex = /import(?:\s+type)?(?:\s+.+?\s+from)?\s*['"]([^.'"/][^'"]*)['"]/g;

  for (const file of srcFiles) {
    const content = await fs.readFile(file, 'utf-8');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const packageName = normalizePackageName(match[1]);
      if (!NODE_BUILTINS.has(packageName) && !allDeps[packageName]) {
        errors.push({
          type: 'missing-dependency',
          message: `Imported package '${packageName}' is not listed in package.json`,
          file,
        });
      }
    }
  }
}

async function validateEnvExample(projectPath: string, errors: ValidationError[]) {
  const envPath = path.join(projectPath, '.env.example');
  if (!await exists(envPath)) return;

  const envContent = await fs.readFile(envPath, 'utf-8');
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await exists(packageJsonPath)
    ? JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    : {};

  const requiredVars = new Set<string>();
  if (packageJson.dependencies?.['@supabase/supabase-js']) {
    requiredVars.add('SUPABASE_URL');
  }
  if (packageJson.dependencies?.['drizzle-orm']) {
    requiredVars.add('SUPABASE_POOLER_URL');
  }
  if (packageJson.dependencies?.['serverless-http']) {
    requiredVars.add('NODE_ENV');
  }
  if (packageJson.dependencies?.['cookie-parser']) {
    requiredVars.add('TRUSTED_PARENT_DOMAINS');
  }

  for (const variable of requiredVars) {
    if (!new RegExp(`^${variable}=`, 'm').test(envContent)) {
      errors.push({
        type: 'missing-env',
        message: `.env.example is missing ${variable}`,
        file: envPath,
      });
    }
  }
}

async function validateNodConfig(projectPath: string, errors: ValidationError[]) {
  const configPath = path.join(projectPath, 'nod.config.json');
  if (!await exists(configPath)) return;

  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    for (const key of ['name', 'framework', 'typescript', 'database', 'orm', 'auth', 'paths', 'components']) {
      if (!(key in config)) {
        errors.push({ type: 'invalid-config', message: `nod.config.json missing required key '${key}'`, file: configPath });
      }
    }
  } catch (error) {
    errors.push({
      type: 'invalid-config',
      message: `nod.config.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      file: configPath,
    });
  }
}

async function validateJsSyntax(projectPath: string, errors: ValidationError[]) {
  const files = (await getFiles(path.join(projectPath, 'src'))).filter(file => file.endsWith('.js'));

  for (const file of files) {
    const lines = (await fs.readFile(file, 'utf-8')).split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (TS_SYNTAX_PATTERNS.some(pattern => pattern.test(trimmed)) && !isLikelyObjectLiteralLine(trimmed)) {
        errors.push({
          type: 'typescript-syntax-in-js',
          message: `Possible TypeScript syntax in JavaScript file at line ${index + 1}`,
          file,
        });
      }
    });
  }
}

function normalizePackageName(importPath: string): string {
  if (importPath.startsWith('node:')) return importPath.slice(5);
  if (importPath.startsWith('@')) return importPath.split('/').slice(0, 2).join('/');
  return importPath.split('/')[0];
}

function isLikelyObjectLiteralLine(line: string): boolean {
  return /^\w+:\s*(['"`\[{]|\d|true|false|null|undefined|\w+\()/.test(line)
    || line.includes('http:')
    || line.includes('https:');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function printValidationErrors(errors: ValidationError[]) {
  if (errors.length === 0) {
    console.log(chalk.green('\n✅ No validation errors found\n'));
    return;
  }

  console.log(chalk.red(`\n❌ Found ${errors.length} validation error(s):\n`));
  
  errors.forEach((error, index) => {
    console.log(chalk.yellow(`${index + 1}. [${error.type}]`), error.message);
    if (error.file) {
      console.log(chalk.gray(`   File: ${error.file}`));
    }
  });
  
  console.log();
}
