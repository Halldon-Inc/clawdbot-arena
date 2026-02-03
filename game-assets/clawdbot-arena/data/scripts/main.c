// Clawdbot Arena - Main Script
// Exposes game state for JavaScript bridge integration

// Global state tracking
int roundNumber = 1;
int roundsP1 = 0;
int roundsP2 = 0;
int matchPhase = 0; // 0=countdown, 1=fighting, 2=ko, 3=finished

// Player entity handles
void player1 = NULL();
void player2 = NULL();

// Called every engine tick
void main() {
    // Get player entities
    player1 = getplayerproperty(0, "entity");
    player2 = getplayerproperty(1, "entity");

    if (player1 == NULL() || player2 == NULL()) {
        return;
    }

    // Update match phase
    updateMatchPhase();

    // Export state for JavaScript bridge
    exportGameState();
}

void updateMatchPhase() {
    int p1Health = getentityproperty(player1, "health");
    int p2Health = getentityproperty(player2, "health");

    if (matchPhase == 1) { // Fighting
        // Check for KO
        if (p1Health <= 0) {
            matchPhase = 2; // KO
            roundsP2 = roundsP2 + 1;
            checkMatchEnd();
        } else if (p2Health <= 0) {
            matchPhase = 2; // KO
            roundsP1 = roundsP1 + 1;
            checkMatchEnd();
        }
    }
}

void checkMatchEnd() {
    // Best of 3
    if (roundsP1 >= 2 || roundsP2 >= 2) {
        matchPhase = 3; // Match finished
    } else {
        // Next round after delay
        roundNumber = roundNumber + 1;
    }
}

void exportGameState() {
    // These values are read by the JavaScript bridge
    // through the OpenBOR WASM memory interface

    // The bridge reads:
    // - Player 1 & 2 health, position, state
    // - Round number and round wins
    // - Match phase
    // - Timer remaining

    // State is automatically available through getentityproperty()
    // The JS bridge polls this data every frame
}

// Called when player takes damage
void ondamage() {
    void self = getlocalvar("self");
    void attacker = getlocalvar("attacker");
    int damage = getlocalvar("damage");

    // Log for combo tracking
    log("DAMAGE: " + damage);
}

// Called on KO
void ondeath() {
    void self = getlocalvar("self");
    log("KO");
}

// Reset for new round
void onround() {
    matchPhase = 0; // Countdown

    // Reset positions
    if (player1 != NULL()) {
        changeentityproperty(player1, "position", 200, 0, 400);
        changeentityproperty(player1, "health", 1000);
    }
    if (player2 != NULL()) {
        changeentityproperty(player2, "position", 1720, 0, 400);
        changeentityproperty(player2, "health", 1000);
    }
}
