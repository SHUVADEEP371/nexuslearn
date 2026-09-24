export interface CandidateNode {
  userId: string;
  name: string;
  skillsOffered: string[];
  skillsWanted: string[];
  reputationScore: number;
  /** UTC week-hour indices, where Sunday 00:00 is 0 and Saturday 23:00 is 167. */
  availableSlots: number[];
}

export interface MutualMatchEdge {
  userA: { id: string; name: string; teaches: string };
  userB: { id: string; name: string; teaches: string };
  affinityScore: number;
  overlappingSlotsCount: number;
  overlappingSlots: number[];
}

const normalizeSkill = (skill: string): string => skill.normalize('NFKC').trim().toLocaleLowerCase('en-US');
const validSlots = (slots: number[]): number[] => [...new Set(slots.filter((slot) => Number.isInteger(slot) && slot >= 0 && slot <= 167))].sort((a, b) => a - b);
const boundedReputation = (score: number): number => Number.isFinite(score) ? Math.max(0, Math.min(score, 5)) : 0;

export class BipartiteMatchingEngine {
  calculateAffinity(userA: CandidateNode, userB: CandidateNode): { score: number; overlappingSlots: number[] } {
    const slotsA = validSlots(userA.availableSlots);
    const slotsB = new Set(validSlots(userB.availableSlots));
    const overlappingSlots = slotsA.filter((slot) => slotsB.has(slot));
    const reputationComponent = (boundedReputation(userA.reputationScore) + boundedReputation(userB.reputationScore)) / 10;
    const availabilityComponent = overlappingSlots.length / Math.max(slotsA.length, 1);
    const score = 0.4 * reputationComponent + 0.6 * availabilityComponent;
    return { score: Math.round(score * 10_000) / 10_000, overlappingSlots };
  }

  /** Returns the two directed skill transfers only when both sides want the other's offer. */
  findMutualTrade(userA: CandidateNode, userB: CandidateNode): { skillAtoB: string; skillBtoA: string } | null {
    const wantsB = new Set(userB.skillsWanted.map(normalizeSkill));
    const wantsA = new Set(userA.skillsWanted.map(normalizeSkill));
    const offeredByA = userA.skillsOffered.find((skill) => wantsB.has(normalizeSkill(skill)));
    const offeredByB = userB.skillsOffered.find((skill) => wantsA.has(normalizeSkill(skill)));
    return offeredByA && offeredByB ? { skillAtoB: offeredByA, skillBtoA: offeredByB } : null;
  }

  solveOptimalMatches(candidates: CandidateNode[]): MutualMatchEdge[] {
    const uniqueCandidates = new Map(candidates.filter((candidate) => candidate.userId).map((candidate) => [candidate.userId, candidate]));
    const nodes = [...uniqueCandidates.values()].sort((a, b) => a.userId.localeCompare(b.userId));
    const edges: MutualMatchEdge[] = [];

    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const userA = nodes[left];
        const userB = nodes[right];
        const trade = this.findMutualTrade(userA, userB);
        if (!trade) continue;
        const affinity = this.calculateAffinity(userA, userB);
        edges.push({
          userA: { id: userA.userId, name: userA.name, teaches: trade.skillAtoB },
          userB: { id: userB.userId, name: userB.name, teaches: trade.skillBtoA },
          affinityScore: affinity.score,
          overlappingSlotsCount: affinity.overlappingSlots.length,
          overlappingSlots: affinity.overlappingSlots,
        });
      }
    }

    edges.sort((a, b) => b.affinityScore - a.affinityScore
      || b.overlappingSlotsCount - a.overlappingSlotsCount
      || a.userA.id.localeCompare(b.userA.id)
      || a.userB.id.localeCompare(b.userB.id));

    // Each original user can occur on either side of a mutual trade, so the
    // selected edges form a disjoint matching across the combined candidate set.
    const matchedUserIds = new Set<string>();
    const selected: MutualMatchEdge[] = [];
    for (const edge of edges) {
      if (matchedUserIds.has(edge.userA.id) || matchedUserIds.has(edge.userB.id)) continue;
      matchedUserIds.add(edge.userA.id);
      matchedUserIds.add(edge.userB.id);
      selected.push(edge);
    }
    return selected;
  }
}

export const bipartiteMatchingEngine = new BipartiteMatchingEngine();
