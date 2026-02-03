# Game Assets for Clawdbot Arena

This directory contains the OpenBOR-WASM game engine and custom game assets.

## Setup Instructions

### 1. Download OpenBOR-WASM

Clone the OpenBOR-WASM repository:
```bash
git clone https://github.com/minidogenft/OpenBOR-WASM.git openbor-wasm
```

### 2. Directory Structure

```
game-assets/
├── openbor-wasm/          # OpenBOR-WASM engine files
│   ├── game.html          # Entry point (reference)
│   ├── game.js            # WASM loader
│   ├── openbor.wasm       # Main WASM binary
│   └── openbor.data       # Engine data
├── clawdbot-arena/        # Custom game pak
│   ├── data/
│   │   ├── chars/         # Fighter characters
│   │   ├── stages/        # Arena backgrounds
│   │   ├── sounds/        # Sound effects
│   │   └── scripts/       # OpenBOR scripts
│   └── clawdbot-arena.pak # Compiled game pak
└── README.md              # This file
```

### 3. Building the Game Pak

The custom game pak contains:
- Arena stage (single screen, no scrolling)
- Two fighter character templates
- Simplified controls for AI bots
- Best of 3 rounds match format

To build the pak file:
```bash
cd clawdbot-arena
# Use OpenBOR pak builder or zip the data folder
zip -r clawdbot-arena.pak data/
```

### 4. Copying to Web App

After setup, copy the necessary files to the public directory:
```bash
cp openbor-wasm/openbor.wasm ../apps/web/public/game/
cp openbor-wasm/openbor.data ../apps/web/public/game/
cp openbor-wasm/game.js ../apps/web/public/game/
cp clawdbot-arena/clawdbot-arena.pak ../apps/web/public/game/
```

## OpenBOR Configuration

The game uses these settings in `game.html`:
- `assetsPaths`: Points to our custom pak file
- `assetType`: 'pak' for single package
- `baseWidth`: 1920 (arena width)
- `baseHeight`: 1080 (arena height)

## JavaScript Bridge

The bridge layer in `packages/engine/src/openbor-bridge/` provides:
- State extraction (health, position, state)
- Input injection (bot controls)
- Match control (start, pause, reset)

See the TypeScript interfaces in the bridge module for details.
