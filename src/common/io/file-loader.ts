import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { FileLoadError } from '@common/errors';

/** Filesystem access for input files. The only place that touches raw disk reads. */
@Injectable()
export class FileLoader {
  /** Returns the file itself, or all files (non-recursive) if the path is a directory. */
  listFiles(inputPath: string, extensions?: string[]): string[] {
    if (!fs.existsSync(inputPath)) {
      throw new FileLoadError(`Path not found: ${inputPath}`, { path: inputPath });
    }
    const stat = fs.statSync(inputPath);
    const files = stat.isDirectory()
      ? fs
          .readdirSync(inputPath)
          .map((f) => path.join(inputPath, f))
          .filter((f) => fs.statSync(f).isFile())
      : [inputPath];
    const filtered = extensions
      ? files.filter((f) => extensions.includes(path.extname(f).toLowerCase()))
      : files;
    return filtered.sort();
  }

  readText(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new FileLoadError(`Cannot read file: ${filePath}`, { cause: String(err) });
    }
  }

  readBytes(filePath: string): Buffer {
    try {
      return fs.readFileSync(filePath);
    } catch (err) {
      throw new FileLoadError(`Cannot read file: ${filePath}`, { cause: String(err) });
    }
  }
}
