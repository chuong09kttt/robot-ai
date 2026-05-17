// ========== GAME LOGIC IN C++ (COMPILED TO WASM) ==========
// This file is compiled to WebAssembly for maximum security
// Reverse engineering this is extremely difficult

#include <emscripten.h>
#include <math.h>
#include <stdlib.h>

// Game state structure
typedef struct {
    float x;
    float y;
    float z;
    float rotation;
    int score;
    int lives;
    int shootCooldown;
    float obstacles[10][3];  // x, y, z positions
    int obstacleCount;
    float powerups[5][3];    // x, y, z positions
    int powerupCount;
} GameState;

static GameState state = {0};

// Initialize game
EMSCRIPTEN_KEEPALIVE
void game_init() {
    state.x = 0;
    state.y = 0;
    state.z = 0;
    state.rotation = 0;
    state.score = 0;
    state.lives = 5;
    state.shootCooldown = 0;
    state.obstacleCount = 0;
    state.powerupCount = 0;
    
    // Initialize obstacle array
    for (int i = 0; i < 10; i++) {
        state.obstacles[i][0] = 0;
        state.obstacles[i][1] = 0;
        state.obstacles[i][2] = -100;
    }
}

// Update game state
EMSCRIPTEN_KEEPALIVE
void game_update(float steering, float speed, int shooting) {
    // Calculate target position (boat/plane movement)
    float targetX = steering * 8.5f;
    state.x += (targetX - state.x) * 0.12f;
    
    // Limit position
    if (state.x > 8.5f) state.x = 8.5f;
    if (state.x < -8.5f) state.x = -8.5f;
    
    // Move forward
    state.z -= speed * 0.48f;
    
    // Calculate rotation
    state.rotation = -steering * 0.5f;
    
    // Handle shooting
    if (shooting && state.shootCooldown <= 0) {
        state.shootCooldown = 10;
    }
    
    if (state.shootCooldown > 0) {
        state.shootCooldown--;
    }
}

// Add score
EMSCRIPTEN_KEEPALIVE
int game_add_score(int points) {
    state.score += points;
    return state.score;
}

// Get current score
EMSCRIPTEN_KEEPALIVE
int game_get_score() {
    return state.score;
}

// Reduce lives
EMSCRIPTEN_KEEPALIVE
int game_hit() {
    state.lives--;
    return state.lives;
}

// Get lives
EMSCRIPTEN_KEEPALIVE
int game_get_lives() {
    return state.lives;
}

// Get position X
EMSCRIPTEN_KEEPALIVE
float game_get_x() {
    return state.x;
}

// Get position Z
EMSCRIPTEN_KEEPALIVE
float game_get_z() {
    return state.z;
}

// Get rotation
EMSCRIPTEN_KEEPALIVE
float game_get_rotation() {
    return state.rotation;
}

// Check if can shoot
EMSCRIPTEN_KEEPALIVE
int game_can_shoot() {
    return state.shootCooldown <= 0;
}

// Create obstacle
EMSCRIPTEN_KEEPALIVE
void game_create_obstacle(float x, float z) {
    if (state.obstacleCount < 10) {
        state.obstacles[state.obstacleCount][0] = x;
        state.obstacles[state.obstacleCount][1] = 0.3f;
        state.obstacles[state.obstacleCount][2] = z;
        state.obstacleCount++;
    }
}

// Update obstacles
EMSCRIPTEN_KEEPALIVE
void game_update_obstacles(float speed) {
    for (int i = 0; i < state.obstacleCount; i++) {
        state.obstacles[i][2] += speed * 0.45f + 0.6f;
    }
    
    // Remove obstacles that passed
    for (int i = 0; i < state.obstacleCount; i++) {
        if (state.obstacles[i][2] > 28.0f) {
            // Shift remaining obstacles
            for (int j = i; j < state.obstacleCount - 1; j++) {
                state.obstacles[j][0] = state.obstacles[j + 1][0];
                state.obstacles[j][1] = state.obstacles[j + 1][1];
                state.obstacles[j][2] = state.obstacles[j + 1][2];
            }
            state.obstacleCount--;
            i--;
        }
    }
}

// Check collision with obstacles
EMSCRIPTEN_KEEPALIVE
int game_check_collision() {
    for (int i = 0; i < state.obstacleCount; i++) {
        float dx = state.obstacles[i][0] - state.x;
        float dz = state.obstacles[i][2] - (state.z + 1.3f);
        float distance = sqrtf(dx * dx + dz * dz);
        
        if (distance < 0.9f) {
            // Remove obstacle
            for (int j = i; j < state.obstacleCount - 1; j++) {
                state.obstacles[j][0] = state.obstacles[j + 1][0];
                state.obstacles[j][1] = state.obstacles[j + 1][1];
                state.obstacles[j][2] = state.obstacles[j + 1][2];
            }
            state.obstacleCount--;
            return 1; // Collision detected
        }
    }
    return 0; // No collision
}

// Reset game
EMSCRIPTEN_KEEPALIVE
void game_reset() {
    state.x = 0;
    state.z = 0;
    state.score = 0;
    state.lives = 5;
    state.shootCooldown = 0;
    state.obstacleCount = 0;
    state.powerupCount = 0;
}

// Get game state as JSON string (for debugging)
EMSCRIPTEN_KEEPALIVE
char* game_get_state_json() {
    static char buffer[512];
    snprintf(buffer, sizeof(buffer), 
        "{\"x\":%.2f,\"z\":%.2f,\"rotation\":%.2f,\"score\":%d,\"lives\":%d,\"obstacles\":%d}",
        state.x, state.z, state.rotation, state.score, state.lives, state.obstacleCount);
    return buffer;
}
