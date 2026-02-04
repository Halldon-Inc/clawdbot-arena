/**
 * Tournament Manager
 * Manages single-elimination tournaments with buy-ins and prize pools
 */

import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export type TournamentFormat = 'single-elimination';

export type TournamentStatus =
  | 'registration'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface TournamentConfig {
  name: string;
  format: TournamentFormat;
  maxBots: 8 | 16;
  buyIn: number; // COMP amount
  prizeDistribution: number[]; // percentages, e.g. [70, 20, 10]
}

export interface BracketMatch {
  matchId: string | null; // null if not yet started
  bot1Id: string | null;
  bot2Id: string | null;
  winnerId: string | null;
  /** Index within the round */
  slot: number;
}

export type BracketRound = BracketMatch[];

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  maxBots: 8 | 16;
  buyIn: number;
  prizeDistribution: number[];
  status: TournamentStatus;
  participants: string[]; // botIds
  bracket: BracketRound[];
  currentRound: number;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  /** Maps active match IDs to their bracket position [roundIndex, slotIndex] */
  activeMatches: Map<string, [number, number]>;
  /** Final placements: botId -> place (1st, 2nd, 3rd...) */
  placements: Map<string, number>;
}

export interface TournamentSummary {
  id: string;
  name: string;
  format: TournamentFormat;
  maxBots: number;
  buyIn: number;
  prizePool: number;
  prizeDistribution: number[];
  status: TournamentStatus;
  participantCount: number;
  participants: string[];
  currentRound: number;
  totalRounds: number;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface BracketState {
  tournamentId: string;
  tournamentName: string;
  status: TournamentStatus;
  currentRound: number;
  totalRounds: number;
  rounds: BracketRound[];
  placements: Record<string, number>;
}

// =============================================================================
// Tournament Manager
// =============================================================================

export class TournamentManager {
  private tournaments: Map<string, Tournament> = new Map();

  /**
   * Callback invoked when a tournament match needs to be created.
   * Should return the matchId assigned by the MatchServer.
   */
  private onCreateMatch:
    | ((bot1Id: string, bot2Id: string, tournamentId: string) => string)
    | null = null;

  /**
   * Callback invoked when a tournament completes.
   * Receives tournament id and placement map (botId -> place).
   */
  private onTournamentEnd:
    | ((tournamentId: string, placements: Map<string, number>, prizePool: number, prizeDistribution: number[]) => void)
    | null = null;

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Set the callback used to create actual game matches.
   * The callback receives (bot1Id, bot2Id, tournamentId) and must return
   * the matchId that the MatchServer assigned.
   */
  setCreateMatchCallback(
    cb: (bot1Id: string, bot2Id: string, tournamentId: string) => string
  ): void {
    this.onCreateMatch = cb;
  }

