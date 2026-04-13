import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const createJsonFileStore = <T>(filePath: string, defaults: () => T) => {
  const resolvedPath = path.resolve(filePath);

  const ensureFile = () => {
    const directory = path.dirname(resolvedPath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    if (!existsSync(resolvedPath)) {
      writeFileSync(resolvedPath, JSON.stringify(defaults(), null, 2), "utf8");
    }
  };

  const read = (): T => {
    ensureFile();
    try {
      return {
        ...defaults(),
        ...(JSON.parse(readFileSync(resolvedPath, "utf8")) as Partial<T>)
      } as T;
    } catch {
      return defaults();
    }
  };

  const write = (value: T) => {
    ensureFile();
    writeFileSync(resolvedPath, JSON.stringify(value, null, 2), "utf8");
    return value;
  };

  return {
    path: resolvedPath,
    read,
    write,
    update: (updater: (current: T) => T) => write(updater(read()))
  };
};
