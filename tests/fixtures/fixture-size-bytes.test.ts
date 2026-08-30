import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_FIXTURE_NAMES,
  PLATFORM_FIXTURE_NAMES,
  inspectFixtureCorpus,
  platformFixturesRoot,
  type PlatformId,
} from "./coverage-report.js";

interface InstructionGolden {
  path?: string;
  sizeBytes?: number;
}

interface SizeByteMismatch {
  platform: PlatformId;
  fixture: string;
  instructionPath: string;
  goldenSizeBytes: number;
  onDiskSizeBytes: number;
}

/**
 * Every `discovery.instructions[].sizeBytes` in a golden must match the byte
 * length of the corresponding file under `project/`. CRLF vs LF shifts sizes
 * by one byte per line and breaks goldens on Linux CI (same class as D1-09).
 */
export function findInstructionSizeByteMismatches(
  platform: PlatformId,
  fixtureNames: readonly string[],
): SizeByteMismatch[] {
  const fixturesRoot = platformFixturesRoot(platform);
  const mismatches: SizeByteMismatch[] = [];

  for (const fixtureName of fixtureNames) {
    const status = inspectFixtureCorpus(fixturesRoot, [fixtureName])[0];
    if (!status || status.completeness !== "complete") {
      continue;
    }

    const fixtureDir = path.join(fixturesRoot, fixtureName);
    const expectedPath = path.join(fixtureDir, "expected.json");
    const parsed = JSON.parse(fs.readFileSync(expectedPath, "utf8")) as {
      discovery?: { instructions?: InstructionGolden[] };
    };

    for (const instruction of parsed.discovery?.instructions ?? []) {
      if (instruction.path === undefined || instruction.sizeBytes === undefined) {
        continue;
      }

      const filePath = path.join(fixtureDir, "project", instruction.path);
      if (!fs.existsSync(filePath)) {
        mismatches.push({
          platform,
          fixture: fixtureName,
          instructionPath: instruction.path,
          goldenSizeBytes: instruction.sizeBytes,
          onDiskSizeBytes: -1,
        });
        continue;
      }

      const onDiskSizeBytes = fs.statSync(filePath).size;
      if (onDiskSizeBytes !== instruction.sizeBytes) {
        mismatches.push({
          platform,
          fixture: fixtureName,
          instructionPath: instruction.path,
          goldenSizeBytes: instruction.sizeBytes,
          onDiskSizeBytes,
        });
      }
    }
  }

  return mismatches;
}

function formatMismatch(mismatch: SizeByteMismatch): string {
  if (mismatch.onDiskSizeBytes < 0) {
    return `${mismatch.platform}/${mismatch.fixture} ${mismatch.instructionPath}: missing file (golden ${mismatch.goldenSizeBytes})`;
  }
  return (
    `${mismatch.platform}/${mismatch.fixture} ${mismatch.instructionPath}: ` +
    `golden ${mismatch.goldenSizeBytes} !== disk ${mismatch.onDiskSizeBytes}`
  );
}

describe("fixture instruction sizeBytes", () => {
  it("matches on-disk byte length for every Claude golden", () => {
    const mismatches = findInstructionSizeByteMismatches("claude", CLAUDE_FIXTURE_NAMES);
    expect(mismatches.map(formatMismatch), mismatches.map(formatMismatch).join("\n")).toEqual([]);
  });

  for (const platform of ["cursor", "codex"] as const) {
    it(`matches on-disk byte length for every ${platform} golden`, () => {
      const mismatches = findInstructionSizeByteMismatches(
        platform,
        PLATFORM_FIXTURE_NAMES[platform],
      );
      expect(mismatches.map(formatMismatch), mismatches.map(formatMismatch).join("\n")).toEqual(
        [],
      );
    });
  }
});
