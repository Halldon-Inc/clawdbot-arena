"""
Asset Extractor for Clawdbot Arena
Extracts individual assets from the combined sprite sheet and organizes them.
Image size: 1024x559
"""

from PIL import Image
import os

# Source image path
SOURCE_IMAGE = r"C:\Users\skadd\OneDrive\Desktop\Game assets.jpg"

# Output base path
OUTPUT_BASE = r"C:\Users\skadd\clawdbot-arena\apps\web\public\assets"

# Define asset regions as (x, y, width, height)
# Based on actual image size of 1024x559

ASSETS = {
    # Fighter sprite sheets - left column
    # Each fighter row appears to be ~130px high with 8 frames
    "sprites/fighters/alphabot/spritesheet.png": {
        "region": (0, 12, 295, 115),
        "description": "AlphaBot fighter sprites (8 frames)"
    },
    "sprites/fighters/neuralknight/spritesheet.png": {
        "region": (0, 140, 295, 115),
        "description": "NeuralKnight fighter sprites (8 frames)"
    },
    "sprites/fighters/quantumfist/spritesheet.png": {
        "region": (0, 268, 295, 115),
        "description": "QuantumFist fighter sprites (8 frames)"
    },
    "sprites/fighters/ironlogic/spritesheet.png": {
        "region": (0, 396, 295, 115),
        "description": "IronLogic fighter sprites (8 frames)"
    },

    # Cyber Colosseum background layers (column 2)
    "backgrounds/cyber-colosseum/layer1-far.png": {
        "region": (305, 12, 175, 45),
        "description": "Cyber Colosseum far background"
    },
    "backgrounds/cyber-colosseum/layer2-mid.png": {
        "region": (305, 62, 175, 45),
        "description": "Cyber Colosseum mid background"
    },
    "backgrounds/cyber-colosseum/layer3-near.png": {
        "region": (305, 112, 175, 60),
        "description": "Cyber Colosseum near background"
    },

    # Factory Floor background layers (column 3)
    "backgrounds/factory-floor/layer1-far.png": {
        "region": (490, 12, 175, 45),
        "description": "Factory Floor far background"
    },
    "backgrounds/factory-floor/layer2-mid.png": {
        "region": (490, 62, 175, 45),
        "description": "Factory Floor mid background"
    },
    "backgrounds/factory-floor/layer3-near.png": {
        "region": (490, 112, 175, 60),
        "description": "Factory Floor near background"
    },

    # Digital Void background layers (column 4)
    "backgrounds/digital-void/layer1-far.png": {
        "region": (675, 12, 175, 45),
        "description": "Digital Void far background"
    },
    "backgrounds/digital-void/layer2-mid.png": {
        "region": (675, 62, 175, 45),
        "description": "Digital Void mid background"
    },
    "backgrounds/digital-void/layer3-near.png": {
        "region": (675, 112, 175, 60),
        "description": "Digital Void near background"
    },

    # UI Elements - middle section
    "ui/health-bar.png": {
        "region": (305, 185, 200, 40),
        "description": "Health bar UI"
    },
    "ui/combo-counter.png": {
        "region": (515, 185, 80, 70),
        "description": "Combo counter UI"
    },
    "ui/round-indicators.png": {
        "region": (605, 185, 100, 70),
        "description": "Round indicators"
    },
    "ui/announcer-text.png": {
        "region": (860, 12, 155, 160),
        "description": "Announcer text (FIGHT, KO, etc)"
    },
    "ui/timer.png": {
        "region": (715, 185, 85, 50),
        "description": "Timer display"
    },
    "ui/betting-frame.png": {
        "region": (860, 185, 155, 200),
        "description": "Betting panel frame"
    },

    # Effects - middle area
    "sprites/effects/hit-spark.png": {
        "region": (305, 240, 140, 75),
        "description": "Hit spark effect frames"
    },
    "sprites/effects/heavy-hit.png": {
        "region": (455, 240, 140, 75),
        "description": "Heavy hit effect frames"
    },
    "sprites/effects/block.png": {
        "region": (605, 240, 90, 90),
        "description": "Block/parry effect frames"
    },
    "sprites/effects/dust.png": {
        "region": (700, 270, 100, 50),
        "description": "Dust cloud effect frames"
    },
    "sprites/effects/ko-explosion.png": {
        "region": (305, 330, 100, 90),
        "description": "KO explosion effect"
    },
    "sprites/effects/energy-charge.png": {
        "region": (415, 330, 100, 90),
        "description": "Energy charge effect"
    },

    # Character Portraits - bottom right
    "sprites/fighters/alphabot/portrait.png": {
        "region": (525, 400, 90, 110),
        "description": "AlphaBot portrait"
    },
    "sprites/fighters/neuralknight/portrait.png": {
        "region": (625, 400, 90, 110),
        "description": "NeuralKnight portrait"
    },
    "sprites/fighters/quantumfist/portrait.png": {
        "region": (725, 400, 90, 110),
        "description": "QuantumFist portrait"
    },
    "sprites/fighters/ironlogic/portrait.png": {
        "region": (825, 400, 90, 110),
        "description": "IronLogic portrait"
    },
}


