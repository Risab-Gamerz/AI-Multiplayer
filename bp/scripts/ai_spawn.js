import { world, system, Player, Dimension, Block } from "@minecraft/server";
import { REAL_PLAYERS_CACHE } from "./rgstart.js";
// =================================================================
// --- Global Core Configuration ---
// =================================================================

const ai_player_id = "rg:bot";
const GLOBAL_WATCH_GAP = 100; // Core loop interval: runs spawning logic once every 1 second (20 ticks)
const PLAYER_SAMPLE_COUNT = 2; // [Mechanism One: Global Sampling] Number of players randomly sampled per loop for checking (Multi-player servers recommend keeping at 1-3)
const LIGHT_LEVEL_DAY_THRESHOLD = 7; // Overworld brightness > 7 is considered daytime

// --- Spawn Range Configuration ---
const MIN_SPAWN_RADIUS = 32; // Closest to player: 24 blocks (within ring area)
const MAX_SPAWN_RADIUS = 64; // Farthest from player: 64 blocks
const CHECK_Y_MIN = -63;     // Minimum Y coordinate to check (e.g.: Y=-63)
const CHECK_Y_MAX = 255;     // Maximum Y coordinate to check

// --- [Mechanism Two/Three: Zone Cooldown] Configuration ---
const ZONE_BLOCK_SIZE = 400; // Zone size: 400x400

// =================================================================
// --- Multi-dimensional/Time Configuration Table ---
// =================================================================
// Configuration key for tracking config cooldown (Config Cooldown)
const SPAWN_CONFIGS = {

    // --- Default Fallback Configuration ---
    "default": {
        SPAWN_GAP_SECONDS: 60,         // [Config Cooldown] Attempt to spawn once every 60 seconds
        SPAWN_CHANCE: 0.0,                  // Spawn probability per attempt
        MAX_SPAWN_COUNT: 1,                 // Maximum spawn count per attempt
        MAX_AI_NEARBY: 3,                   // Max AI count around player (pre-check density)
        NEARBY_RADIUS: 40,                  // Density check radius
        COOLDOWN_BASE_SECONDS: 120,         // [Dynamic Zone Cooldown] Base cooldown time (120 seconds)
        COOLDOWN_MULTIPLIER_PER_AI: 60,     // Cooldown time increase per 1 nearby AI (60 sec/AI)
        EXCLUDED_BLOCKS: ["minecraft:dirt", "minecraft:stone"],
        UNDERGROUND_SPAWN_CHANCE: 0.4
    },

    // --- Overworld - Daytime (brightness > 7) ---
    "minecraft:overworld_day": {
        SPAWN_GAP_SECONDS: 60,
        SPAWN_CHANCE: 0.5,
        MAX_SPAWN_COUNT: 2,                 // Can spawn 1-2
        MAX_AI_NEARBY: 3,
        NEARBY_RADIUS: 128,
        COOLDOWN_BASE_SECONDS: 120,         // 2 minute base cooldown
        COOLDOWN_MULTIPLIER_PER_AI: 60,     // 
        EXCLUDED_BLOCKS: ["minecraft:air", "minecraft:lava"],
        UNDERGROUND_SPAWN_CHANCE: 0.4
    },

    // --- Overworld - Nighttime (brightness <= 7) ---
    "minecraft:overworld_night": {
        SPAWN_GAP_SECONDS: 60,
        SPAWN_CHANCE: 0.4,
        MAX_SPAWN_COUNT: 2,
        MAX_AI_NEARBY: 3,
        NEARBY_RADIUS: 128,
        COOLDOWN_BASE_SECONDS: 180,
        COOLDOWN_MULTIPLIER_PER_AI: 60,
        EXCLUDED_BLOCKS: ["minecraft:air", "minecraft:lava"],
        UNDERGROUND_SPAWN_CHANCE: 0.4
    },

    // --- Nether (Hell) ---
    "minecraft:nether": {
        SPAWN_GAP_SECONDS: 75,
        SPAWN_CHANCE: 0.3,
        MAX_SPAWN_COUNT: 1,                 // Spawn only 1
        MAX_AI_NEARBY: 3,
        NEARBY_RADIUS: 128,
        COOLDOWN_BASE_SECONDS: 240,         // 4 minute base cooldown
        COOLDOWN_MULTIPLIER_PER_AI: 90,     // High density penalty
        EXCLUDED_BLOCKS: ["minecraft:air", "minecraft:lava"],
        UNDERGROUND_SPAWN_CHANCE: 0.4
    },

    // --- End Dimension ---
    "minecraft:the_end": {
        SPAWN_GAP_SECONDS: 90,
        SPAWN_CHANCE: 0.2,
        MAX_SPAWN_COUNT: 1,                 // Spawn only 1
        MAX_AI_NEARBY: 2,
        NEARBY_RADIUS: 128,
        COOLDOWN_BASE_SECONDS: 480,         // 8 minute base cooldown
        COOLDOWN_MULTIPLIER_PER_AI: 120,    // Highest density penalty
        EXCLUDED_BLOCKS: ["minecraft:air", "minecraft:lava"],
        UNDERGROUND_SPAWN_CHANCE: 0.4
    }
};

