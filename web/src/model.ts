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
    typst: string;
  };
  compiler: string;
  history: {
    first_parent_keys: string[];
    full_tree_keys: string[];
  };
  revisions: Revision[];
}

export type HistoryMode = "first-parent" | "full-tree";

export interface GraphNode {
  key: string;
  column: number;
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
    nodes.push({ key, column: newestFirstKeys.length - order - 1, lane });

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
