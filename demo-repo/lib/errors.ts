import { slug } from "./utils";

export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof AppError) {
    return error.code + ": " + error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown";
}

export function errorCode(message: string): string {
  const dashed = slug(message);
  if (dashed.length === 0) {
    return "error";
  }
  return dashed.slice(0, 24);
}
