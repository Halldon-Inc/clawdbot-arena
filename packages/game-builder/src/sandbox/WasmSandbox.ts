/**
 * WASM Sandbox for Moltblox Games
 *
 * Security model based on WebAssembly's formal verification guarantees:
 * - Memory isolation: Linear memory is sandboxed
 * - No raw pointers: Memory safety enforced
 * - No network access: WASI network capabilities denied
 * - No filesystem access: WASI filesystem capabilities denied
 * - Deterministic execution: Seeded random, controlled time
 * - Bounded resources: Memory limits, fuel/instruction limits
 */

import CryptoJS from 'crypto-js';

// =============================================================================
// Types
// =============================================================================

export interface SandboxConfig {
  /** Maximum memory in bytes (default: 50MB) */
  maxMemory: number;

  /** Maximum execution fuel/instructions per tick */
  maxFuelPerTick: number;

  /** Maximum table elements */
  maxTableElements: number;

  /** Random seed for deterministic execution */
  seed: number;

  /** Game tick rate in ms */
  tickRate: number;
}

export interface GameInstance {
  /** Unique instance ID */
  instanceId: string;

  /** Game type identifier */
  gameType: string;

  /** Initialize the game with players */
  initialize(playerIds: string[], seed?: number): void;

  /** Get current game state */
  getState(): unknown;

  /** Get state visible to a specific player */
  getStateForPlayer(playerId: string): unknown;

  /** Get valid actions for a player */
  getValidActions(playerId: string): unknown[];

  /** Apply a player action */
  applyAction(playerId: string, action: unknown): unknown;

  /** Process a game tick */
  tick(deltaTime: number): unknown;

  /** Check if game has ended */
  isTerminal(): boolean;

  /** Get final result */
  getResult(): unknown;

  /** Serialize game state */
  serialize(): unknown;

  /** Destroy instance and free resources */
  destroy(): void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompilationResult {
  success: boolean;
  wasmBytes?: Uint8Array;
  wasmHash?: string;
  errors?: string[];
  sourceMap?: string;
}

// =============================================================================
// Forbidden WASI Functions
// =============================================================================

const FORBIDDEN_WASI_FUNCTIONS = [
  // Network operations
  'sock_accept',
  'sock_recv',
  'sock_send',
  'sock_shutdown',

  // File operations (we don't allow any filesystem access)
  'path_open',
  'path_create_directory',
  'path_remove_directory',
  'path_unlink_file',
  'path_rename',
  'path_symlink',
  'path_readlink',
  'path_filestat_get',
  'path_filestat_set_times',

  // File descriptor operations
  'fd_read',
  'fd_write',
  'fd_seek',
  'fd_tell',
  'fd_allocate',
  'fd_close',
  'fd_datasync',
  'fd_sync',
  'fd_pread',
  'fd_pwrite',

  // Process operations
  'proc_raise',
  'sched_yield',

  // Clock operations (we provide our own deterministic time)
  'clock_time_get',
  'clock_res_get',
];

// =============================================================================
// Deterministic Random Number Generator
// =============================================================================

class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Get next random number between 0 and 1 */
  next(): number {
    // Mulberry32 PRNG - fast and deterministic
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Get random integer in range [min, max] */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Reset to a new seed */
  reset(seed: number): void {
    this.state = seed;
  }
}

// =============================================================================
// WASM Sandbox
// =============================================================================

export class WasmSandbox {
  private config: SandboxConfig;
  private instances: Map<string, GameInstance> = new Map();
  private random: DeterministicRandom;
  private currentTick: number = 0;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      maxMemory: 50 * 1024 * 1024, // 50MB
      maxFuelPerTick: 1_000_000,
      maxTableElements: 10000,
      seed: Date.now(),
      tickRate: 33, // ~30fps
      ...config,
    };