  /**
   * Set the callback invoked when a tournament ends.
   */
  setTournamentEndCallback(
    cb: (tournamentId: string, placements: Map<string, number>, prizePool: number, prizeDistribution: number[]) => void
  ): void {
    this.onTournamentEnd = cb;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Create a new tournament in registration phase.
   */
  createTournament(config: TournamentConfig): Tournament {
    const id = `tourn_${nanoid(12)}`;

    // Validate prize distribution sums to 100
    const totalPct = config.prizeDistribution.reduce((s, p) => s + p, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error(
        `Prize distribution must sum to 100, got ${totalPct}`
      );
    }

    if (config.maxBots !== 8 && config.maxBots !== 16) {
      throw new Error('maxBots must be 8 or 16');
    }

    const tournament: Tournament = {
      id,
      name: config.name,
      format: config.format,
      maxBots: config.maxBots,
      buyIn: config.buyIn,
      prizeDistribution: [...config.prizeDistribution],
      status: 'registration',
      participants: [],
      bracket: [],
      currentRound: 0,
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      activeMatches: new Map(),
      placements: new Map(),
    };

    this.tournaments.set(id, tournament);
    console.log(`Tournament created: ${config.name} (${id}), buy-in: ${config.buyIn} COMP`);
    return tournament;
  }

  /**
   * Add a bot to a tournament that is still in registration.
   * Returns true on success.
   */
  joinTournament(tournamentId: string, botId: string): { success: boolean; error?: string } {
    const t = this.tournaments.get(tournamentId);
    if (!t) {
      return { success: false, error: 'Tournament not found' };
    }

    if (t.status !== 'registration') {
      return { success: false, error: 'Tournament is not accepting registrations' };
    }

    if (t.participants.includes(botId)) {
      return { success: false, error: 'Bot already registered for this tournament' };
    }

    if (t.participants.length >= t.maxBots) {
      return { success: false, error: 'Tournament is full' };
    }

    t.participants.push(botId);
    console.log(`Bot ${botId} joined tournament ${t.name} (${t.participants.length}/${t.maxBots})`);
    return { success: true };
  }

  /**
   * Start the tournament.
   * Generates the bracket and kicks off the first round of matches.
   */
  startTournament(tournamentId: string): { success: boolean; error?: string } {
    const t = this.tournaments.get(tournamentId);
    if (!t) {
      return { success: false, error: 'Tournament not found' };
    }

    if (t.status !== 'registration') {
      return { success: false, error: 'Tournament has already started or ended' };
    }

    // Need at least 2 participants; pad to power of 2 with byes
    if (t.participants.length < 2) {
      return { success: false, error: 'Need at least 2 participants to start' };
    }

    t.status = 'in_progress';
    t.startedAt = Date.now();
    t.currentRound = 0;

    // Generate seeded bracket
    this.generateBracket(t);

    // Start first round matches
    this.startRoundMatches(t);

    console.log(`Tournament ${t.name} started with ${t.participants.length} bots`);
    return { success: true };
  }

  /**
   * Handle the result of a match that belongs to a tournament.
   * Advances the winner in the bracket and starts the next match / round
   * when ready.
   */
  handleMatchResult(matchId: string, winnerId: string): { tournamentId: string; advanced: boolean } | null {
    // Find which tournament this match belongs to
    for (const [tournamentId, t] of this.tournaments) {
      const position = t.activeMatches.get(matchId);
      if (!position) continue;

      const [roundIdx, slotIdx] = position;
      const bracketMatch = t.bracket[roundIdx][slotIdx];

      // Record the winner
      bracketMatch.winnerId = winnerId;
      t.activeMatches.delete(matchId);

      // Determine loser for placement tracking
      const loserId =
        bracketMatch.bot1Id === winnerId
          ? bracketMatch.bot2Id
          : bracketMatch.bot1Id;

      // Loser placement: total rounds - current round index
      // e.g. in an 8-bot tournament (3 rounds): eliminated in round 0 => 5th-8th, round 1 => 3rd-4th
      const totalRounds = t.bracket.length;
      if (loserId) {
        // Place is based on which round they were eliminated
        // Round 0 losers: placed maxBots/2 + 1  ... maxBots
        // Round 1 losers: placed maxBots/4 + 1  ... maxBots/2
        // etc.
        const remainingAfterRound = Math.pow(2, totalRounds - roundIdx - 1);
        const loserPlace = remainingAfterRound + 1;
        t.placements.set(loserId, loserPlace);
      }

      // Check if current round is complete
      const currentRoundMatches = t.bracket[roundIdx];
      const roundComplete = currentRoundMatches.every((m) => m.winnerId !== null);

      if (roundComplete) {
        // Check if this was the final round
        if (roundIdx === totalRounds - 1) {
          // Tournament is over -- the winner of the final match wins it all
          t.placements.set(winnerId, 1);
          t.status = 'completed';
          t.endedAt = Date.now();
          console.log(`Tournament ${t.name} completed! Winner: ${winnerId}`);

          // Notify
          if (this.onTournamentEnd) {
            const prizePool = t.buyIn * t.participants.length;
            this.onTournamentEnd(tournamentId, t.placements, prizePool, t.prizeDistribution);
          }
        } else {
          // Advance winners to next round
          t.currentRound = roundIdx + 1;
          this.populateNextRound(t, roundIdx);
          this.startRoundMatches(t);
        }
      }

      return { tournamentId, advanced: true };
    }

    return null; // Match does not belong to any tournament
  }

  /**
   * Get the full bracket state for display.
   */
  getBracket(tournamentId: string): BracketState | null {
    const t = this.tournaments.get(tournamentId);
    if (!t) return null;

    const placementsObj: Record<string, number> = {};
    for (const [botId, place] of t.placements) {
      placementsObj[botId] = place;
    }

    return {
      tournamentId: t.id,
      tournamentName: t.name,
      status: t.status,
      currentRound: t.currentRound,
      totalRounds: t.bracket.length,
      rounds: t.bracket,
      placements: placementsObj,
    };
  }

  /**
   * List all tournaments, optionally filtered by status.
   */
  listTournaments(status?: TournamentStatus): TournamentSummary[] {
    const results: TournamentSummary[] = [];

    for (const t of this.tournaments.values()) {
      if (status && t.status !== status) continue;

      results.push({
        id: t.id,
        name: t.name,
        format: t.format,
        maxBots: t.maxBots,
        buyIn: t.buyIn,
        prizePool: t.buyIn * t.participants.length,
        prizeDistribution: t.prizeDistribution,
        status: t.status,
        participantCount: t.participants.length,
        participants: [...t.participants],
        currentRound: t.currentRound,
        totalRounds: t.bracket.length || this.roundCount(t.maxBots),
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
      });
    }

    // Most recent first
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  }

  /**
   * Get a single tournament by id.
   */
  getTournament(tournamentId: string): Tournament | undefined {
    return this.tournaments.get(tournamentId);
  }

  /**
   * Cancel a tournament that has not yet completed.
   */
  cancelTournament(tournamentId: string): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t) return false;
    if (t.status === 'completed' || t.status === 'cancelled') return false;

