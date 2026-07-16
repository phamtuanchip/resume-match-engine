import { JsonFileStore } from '@common/io';

/**
 * Generic repository seam (borrowed from the reference project's BaseRepository<T>).
 * Backed by a JSON file store here; a real database can drop in behind the same contract.
 */
export abstract class BaseRepository<T extends { id: string }> {
  abstract save(entity: T): void;
  abstract findById(id: string): T | null;
  abstract findAll(): T[];
  abstract delete(id: string): void;
}

export class JsonFileRepository<T extends { id: string }> extends BaseRepository<T> {
  constructor(private readonly store: JsonFileStore<T>) {
    super();
  }

  save(entity: T): void {
    this.store.save(entity.id, entity);
  }

  findById(id: string): T | null {
    return this.store.load(id);
  }

  findAll(): T[] {
    return this.store.loadAll();
  }

  delete(id: string): void {
    this.store.delete(id);
  }
}
