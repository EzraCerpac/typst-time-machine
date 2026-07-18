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
  revisions: Revision[];
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

