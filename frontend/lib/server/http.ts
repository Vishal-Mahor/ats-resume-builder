import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (
    (error as { code?: string })?.code === '23505' ||
    (error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    String((error as { message?: string })?.message || '').includes('UNIQUE constraint failed')
  ) {
    return NextResponse.json({ error: 'Resource already exists' }, { status: 409 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  console.error('[route error]', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