def create_directories():
    """Create the output directory structure."""
    dirs = [
        "sprites/fighters/alphabot",
        "sprites/fighters/neuralknight",
        "sprites/fighters/quantumfist",
        "sprites/fighters/ironlogic",
        "sprites/effects",
        "backgrounds/cyber-colosseum",
        "backgrounds/factory-floor",
        "backgrounds/digital-void",
        "ui",
    ]

    for d in dirs:
        path = os.path.join(OUTPUT_BASE, d)
        os.makedirs(path, exist_ok=True)
        print(f"Created directory: {path}")


def remove_checkered_background(image):
    """
    Convert checkered transparency pattern to actual transparency.
    The checkered pattern is typically light gray (#C0C0C0) and white (#FFFFFF).
    """
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    pixels = image.load()
    width, height = image.size

    # Colors that indicate transparency (checkered pattern)
    # Light gray and white checkerboard
    transparent_colors = [
        (192, 192, 192),  # Light gray
        (204, 204, 204),  # Slightly different gray
        (200, 200, 200),  # Another gray variant
    ]

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Check if pixel is part of checkered background
            # Checkered backgrounds have equal R, G, B values (gray)
            if abs(r - g) < 10 and abs(g - b) < 10 and abs(r - b) < 10:
                # It's a gray pixel, likely background
                if 180 <= r <= 220:  # In the gray range
                    pixels[x, y] = (r, g, b, 0)  # Make transparent

    return image


def extract_assets(source_path):
    """Extract all assets from the source image."""
    print(f"\nLoading source image: {source_path}")

    try:
        source = Image.open(source_path)
        # Convert to RGBA to support transparency
        if source.mode != 'RGBA':
            source = source.convert('RGBA')

        print(f"Image size: {source.size}")
        print(f"Image mode: {source.mode}")

    except Exception as e:
        print(f"Error loading image: {e}")
        return False

    extracted_count = 0

    for output_path, asset_info in ASSETS.items():
        region = asset_info["region"]
        description = asset_info["description"]

        try:
            # Calculate crop box (left, upper, right, lower)
            x, y, w, h = region
            crop_box = (x, y, x + w, y + h)

            # Ensure we're within bounds
            crop_box = (
                max(0, crop_box[0]),
                max(0, crop_box[1]),
                min(source.size[0], crop_box[2]),
                min(source.size[1], crop_box[3])
            )

            # Crop the region
            cropped = source.crop(crop_box)

            # Try to remove checkered background
            cropped = remove_checkered_background(cropped)

            # Full output path
            full_output_path = os.path.join(OUTPUT_BASE, output_path)

            # Save as PNG (preserves transparency)
            cropped.save(full_output_path, 'PNG')

            print(f"[OK] Extracted: {output_path} ({w}x{h})")
            extracted_count += 1

        except Exception as e:
            print(f"[ERROR] Error extracting {output_path}: {e}")

    print(f"\nExtracted {extracted_count}/{len(ASSETS)} assets")
    return True


