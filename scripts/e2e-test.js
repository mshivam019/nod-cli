#!/usr/bin/env node
/**
 * End-to-End Testing Script for nod-cli
 * Tests all combinations of frameworks, languages, presets, and components
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const TEST_DIR = path.join(ROOT_DIR, 'e2e-tests');
const CLI_PATH = path.join(ROOT_DIR, 'dist', 'cli.js');

// Test configurations
const FRAMEWORKS = ['express', 'hono'];
const LANGUAGES = ['ts', 'js'];
const PRESETS = ['minimal', 'api', 'full', 'ai', '1'];

// Files to check for TypeScript syntax errors in JS files
const TS_SYNTAX_PATTERNS = [
  /:\s*string\b/,
  /:\s*number\b/,
  /:\s*boolean\b/,
  /:\s*any\b/,
  /:\s*void\b/,
  /:\s*Promise</,
  /:\s*Request\b/,
  /:\s*Response\b/,
  /:\s*NextFunction\b/,
  /:\s*Express\b/,
  /:\s*Error\b/,
  /:\s*Context\b/,
  /:\s*Next\b/,
  /:\s*Function\b/,
  /:\s*\[\]/,  // Array type annotation
  /:\s*\{\}/,  // Object type annotation
  /\binterface\s+\w+/,
  /\btype\s+\w+\s*=/,
  /\bas\s+const\b/,
  /\bas\s+\w+\[\]/,
  /\bas\s+\w+\b(?!\s*[,;)\]}])/,  // "as Type" but not "as" at end of statement
  /!\s*[,;)}\]]/,  // Non-null assertions
  /!\s*\./,        // Non-null assertions before property access
  /<\w+>\s*\(/,    // Generic type parameters in function calls
  /\)\s*:\s*\w+\s*{/,  // Return type annotation on function
  /\)\s*:\s*\w+\s*=>/,  // Return type annotation on arrow function
];

// Results tracking
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function runCommand(command, cwd = ROOT_DIR, silent = false) {
  try {
    const output = execSync(command, { 
      cwd, 
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      timeout: 30000,
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || '' };
  }
}

function runInteractiveCommand(command, cwd, inputs) {
  return new Promise((resolve) => {
    const child = spawn('node', command.split(' ').slice(1), {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    
    let output = '';
    let inputIndex = 0;
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      // Send next input when we see a prompt
      if (inputIndex < inputs.length && (output.includes('?') || output.includes(':'))) {
        setTimeout(() => {
          if (inputIndex < inputs.length) {
            child.stdin.write(inputs[inputIndex] + '\n');
            inputIndex++;
          }
        }, 100);
      }
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ success: code === 0, output, code });
    });
    
    child.on('error', (err) => {
      resolve({ success: false, error: err.message, output });
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Timeout', output });
    }, 30000);
  });
}

async function checkForTsSyntaxInJsFiles(projectPath) {
  const errors = [];
  const jsFiles = [];
  
  // Find all .js files
  function findJsFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && item !== 'node_modules') {
        findJsFiles(fullPath);
      } else if (item.endsWith('.js')) {
        jsFiles.push(fullPath);
      }
    }
  }
  
  findJsFiles(path.join(projectPath, 'src'));
  
  // Also check drizzle.config.js if exists
  const drizzleConfig = path.join(projectPath, 'drizzle.config.js');
  if (fs.existsSync(drizzleConfig)) {
    jsFiles.push(drizzleConfig);
  }
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      
      for (const pattern of TS_SYNTAX_PATTERNS) {
        if (pattern.test(line)) {
          // Filter out false positives
          if (line.includes('import') && line.includes('from')) continue;
          if (line.includes('// ')) continue; // Inline comments
          if (line.includes('`') && line.includes('${')) continue; // Template literals
          
          // Skip object property assignments (key: value)
          // These look like type annotations but are valid JS
          const trimmedLine = line.trim();
          if (/^\w+:\s*\w+[,}]?\s*$/.test(trimmedLine)) continue;
          if (/^\w+:\s*['"`]/.test(trimmedLine)) continue; // String values
          if (/^\w+:\s*\[/.test(trimmedLine)) continue; // Array values
          if (/^\w+:\s*{/.test(trimmedLine)) continue; // Object values
          if (/^\w+:\s*\d/.test(trimmedLine)) continue; // Number values
          if (/^\w+:\s*(true|false|null|undefined)/.test(trimmedLine)) continue; // Boolean/null values
          if (/^\w+:\s*\w+\(/.test(trimmedLine)) continue; // Function call values
          if (/^\w+:\s*await\s/.test(trimmedLine)) continue; // Await expressions
          if (/^\w+:\s*new\s/.test(trimmedLine)) continue; // Constructor calls
          
          // Skip return statements with object literals
          if (/return\s*{/.test(line)) continue;
          
          errors.push({
            file: path.relative(projectPath, file),
            line: i + 1,
            content: line.trim(),
            pattern: pattern.toString(),
          });
          break; // Only report first match per line
        }
      }
    }
  }
  
  return errors;
}

async function checkPackageJson(projectPath) {
  const errors = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    errors.push('package.json not found');
    return errors;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // Check for required fields
  if (!packageJson.name) errors.push('Missing name in package.json');
  if (!packageJson.scripts) errors.push('Missing scripts in package.json');
  if (!packageJson.dependencies) errors.push('Missing dependencies in package.json');
  
  // Check for common required dependencies based on what's imported
  const srcDir = path.join(projectPath, 'src');
  if (fs.existsSync(srcDir)) {
    const allImports = new Set();
    
    function scanImports(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanImports(fullPath);
        } else if (item.endsWith('.js') || item.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const importMatches = content.matchAll(/import .+ from ['"]([^./][^'"]+)['"]/g);
          for (const match of importMatches) {
            // Get the package name (handle scoped packages)
            let pkg = match[1];
            if (pkg.startsWith('@')) {
              pkg = pkg.split('/').slice(0, 2).join('/');
            } else {
              pkg = pkg.split('/')[0];
            }
            allImports.add(pkg);
          }
        }
      }
    }
    
    scanImports(srcDir);
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    for (const imp of allImports) {
      if (!allDeps[imp]) {
        errors.push(`Missing dependency: ${imp}`);
      }
    }
  }
  
  return errors;
}

async function checkRequiredFiles(projectPath, config) {
  const errors = [];
  const requiredFiles = [
    'package.json',
    '.gitignore',
    '.env.example',
    'README.md',
  ];
  
  const ext = config.typescript ? 'ts' : 'js';
  
  // Core files
  requiredFiles.push(`src/app.${ext}`);
  requiredFiles.push(`src/server.${ext}`);
  requiredFiles.push(`src/config/index.${ext}`);
  requiredFiles.push(`src/utils/logger.${ext}`);
  
  // Check based on preset
  if (config.preset !== 'minimal') {
    requiredFiles.push(`src/routes/index.${ext}`);
    requiredFiles.push(`src/controllers/example.${ext}`);
    requiredFiles.push(`src/services/example.${ext}`);
  }
  
  // Supabase auth
  if (config.preset === '1' || config.preset === 'full' || config.preset === 'ai') {
    requiredFiles.push(`src/middleware/jwtAuth.middleware.${ext}`);
    requiredFiles.push(`src/helpers/supabase.helper.${ext}`);
    requiredFiles.push(`src/config/config.${ext}`);
  }
  
  // Drizzle
  if (config.preset === '1' || config.preset === 'full' || config.preset === 'ai') {
    requiredFiles.push(`drizzle.config.${ext}`);
    requiredFiles.push(`src/db/index.${ext}`);
    requiredFiles.push(`src/db/schema.${ext}`);
  }
  
  // Environments
  if (config.preset === '1' || config.preset === 'full' || config.preset === 'ai' || config.preset === 'api') {
    requiredFiles.push(`src/environments/staging.${ext}`);
    requiredFiles.push(`src/environments/production.${ext}`);
  }
  
  // GitHub workflow
  if (config.preset === '1' || config.preset === 'full' || config.preset === 'ai' || config.preset === 'api') {
    requiredFiles.push('.github/workflows/deploy.yml');
  }
  
  // Preset 1 specific
  if (config.preset === '1') {
    requiredFiles.push(`src/middleware/permission.middleware.${ext}`);
    requiredFiles.push(`src/middleware/sourceSelection.middleware.${ext}`);
    requiredFiles.push(`src/utils/sourceConfig.${ext}`);
    requiredFiles.push(`src/utils/auditLogger.${ext}`);
    requiredFiles.push(`src/middleware/auditLog.middleware.${ext}`);
  }
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectPath, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  
  return errors;
}

async function testProjectGeneration(framework, language, preset) {
  const projectName = `test-${framework}-${language}-${preset}`;
  const projectPath = path.join(TEST_DIR, projectName);
  const isTS = language === 'ts';
  
  log(`\n${'='.repeat(60)}`, 'info');
  log(`Testing: ${framework} + ${language} + ${preset}`, 'info');
  log(`${'='.repeat(60)}`, 'info');
  
  const testResult = {
    name: projectName,
    framework,
    language,
    preset,
    errors: [],
    warnings: [],
  };
  
  try {
    // Clean up if exists
    if (fs.existsSync(projectPath)) {
      fs.removeSync(projectPath);
    }
    
    // Generate project
    log(`Generating project...`, 'info');
    const tsFlag = isTS ? '--ts' : '--no-ts';
    const genResult = runCommand(
      `node "${CLI_PATH}" ${projectName} --preset ${preset} --framework ${framework} ${tsFlag} --yes`,
      TEST_DIR,
      true
    );
    
    if (!genResult.success) {
      testResult.errors.push(`Generation failed: ${genResult.error}`);
      results.failed.push(testResult);
      return testResult;
    }
    
    // Check if project was created
    if (!fs.existsSync(projectPath)) {
      testResult.errors.push('Project directory was not created');
      results.failed.push(testResult);
      return testResult;
    }
    
    // Check required files
    log(`Checking required files...`, 'info');
    const fileErrors = await checkRequiredFiles(projectPath, { preset, typescript: isTS });
    testResult.errors.push(...fileErrors);
    
    // Check package.json
    log(`Checking package.json...`, 'info');
    const pkgErrors = await checkPackageJson(projectPath);
    testResult.errors.push(...pkgErrors);
    
    // Check for TypeScript syntax in JS files
    if (!isTS) {
      log(`Checking for TypeScript syntax in JS files...`, 'info');
      const tsErrors = await checkForTsSyntaxInJsFiles(projectPath);
      if (tsErrors.length > 0) {
        for (const err of tsErrors) {
          testResult.errors.push(`TS syntax in JS: ${err.file}:${err.line} - ${err.content}`);
        }
      }
    }
    
    // Install dependencies
    log(`Installing dependencies...`, 'info');
    const installResult = runCommand('npm install', projectPath, true);
    if (!installResult.success) {
      testResult.errors.push(`npm install failed: ${installResult.error}`);
    }
    
    // For TypeScript projects, try to compile
    if (isTS && installResult.success) {
      log(`Compiling TypeScript...`, 'info');
      const buildResult = runCommand('npm run build', projectPath, true);
      if (!buildResult.success) {
        testResult.errors.push(`TypeScript compilation failed: ${buildResult.error}`);
      }
    }
    
    // Check for ESLint errors (if eslint is available)
    if (installResult.success) {
      log(`Running linter...`, 'info');
      const lintResult = runCommand('npm run lint 2>&1 || true', projectPath, true);
      if (lintResult.output && lintResult.output.includes('error')) {
        testResult.warnings.push('Linting warnings/errors found');
      }
    }
    
    // Determine result
    if (testResult.errors.length === 0) {
      log(`✓ PASSED: ${projectName}`, 'success');
      results.passed.push(testResult);
    } else {
      log(`✗ FAILED: ${projectName}`, 'error');
      for (const err of testResult.errors) {
        log(`  - ${err}`, 'error');
      }
      results.failed.push(testResult);
    }
    
    if (testResult.warnings.length > 0) {
      for (const warn of testResult.warnings) {
        log(`  ⚠ ${warn}`, 'warning');
      }
    }
    
  } catch (error) {
    testResult.errors.push(`Unexpected error: ${error.message}`);
    log(`✗ FAILED: ${projectName} - ${error.message}`, 'error');
    results.failed.push(testResult);
  }
  
  return testResult;
}

async function testAddCommands(projectPath) {
  log(`\n${'='.repeat(60)}`, 'info');
  log(`Testing add commands...`, 'info');
  log(`${'='.repeat(60)}`, 'info');
  
  const addCommands = [
    'vercel-cron',
    'github-actions',
    'supabase',
    'drizzle',
    'langfuse',
  ];
  
  const errors = [];
  
  for (const cmd of addCommands) {
    log(`Testing: nod add ${cmd}`, 'info');
    const result = runCommand(`node "${CLI_PATH}" add ${cmd}`, projectPath, true);
    if (!result.success) {
      errors.push(`add ${cmd} failed: ${result.error}`);
    }
  }
  
  return errors;
}

async function main() {
  log('\n🚀 nod-cli End-to-End Test Suite\n', 'info');
  
  // Ensure we're in the right directory
  process.chdir(ROOT_DIR);
  
  // Build the CLI first
  log('Building nod-cli...', 'info');
  const buildResult = runCommand('npm run build', ROOT_DIR, true);
  if (!buildResult.success) {
    log('Failed to build nod-cli', 'error');
    process.exit(1);
  }
  
  // Create test directory
  fs.ensureDirSync(TEST_DIR);
  
  // Run all combination tests
  const startTime = Date.now();
  
  for (const framework of FRAMEWORKS) {
    for (const language of LANGUAGES) {
      for (const preset of PRESETS) {
        await testProjectGeneration(framework, language, preset);
      }
    }
  }
  
  // Test add commands on a base project
  const addTestProject = path.join(TEST_DIR, 'test-add-commands');
  if (fs.existsSync(addTestProject)) {
    fs.removeSync(addTestProject);
  }
  
  log('\nGenerating base project for add command tests...', 'info');
  runCommand(`node "${CLI_PATH}" test-add-commands --preset minimal --framework express --yes`, TEST_DIR, true);
  
  if (fs.existsSync(addTestProject)) {
    const addErrors = await testAddCommands(addTestProject);
    if (addErrors.length > 0) {
      results.failed.push({
        name: 'add-commands',
        errors: addErrors,
      });
    } else {
      results.passed.push({
        name: 'add-commands',
        errors: [],
      });
    }
  }
  
  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log(`\n${'='.repeat(60)}`, 'info');
  log(`TEST SUMMARY`, 'info');
  log(`${'='.repeat(60)}`, 'info');
  log(`Duration: ${duration}s`, 'info');
  log(`Total: ${results.passed.length + results.failed.length}`, 'info');
  log(`Passed: ${results.passed.length}`, 'success');
  log(`Failed: ${results.failed.length}`, results.failed.length > 0 ? 'error' : 'info');
  
  if (results.failed.length > 0) {
    log(`\nFailed tests:`, 'error');
    for (const test of results.failed) {
      log(`  - ${test.name}`, 'error');
      for (const err of test.errors.slice(0, 5)) {
        log(`    ${err}`, 'error');
      }
      if (test.errors.length > 5) {
        log(`    ... and ${test.errors.length - 5} more errors`, 'error');
      }
    }
  }
  
  // Write detailed results to file
  const resultsPath = path.join(TEST_DIR, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  log(`\nDetailed results written to: ${resultsPath}`, 'info');
  
  // Cleanup option
  if (process.argv.includes('--cleanup')) {
    log('\nCleaning up test projects...', 'info');
    fs.removeSync(TEST_DIR);
  }
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(console.error);
