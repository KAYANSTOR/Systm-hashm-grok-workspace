/**
 * Architecture guardrails — fail CI if UI routes import repository SQL layer directly.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function listFiles(dir: string, pred: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFiles(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}

describe("architecture guardrails", () => {
  it("routes must not import server/repository directly", () => {
    const routes = listFiles(join(ROOT, "src/routes"), (f) => f.endsWith(".tsx"));
    const violations: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      if (src.includes("server/repository") || src.includes("@/server/repository")) {
        violations.push(file.replace(ROOT + "/", ""));
      }
    }
    assert.deepEqual(violations, [], `Routes import repository: ${violations.join(", ")}`);
  });

  it("routes must not import domain operations for raw stock math (prefer store)", () => {
    // Soft rule: routes may call store only; allow labels/utils
    const routes = listFiles(join(ROOT, "src/routes"), (f) => f.endsWith(".tsx"));
    const violations: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      if (src.includes("applyInvoiceEffects") || src.includes("financial_transactions")) {
        violations.push(file.replace(ROOT + "/", ""));
      }
    }
    assert.deepEqual(violations, [], `Forbidden imports: ${violations.join(", ")}`);
  });
});
