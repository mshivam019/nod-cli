import fs from 'fs-extra';
import * as path from 'path';

export async function migrateControllers(projectPath: string, ext: string) {
  const controllersDir = path.join(projectPath, 'src/controllers');

  if (!await fs.pathExists(controllersDir)) {
    console.log('No controllers directory found, skipping controller migration');
    return;
  }

  const controllerFiles = await glob(controllersDir, `*.${ext === 'ts' ? 'ts' : 'js'}`);

  for (const controllerFile of controllerFiles) {
    await migrateControllerFile(controllerFile, ext);
  }
}

async function glob(dir: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(pattern) && !entry.name.includes('.d.')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      files.push(...await glob(fullPath, pattern));
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
  if (!content.includes('Controller') && !content.includes('controller')) {
    console.log(`⚠ Skipping ${fileName} - not a controller file`);
    return;
  }

  const newContent = convertControllerToErrorHandlingPattern(content, ext);

  await fs.outputFile(filePath, newContent);
  console.log(`✓ Migrated ${fileName} controller to next(error) pattern`);
}

function convertControllerToErrorHandlingPattern(content: string, ext: string): string {
  const isTS = ext === 'ts';

  // Add next parameter if not present
  if (isTS) {
    // Add NextFunction import if needed
    if (content.includes('Request, Response') && !content.includes('NextFunction')) {
      content = content.replace(
        /import\s+\{\s*Request,\s*Response\s*\}\s*from\s*['"]express['"]/,
        "import { Request, Response, NextFunction } from 'express'"
      );
    }

    // Add next parameter to controller methods that don't have it
    content = content.replace(
      /(\s+)(async\s+\w+\([^)]*\):\s*\w+\s*\{)/g,
      (match, prefix, methodSig) => {
        if (methodSig.includes('next')) return match;
        return `${prefix}${methodSig.replace('(', '(req: Request, res: Response, next: NextFunction): void => {')}`;
      }
    );
  } else {
    // Add next parameter to controller methods that don't have it
    content = content.replace(
      /(\s+)(async\s+\w+\([^)]*\)\s*=>\s*\{)/g,
      (match, prefix, methodSig) => {
        if (methodSig.includes('next')) return match;
        return `${prefix}${methodSig.replace('(', '(req, res, next) => {')}`;
      }
    );

    content = content.replace(
      /(\s+)(\w+\s*\([^)]*\)\s*=>\s*\{)/g,
      (match, prefix, methodSig) => {
        if (methodSig.includes('next')) return match;
        return `${prefix}${methodSig.replace('(', '(req, res, next) => {')}`;
      }
    );
  }

  // Replace try-catch blocks to use next(error)
  content = content.replace(
    /\}\s*\}\s*catch\s*\(\s*error\s*\)\s*\{\s*return\s+res\.status\(\d+\)\.json\(\{[^}]*\}\)/g,
    (match) => {
      // Extract the status code and response
      const statusMatch = match.match(/res\.status\((\d+)\)/);
      const errorMsgMatch = match.match(/error:\s*['"]([^'"]+)['"]/);

      if (statusMatch && errorMsgMatch) {
        const statusCode = statusMatch[1];
        const errorMsg = errorMsgMatch[1];
        return `    } catch (error) {
      next(error);`;
      }

      return match.replace(
        /catch\s*\(\s*error\s*\)\s*\{[^}]+\}/,
        `catch (error) {
      next(error);`
      );
    }
  );

  // Handle complex catch blocks with multiple properties
  content = content.replace(
    /catch\s*\(\s*error\s*\)\s*\{[\s\S]*?return\s+res\.status\((\d+)\)\.json\(\{[\s\S]*?\}\);?[\s\S]*?\}/g,
    (match) => {
      return `    } catch (error) {
      next(error);`;
    }
  );

  return content;
}
