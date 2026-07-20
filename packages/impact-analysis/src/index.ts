import type { ArtifactKind, ArtifactVersionRecord, StateStore } from "../../persistence/src/index.js";

export interface ImpactReport { changedPaths: string[]; roots: ArtifactVersionRecord[]; affected: Record<ArtifactKind, ArtifactVersionRecord[]>; stale: ArtifactVersionRecord[]; revalidationRequired: boolean }
const kinds: ArtifactKind[] = ["requirement", "task", "code", "test", "validation", "context", "review"];
export class ImpactAnalyzer {
  constructor(private readonly store: StateStore) {}
  analyze(changedPaths: readonly string[]): ImpactReport {
    const paths = [...new Set(changedPaths.map(path => path.replaceAll("\\", "/")))].sort(), roots = this.store.latestArtifactVersionsByPaths(paths), neighborhood = this.store.artifactNeighborhood(roots.map(x => x.id)), rootIds = new Set(roots.map(x => x.id)); const affected = Object.fromEntries(kinds.map(kind => [kind, neighborhood.filter(item => item.kind === kind && !rootIds.has(item.id))])) as Record<ArtifactKind, ArtifactVersionRecord[]>; const stale = neighborhood.filter(item => item.stale);
    return { changedPaths: paths, roots, affected, stale, revalidationRequired: stale.length > 0 || affected.test.length > 0 || affected.validation.length > 0 };
  }
}