def split_fighter_spritesheet(fighter_name, frame_width=37, frame_height=57):
    """Split a fighter spritesheet into individual animation frames."""
    spritesheet_path = os.path.join(OUTPUT_BASE, f"sprites/fighters/{fighter_name}/spritesheet.png")
    output_dir = os.path.join(OUTPUT_BASE, f"sprites/fighters/{fighter_name}")

    if not os.path.exists(spritesheet_path):
        print(f"Spritesheet not found: {spritesheet_path}")
        return

    try:
        sheet = Image.open(spritesheet_path)
        if sheet.mode != 'RGBA':
            sheet = sheet.convert('RGBA')

        sheet_width, sheet_height = sheet.size

        # Animation names for the frames
        animations = {
            'idle': [0],
            'walk': [1],
            'jump': [2],
            'attack1': [3],
            'attack2': [4],
            'special': [5],
            'hit': [6],
            'ko': [7],
        }

        # Calculate frame positions (2 rows x 4 cols = 8 frames)
        frames_per_row = 4
        actual_frame_width = sheet_width // frames_per_row
        actual_frame_height = sheet_height // 2

        print(f"\n  {fighter_name}: sheet={sheet_width}x{sheet_height}, frame={actual_frame_width}x{actual_frame_height}")

        frame_idx = 0
        for row in range(2):
            for col in range(4):
                x = col * actual_frame_width
                y = row * actual_frame_height

                frame = sheet.crop((x, y, x + actual_frame_width, y + actual_frame_height))

                # Get animation name for this frame
                anim_name = list(animations.keys())[frame_idx] if frame_idx < len(animations) else f"frame_{frame_idx}"

                frame_path = os.path.join(output_dir, f"{anim_name}.png")
                frame.save(frame_path, 'PNG')
                frame_idx += 1

        print(f"  [OK] Split {fighter_name} into {frame_idx} frames")

    except Exception as e:
        print(f"  [ERROR] Error splitting {fighter_name}: {e}")


def split_effect_spritesheet(effect_name, expected_frames=4):
    """Split an effect spritesheet into individual frames."""
    spritesheet_path = os.path.join(OUTPUT_BASE, f"sprites/effects/{effect_name}.png")
    output_dir = os.path.join(OUTPUT_BASE, "sprites/effects", effect_name)

    if not os.path.exists(spritesheet_path):
        print(f"Effect spritesheet not found: {spritesheet_path}")
        return

    os.makedirs(output_dir, exist_ok=True)

    try:
        sheet = Image.open(spritesheet_path)
        if sheet.mode != 'RGBA':
            sheet = sheet.convert('RGBA')

        sheet_width, sheet_height = sheet.size

        # Assume horizontal strip of frames
        frame_width = sheet_width // expected_frames

        for i in range(expected_frames):
            x = i * frame_width
            frame = sheet.crop((x, 0, x + frame_width, sheet_height))
            frame_path = os.path.join(output_dir, f"frame_{i:02d}.png")
            frame.save(frame_path, 'PNG')

        print(f"  [OK] Split {effect_name} into {expected_frames} frames")

    except Exception as e:
        print(f"  [ERROR] Error splitting {effect_name}: {e}")


