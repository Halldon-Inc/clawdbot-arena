/**
 * Beat 'em Up Game Constants
 * Balance values for Castle Crashers-style combat
 */

// =============================================================================
// Physics Constants
// =============================================================================

export const PHYSICS = {
  // Movement
  WALK_SPEED: 4,
  RUN_SPEED: 8,
  JUMP_FORCE: -16,
  GRAVITY: 0.8,
  MAX_FALL_SPEED: 20,

  // Ground and bounds
  GROUND_Y: 800,
  STAGE_LEFT: 50,
  STAGE_RIGHT: 1870,

  // Air control
  AIR_CONTROL: 0.6,

  // Friction
  GROUND_FRICTION: 0.85,
  AIR_FRICTION: 0.95,
} as const;

// =============================================================================
// Combat Constants
// =============================================================================

export const COMBAT = {
  // Damage values
  LIGHT_DAMAGE: 30,
  HEAVY_DAMAGE: 60,
  AIR_LIGHT_DAMAGE: 25,
  AIR_HEAVY_DAMAGE: 50,
  SPECIAL_DAMAGE: 80,

  // Combo multipliers
  COMBO_DAMAGE_BONUS: 0.1, // +10% per combo hit
  MAX_COMBO_BONUS: 0.5, // Max +50% damage

  // Magic/Special
  MAGIC_COST: 25,
  MAGIC_GAIN_PER_HIT: 5,
  MAGIC_GAIN_PER_DAMAGE: 0.02, // 2% of damage dealt

  // Hitstun and knockback
  LIGHT_HITSTUN_FRAMES: 12,
  HEAVY_HITSTUN_FRAMES: 20,
  SPECIAL_HITSTUN_FRAMES: 30,

  LIGHT_KNOCKBACK: 4,
  HEAVY_KNOCKBACK: 10,
  SPECIAL_KNOCKBACK: 15,
  AIR_KNOCKBACK_Y: -8,

  // Knockdown
  KNOCKDOWN_DURATION_FRAMES: 30,
  GETUP_DURATION_FRAMES: 20,
  GETUP_INVINCIBILITY_FRAMES: 10,
} as const;

// =============================================================================
// Attack Frame Data
// =============================================================================

export interface AttackFrameData {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  knockbackX: number;
  knockbackY: number;
  magicGain: number;
  canChain: boolean;
  chainWindow: number;
  hitboxWidth: number;
  hitboxHeight: number;
  hitboxOffsetX: number;
  hitboxOffsetY: number;
}

export const ATTACK_DATA: Record<string, AttackFrameData> = {
  // Ground light attacks (combo chain)
  light_1: {
    startup: 4,
    active: 4,
    recovery: 8,
    damage: 25,
    hitstun: 12,
    knockbackX: 3,
    knockbackY: 0,
    magicGain: 5,
    canChain: true,
    chainWindow: 12,
    hitboxWidth: 60,
    hitboxHeight: 80,
    hitboxOffsetX: 40,
    hitboxOffsetY: -20,
  },
  light_2: {
    startup: 4,
    active: 4,
    recovery: 10,
    damage: 30,
    hitstun: 14,
    knockbackX: 4,
    knockbackY: 0,
    magicGain: 5,
    canChain: true,
    chainWindow: 12,
    hitboxWidth: 65,
    hitboxHeight: 80,
    hitboxOffsetX: 45,
    hitboxOffsetY: -20,
  },
  light_3: {
    startup: 5,
    active: 5,
    recovery: 12,
    damage: 35,
    hitstun: 16,
    knockbackX: 5,
    knockbackY: 0,
    magicGain: 6,
    canChain: true,
    chainWindow: 14,
    hitboxWidth: 70,
    hitboxHeight: 80,
    hitboxOffsetX: 50,
    hitboxOffsetY: -20,
  },
  light_4: {
    startup: 6,
    active: 6,
    recovery: 20,
    damage: 45,
    hitstun: 20,
    knockbackX: 12,
    knockbackY: -6,
    magicGain: 8,
    canChain: false,
    chainWindow: 0,
    hitboxWidth: 80,
    hitboxHeight: 90,
    hitboxOffsetX: 55,
    hitboxOffsetY: -25,
  },

  // Heavy attack
  heavy: {
    startup: 12,
    active: 6,
    recovery: 24,
    damage: 60,
    hitstun: 22,
    knockbackX: 14,
    knockbackY: -4,
    magicGain: 10,
    canChain: false,
    chainWindow: 0,
    hitboxWidth: 90,
    hitboxHeight: 100,
    hitboxOffsetX: 60,
    hitboxOffsetY: -30,
  },

  // Air attacks
  air_light: {
    startup: 4,
    active: 8,
    recovery: 10,
    damage: 25,
    hitstun: 14,
    knockbackX: 3,
    knockbackY: 8,
    magicGain: 5,
    canChain: false,
    chainWindow: 0,
    hitboxWidth: 60,
    hitboxHeight: 70,
    hitboxOffsetX: 35,
    hitboxOffsetY: 10,
  },
  air_heavy: {
    startup: 8,
    active: 10,
    recovery: 16,
    damage: 50,
    hitstun: 20,
    knockbackX: 6,
    knockbackY: 14,
    magicGain: 8,
    canChain: false,
    chainWindow: 0,
    hitboxWidth: 80,
    hitboxHeight: 90,
    hitboxOffsetX: 50,
    hitboxOffsetY: 15,
  },

  // Special attack (uses magic)
  special: {
    startup: 10,
    active: 12,
    recovery: 30,
    damage: 80,
    hitstun: 30,
    knockbackX: 20,
    knockbackY: -10,
    magicGain: 0,
    canChain: false,
    chainWindow: 0,
    hitboxWidth: 120,
    hitboxHeight: 120,
    hitboxOffsetX: 80,
    hitboxOffsetY: -40,
  },
} as const;

// =============================================================================
// Match Constants
// =============================================================================

export const MATCH = {
  // Round settings
  ROUNDS_TO_WIN: 1,
  ROUND_TIME_SECONDS: 30,
  STARTING_HEALTH: 1000,
  STARTING_MAGIC: 0,
  MAX_MAGIC: 100,

  // Tick rate
  TICK_RATE: 60,
  TICK_MS: 1000 / 60,

  // Decision timeout
  DECISION_TIMEOUT_MS: 100,

  // Stage
  STAGE_WIDTH: 1920,
  STAGE_HEIGHT: 1080,

  // Countdown
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_FRAMES: 3 * 60,

  // Round end delay
  KO_DELAY_FRAMES: 90,
  ROUND_END_DELAY_FRAMES: 120,
} as const;

// =============================================================================
// Fighter Constants
// =============================================================================

export const FIGHTER = {
  WIDTH: 80,
  HEIGHT: 140,

  // Starting positions
  P1_START_X: 400,
  P2_START_X: 1520,
  START_Y: PHYSICS.GROUND_Y,

  // Hurtbox (slightly smaller than sprite)
  HURTBOX_WIDTH: 60,
  HURTBOX_HEIGHT: 120,
  HURTBOX_OFFSET_X: 10,
  HURTBOX_OFFSET_Y: 10,
} as const;
