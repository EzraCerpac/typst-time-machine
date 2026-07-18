import { describe, expect, test } from "bun:test";

import { outputsMatch, pageRelation, phaseLabel, shortId, type RenderStatus } from "../../web/src/model";

function ready(hashes: string[]): RenderStatus {
  return {
    revision_key: "git:abc",
    phase: "ready",
    render_id: "a".repeat(64),
    pages: hashes.map((hash, index) => ({
      number: index + 1,
      file: `page-${index + 1}.svg`,
      hash,
    })),
  };
}

describe("visual comparison model", () => {
  test("classifies changed and added pages", () => {
    expect(pageRelation(ready(["a"]), ready(["b"]), 0)).toBe("changed");
    expect(pageRelation(ready(["a"]), ready(["a", "b"]), 1)).toBe("added");
    expect(pageRelation(ready(["a", "b"]), ready(["a"]), 1)).toBe("removed");
  });

  test("recognizes byte-identical document output", () => {
    expect(outputsMatch(ready(["a", "b"]), ready(["a", "b"]))).toBe(true);
    expect(outputsMatch(ready(["a"]), ready(["a", "b"]))).toBe(false);
  });

  test("keeps labels concise", () => {
    expect(shortId("1234567890")).toBe("12345678");
    expect(phaseLabel(ready(["a", "b"]))).toBe("2 pages");
  });
});