    t.status = 'cancelled';
    t.endedAt = Date.now();
    t.activeMatches.clear();
    console.log(`Tournament ${t.name} cancelled`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Number of rounds for a given bracket size.
   */
  private roundCount(maxBots: number): number {
    return Math.log2(maxBots);
  }

  /**
   * Seeded bracket generation.
   * Shuffles participants, pads with byes (null), then builds the bracket
   * structure for all rounds.
   */
  private generateBracket(t: Tournament): void {
    const totalRounds = this.roundCount(t.maxBots);
    const bracketSize = t.maxBots;

    // Shuffle participants for seeding
    const shuffled = [...t.participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Pad to bracket size with nulls (byes)
    while (shuffled.length < bracketSize) {
      shuffled.push(null as unknown as string);
    }

    // Build all rounds
    t.bracket = [];

    // First round
    const firstRound: BracketRound = [];
    for (let i = 0; i < bracketSize; i += 2) {
      firstRound.push({
        matchId: null,
        bot1Id: shuffled[i] || null,
        bot2Id: shuffled[i + 1] || null,
        winnerId: null,
        slot: i / 2,
      });
    }
    t.bracket.push(firstRound);

    // Subsequent rounds (empty slots, will be filled as winners advance)
    let matchesInRound = bracketSize / 4;
    for (let r = 1; r < totalRounds; r++) {
      const round: BracketRound = [];
      for (let s = 0; s < matchesInRound; s++) {
        round.push({
          matchId: null,
          bot1Id: null,
          bot2Id: null,
          winnerId: null,
          slot: s,
        });
      }
      t.bracket.push(round);
      matchesInRound = Math.max(1, matchesInRound / 2);
    }

    // Handle first-round byes: if one side is null, auto-advance the other
    for (const match of firstRound) {
      if (match.bot1Id && !match.bot2Id) {
        match.winnerId = match.bot1Id;
      } else if (!match.bot1Id && match.bot2Id) {
        match.winnerId = match.bot2Id;
      } else if (!match.bot1Id && !match.bot2Id) {
        // Both null -- empty slot, winner stays null
        match.winnerId = null;
      }
    }

    // If all first-round matches resolved by byes, populate next round
    const allResolved = firstRound.every(
      (m) => m.winnerId !== null || (!m.bot1Id && !m.bot2Id)
    );
    if (allResolved && totalRounds > 1) {
      t.currentRound = 1;
      this.populateNextRound(t, 0);
    }
  }

  /**
   * Populate the next round from winners of the given round.
   */
  private populateNextRound(t: Tournament, completedRoundIdx: number): void {
    const nextRoundIdx = completedRoundIdx + 1;
    if (nextRoundIdx >= t.bracket.length) return;

    const completedRound = t.bracket[completedRoundIdx];
    const nextRound = t.bracket[nextRoundIdx];

    for (let i = 0; i < completedRound.length; i += 2) {
      const winner1 = completedRound[i].winnerId;
      const winner2 = completedRound[i + 1]?.winnerId ?? null;

      const nextSlot = Math.floor(i / 2);
      if (nextSlot < nextRound.length) {
        nextRound[nextSlot].bot1Id = winner1;
        nextRound[nextSlot].bot2Id = winner2;

        // Handle byes in later rounds
        if (winner1 && !winner2) {
          nextRound[nextSlot].winnerId = winner1;
        } else if (!winner1 && winner2) {
          nextRound[nextSlot].winnerId = winner2;
        }
      }
    }
  }

  /**
   * Start all unstarted matches in the current round that have two valid
   * participants and no winner yet.
   */
  private startRoundMatches(t: Tournament): void {
    const round = t.bracket[t.currentRound];
    if (!round) return;

    for (const match of round) {
      // Skip if already has a winner (bye) or already started
      if (match.winnerId !== null) continue;
      if (match.matchId !== null) continue;
      if (!match.bot1Id || !match.bot2Id) continue;

      if (this.onCreateMatch) {
        const matchId = this.onCreateMatch(match.bot1Id, match.bot2Id, t.id);
        match.matchId = matchId;
        t.activeMatches.set(matchId, [t.currentRound, match.slot]);
        console.log(
          `Tournament match started: ${match.bot1Id} vs ${match.bot2Id} ` +
            `(round ${t.currentRound + 1}, match ${matchId})`
        );
      } else {
        console.warn(
          'TournamentManager: no createMatch callback set, cannot start match'
        );
      }
    }

    // After starting matches, check if the round is already complete
    // (all byes) and advance if needed
    const allDone = round.every((m) => m.winnerId !== null);
    if (allDone && t.currentRound < t.bracket.length - 1) {
      t.currentRound++;
      this.populateNextRound(t, t.currentRound - 1);
      this.startRoundMatches(t);
    }
  }
}
