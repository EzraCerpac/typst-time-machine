export type RenderPhase =
  | "queued"
  | "materializing"
  | "compiling"
  | "ready"
  | "entrypoint_missing"
  | "error";

export interface PageArtifact {
  number: number;
  file: string;
  hash: string;
}

export interface RenderStatus {
  revision_key: string;
  phase: RenderPhase;
  message?: string;
  render_id?: string;
  pages: PageArtifact[];
}

export interface Revision {
  key: string;
  commit_id: string;
  change_id?: string;
  parent_ids: string[];
  subject: string;
  author: string;
  author_email: string;
  authored_at: string;
  committed_at: string;
  committer_unix: number;
  bookmarks: string[];
  changed_paths: string[];
  render?: RenderStatus;
}

export interface Session {
  repository: {
    kind: "git" | "jj";
    root: string;
    identity: string;
    operation_id?: string;
  };
  target: {
    name?: string;
    entry: string;
    root: string;
    history_paths: string[];
    font_paths: string[];
    inputs: Record<string, string>;
    package_path?: string;
    package_cache_path?: string;
    typst?: string;
  };
  compiler: string;
  history: {
    limit: number;
    max_limit: number;
    first_parent_keys: string[];
    full_tree_keys: string[];
  };
  revisions: Revision[];
}

export type HistoryMode = "first-parent" | "full-tree";

export interface GraphNode {
  key: string;
  row: number;
  lane: number;
}

export interface GraphEdge {
  child: string;
  parent: string;
  merge: boolean;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  laneCount: number;
}

export type AlignmentConfidence = "high" | "medium";

export type AlignedPageRelation = "same" | "changed" | "added" | "removed";

export interface AlignedPagePair {
  leftIndex: number | null;
  rightIndex: number | null;
  relation: AlignedPageRelation;
  confidence: AlignmentConfidence;
}

export interface PageAlignment {
  pairs: AlignedPagePair[];
  confidence: AlignmentConfidence | null;
  shifted: boolean;
  anchorCount: number;
}

export interface PageSelection {
  pageA: number;
  pageB: number;
}

export function clampPageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.min(Math.max(index, 0), pageCount - 1);
}

export interface HistorySelection {
  selectedKey: string;
  pinnedKey: string;
  selectedReset: boolean;
  pinnedReset: boolean;
}

export function reconcileHistorySelection(
  revisions: Pick<Revision, "key" | "commit_id" | "parent_ids">[],
  visibleKeys: string[],
  previousSelectedKey: string,
  previousPinnedKey: string,
): HistorySelection {
  if (visibleKeys.length === 0) {
    throw new Error("cannot select from empty history");
  }
  const selectedKey = visibleKeys.includes(previousSelectedKey)
    ? previousSelectedKey
    : visibleKeys[visibleKeys.length - 1];
  const revisionKeys = new Set(revisions.map((revision) => revision.key));
  const selectedRevision = revisions.find((revision) => revision.key === selectedKey);
  const revisionByCommit = new Map(
    revisions.map((revision) => [revision.commit_id, revision.key]),
  );
  const parentKey = selectedRevision?.parent_ids
    .map((commit) => revisionByCommit.get(commit))
    .find((key) => key != null);
  const pinnedKey = revisionKeys.has(previousPinnedKey)
    ? previousPinnedKey
    : (parentKey ?? selectedKey);
  return {
    selectedKey,
    pinnedKey,
    selectedReset: selectedKey !== previousSelectedKey,
    pinnedReset: pinnedKey !== previousPinnedKey,
  };
}

interface PageAnchor {
  leftIndex: number;
  rightIndex: number;
  unique: boolean;
}

const MAX_ALIGNMENT_CELLS = 250_000;

export type PageRelation = "same" | "changed" | "added" | "removed" | "waiting";

export function pageRelation(
  left: RenderStatus | undefined,
  right: RenderStatus | undefined,
  pageIndex: number,
): PageRelation {
  if (left?.phase !== "ready" || right?.phase !== "ready") return "waiting";
  const a = left.pages[pageIndex];
  const b = right.pages[pageIndex];
  if (!a && b) return "added";
  if (a && !b) return "removed";
  if (!a || !b) return "waiting";
  return a.hash === b.hash ? "same" : "changed";
}

