import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";
import { isNightTime } from "./ai_mood.js";

// ============================================================================
// CONFIG
// ============================================================================
const TORCH_CHECK_GAP  = 80;   // Every 4 seconds
const TORCH_COOLDOWN_TICKS  = 600;  // Min 30s between placements per bot
const TORCH_PLACE_CHANCE    = 0.40; // 40% chance per check when all conditions met
const TORCH_BLOCK           = "minecraft:torch";

// 4 cardinal side positions to try placing a torch
const SIDE_OFFSETS = [
    { dx:  1, dz:  0 },
    { dx: -1, dz:  0 },
    { dx:  0, dz:  1 },
    { dx:  0, dz: -1 }
];

// ============================================================================
// HELPERS
// ============================================================================
/**
 * Returns true if the bot is outdoors (no solid block within 4 blocks above).
 * Avoids the expensive full-column scan from ai_environment.js.
 */
function isOutdoors(dim, loc) {
    const x = Math.floor(loc.x);
    const z = Math.floor(loc.z);
    const baseY = Math.floor(loc.y);

    for (let dy = 1; dy <= 4; dy++) {
        try {
            const b = dim.getBlock({ x, y: baseY + dy, z });
            if (b && !b.isAir && b.isSolid) return false; // Covered → indoors
        } catch (e) {
            return false; // Chunk not loaded
        }
    }
    return true; // Clear sky above → outdoors
}

/**
 * Tries to place a torch on the first valid adjacent tile.
 * Returns true if a torch was placed.
 */
function tryPlaceTorch(ai) {
    const loc = ai.location;
    const dim = ai.dimension;
    const baseX = Math.floor(loc.x);
    const baseY = Math.floor(loc.y);
    const baseZ = Math.floor(loc.z);

    for (const off of SIDE_OFFSETS) {
        const tx = baseX + off.dx;
        const ty = baseY;
        const tz = baseZ + off.dz;

        try {
            const spot  = dim.getBlock({ x: tx, y: ty,     z: tz });
            const below = dim.getBlock({ x: tx, y: ty - 1, z: tz });

            if (!spot || !below) continue;
            if (!spot.isAir) continue;            // Spot must be empty
            if (below.isAir || !below.isSolid) continue; // Must have solid floor

            world.runCommand(`setblock ${tx} ${ty} ${tz} ${TORCH_BLOCK}`);
            try { ai.runCommand(`playsound random.click @a ${tx} ${ty} ${tz} 1 1`); } catch (e) {}
            return true;
        } catch (e) {}
    }
    return false;
}

// ============================================================================
// startR
// ============================================================================
export function startTorchPlacement() {
    system.runInterval(() => {
        // Only run at night — cheap check thanks to shared cache in ai_mood.js
        if (!isNightTime()) return;

        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        for (const ai of allAis) {
            if (!ai.isValid) continue;

            // Skip busy or submerged bots
            if (ai.isInWater || ai.isFalling) continue;
            if (ai.hasTag("is_busy_building") || ai.hasTag("on_eat") ||
                ai.hasTag("is_sleeping")       || ai.hasTag("is_in_combat")) continue;

            // Stochastic skip to spread cost across frames
            if (Math.random() > TORCH_PLACE_CHANCE) continue;

            // Cooldown: don't spam torches
            const lastTorch = ai.getDynamicProperty("rg:last_torch_tick") || 0;
            if (system.currentTick < lastTorch + TORCH_COOLDOWN_TICKS) continue;

            // Only place torches outdoors
            if (!isOutdoors(ai.dimension, ai.location)) continue;

            if (tryPlaceTorch(ai)) {
                ai.setDynamicProperty("rg:last_torch_tick", system.currentTick);
            }
        }
    }, TORCH_CHECK_GAP);
}
