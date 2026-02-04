/**
 * Cosmetic Store
 * Token-sink system for purchasing and equipping cosmetic effects
 */

import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export type CosmeticCategory = 'ko_animation' | 'entrance' | 'taunt';

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticEffect {
  id: string;
  name: string;
  category: CosmeticCategory;
  price: number; // COMP tokens
  description: string;
  rarity: CosmeticRarity;
}

export interface PurchaseRecord {
  effectId: string;
  walletAddress: string;
  purchasedAt: number;
  pricePaid: number;
}

export interface EquipRecord {
  botId: string;
  effectId: string;
  equippedAt: number;
}

// =============================================================================
// Default Cosmetic Effects (seed data)
// =============================================================================

const DEFAULT_EFFECTS: CosmeticEffect[] = [
  // --- KO Animations (shown when your bot delivers the finishing blow) ---
  {
    id: 'ko_shatter',
    name: 'Pixel Shatter',
    category: 'ko_animation',
    price: 50,
    description: 'Opponent shatters into pixelated fragments on KO.',
    rarity: 'common',
  },
  {
    id: 'ko_explosion',
    name: 'Neon Explosion',
    category: 'ko_animation',
    price: 100,
    description: 'A brilliant neon shockwave radiates from the final hit.',
    rarity: 'rare',
  },
  {
    id: 'ko_blackhole',
    name: 'Black Hole Collapse',
    category: 'ko_animation',
    price: 300,
    description: 'A miniature black hole consumes the defeated opponent.',
    rarity: 'epic',
  },
  {
    id: 'ko_lightning',
    name: 'Thunder Judgment',
    category: 'ko_animation',
    price: 750,
    description: 'Lightning strikes from above, obliterating the loser in a storm of electricity.',
    rarity: 'legendary',
  },

  // --- Entrance Effects (played when your bot enters the arena) ---
  {
    id: 'entrance_smoke',
    name: 'Smoke Screen',
    category: 'entrance',
    price: 50,
    description: 'Bot emerges from a cloud of purple smoke.',
    rarity: 'common',
  },
  {
    id: 'entrance_portal',
    name: 'Dimensional Rift',
    category: 'entrance',
    price: 100,
    description: 'Bot steps through a swirling dimensional portal.',
    rarity: 'rare',
  },
  {
    id: 'entrance_meteor',
    name: 'Meteor Impact',
    category: 'entrance',
    price: 350,
    description: 'Bot crashes into the arena like a blazing meteor.',
    rarity: 'epic',
  },
  {
    id: 'entrance_glitch',
    name: 'Reality Glitch',
    category: 'entrance',
    price: 800,
    description: 'The entire arena glitches and distorts as your bot materializes from the code itself.',
    rarity: 'legendary',
  },

  // --- Taunts (triggered via the special input at certain moments) ---
  {
    id: 'taunt_wave',
    name: 'Sarcastic Wave',
    category: 'taunt',
    price: 40,
    description: 'Your bot gives a dismissive wave to the opponent.',
    rarity: 'common',
  },
  {
    id: 'taunt_flex',
    name: 'Victory Flex',
    category: 'taunt',
    price: 80,
    description: 'Bot flexes with energy particles swirling around its arms.',
    rarity: 'rare',
  },
  {
    id: 'taunt_hologram',
    name: 'Holographic Clone',
    category: 'taunt',
    price: 250,
    description: 'A holographic copy of your bot appears and mocks the opponent.',
    rarity: 'epic',
  },
  {
    id: 'taunt_throne',
    name: 'Digital Throne',
    category: 'taunt',
    price: 600,
    description: 'A throne of pure data materializes and your bot sits on it, crown and all.',
    rarity: 'legendary',
  },
];

// =============================================================================
// Cosmetic Store
// =============================================================================

export class CosmeticStore {
  /** All available cosmetic effects */
  private effects: Map<string, CosmeticEffect> = new Map();

  /** Purchases by wallet address: walletAddress -> effectId[] */
  private userPurchases: Map<string, Set<string>> = new Map();

  /** All purchase records (for audit trail) */
  private purchaseHistory: PurchaseRecord[] = [];

  /** Equipped effects per bot: botId -> Set<effectId> */
  private equippedEffects: Map<string, Set<string>> = new Map();

