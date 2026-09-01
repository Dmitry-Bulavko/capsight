import type { UnknownFieldType } from "../../core/model/index.js";

function sortedKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).sort();
}

export function describeValueType(value: unknown): UnknownFieldType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

export function redactUnknownFields(
  data: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
): Record<string, UnknownFieldType> {
  const unknownFields: Record<string, UnknownFieldType> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!knownKeys.has(key)) {
      unknownFields[key] = describeValueType(value);
    }
  }
  return unknownFields;
}

export function extractEnvKeys(config: Record<string, unknown>): string[] {
  return sortedKeys(config.env);
}

export function sortedObjectKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.keys(value).sort();
}
