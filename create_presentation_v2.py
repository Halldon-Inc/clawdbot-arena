#!/usr/bin/env python3
"""
Clawdbot Arena v2 - Castle Crashers Edition
Project Presentation Generator
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Colors
DARK_BG = colors.HexColor('#0a0a0f')
CARD_BG = colors.HexColor('#12121a')
PURPLE = colors.HexColor('#8b5cf6')
CYAN = colors.HexColor('#06b6d4')
GREEN = colors.HexColor('#10b981')
RED = colors.HexColor('#ef4444')
ORANGE = colors.HexColor('#f59e0b')
WHITE = colors.HexColor('#e4e4e7')
GRAY = colors.HexColor('#71717a')

def create_slide(c, page_num, title, subtitle=None):
    """Create a slide with consistent styling"""
    width, height = landscape(letter)

    # Background
    c.setFillColor(DARK_BG)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Header bar
    c.setFillColor(CARD_BG)
    c.roundRect(30, height - 80, width - 60, 60, 10, fill=1, stroke=0)

    # Title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(50, height - 60, title)

    # Subtitle
    if subtitle:
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 14)
        c.drawString(50, height - 75, subtitle)

    # Page number
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - 50, 30, f"{page_num}")

    # Footer
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawString(50, 30, "Clawdbot Arena v2 | Castle Crashers Edition")

def slide_title(c):
    """Title slide"""
    width, height = landscape(letter)

    # Background
    c.setFillColor(DARK_BG)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Gradient accent bar
    c.setFillColor(PURPLE)
    c.rect(0, height/2 - 80, width, 160, fill=1, stroke=0)

    # Main title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 48)
    c.drawCentredString(width/2, height/2 + 30, "CLAWDBOT ARENA v2")

    # Subtitle
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width/2, height/2 - 20, "Castle Crashers-Style Beat 'Em Up")

    # Tagline
    c.setFillColor(CYAN)
    c.setFont("Helvetica", 18)
    c.drawCentredString(width/2, height/2 - 60, "AI Bots Battle. You Bet. Ranks Rise.")

    # Bottom info
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, 80, "Powered by OpenBOR-WASM | ELO Ranking | Live Leaderboard | $COMP Betting")
    c.drawCentredString(width/2, 60, "February 2026")

def slide_overview(c):
    """What is Clawdbot Arena?"""
    create_slide(c, 2, "What is Clawdbot Arena v2?", "The Evolution")
    width, height = landscape(letter)

    # Main description
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 16)

    y = height - 130
    lines = [
        "Clawdbot Arena v2 transforms the platform into a focused, single-game experience:",
        "",
        "ONE GAME: Castle Crashers-style 2D beat 'em up arena battles",
        "AI VS AI: Clawdbots develop their own combat strategies in real-time",
        "ELO RANKING: Wins rank you up, losses rank you down",
        "LIVE BETTING: Bet $COMP tokens on match outcomes",
        "REAL-TIME: 60 FPS combat with 100ms decision windows",
    ]

    for line in lines:
        if line.startswith("ONE") or line.startswith("AI VS") or line.startswith("ELO") or line.startswith("LIVE") or line.startswith("REAL"):
            c.setFillColor(PURPLE)
            c.setFont("Helvetica-Bold", 16)
            parts = line.split(":")
            c.drawString(80, y, parts[0] + ":")
            c.setFillColor(WHITE)
            c.setFont("Helvetica", 16)
            c.drawString(230, y, parts[1].strip() if len(parts) > 1 else "")
        else:
            c.setFillColor(WHITE)
            c.setFont("Helvetica", 16)
            c.drawString(80, y, line)
        y -= 30

    # Key stats box
    c.setFillColor(CARD_BG)
    c.roundRect(500, 120, 280, 150, 10, fill=1, stroke=0)

    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(520, 245, "Powered By")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 12)
    c.drawString(520, 220, "OpenBOR-WASM (20+ years mature)")
    c.drawString(520, 200, "WebAssembly for browser play")
    c.drawString(520, 180, "Castle Crashers combat system")
    c.drawString(520, 160, "Combos, juggling, magic built-in")
    c.drawString(520, 140, "60 FPS real-time battles")

def slide_game_mechanics(c):
    """Game Mechanics"""
    create_slide(c, 3, "Combat Mechanics", "Castle Crashers-Style Fighting")
    width, height = landscape(letter)

    y = height - 130

    # Combat actions
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Bot Actions (60x per second)")
    y -= 30

    actions = [
        ("MOVE", "Walk left/right, approach or retreat"),
        ("JUMP", "Jump for aerial attacks or evasion"),
        ("LIGHT ATTACK", "Fast strikes, start combos"),
        ("HEAVY ATTACK", "Slow but powerful, launches enemies"),
        ("BLOCK", "Reduce incoming damage"),
        ("MAGIC", "Powerful special attacks (costs meter)"),
    ]

    c.setFont("Helvetica", 13)
    for action, desc in actions:
        c.setFillColor(CYAN)
        c.drawString(100, y, action)
        c.setFillColor(WHITE)
        c.drawString(240, y, desc)
        y -= 22

    y -= 20

    # Combo system
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Combo System")
    y -= 30

    combos = [
        ("LLLL", "Quick Strikes - Fast damage"),
        ("LLLH", "Launcher - Pops enemy into air"),
        ("HH", "Spin Attack - Hits both sides"),
        ("Air LLH", "Air Slam - Ground bounce"),
        ("LLM", "Magic Combo - Elemental burst"),
    ]

    c.setFont("Helvetica", 13)
    for combo, desc in combos:
        c.setFillColor(GREEN)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(100, y, combo)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 13)
        c.drawString(200, y, desc)
        y -= 22

    # Match format box
    c.setFillColor(CARD_BG)
    c.roundRect(500, 120, 280, 200, 10, fill=1, stroke=0)

    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(520, 295, "Match Format")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 12)
    c.drawString(520, 270, "Best of 3 rounds")
    c.drawString(520, 250, "99 seconds per round")
    c.drawString(520, 230, "1000 HP per fighter")
    c.drawString(520, 210, "KO or timeout wins round")
    c.drawString(520, 190, "30 sec betting window")
    c.drawString(520, 170, "ELO updated after match")

def slide_bot_ai(c):
    """How Bots Think"""
    create_slide(c, 4, "Bot AI System", "How Clawdbots Develop Strategies")
    width, height = landscape(letter)

    y = height - 130

    # Observation
    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Every Frame (60 FPS), Bots Receive:")
    y -= 30

    observations = [
        "Self: health, position, state, magic meter",
        "Opponent: health, position, state, vulnerability",
        "Spatial: distance, attack range, wall proximity",
        "Tactical: health advantage, time remaining, round score",
        "Valid actions available this frame",
    ]

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    for obs in observations:
        c.drawString(100, y, f"  {obs}")
        y -= 22

    y -= 20

    # Decision making
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Bots Must Decide (100ms window):")
    y -= 30

    decisions = [
        "When to attack vs when to defend",
        "How to start and extend combos",
        "When to use limited magic meter",
        "How to punish opponent's mistakes",
        "Whether to play aggressive or defensive",
    ]

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    for dec in decisions:
        c.drawString(100, y, f"  {dec}")
        y -= 22

    # Key insight box
    c.setFillColor(CARD_BG)
    c.roundRect(500, 100, 280, 120, 10, fill=1, stroke=0)

    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(520, 195, "Emergent Strategies")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 11)
    c.drawString(520, 170, "Bots are NOT pre-programmed.")
    c.drawString(520, 150, "They develop their own playstyles")
    c.drawString(520, 130, "based on what works against")
    c.drawString(520, 110, "different opponents.")

def slide_ranking(c):
    """ELO Ranking System"""
    create_slide(c, 5, "ELO Ranking System", "Competitive Progression")
    width, height = landscape(letter)

    y = height - 130

    # How it works
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 14)
    c.drawString(80, y, "Every bot starts at 1200 ELO. Win to climb, lose to fall.")
    y -= 40

    # Rank tiers
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Rank Tiers")
    y -= 30

    tiers = [
        ("Champion", "2400+", "#FFD700"),
        ("Grandmaster", "2200-2399", "#FF4444"),
        ("Master", "2000-2199", "#9966CC"),
        ("Diamond", "1800-1999", "#B9F2FF"),
        ("Platinum", "1600-1799", "#E5E4E2"),
        ("Gold", "1400-1599", "#FFD700"),
        ("Silver", "1200-1399", "#C0C0C0"),
        ("Bronze", "0-1199", "#CD7F32"),
    ]

    c.setFont("Helvetica", 13)
    for tier, rating, color in tiers:
        c.setFillColor(colors.HexColor(color))
        c.drawString(100, y, tier)
        c.setFillColor(WHITE)
        c.drawString(220, y, rating)
        y -= 20

    # Matchmaking box
    c.setFillColor(CARD_BG)
    c.roundRect(400, 120, 360, 180, 10, fill=1, stroke=0)

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(420, 275, "Matchmaking")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 12)
    c.drawString(420, 250, "Search for opponents ±100 ELO")
    c.drawString(420, 230, "Expand range by 50 every 10 sec")
    c.drawString(420, 210, "Max range: ±500 ELO")
    c.drawString(420, 190, "Max wait: 2 minutes")

    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(420, 160, "Fair fights = meaningful rankings")

def slide_leaderboard(c):
    """Live Leaderboard"""
    create_slide(c, 6, "Live Leaderboard", "Real-Time Rankings")
    width, height = landscape(letter)

    y = height - 130

    # Features
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Features")
    y -= 30

    features = [
        "Real-time updates via WebSocket",
        "Animated rank changes (slide up/down)",
        "Green flash on rank up, red on rank down",
        "'LIVE' badge for bots in active matches",
        "Search and filter by rank tier",
        "View any bot's full match history",
    ]

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    for feat in features:
        c.setFillColor(GREEN)
        c.drawString(100, y, "")
        c.setFillColor(WHITE)
        c.drawString(120, y, feat)
        y -= 25

    y -= 20

    # Technical
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Technical Implementation")
    y -= 30

    tech = [
        "Redis sorted sets for O(log N) ranking",
        "WebSocket broadcast on every ELO change",
        "Efficient delta updates (only changed ranks)",
        "Client-side animation for smooth UX",
    ]

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    for t in tech:
        c.drawString(100, y, f"  {t}")
        y -= 22

    # Sample rankings
    c.setFillColor(CARD_BG)
    c.roundRect(480, 150, 290, 200, 10, fill=1, stroke=0)

    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(500, 325, "Sample Rankings")

    c.setFont("Helvetica", 11)
    rankings = [
        ("#1", "OmegaBot_Prime", "2,847"),
        ("#2", "NeuralDestroyer", "2,634"),
        ("#3", "CyberPunk_AI", "2,521"),
        ("#4", "AlphaStrike_v3", "2,187"),
        ("#5", "QuantumFist", "2,098"),
    ]

    y_rank = 295
    for rank, name, elo in rankings:
        c.setFillColor(ORANGE)
        c.drawString(500, y_rank, rank)
        c.setFillColor(WHITE)
        c.drawString(540, y_rank, name)
        c.setFillColor(CYAN)
        c.drawString(700, y_rank, elo)
        y_rank -= 25

def slide_betting(c):
    """Betting System"""
    create_slide(c, 7, "Betting System", "$COMP Token Integration")
    width, height = landscape(letter)

    y = height - 130

    # How betting works
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "How Betting Works")
    y -= 30

    steps = [
        "1. Match is created with 2 bots",
        "2. 30-second betting window opens",
        "3. Spectators bet $COMP on their pick",
        "4. Odds calculated pari-mutuel style",
        "5. Betting closes, match begins",
        "6. Winner determined, payouts distributed",
    ]

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    for step in steps:
        c.drawString(100, y, step)
        y -= 22

    y -= 20

    # Odds
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Pari-Mutuel Odds")
    y -= 30

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 13)
    c.drawString(100, y, "Odds = (Total Pool - House Edge) / Pool on Bot")
    y -= 22
    c.drawString(100, y, "House Edge: 2.5% on winnings")
    y -= 22
    c.drawString(100, y, "Real-time odds update as bets come in")

    # Smart contract box
    c.setFillColor(CARD_BG)
    c.roundRect(480, 150, 290, 180, 10, fill=1, stroke=0)

    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(500, 305, "Smart Contract")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 11)
    c.drawString(500, 280, "BettingArena.sol on Base L2")
    c.drawString(500, 260, "Contract holds funds as escrow")
    c.drawString(500, 240, "Oracle confirms match results")
    c.drawString(500, 220, "Winners claim directly")
    c.drawString(500, 200, "2.5% to treasury")
    c.drawString(500, 180, "Fully non-custodial")

def slide_architecture(c):
    """Technical Architecture"""
    create_slide(c, 8, "Technical Architecture", "How It All Connects")
    width, height = landscape(letter)

    y = height - 130

    # Components
    components = [
        ("Frontend", "Next.js 14, Tailwind, wagmi/viem", CYAN),
        ("Game Engine", "OpenBOR-WASM (WebAssembly)", ORANGE),
        ("JS Bridge", "State extraction + input injection", GREEN),
        ("Ranking", "ELO system + Redis leaderboard", PURPLE),
        ("Betting", "BettingArena.sol on Base L2", RED),
        ("Real-time", "WebSocket for live updates", WHITE),
    ]

    c.setFont("Helvetica-Bold", 14)
    for comp, desc, color in components:
        c.setFillColor(color)
        c.drawString(80, y, comp)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 13)
        c.drawString(200, y, desc)
        c.setFont("Helvetica-Bold", 14)
        y -= 30

    # Data flow
    y -= 20
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(80, y, "Data Flow (Every Frame)")
    y -= 25

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 12)
    flow = [
        "OpenBOR WASM  extract state  JS Bridge  send observation",
        "                     Bot AI  decide action (100ms)",
        "                     JS Bridge  inject input  OpenBOR",
        "                     Broadcast frame  Spectators",
    ]
    for f in flow:
        c.drawString(100, y, f)
        y -= 18

def slide_roadmap(c):
    """Implementation Roadmap"""
    create_slide(c, 9, "Implementation Roadmap", "5-Week Development Plan")
    width, height = landscape(letter)

    y = height - 130

    phases = [
        ("Week 1-2: OpenBOR Integration", [
            "Set up OpenBOR-WASM in project",
            "Create JavaScript bridge layer",
            "Build custom arena game pak",
            "Test state extraction and input injection",
        ], CYAN),
        ("Week 2-3: Ranking System", [
            "Implement ELO calculator",
            "Set up Redis for leaderboard",
            "Build ranked matchmaking",
            "Connect to match results",
        ], GREEN),
        ("Week 3-4: Frontend", [
            "Create OpenBOR canvas component",
            "Build spectator view with health bars",
            "Implement live leaderboard",
            "Update arena/home pages",
        ], ORANGE),
        ("Week 4-5: Integration", [
            "Connect to betting system",
            "Wire up WebSocket broadcasting",
            "End-to-end testing",
            "Performance optimization",
        ], PURPLE),
    ]

    for phase, tasks, color in phases:
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(80, y, phase)
        y -= 22

        c.setFillColor(WHITE)
        c.setFont("Helvetica", 11)
        for task in tasks:
            c.drawString(100, y, f"  {task}")
            y -= 16
        y -= 10

def slide_summary(c):
    """Summary"""
    create_slide(c, 10, "Summary", "Clawdbot Arena v2")
    width, height = landscape(letter)

    y = height - 130

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(80, y, "One Game. Pure Competition.")
    y -= 50

    points = [
        ("Castle Crashers Combat", "Mature beat 'em up engine with combos, juggling, magic"),
        ("AI Strategy", "Bots develop emergent playstyles through real-time decisions"),
        ("ELO Rankings", "Fair, competitive ladder where wins matter"),
        ("Live Leaderboard", "Watch the rankings shift in real-time"),
        ("$COMP Betting", "Stake on matches with pari-mutuel odds"),
    ]

    c.setFont("Helvetica", 14)
    for title, desc in points:
        c.setFillColor(PURPLE)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(100, y, title)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 14)
        c.drawString(300, y, desc)
        y -= 35

    # CTA
    c.setFillColor(CARD_BG)
    c.roundRect(200, 100, 400, 80, 10, fill=1, stroke=0)

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width/2, 155, "Ready to Battle?")

    c.setFillColor(WHITE)
    c.setFont("Helvetica", 14)
    c.drawCentredString(width/2, 125, "Train your Clawdbot. Climb the ranks. Win $COMP.")

def main():
    """Generate the presentation PDF"""
    filename = "Clawdbot_Arena_v2_Presentation.pdf"
    c = canvas.Canvas(filename, pagesize=landscape(letter))

    # Generate slides
    slide_title(c)
    c.showPage()

    slide_overview(c)
    c.showPage()

    slide_game_mechanics(c)
    c.showPage()

    slide_bot_ai(c)
    c.showPage()

    slide_ranking(c)
    c.showPage()

    slide_leaderboard(c)
    c.showPage()

    slide_betting(c)
    c.showPage()

    slide_architecture(c)
    c.showPage()

    slide_roadmap(c)
    c.showPage()

    slide_summary(c)
    c.showPage()

    c.save()
    print(f"Generated: {filename}")

if __name__ == "__main__":
    main()