export function outputsMatch(
  newer: RenderStatus | undefined,
  older: RenderStatus | undefined,
): boolean {
  if (newer?.phase !== "ready" || older?.phase !== "ready") return false;
  if (newer.pages.length !== older.pages.length) return false;
  return newer.pages.every((page, index) => page.hash === older.pages[index]?.hash);
}

/**
 * Align two ordered page sequences using only byte-identical rendered pages.
 *
 * Exact pages form monotonic LCS anchors. Equal-sized gaps between anchors may
 * represent changed pages and are paired positionally. Unequal gaps stay
 * separate because guessing through an insertion or deletion would silently
 * recreate the physical-page mismatch this alignment is meant to avoid.
 */
export function alignPages(
  leftPages: readonly PageArtifact[],
  rightPages: readonly PageArtifact[],
): PageAlignment {
  const anchors = pageAnchors(leftPages, rightPages);
  const uniqueAnchorCount = anchors.filter((anchor) => anchor.unique).length;

  // Repeated blank or boilerplate pages are not enough evidence for alignment.
  if (uniqueAnchorCount === 0) {
    return {
      pairs: [],
      confidence: null,
      shifted: false,
      anchorCount: anchors.length,
    };
  }

  const highAnchors = highConfidenceAnchors(anchors);
  const pairs: AlignedPagePair[] = [];
  let previousLeft = -1;
  let previousRight = -1;

  anchors.forEach((anchor, anchorIndex) => {
    appendGap(
      pairs,
      previousLeft + 1,
      anchor.leftIndex,
      previousRight + 1,
      anchor.rightIndex,
      boundaryConfidence(highAnchors, anchorIndex - 1, anchorIndex),
      anchorIndex > 0,
    );
    pairs.push({
      leftIndex: anchor.leftIndex,
      rightIndex: anchor.rightIndex,
      relation: "same",
      confidence: anchor.unique && highAnchors.has(anchorIndex) ? "high" : "medium",
    });
    previousLeft = anchor.leftIndex;
    previousRight = anchor.rightIndex;
  });

  appendGap(
    pairs,
    previousLeft + 1,
    leftPages.length,
    previousRight + 1,
    rightPages.length,
    boundaryConfidence(highAnchors, anchors.length - 1, anchors.length),
    false,
  );

  return {
    pairs,
    confidence: highAnchors.size > 0 ? "high" : "medium",
    shifted: pairs.some(
      (pair) =>
        pair.leftIndex === null ||
        pair.rightIndex === null ||
        pair.leftIndex !== pair.rightIndex,
    ),
    anchorCount: anchors.length,
  };
}

export function findAlignedPair(
  alignment: PageAlignment,
  side: "left" | "right",
  pageIndex: number,
): AlignedPagePair | undefined {
  return alignment.pairs.find((pair) =>
    side === "left" ? pair.leftIndex === pageIndex : pair.rightIndex === pageIndex,
  );
}

/** Return a new selection only after the caller handles an explicit user action. */
export function selectionForAlignedPair(pair: AlignedPagePair): PageSelection | undefined {
  if (pair.leftIndex === null || pair.rightIndex === null) return undefined;
  return { pageA: pair.leftIndex, pageB: pair.rightIndex };
}

function pageAnchors(
  leftPages: readonly PageArtifact[],
  rightPages: readonly PageArtifact[],
): PageAnchor[] {
  if ((leftPages.length + 1) * (rightPages.length + 1) > MAX_ALIGNMENT_CELLS) return [];

  const leftCounts = hashCounts(leftPages);
  const rightCounts = hashCounts(rightPages);
  const lengths = Array.from({ length: leftPages.length + 1 }, () =>
    Array<number>(rightPages.length + 1).fill(0),
  );

  for (let left = leftPages.length - 1; left >= 0; left -= 1) {
    for (let right = rightPages.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        leftPages[left].hash === rightPages[right].hash
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const anchors: PageAnchor[] = [];
  let left = 0;
  let right = 0;
  while (left < leftPages.length && right < rightPages.length) {
    const hash = leftPages[left].hash;
    if (hash === rightPages[right].hash) {
      anchors.push({
        leftIndex: left,
        rightIndex: right,
        unique: leftCounts.get(hash) === 1 && rightCounts.get(hash) === 1,
      });
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      // Stable tie-break: advance left before right.
      left += 1;
    } else {
      right += 1;
    }
  }
  return anchors;
}

function hashCounts(pages: readonly PageArtifact[]): Map<string, number> {
  const counts = new Map<string, number>();
  pages.forEach((page) => counts.set(page.hash, (counts.get(page.hash) ?? 0) + 1));
  return counts;
}

function highConfidenceAnchors(anchors: readonly PageAnchor[]): Set<number> {
  const high = new Set<number>();
  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];
    if (
      previous.unique &&
      current.unique &&
      current.leftIndex === previous.leftIndex + 1 &&
      current.rightIndex === previous.rightIndex + 1
    ) {
      high.add(index - 1);
      high.add(index);
    }
  }
  return high;
}