  constructor() {
    // Seed with default effects
    for (const effect of DEFAULT_EFFECTS) {
      this.effects.set(effect.id, { ...effect });
    }
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Get all available cosmetic effects.
   */
  getEffects(): CosmeticEffect[] {
    return Array.from(this.effects.values());
  }

  /**
   * Get effects filtered by category.
   */
  getEffectsByCategory(category: CosmeticCategory): CosmeticEffect[] {
    return this.getEffects().filter((e) => e.category === category);
  }

  /**
   * Get effects filtered by rarity.
   */
  getEffectsByRarity(rarity: CosmeticRarity): CosmeticEffect[] {
    return this.getEffects().filter((e) => e.rarity === rarity);
  }

  /**
   * Get a specific effect by ID.
   */
  getEffect(id: string): CosmeticEffect | undefined {
    return this.effects.get(id);
  }

  /**
   * Get all effects owned by a wallet address.
   */
  getUserEffects(walletAddress: string): CosmeticEffect[] {
    const owned = this.userPurchases.get(walletAddress.toLowerCase());
    if (!owned) return [];

    const results: CosmeticEffect[] = [];
    for (const effectId of owned) {
      const effect = this.effects.get(effectId);
      if (effect) {
        results.push(effect);
      }
    }
    return results;
  }

  /**
   * Check if a wallet owns a specific effect.
   */
  userOwnsEffect(walletAddress: string, effectId: string): boolean {
    const owned = this.userPurchases.get(walletAddress.toLowerCase());
    return owned ? owned.has(effectId) : false;
  }

  /**
   * Get all effects equipped on a specific bot.
   */
  getEquippedEffects(botId: string): CosmeticEffect[] {
    const equipped = this.equippedEffects.get(botId);
    if (!equipped) return [];

    const results: CosmeticEffect[] = [];
    for (const effectId of equipped) {
      const effect = this.effects.get(effectId);
      if (effect) {
        results.push(effect);
      }
    }
    return results;
  }

  /**
   * Get the purchase history for a wallet.
   */
  getPurchaseHistory(walletAddress: string): PurchaseRecord[] {
    const addr = walletAddress.toLowerCase();
    return this.purchaseHistory.filter((p) => p.walletAddress === addr);
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Purchase a cosmetic effect.
   * Returns the purchase record on success, or an error message.
   */
  purchaseEffect(
    walletAddress: string,
    effectId: string
  ): { success: boolean; error?: string; purchase?: PurchaseRecord } {
    const addr = walletAddress.toLowerCase();

    const effect = this.effects.get(effectId);
    if (!effect) {
      return { success: false, error: 'Effect not found' };
    }

    // Check if already owned
    if (this.userOwnsEffect(addr, effectId)) {
      return { success: false, error: 'Effect already owned' };
    }

    // Note: Actual COMP token deduction would happen via smart contract.
    // This store records the purchase assuming payment was verified externally.

    const purchase: PurchaseRecord = {
      effectId,
      walletAddress: addr,
      purchasedAt: Date.now(),
      pricePaid: effect.price,
    };

    // Record ownership
    let owned = this.userPurchases.get(addr);
    if (!owned) {
      owned = new Set();
      this.userPurchases.set(addr, owned);
    }
    owned.add(effectId);

    // Record history
    this.purchaseHistory.push(purchase);

    console.log(
      `Cosmetic purchased: ${effect.name} (${effect.rarity}) by ${addr} for ${effect.price} COMP`
    );

    return { success: true, purchase };
  }

  /**
   * Equip a cosmetic effect on a bot.
   * The wallet that owns the bot must also own the effect.
   */
  equipEffect(
    botId: string,
    effectId: string,
    walletAddress?: string
  ): { success: boolean; error?: string } {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return { success: false, error: 'Effect not found' };
    }

    // If wallet is provided, verify ownership
    if (walletAddress && !this.userOwnsEffect(walletAddress, effectId)) {
      return { success: false, error: 'Effect not owned by this wallet' };
    }

    // Only one effect per category can be equipped at a time
    let equipped = this.equippedEffects.get(botId);
    if (!equipped) {
      equipped = new Set();
      this.equippedEffects.set(botId, equipped);
    }

    // Remove any existing effect in the same category
    for (const existingId of equipped) {
      const existing = this.effects.get(existingId);
      if (existing && existing.category === effect.category) {
        equipped.delete(existingId);
        break;
      }
    }

    equipped.add(effectId);
    console.log(`Cosmetic equipped: ${effect.name} on bot ${botId}`);
    return { success: true };
  }

  /**
   * Unequip a cosmetic effect from a bot.
   */
  unequipEffect(botId: string, effectId: string): boolean {
    const equipped = this.equippedEffects.get(botId);
    if (!equipped) return false;
    return equipped.delete(effectId);
  }

  // ---------------------------------------------------------------------------
  // Admin operations
  // ---------------------------------------------------------------------------

  /**
   * Add a new cosmetic effect to the store.
   */
  addEffect(effect: Omit<CosmeticEffect, 'id'>): CosmeticEffect {
    const id = `cosmetic_${nanoid(10)}`;
    const full: CosmeticEffect = { ...effect, id };
    this.effects.set(id, full);
    console.log(`New cosmetic added: ${full.name} (${full.rarity})`);
    return full;
  }

  /**
   * Remove an effect from the store (does not revoke existing purchases).
   */
  removeEffect(id: string): boolean {
    return this.effects.delete(id);
  }

  /**
   * Get total COMP spent across all purchases (burn tracking).
   */
  getTotalCompBurned(): number {
    return this.purchaseHistory.reduce((sum, p) => sum + p.pricePaid, 0);
  }

  /**
   * Get purchase counts per effect (for popularity tracking).
   */
  getEffectPopularity(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of this.purchaseHistory) {
      counts.set(p.effectId, (counts.get(p.effectId) || 0) + 1);
    }
    return counts;
  }
}
