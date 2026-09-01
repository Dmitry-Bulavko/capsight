export async function withMatrixPatch<T extends { id: string }>(
  matrix: readonly T[],
  id: string,
  patch: Partial<T>,
  body: () => Promise<void>,
): Promise<void> {
  const entry = matrix.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Matrix entry not found: ${id}`);
  }
  const original = { ...entry };
  Object.assign(entry, patch);
  try {
    await body();
  } finally {
    for (const key of Object.keys(entry) as Array<keyof T>) {
      delete (entry as unknown as Record<string, unknown>)[key as string];
    }
    Object.assign(entry, original);
  }
}

export function withMatrixPatchSync<T extends { id: string }>(
  matrix: readonly T[],
  id: string,
  patch: Partial<T>,
  body: () => void,
): void {
  const entry = matrix.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Matrix entry not found: ${id}`);
  }
  const original = { ...entry };
  Object.assign(entry, patch);
  try {
    body();
  } finally {
    for (const key of Object.keys(entry) as Array<keyof T>) {
      delete (entry as unknown as Record<string, unknown>)[key as string];
    }
    Object.assign(entry, original);
  }
}