def create_animation_json():
    """Create animation configuration JSON for Phaser."""
    import json

    animations = {
        "fighters": {
            "alphabot": {
                "idle": {"frames": [0], "frameRate": 8, "repeat": -1},
                "walk": {"frames": [1], "frameRate": 10, "repeat": -1},
                "jump": {"frames": [2], "frameRate": 8, "repeat": 0},
                "attack1": {"frames": [3], "frameRate": 12, "repeat": 0},
                "attack2": {"frames": [4], "frameRate": 10, "repeat": 0},
                "special": {"frames": [5], "frameRate": 8, "repeat": 0},
                "hit": {"frames": [6], "frameRate": 8, "repeat": 0},
                "ko": {"frames": [7], "frameRate": 6, "repeat": 0},
            },
            "neuralknight": {
                "idle": {"frames": [0], "frameRate": 8, "repeat": -1},
                "walk": {"frames": [1], "frameRate": 10, "repeat": -1},
                "jump": {"frames": [2], "frameRate": 8, "repeat": 0},
                "attack1": {"frames": [3], "frameRate": 12, "repeat": 0},
                "attack2": {"frames": [4], "frameRate": 10, "repeat": 0},
                "special": {"frames": [5], "frameRate": 8, "repeat": 0},
                "hit": {"frames": [6], "frameRate": 8, "repeat": 0},
                "ko": {"frames": [7], "frameRate": 6, "repeat": 0},
            },
            "quantumfist": {
                "idle": {"frames": [0], "frameRate": 8, "repeat": -1},
                "walk": {"frames": [1], "frameRate": 10, "repeat": -1},
                "jump": {"frames": [2], "frameRate": 8, "repeat": 0},
                "attack1": {"frames": [3], "frameRate": 12, "repeat": 0},
                "attack2": {"frames": [4], "frameRate": 10, "repeat": 0},
                "special": {"frames": [5], "frameRate": 8, "repeat": 0},
                "hit": {"frames": [6], "frameRate": 8, "repeat": 0},
                "ko": {"frames": [7], "frameRate": 6, "repeat": 0},
            },
            "ironlogic": {
                "idle": {"frames": [0], "frameRate": 8, "repeat": -1},
                "walk": {"frames": [1], "frameRate": 10, "repeat": -1},
                "jump": {"frames": [2], "frameRate": 8, "repeat": 0},
                "attack1": {"frames": [3], "frameRate": 12, "repeat": 0},
                "attack2": {"frames": [4], "frameRate": 10, "repeat": 0},
                "special": {"frames": [5], "frameRate": 8, "repeat": 0},
                "hit": {"frames": [6], "frameRate": 8, "repeat": 0},
                "ko": {"frames": [7], "frameRate": 6, "repeat": 0},
            },
        },
        "effects": {
            "hit-spark": {"frames": 4, "frameRate": 15, "repeat": 0},
            "heavy-hit": {"frames": 4, "frameRate": 12, "repeat": 0},
            "block": {"frames": 3, "frameRate": 12, "repeat": 0},
            "dust": {"frames": 4, "frameRate": 15, "repeat": 0},
            "ko-explosion": {"frames": 4, "frameRate": 10, "repeat": 0},
            "energy-charge": {"frames": 4, "frameRate": 12, "repeat": -1},
        }
    }

    config_path = os.path.join(OUTPUT_BASE, "animations.json")
    with open(config_path, 'w') as f:
        json.dump(animations, f, indent=2)

    print(f"\n[OK] Created animation config: {config_path}")


def main():
    print("=" * 60)
    print("Clawdbot Arena Asset Extractor")
    print("=" * 60)

    # Check if source exists
    if not os.path.exists(SOURCE_IMAGE):
        print(f"Error: Source image not found at {SOURCE_IMAGE}")
        return

    # Create directory structure
    print("\nStep 1: Creating directory structure...")
    create_directories()

    # Extract assets
    print("\nStep 2: Extracting assets from sprite sheet...")
    if not extract_assets(SOURCE_IMAGE):
        print("\nAsset extraction failed!")
        return

    # Split fighter spritesheets
    print("\nStep 3: Splitting fighter spritesheets into individual frames...")
    for fighter in ['alphabot', 'neuralknight', 'quantumfist', 'ironlogic']:
        split_fighter_spritesheet(fighter)

    # Split effect spritesheets
    print("\nStep 4: Splitting effect spritesheets...")
    effects = [
        ('hit-spark', 4),
        ('heavy-hit', 4),
        ('block', 3),
        ('dust', 4),
        ('ko-explosion', 4),
        ('energy-charge', 4),
    ]
    for effect_name, num_frames in effects:
        split_effect_spritesheet(effect_name, num_frames)

    # Create animation config
    print("\nStep 5: Creating animation configuration...")
    create_animation_json()

    print("\n" + "=" * 60)
    print("Asset extraction complete!")
    print(f"Output location: {OUTPUT_BASE}")
    print("=" * 60)

    # Print summary
    print("\nAsset Summary:")
    print("  - 4 fighter spritesheets (split into 8 frames each)")
    print("  - 9 background layers (3 arenas x 3 layers)")
    print("  - 6 UI elements")
    print("  - 6 effect spritesheets")
    print("  - 4 character portraits")
    print("  - 1 animation config JSON")


if __name__ == "__main__":
    main()
