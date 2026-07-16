/**
 * Typed domain errors (borrowed convention: consistent `{ code, message, context }` shape,
 * mirroring the reference project's exception-filter discipline).
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a file cannot be read or no converter supports its format. */
export class FileLoadError extends DomainError {
  readonly code = 'FILE_LOAD_ERROR';
}

/** Raised when a job spec fails validation (weights out of 1–5, missing fields, …). */
export class InvalidJobSpecError extends DomainError {
  readonly code = 'INVALID_JOB_SPEC';
}

/** Raised only for unrecoverable parsing failures — messy content degrades to warnings instead. */
export class ParseError extends DomainError {
  readonly code = 'PARSE_ERROR';
}

/** Raised by matching engines (LLM call failure, malformed response). Caught by fallback logic. */
export class EngineError extends DomainError {
  readonly code = 'ENGINE_ERROR';
}
