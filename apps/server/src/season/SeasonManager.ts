/**
 * Season Manager
 * Manages competitive seasons with ELO resets and archived leaderboards
 */

import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export type SeasonStatus = 'upcoming' | 'active' | 'ended';

export type EloResetRule = 'full' | 'soft' | 'none';

export interface SeasonConfig {
  name: string;
  startDate: number; // epoch ms
  endDate: number; // epoch ms
  eloResetRule: EloResetRule;
}

export interface LeaderboardEntry {
  botId: string;
  botName: string;
  rating: number;
  wins: number;
  losses: number;
  rank: number;
}

export interface Season {
  seasonId: string;
  name: string;
  startDate: number;
  endDate: number;
  status: SeasonStatus;
  eloResetRule: EloResetRule;
  createdAt: number;
  /** Snapshot of the leaderboard taken when the season ends */
  archivedLeaderboard: LeaderboardEntry[] | null;
}

export interface SeasonSummary {
  seasonId: string;
  name: string;
  startDate: number;
  endDate: number;
  status: SeasonStatus;
  eloResetRule: EloResetRule;
  daysRemaining: number | null;
}

// =============================================================================
// Season Manager
// =============================================================================

export class SeasonManager {
  private seasons: Map<string, Season> = new Map();

  /**
   * Callback to fetch the current live leaderboard for snapshotting.
   * Should return an array of LeaderboardEntry sorted by rating descending.
   */
  private fetchLeaderboard: (() => Promise<LeaderboardEntry[]>) | null = null;

  /**
   * Callback to reset a bot's ELO.
   * Receives (botId, newRating).
   */
  private resetBotElo: ((botId: string, newRating: number) => Promise<void>) | null = null;

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Register a callback that returns the current leaderboard.
   */
  setLeaderboardProvider(cb: () => Promise<LeaderboardEntry[]>): void {
    this.fetchLeaderboard = cb;
  }

  /**
   * Register a callback to reset a bot's ELO rating.
   */
  setEloResetCallback(cb: (botId: string, newRating: number) => Promise<void>): void {
    this.resetBotElo = cb;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Create a new season. It starts in 'upcoming' status.
   */
  createSeason(config: SeasonConfig): Season {
    const seasonId = `season_${nanoid(10)}`;

    if (config.endDate <= config.startDate) {
      throw new Error('End date must be after start date');
    }

    const season: Season = {
      seasonId,
      name: config.name,
      startDate: config.startDate,
      endDate: config.endDate,
      status: 'upcoming',
      eloResetRule: config.eloResetRule,
      createdAt: Date.now(),
      archivedLeaderboard: null,
    };

    this.seasons.set(seasonId, season);
    console.log(`Season created: ${config.name} (${seasonId})`);
    return season;
  }

  /**
   * Start a season: apply the ELO reset rule and set status to 'active'.
   * Only one season can be active at a time.
   */
  async startSeason(seasonId: string): Promise<{ success: boolean; error?: string }> {
    const season = this.seasons.get(seasonId);
    if (!season) {
      return { success: false, error: 'Season not found' };
    }

    if (season.status !== 'upcoming') {
      return { success: false, error: 'Season is not in upcoming state' };
    }

    // Ensure no other season is active
    const active = this.getCurrentSeason();
    if (active) {
      return {
        success: false,
        error: `Another season is already active: ${active.name}`,
      };
    }

    // Apply ELO reset
    await this.applyEloReset(season);

    season.status = 'active';
    season.startDate = Date.now(); // Snap actual start to now
    console.log(`Season started: ${season.name}`);
    return { success: true };
  }

  /**
   * End the currently active season: snapshot leaderboard and deactivate.
   */
  async endSeason(seasonId: string): Promise<{ success: boolean; error?: string }> {
    const season = this.seasons.get(seasonId);
    if (!season) {
      return { success: false, error: 'Season not found' };
    }

    if (season.status !== 'active') {
      return { success: false, error: 'Season is not active' };
    }

    // Snapshot leaderboard
    if (this.fetchLeaderboard) {
      const leaderboard = await this.fetchLeaderboard();
      season.archivedLeaderboard = leaderboard;
    } else {
      season.archivedLeaderboard = [];
    }

    season.status = 'ended';
    season.endDate = Date.now();
    console.log(`Season ended: ${season.name}, ${season.archivedLeaderboard.length} entries archived`);
    return { success: true };
  }

  /**
   * Get the currently active season, or null if none.
   */
  getCurrentSeason(): Season | null {
    for (const season of this.seasons.values()) {
      if (season.status === 'active') {
        return season;
      }
    }
    return null;
  }

  /**
   * Get the archived leaderboard for a past season.
   */
  getSeasonLeaderboard(seasonId: string): LeaderboardEntry[] | null {
    const season = this.seasons.get(seasonId);
    if (!season) return null;
    return season.archivedLeaderboard;
  }

  /**
   * Get a single season by ID.
   */
  getSeason(seasonId: string): Season | undefined {
    return this.seasons.get(seasonId);
  }

  /**
   * List all seasons, optionally filtered by status.
   */
  listSeasons(status?: SeasonStatus): SeasonSummary[] {
    const results: SeasonSummary[] = [];
    const now = Date.now();

    for (const s of this.seasons.values()) {
      if (status && s.status !== status) continue;

      let daysRemaining: number | null = null;
      if (s.status === 'active') {
        daysRemaining = Math.max(
          0,
          Math.ceil((s.endDate - now) / (1000 * 60 * 60 * 24))
        );
      }

      results.push({
        seasonId: s.seasonId,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
        eloResetRule: s.eloResetRule,
        daysRemaining,
      });
    }

    // Most recent first
    results.sort((a, b) => b.startDate - a.startDate);
    return results;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Apply the ELO reset rule for a season.
   *  - 'full': Reset all bots to 1000
   *  - 'soft': Move all bots halfway toward 1000 (compress ratings)
   *  - 'none': Do nothing
   */
  private async applyEloReset(season: Season): Promise<void> {
    if (season.eloResetRule === 'none') {
      console.log('ELO reset: none (ratings preserved)');
      return;
    }

    if (!this.fetchLeaderboard || !this.resetBotElo) {
      console.warn('ELO reset skipped: no leaderboard provider or reset callback configured');
      return;
    }

    const leaderboard = await this.fetchLeaderboard();
    const defaultRating = 1000;

    for (const entry of leaderboard) {
      let newRating: number;

      if (season.eloResetRule === 'full') {
        newRating = defaultRating;
      } else {
        // Soft reset: move halfway toward the default
        newRating = Math.round((entry.rating + defaultRating) / 2);
      }

      await this.resetBotElo(entry.botId, newRating);
    }

    console.log(
      `ELO reset applied (${season.eloResetRule}): ${leaderboard.length} bots updated`
    );
  }
}
