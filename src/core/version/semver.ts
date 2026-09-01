/** Parse a semver string into a numeric triple (major, minor, patch). */
export function parseSemverTuple(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** @returns negative if a < b, positive if a > b, 0 if equal, null if unparsable */
export function compareSemver(a: string, b: string): number | null {
  const left = parseSemverTuple(a);
  const right = parseSemverTuple(b);
  if (!left || !right) {
    return null;
  }

  for (let i = 0; i < 3; i++) {
    if (left[i]! < right[i]!) {
      return -1;
    }
    if (left[i]! > right[i]!) {
      return 1;
    }
  }
  return 0;
}

/** Extract a semver string from CLI output or other noisy text. */
export function extractSemverString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
  return match?.[1] ?? null;
}
