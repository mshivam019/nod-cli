import fs from 'fs-extra';
import * as path from 'path';

/**
 * Migrate controllers to use next(error) pattern
 *
 * Controllers should:
 * 1. Accept (req, res, next) parameters
 * 2. Call next(error) on exceptions
 * 3. Return response objects (not call res.json directly)
 */

export async function migrateControllers(projectPath: string, ext: string) {
  const controllersDir = path.join(projectPath, 'src/controllers');

  if (!await fs.pathExists(controllersDir)) {
    console.log('No controllers directory found');
    return;
  }

  const controllerFiles = await glob(controllersDir, `.${ext === 'ts' ? 'ts' : 'js'}`);

  for (const controllerFile of controllerFiles) {
    await migrateControllerFile(controllerFile, ext);
  }
}

async function glob(dir: string, suffix: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(suffix) && !entry.name.includes('.d.')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      files.push(...await glob(fullPath, suffix));
    }
  }

  return files;
}

async function migrateControllerFile(filePath: string, ext: string) {
  let content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath, `.${ext === 'ts' ? 'ts' : 'js'}`);

  // Skip if already using next(error) pattern
  if (content.includes('next(error)') || content.includes('next (error)')) {
    console.log(`✓ Skipping ${fileName} - already using next(error) pattern`);
    return;
  }

  // Check if this is a controller file
  const isController = content.includes('Controller') ||
                       content.includes('controller') ||
                       content.includes('export const');

  if (!isController) {
    console.log(`⚠ Skipping ${fileName} - not a controller file`);
    return;
  }

  // Add NextFunction import if needed
  if (ext === 'ts') {
    content = content.replace(
      /import\s+\{\s*Request,\s*Response\s*\}\s*from\s*['"]express['"]/,
      "import { Request, Response, NextFunction } from 'express'"
    );
  }

  // Convert controller methods to use next(error)
  // Pattern: async method(req, res) { try { ... } catch (error) { res.status(500).json(...) } }
  // To: async method(req, res, next) { try { ... } catch (error) { next(error) } }

  content = content.replace(
    /catch\s*\(\s*error\s*\)\s*\{[\s\S]*?res\.status\(\d+\)\.json\([^)]+\)[\s\S]*?\}/g,
    `catch (error) {
      next(error);
    }`
  );

  // Convert res.json({ success: true, data: ... }) to return { success: true, data: ... }
  content = content.replace(
    /return\s+res\.json\(\{[\s\S]*?success:\s*true[^}]*\}\)(\s*;)?/g,
    (match) => {
      // Extract the JSON object
      const jsonMatch = match.match(/res\.json\s*\(\s*(\{[^}]+\})\s*\)/);
      if (jsonMatch) {
        return `return ${jsonMatch[1]};`;
      }
      return match;
    }
  );

  // Convert res.status(x).json(...) to return { ..., statusCode: x }
  content = content.replace(
    /res\.status\((\d+)\)\.json\(\{([^}]+)\}\)/g,
    (match, statusCode, jsonContent) => {
      return `return { ${jsonContent}, statusCode: ${statusCode} };`;
    }
  );

  await fs.outputFile(filePath, content);
  console.log(`✓ Migrated ${fileName} controller`);
}