// =================================================================
// --- Core Tracker ---
// =================================================================

const spawnCooldowns = new Map();     // For tracking config cooldown (Config Cooldown)
const spawnZoneCooldowns = new Map(); // For tracking zone cooldown (Zone Cooldown)


// =================================================================
// --- Helper Functions ---
// =================================================================

/**
 * Get the correct configuration and key based on dimension and light level.
 */
function getSpawnConfig(player) {
    const dimId = player.dimension.id;
    let key = dimId;

    if (dimId === "minecraft:overworld") {
        try {
            // Get the light level at the player's location
            const lightLevel = player.dimension.getLightLevel(player.location);
            key = lightLevel > LIGHT_LEVEL_DAY_THRESHOLD ? "minecraft:overworld_day" : "minecraft:overworld_night";
        } catch (e) {
            // Default daytime, avoid errors caused by unloaded chunks
            key = "minecraft:overworld_day";
        }
    }

    const config = SPAWN_CONFIGS[key] || SPAWN_CONFIGS["default"];
    return { config, key };
}

function getZoneKey(dimension, loc) {
    const xZone = (loc.x / ZONE_BLOCK_SIZE) | 0;
    const zZone = (loc.z / ZONE_BLOCK_SIZE) | 0;
    return `${dimension.id}_${xZone}_${zZone}`;
}


function getNearbyAICount(dimension, location, radius) {

    const nearbyEntities = dimension.getEntities({
        type: ai_player_id,
        maxDistance: radius,
        location: location
    });

    let untamedAICount = 0;

    for (const entity of nearbyEntities) {
        if (!entity || !entity.isValid) {
            continue;
        }

        const tameableComp = entity.getComponent('minecraft:tameable');

        if (!tameableComp || !tameableComp.isTamed) {
            untamedAICount++;
        }
    }

    return untamedAICount;
}

function isSafeSpawnLocation(dimension, loc, excludedBlocks) {

    // [Robustness Fix 1] Ensure excludedBlocks is an array
    const blacklist = Array.isArray(excludedBlocks) ? excludedBlocks : [];

    // Ensure rounded coordinates are used for querying
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);


    try {
        // 1. Get blocks
        const floorBlock = dimension.getBlock({ x: x, y: y - 1, z: z }); // Block below
        const currentBlock = dimension.getBlock({ x: x, y: y, z: z });   // Current block
        const headBlock = dimension.getBlock({ x: x, y: y + 1, z: z }); // Block above

        // Check 1: Block below (floorBlock) must be a solid block for entity to stand on

        // 1.1 If block below is null (unloaded chunk), return false immediately.
        if (!floorBlock) {
            return false;
        }


        // 1.2 Check if in blacklist (air and lava)
        if (blacklist.includes(floorBlock.typeId)) {
            return false;
        }

        // 2.1 Check current block (Y)
        if (!currentBlock || currentBlock.typeId !== "minecraft:air") {
            return false;
        }

        // 2.2 Check block above (Y+1)
        if (!headBlock || headBlock.typeId !== "minecraft:air") {
            return false;
        }
        return true;

    } catch (e) {
        return false;
    }
}





// =================================================================
// --- Core Spawn Logic ---
// =================================================================

