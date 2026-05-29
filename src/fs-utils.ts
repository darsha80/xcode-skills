import { cp, lstat, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function copyDirectoryReplacing(source: string, destination: string): Promise<void> {
  await assertNoSymlinks(source);
  await removePath(destination);
  await mkdir(destination, { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    errorOnExist: false,
    force: true,
  });
}

async function assertNoSymlinks(path: string): Promise<void> {
  const entry = await lstat(path);
  if (entry.isSymbolicLink()) {
    throw new Error(`Resolved Skill Artifact contains symlink: ${path}`);
  }

  if (!entry.isDirectory()) {
    return;
  }

  const children = await readdir(path);
  await Promise.all(children.map((child) => assertNoSymlinks(join(path, child))));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
