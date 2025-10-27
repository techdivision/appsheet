/**
 * Error types for AppSheet operations
 */

/**
 * Base error class for AppSheet operations
 */
export class AppSheetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppSheetError';
    Object.setPrototypeOf(this, AppSheetError.prototype);
  }
}

/**
 * Authentication/authorization error
 */
export class AuthenticationError extends AppSheetError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Validation error (invalid input)
 */
export class ValidationError extends AppSheetError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppSheetError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AppSheetError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT', 429, details);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Network/connection error
 */
export class NetworkError extends AppSheetError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', undefined, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