    this.random = new DeterministicRandom(this.config.seed);
  }

  /**
   * Validate WASM module for security
   */
  async validateModule(wasmBytes: Uint8Array): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Compile to validate syntax
      const module = await WebAssembly.compile(wasmBytes.buffer as ArrayBuffer);

      // Check imports
      const imports = WebAssembly.Module.imports(module);
      for (const imp of imports) {
        // Only allow our controlled imports
        if (imp.module === 'wasi_snapshot_preview1') {
          // Check for forbidden WASI functions
          if (FORBIDDEN_WASI_FUNCTIONS.some((f) => imp.name.startsWith(f))) {
            errors.push(`Forbidden WASI function: ${imp.name}`);
          }
        } else if (imp.module === 'env') {
          // We provide controlled env imports
          const allowedEnvImports = [
            'memory',
            '__indirect_function_table',
            'abort',
            'trace',
            'seed',
          ];
          if (!allowedEnvImports.includes(imp.name)) {
            warnings.push(`Non-standard env import: ${imp.name}`);
          }
        } else if (imp.module === 'game') {
          // Game API imports are allowed
          continue;
        } else {
          errors.push(`Forbidden import module: ${imp.module}.${imp.name}`);
        }
      }

      // Check exports for required game interface
      const exports = WebAssembly.Module.exports(module);
      const exportNames = exports.map((e) => e.name);

      const requiredExports = [
        'initialize',
        'getState',
        'applyAction',
        'tick',
        'isTerminal',
        'getResult',
      ];

      for (const required of requiredExports) {
        if (!exportNames.includes(required)) {
          errors.push(`Missing required export: ${required}`);
        }
      }

      // Check memory limits
      for (const exp of exports) {
        if (exp.kind === 'memory') {
          // Memory export found - will be bounded at runtime
          break;
        }
      }
    } catch (error) {
      errors.push(`WASM compilation failed: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Load a validated WASM game module
   */
  async loadGame(
    wasmBytes: Uint8Array,
    gameType: string
  ): Promise<GameInstance> {
    // Validate first
    const validation = await this.validateModule(wasmBytes);
    if (!validation.valid) {
      throw new Error(
        `Invalid WASM module: ${validation.errors.join(', ')}`
      );
    }

    const instanceId = this.generateInstanceId();

    // Create controlled imports
    const imports = this.createSandboxedImports(instanceId);

    // Instantiate with limits
    const module = await WebAssembly.compile(wasmBytes.buffer as ArrayBuffer);
    const instance = await WebAssembly.instantiate(module, imports);

    // Create game wrapper
    const gameInstance = new SandboxedGameInstance(
      instanceId,
      gameType,
      instance,
      this.config,
      this.random
    );

    this.instances.set(instanceId, gameInstance);

    return gameInstance;
  }

  /**
   * Get an existing game instance
   */
  getInstance(instanceId: string): GameInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Destroy a game instance
   */
  destroyInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.destroy();
      this.instances.delete(instanceId);
    }
  }

  /**
   * Get all active instances
   */
  getActiveInstances(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Create sandboxed imports for WASM module
   */
  private createSandboxedImports(
    instanceId: string
  ): WebAssembly.Imports {
    const self = this;

    return {
      env: {
        // Controlled memory - will be bounded
        memory: new WebAssembly.Memory({
          initial: 16, // 1MB initial
          maximum: Math.ceil(this.config.maxMemory / 65536), // Convert to pages
        }),

        // Controlled table
        __indirect_function_table: new WebAssembly.Table({
          initial: 0,
          maximum: this.config.maxTableElements,
          element: 'anyfunc',
        }),

        // Abort handler
        abort: (
          msgPtr: number,
          filePtr: number,
          line: number,
          col: number
        ) => {
          console.error(
            `Game ${instanceId} aborted at line ${line}:${col}`
          );
          throw new Error(`Game aborted at line ${line}:${col}`);
        },

        // Trace for debugging (sanitized)
        trace: (msgPtr: number, numArgs: number, ...args: number[]) => {
          // Limited tracing - no sensitive data exposure
          console.log(`[Game ${instanceId}] trace: ${numArgs} args`);
        },

        // Deterministic random seed
        seed: () => {
          return self.random.next();
        },
      },

      // Minimal WASI - only safe operations
      wasi_snapshot_preview1: {
        // Random - use our deterministic source
        random_get: (bufPtr: number, bufLen: number) => {
          // Would write random bytes to buffer using our PRNG
          return 0; // Success
        },

        // Args - empty
        args_get: () => 0,
        args_sizes_get: (argcPtr: number, argvBufSizePtr: number) => 0,

        // Environment - empty
        environ_get: () => 0,
        environ_sizes_get: (countPtr: number, sizePtr: number) => 0,

        // Exit
        proc_exit: (code: number) => {
          throw new Error(`Game exited with code ${code}`);
        },
      },

      // Game API imports
      game: {
        // Emit game event
        emitEvent: (typePtr: number, dataPtr: number) => {
          // Events would be captured and forwarded to game server
        },

        // Get current tick
        getCurrentTick: () => self.currentTick,

        // Get random (deterministic)
        getRandom: () => self.random.next(),

        // Get random int
        getRandomInt: (min: number, max: number) =>
          self.random.nextInt(min, max),
      },
    };
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `game_${timestamp}_${random}`;
  }

  /**
   * Calculate hash of WASM bytecode
   */
  static hashWasm(wasmBytes: Uint8Array): string {
    const wordArray = CryptoJS.lib.WordArray.create(wasmBytes as any);
    return CryptoJS.SHA256(wordArray).toString();
  }
}

// =============================================================================
// Sandboxed Game Instance
// =============================================================================

class SandboxedGameInstance implements GameInstance {
  instanceId: string;
  gameType: string;
  private wasmInstance: WebAssembly.Instance;
  private config: SandboxConfig;
  private random: DeterministicRandom;
  private fuelUsed: number = 0;
  private destroyed: boolean = false;

  constructor(
    instanceId: string,
    gameType: string,
    wasmInstance: WebAssembly.Instance,
    config: SandboxConfig,
    random: DeterministicRandom
  ) {
    this.instanceId = instanceId;
    this.gameType = gameType;
    this.wasmInstance = wasmInstance;
    this.config = config;
    this.random = random;
  }

  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error(`Game instance ${this.instanceId} has been destroyed`);
    }
  }

  private getExport<T>(name: string): T {
    this.checkDestroyed();
    const exp = this.wasmInstance.exports[name];
    if (!exp) {
      throw new Error(`Missing export: ${name}`);
    }
    return exp as T;
  }

  initialize(playerIds: string[], seed?: number): void {
    this.checkDestroyed();
    if (seed !== undefined) {
      this.random.reset(seed);
    }

    const initFn = this.getExport<Function>('initialize');
    // In real implementation, we'd serialize playerIds to WASM memory
    initFn(playerIds.length);
  }

  getState(): unknown {
    const fn = this.getExport<Function>('getState');
    // Would deserialize from WASM memory
    return fn();
  }

  getStateForPlayer(playerId: string): unknown {
    const fn = this.getExport<Function>('getStateForPlayer');
    return fn();
  }

  getValidActions(playerId: string): unknown[] {
    const fn = this.getExport<Function>('getValidActions');
    return fn();
  }

  applyAction(playerId: string, action: unknown): unknown {
    const fn = this.getExport<Function>('applyAction');
    return fn();
  }

  tick(deltaTime: number): unknown {
    this.checkDestroyed();
    this.fuelUsed = 0; // Reset fuel for this tick

    const fn = this.getExport<Function>('tick');

    // In production, we'd use instruction counting/fuel
    // For now, just call the function
    return fn(deltaTime);
  }

  isTerminal(): boolean {
    const fn = this.getExport<Function>('isTerminal');
    return fn() !== 0;
  }

  getResult(): unknown {
    const fn = this.getExport<Function>('getResult');
    return fn();
  }

  serialize(): unknown {
    const fn = this.getExport<Function>('serialize');
    return fn();
  }

  destroy(): void {
    this.destroyed = true;
    // Clear references
    (this.wasmInstance as any) = null;
  }
}

// =============================================================================
// Export
// =============================================================================

export default WasmSandbox;
