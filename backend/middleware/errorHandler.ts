// ============================================================
// Error Handler Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[ERROR]', err.message);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
  }

  // Unique constraint violation
  if (
    (err as any).code === '23505' ||
    (err as any).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    String((err as any).message || '').includes('UNIQUE constraint failed')
  ) {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  // JSON parse errors
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Default 500
  const status = (err as any).status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
