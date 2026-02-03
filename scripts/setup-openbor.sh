#!/bin/bash
# Setup script for OpenBOR-WASM
# Run this script to download and configure the game engine

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up OpenBOR-WASM for Clawdbot Arena..."

# Navigate to game-assets
cd "$PROJECT_ROOT/game-assets"

# Clone OpenBOR-WASM if not exists
if [ ! -d "openbor-wasm" ]; then
    echo "Cloning OpenBOR-WASM..."
    git clone https://github.com/minidogenft/OpenBOR-WASM.git openbor-wasm
else
    echo "OpenBOR-WASM already exists, pulling latest..."
    cd openbor-wasm && git pull && cd ..
fi

# Create public/game directory
mkdir -p "$PROJECT_ROOT/apps/web/public/game"

# Copy WASM files to public directory
echo "Copying WASM files to public directory..."
if [ -f "openbor-wasm/openbor.wasm" ]; then
    cp openbor-wasm/openbor.wasm "$PROJECT_ROOT/apps/web/public/game/"
    cp openbor-wasm/openbor.data "$PROJECT_ROOT/apps/web/public/game/" 2>/dev/null || true
    cp openbor-wasm/game.js "$PROJECT_ROOT/apps/web/public/game/" 2>/dev/null || true
    echo "WASM files copied successfully!"
else
    echo "Warning: WASM files not found. You may need to build OpenBOR-WASM first."
    echo "See: https://github.com/minidogenft/OpenBOR-WASM for build instructions."
fi

# Build custom game pak
echo "Building custom game pak..."
cd "$PROJECT_ROOT/game-assets/clawdbot-arena"
if [ -d "data" ]; then
    zip -r clawdbot-arena.pak data/
    cp clawdbot-arena.pak "$PROJECT_ROOT/apps/web/public/game/"
    echo "Game pak built and copied!"
fi

echo ""
echo "Setup complete!"
echo "Next steps:"
echo "1. Ensure OpenBOR-WASM is properly built"
echo "2. Add sprite assets to game-assets/clawdbot-arena/data/chars/"
echo "3. Run 'pnpm dev' to start the development server"
