import fs from 'fs-extra';
import * as path from 'path';

/**
 * Response Wrapper for Automatic Response Handling
 *
 * Features:
 * - Controllers just return data objects
 * - Automatic 200 status for successful responses
 * - Error handling with status codes from thrown errors
 * - Standard response format: { success, data, message }
 */

export async function generateResponseWrapper(projectPath: string, ext: string) {
  const content = ext === 'ts'
    ? `/**
 * Response Wrapper for Automatic Response Handling
 *
 * Usage:
 * - Controllers return { success, data, message } objects
 * - Services can throw errors with statusCode property
 * - Status 200 for success, 4xx/5xx for errors
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface ApiError extends Error {
  statusCode?: number;
}

/**
 * Wrap a controller response with proper status code
 * @param response - The response object from controller
 * @param res - Express response object
 * @param defaultStatus - Default status code (200 for success)
 */
export function wrapResponse(response: ApiResponse, res: any, defaultStatus = 200): void {
  if (response.success !== false) {
    // Successful response
    const statusCode = response.statusCode || defaultStatus;
    res.status(statusCode).json({
      success: true,
      ...(response.data !== undefined && { data: response.data }),
      ...(response.message && { message: response.message })
    });
  } else {
    // Error response
    const statusCode = response.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      ...(response.error && { error: response.error }),
      ...(response.message && { message: response.message })
    });
  }
}

/**
 * Wrap an async controller handler with automatic error handling
 *
 * @param handler - Async controller function that returns ApiResponse
 * @returns Wrapped handler with automatic response/error handling
 */
export function wrapHandler<T>(
  handler: (req: any, res: any) => Promise<ApiResponse<T>>
): (req: any, res: any, next: any) => void {
  return async (req: any, res: any, next: any) => {
    try {
      const response = await handler(req, res);
      wrapResponse(response, res);
    } catch (error) {
      // Handle errors with status codes
      const statusCode = (error as ApiError).statusCode || 500;
      const message = (error as Error).message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && (error as Error).stack && { stack: (error as Error).stack })
      });
    }
  };
}

/**
 * Create an error with status code
 */
export function createError(message: string, statusCode: number = 500): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  return error;
}

/**
 * Helper to create successful response
 */
export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Helper to create error response
 */
export function fail(message: string, statusCode: number = 400): ApiResponse {
  return {
    success: false,
    error: message,
    statusCode
  };
}
`
    : `/**
 * Response Wrapper for Automatic Response Handling
 *
 * Usage:
 * - Controllers return { success, data, message } objects
 * - Services can throw errors with statusCode property
 * - Status 200 for success, 4xx/5xx for errors
 */

/**
 * Wrap a controller response with proper status code
 * @param response - The response object from controller
 * @param res - Express response object
 * @param defaultStatus - Default status code (200 for success)
 */
export function wrapResponse(response, res, defaultStatus = 200) {
  if (response.success !== false) {
    // Successful response
    const statusCode = response.statusCode || defaultStatus;
    res.status(statusCode).json({
      success: true,
      ...(response.data !== undefined && { data: response.data }),
      ...(response.message && { message: response.message })
    });
  } else {
    // Error response
    const statusCode = response.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      ...(response.error && { error: response.error }),
      ...(response.message && { message: response.message })
    });
  }
}

/**
 * Wrap an async controller handler with automatic error handling
 *
 * @param handler - Async controller function that returns response object
 * @returns Wrapped handler with automatic response/error handling
 */
export function wrapHandler(handler) {
  return async (req, res, next) => {
    try {
      const response = await handler(req, res);
      wrapResponse(response, res);
    } catch (error) {
      // Handle errors with status codes
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && error.stack && { stack: error.stack })
      });
    }
  };
}

/**
 * Create an error with status code
 */
export function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Helper to create successful response
 */
export function success(data, message) {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Helper to create error response
 */
export function fail(message, statusCode = 400) {
  return {
    success: false,
    error: message,
    statusCode
  };
}
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/response-wrapper.${ext}`), content);
}