function trySpawnAI() {

    // [Core Optimization 1] Use global cache REAL_PLAYERS_CACHE, performance overhead approaches 0
    const allPlayers = REAL_PLAYERS_CACHE;
    if (!allPlayers || allPlayers.length === 0) return; // Check cache

    // 1. [Global Sampling] Select players to check in this loop (high performance critical)
    // Although sort() is relatively slow, the impact is acceptable since allPlayers is cached and the number is small.
    const playersToSample = allPlayers.length <= PLAYER_SAMPLE_COUNT
        ? allPlayers
        // Use slice() for random sampling
        : [...allPlayers].sort(() => 0.5 - Math.random()).slice(0, PLAYER_SAMPLE_COUNT);

    for (const player of playersToSample) {
        const { config, key } = getSpawnConfig(player);
        const dimension = player.dimension;
        const currentTick = system.currentTick;
        const playerLoc = player.location;
        const zoneKey = getZoneKey(dimension, playerLoc);

        // 0. [Config Cooldown Check] ... (unchanged)
        const nextSpawnTick = spawnCooldowns.get(key) || 0;
        if (currentTick < nextSpawnTick) continue;

        // 1. [Zone Cooldown Check] ... (unchanged)
        const zoneCooldownExpiry = spawnZoneCooldowns.get(zoneKey) || 0;
        if (currentTick < zoneCooldownExpiry) continue;

        // 2. Density check (pre-check) ... (unchanged)
        const nearbyAI_pre = getNearbyAICount(dimension, playerLoc, config.NEARBY_RADIUS);
        if (nearbyAI_pre >= config.MAX_AI_NEARBY) continue;

        // 3. Probability check... (unchanged)
        if (Math.random() > config.SPAWN_CHANCE) {
            const cooldownDuration = config.SPAWN_GAP_SECONDS * 20;
            spawnCooldowns.set(key, currentTick + cooldownDuration);
            continue;
        }

        // 4. [Extreme Optimization] Random direction search

        const randomAngle = Math.random() * 2 * Math.PI;
        const randomDistance = MIN_SPAWN_RADIUS + Math.random() * (MAX_SPAWN_RADIUS - MIN_SPAWN_RADIUS);

        const offsetX = Math.cos(randomAngle) * randomDistance;
        const offsetZ = Math.sin(randomAngle) * randomDistance;

        // [Micro Optimization 2] Use | 0 instead of Math.floor
        const baseLoc = {
            x: (playerLoc.x + offsetX) | 0,
            z: (playerLoc.z + offsetZ) | 0
        };

        let safeLoc = null;
        const excludedBlocks = config.EXCLUDED_BLOCKS;

        const roll = Math.random();
        const isUndergroundRoll = roll < config.UNDERGROUND_SPAWN_CHANCE;

        let yStart, yEnd, yStep;

        if (isUndergroundRoll) {
            yStart = CHECK_Y_MIN;
            yEnd = CHECK_Y_MAX;
            yStep = 1;
        } else {
            yStart = CHECK_Y_MAX;
            yEnd = CHECK_Y_MIN;
            yStep = -1;
        }

        // [Unified search loop]... (unchanged)
        for (let y = yStart; (yStep > 0 ? y <= yEnd : y >= yEnd); y += yStep) {
            const checkLoc = { x: baseLoc.x, y: y, z: baseLoc.z };

            if (isSafeSpawnLocation(dimension, checkLoc, excludedBlocks)) {
                safeLoc = checkLoc;
                break;
            }
        }

        // 5. If no safe point found... (unchanged)
        if (!safeLoc) {
            const cooldownDuration = config.SPAWN_GAP_SECONDS * 20;
            spawnCooldowns.set(key, currentTick + cooldownDuration);
            continue;
        }

        // --- Found safe point, spawn ---

        // A. Execute spawn
        // [Micro Optimization 3] Use | 0 instead of Math.floor
        const spawnCount = config.MAX_SPAWN_COUNT === 1
            ? 1
            : ((Math.random() * config.MAX_SPAWN_COUNT) | 0) + 1;

        for (let i = 0; i < spawnCount; i++) {
            // Random offset does not need Math.floor
            const spawnLoc = {
                x: safeLoc.x + 0.5 + Math.random() * 0.2 - 0.1,
                y: safeLoc.y,
                z: safeLoc.z + 0.5 + Math.random() * 0.2 - 0.1
            };
            dimension.spawnEntity(ai_player_id, spawnLoc);
        }

        // B. [Activate Config Cooldown]
        const cooldownDuration = config.SPAWN_GAP_SECONDS * 20;
        spawnCooldowns.set(key, currentTick + cooldownDuration);

        // C. [Activate Dynamic Zone Cooldown]
        const nearbyAI_post = getNearbyAICount(dimension, playerLoc, config.NEARBY_RADIUS);

        // Calculate dynamic cooldown time (Ticks)
        const baseCooldownTicks = config.COOLDOWN_BASE_SECONDS * 20;
        const multiplierCooldownTicks = nearbyAI_post * (config.COOLDOWN_MULTIPLIER_PER_AI * 20);

        // [Micro Optimization 4] Use | 0 to ensure final cooldown time is integer
        const dynamicCooldownTicks = (baseCooldownTicks + multiplierCooldownTicks) | 0;

        spawnZoneCooldowns.set(zoneKey, currentTick + dynamicCooldownTicks);

    }
}



// =================================================================
// --- Export Init Function ---
// =================================================================

/**
 * Export function: start AI player timed spawning system.
 */
export function startAISpawner() {
    // Start global WATCHing loop, it runs at fixed GLOBAL_WATCH_GAP
    system.runInterval(trySpawnAI, GLOBAL_WATCH_GAP);
    console.log(`[AI Spawner] Initialization complete, global check interval is ${GLOBAL_WATCH_GAP / 20} seconds.`);
}
