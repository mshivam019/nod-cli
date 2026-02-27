import fs from "fs-extra";
import * as path from "path";

/**
 * Router Configuration - Simple Re-export
 *
 * This file provides convenient access to router utilities
 */

export async function generateRouterConfigSimple(
  projectPath: string,
  ext: string,
) {
  const content = `/**
 * Router Configuration
 *
 * Import from here to get:
 * - METHODS: HTTP method constants (METHODS.GET, METHODS.POST, etc.)
 * - createConfiguredRouter: Create router with registered middlewares
 * - success: Create successful response
 * - fail: Create error response
 * - createError: Create error with status code
 */

export { METHODS, createConfiguredRouter, success, fail, createError } from '../helpers/route-builder.js';
`;

  await fs.outputFile(
    path.join(projectPath, `src/config/router.${ext}`),
    content,
  );
}