function boundaryConfidence(
  highAnchors: ReadonlySet<number>,
  previousAnchor: number,
  nextAnchor: number,
): AlignmentConfidence {
  return highAnchors.has(previousAnchor) || highAnchors.has(nextAnchor) ? "high" : "medium";
}

function appendGap(
  pairs: AlignedPagePair[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  confidence: AlignmentConfidence,
  bounded: boolean,
): void {
  const leftLength = leftEnd - leftStart;
  const rightLength = rightEnd - rightStart;
  if (bounded && leftLength === rightLength) {
    for (let offset = 0; offset < leftLength; offset += 1) {
      pairs.push({
        leftIndex: leftStart + offset,
        rightIndex: rightStart + offset,
        relation: "changed",
        confidence: "medium",
      });
    }
    return;
  }

  for (let left = leftStart; left < leftEnd; left += 1) {
    pairs.push({ leftIndex: left, rightIndex: null, relation: "removed", confidence });
  }
  for (let right = rightStart; right < rightEnd; right += 1) {
    pairs.push({ leftIndex: null, rightIndex: right, relation: "added", confidence });
  }
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function phaseLabel(status: RenderStatus | undefined): string {
  switch (status?.phase) {
    case "queued":
      return "Waiting";
    case "materializing":
      return "Reading revision";
    case "compiling":
      return "Typesetting";
    case "ready":
      return `${status.pages.length} page${status.pages.length === 1 ? "" : "s"}`;
    case "entrypoint_missing":
      return "No document";
    case "error":
      return "Could not render";
    default:
      return "Not rendered";
  }
}

export function layoutRevisionGraph(revisions: Revision[], newestFirstKeys: string[]): GraphLayout {
  const byKey = new Map(revisions.map((revision) => [revision.key, revision]));
  const keyByCommit = new Map(revisions.map((revision) => [revision.commit_id, revision.key]));
  const visibleCommits = new Set(
    newestFirstKeys.map((key) => byKey.get(key)?.commit_id).filter((id): id is string => Boolean(id)),
  );
  const active: string[] = [];
  const nodes: GraphNode[] = [];

  newestFirstKeys.forEach((key, order) => {
    const revision = byKey.get(key);
    if (!revision) return;
    let lane = active.indexOf(revision.commit_id);
    if (lane < 0) {
      lane = active.length;
    } else {
      active.splice(lane, 1);
    }
    nodes.push({ key, row: order, lane });

    revision.parent_ids
      .filter((parent) => visibleCommits.has(parent))
      .forEach((parent, parentIndex) => {
        if (active.includes(parent)) return;
        active.splice(Math.min(lane + parentIndex, active.length), 0, parent);
      });
  });

  const positioned = new Map(nodes.map((node) => [node.key, node]));
  const edges = newestFirstKeys.flatMap((key) => {
    const revision = byKey.get(key);
    if (!revision || !positioned.has(key)) return [];
    return revision.parent_ids.flatMap((parent, parentIndex) => {
      const parentKey = keyByCommit.get(parent);
      if (!parentKey || !positioned.has(parentKey)) return [];
      return [{ child: key, parent: parentKey, merge: parentIndex > 0 }];
    });
  });
  return {
    nodes,
    edges,
    laneCount: Math.max(1, ...nodes.map((node) => node.lane + 1)),
  };
}
