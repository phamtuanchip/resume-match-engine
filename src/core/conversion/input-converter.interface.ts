import * as path from 'path';
import type { FileLoader } from '@common/io';
import { SourceInfo } from '@core/canonical';

/**
 * Source-agnostic input descriptor: a file today, an HRM/API payload tomorrow.
 * Converters only look at what is present; filesystem reads happen upstream (common/io).
 */
export interface SourceDescriptor {
  uri: string; // file path today; URL or HRM record ref later
  origin: 'file' | 'api' | 'hrm';
  ext?: string;
  mime?: string;
  bytes?: Buffer;
  text?: string;
  payload?: unknown; // already-structured object (e.g. an HRM API response)
}

/** Every conversion carries warnings, so graceful degradation flows through the layer. */
export interface ConversionResult<T> {
  value: T;
  warnings: string[];
}

/** Intermediate output of resume converters: canonical text awaiting parsing enrichment. */
export interface RawResume {
  id: string;
  source: SourceInfo;
  text: string;
  warnings: string[];
}

/** Strategy: one implementation per input format. Adding a format = one class + one registration. */
export interface InputConverter<TCanonical> {
  readonly kind: 'resume' | 'job';
  readonly name: string;
  supports(source: SourceDescriptor): boolean;
  convert(source: SourceDescriptor): Promise<ConversionResult<TCanonical>>;
}

/**
 * Filename component of a source uri, normalizing Windows separators on any platform (path.basename
 * only splits on the host separator, so a Windows path handed to a posix host would not split).
 */
export function baseName(uri: string): string {
  return uri.replace(/\\/g, '/').split('/').pop() ?? uri;
}

/**
 * Factory for a file-backed SourceDescriptor. Every use case that feeds a file into the
 * converter layer needs the same {uri, origin, ext, bytes} shape — this keeps that assembly
 * (and the disk read via FileLoader) in one place.
 */
export function fileSource(loader: FileLoader, uri: string): SourceDescriptor {
  return {
    uri,
    origin: 'file',
    ext: path.extname(uri).toLowerCase(),
    bytes: loader.readBytes(uri),
  };
}

/** Derives a stable id slug from a source uri (filename without extension). */
export function sourceId(uri: string): string {
  const base = baseName(uri);
  return base
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
