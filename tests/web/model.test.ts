import { describe, expect, test } from "bun:test";

import {
  alignPages,
  findAlignedPair,
  layoutRevisionGraph,
  outputsMatch,
  pageRelation,
  phaseLabel,
  selectionForAlignedPair,
  shortId,
  type PageArtifact,
  type RenderStatus,
  type Revision,
} from "../../web/src/model";

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

function pages(hashes: string[]): PageArtifact[] {
  return ready(hashes).pages;
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

  test("keeps identical pages paired without reporting a shift", () => {
    const alignment = alignPages(pages(["a", "b", "c"]), pages(["a", "b", "c"]));

    expect(alignment.shifted).toBe(false);
    expect(alignment.confidence).toBe("high");
    expect(alignment.pairs.map(({ leftIndex, rightIndex, relation }) => [leftIndex, rightIndex, relation])).toEqual([
      [0, 0, "same"],
      [1, 1, "same"],
      [2, 2, "same"],
    ]);
  });

  test.each([
    ["start", ["a", "b", "c"], ["x", "a", "b", "c"], 0],
    ["middle", ["a", "b", "c"], ["a", "x", "b", "c"], 1],
    ["end", ["a", "b", "c"], ["a", "b", "c", "x"], 3],
  ])("aligns an insertion at the %s", (_label: string, left: string[], right: string[], addedIndex: number) => {
    const alignment = alignPages(pages(left), pages(right));

    expect(alignment.shifted).toBe(true);
    expect(alignment.confidence).toBe("high");
    expect(alignment.pairs).toContainEqual({
      leftIndex: null,
      rightIndex: addedIndex,
      relation: "added",
      confidence: "high",
    });
  });

  test.each([
    ["start", ["x", "a", "b", "c"], ["a", "b", "c"], 0],
    ["middle", ["a", "x", "b", "c"], ["a", "b", "c"], 1],
    ["end", ["a", "b", "c", "x"], ["a", "b", "c"], 3],
  ])("aligns a deletion at the %s", (_label: string, left: string[], right: string[], removedIndex: number) => {
    const alignment = alignPages(pages(left), pages(right));

    expect(alignment.shifted).toBe(true);
    expect(alignment.confidence).toBe("high");
    expect(alignment.pairs).toContainEqual({
      leftIndex: removedIndex,
      rightIndex: null,
      relation: "removed",
      confidence: "high",
    });
  });

  test("pairs an equal changed span only when exact anchors bound it", () => {
    const alignment = alignPages(pages(["a", "old", "c"]), pages(["a", "new", "c"]));

    expect(alignment.pairs).toContainEqual({
      leftIndex: 1,
      rightIndex: 1,
      relation: "changed",
      confidence: "medium",
    });
  });

  test("does not infer changed pairs from a weak document-edge anchor", () => {
    const alignment = alignPages(pages(["old", "a"]), pages(["new", "a"]));

    expect(alignment.pairs.slice(0, 2).map(({ leftIndex, rightIndex, relation }) => [leftIndex, rightIndex, relation])).toEqual([
      [0, null, "removed"],
      [null, 0, "added"],
    ]);
  });

  test("suppresses duplicate-only anchors", () => {
    const alignment = alignPages(pages(["blank", "blank"]), pages(["blank", "new", "blank"]));

    expect(alignment).toEqual({ pairs: [], confidence: null, shifted: false, anchorCount: 2 });
  });

  test("downgrades duplicate anchors when a unique anchor makes alignment usable", () => {
    const alignment = alignPages(pages(["blank", "a", "blank"]), pages(["x", "blank", "a", "blank"]));
    const duplicatePair = alignment.pairs.find(
      (pair) => pair.leftIndex === 0 && pair.rightIndex === 1,
    );

    expect(alignment.confidence).toBe("medium");
    expect(duplicatePair?.confidence).toBe("medium");
  });

  test("does not claim alignment without a shared exact page", () => {
    expect(alignPages(pages(["a", "b"]), pages(["x", "y"]))).toEqual({
      pairs: [],
      confidence: null,
      shifted: false,
      anchorCount: 0,
    });
  });

  test("keeps unequal changed regions separate across multiple shifts", () => {
    const alignment = alignPages(
      pages(["a", "removed", "b", "c", "d"]),
      pages(["a", "b", "added", "c", "d"]),
    );

    expect(alignment.pairs.map(({ leftIndex, rightIndex, relation }) => [leftIndex, rightIndex, relation])).toEqual([
      [0, 0, "same"],
      [1, null, "removed"],
      [2, 1, "same"],
      [null, 2, "added"],
      [3, 3, "same"],
      [4, 4, "same"],
    ]);
  });

  test("returns a new selection only for an explicit complete pair", () => {
    const alignment = alignPages(pages(["a", "b"]), pages(["x", "a", "b"]));
    const pair = findAlignedPair(alignment, "right", 2);
    const before = { pageA: 0, pageB: 2 };

    expect(before).toEqual({ pageA: 0, pageB: 2 });
    expect(pair && selectionForAlignedPair(pair)).toEqual({ pageA: 1, pageB: 2 });
    expect(before).toEqual({ pageA: 0, pageB: 2 });
    expect(selectionForAlignedPair(alignment.pairs[0])).toBeUndefined();
  });

  test("keeps labels concise", () => {
    expect(shortId("1234567890")).toBe("12345678");
    expect(phaseLabel(ready(["a", "b"]))).toBe("2 pages");
  });

  test("lays merge history onto separate lanes", () => {
    const revision = (id: string, parents: string[]): Revision => ({
      key: `git:${id}`,
      commit_id: id,
      parent_ids: parents,
      subject: id,
      author: "Test",
      author_email: "test@example.com",
      authored_at: "2026-07-18T00:00:00Z",
      committed_at: "2026-07-18T00:00:00Z",
      committer_unix: 0,
      bookmarks: [],
      changed_paths: [],
    });
    const revisions = [
      revision("merge", ["main", "branch"]),
      revision("main", ["base"]),
      revision("branch", ["base"]),
      revision("base", []),
    ];
    const graph = layoutRevisionGraph(
      revisions,
      revisions.map((item) => item.key),
    );

    expect(graph.laneCount).toBe(2);
    expect(graph.edges).toHaveLength(4);
    expect(graph.nodes.map((node) => node.row)).toEqual([0, 1, 2, 3]);
    expect(graph.edges.find((edge) => edge.child === "git:merge" && edge.parent === "git:branch")?.merge).toBe(
      true,
    );
  });
});
