import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Where uploaded files are kept. Nothing outside the implementations knows where that is, so
 * production can switch to an S3-compatible store. Keys are paths like "guilds/<id>/<uuid>.webp".
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  /** The file, or null when there's none with that key. */
  read(key: string): Promise<Buffer | null>;
  /** Removes the file; does nothing when there's none. */
  delete(key: string): Promise<void>;
}

/** Files in a local folder: a Docker volume in development. */
export function localFileStorage(root: string): FileStorage {
  const base = resolve(root);
  const pathFor = (key: string) => {
    const path = resolve(join(base, key));
    // Keys come from our code, but never let one point outside the folder.
    if (!path.startsWith(base + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  };

  return {
    async save(key, data) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
    async read(key) {
      try {
        return await readFile(pathFor(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}

/** Files in memory, for tests. */
export function memoryFileStorage(): FileStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    save: (key, data) => {
      files.set(key, data);
      return Promise.resolve();
    },
    read: (key) => Promise.resolve(files.get(key) ?? null),
    delete: (key) => {
      files.delete(key);
      return Promise.resolve();
    },
  };
}
