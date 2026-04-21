import { world, system } from "@minecraft/server";
import { REAL_PLAYERS_CACHE } from "./rgstart.js";

const ai_player_id = "rg:bot";
const PATHFINDING_CHECK_GAP = 10;
const PROXIMITY_RADIUS = 32;

// Helper to get AI's current target
function getAITarget(ai) {
    if (!ai || !ai.isValid) return null;
    
    const targetId = ai.getDynamicProperty("rg:current_target");
    if (!targetId) return null;
    
    try {
        const target = world.getEntity(targetId);
        if (!target || !target.isValid) {
            // Clean up invalid target
            ai.setDynamicProperty("rg:current_target", null);
            return null;
        }
        return target;
    } catch (e) {
        return null;
    }
}

export function startPathfindingTweaks() {
    system.runInterval(() => {
        const allPlayers = REAL_PLAYERS_CACHE;
        if (!allPlayers || allPlayers.length === 0) return;

        const activeAIs = new Set();

        for (const player of allPlayers) {
            if (!player.isValid) continue;

            try {
                const nearbyAI = player.dimension.getEntities({
                    type: ai_player_id,
                    maxDistance: PROXIMITY_RADIUS,
                    location: player.location
                });

                for (const ai of nearbyAI) {
                    if (!ai.isValid) continue;
                    
                    // Check if AI has a target using dynamic property
                    const hasTarget = ai.getDynamicProperty("rg:current_target") !== null;
                    
                    // Don't bridge if bot is in or near water
                    if (hasTarget && ai.isOnGround && !ai.isInWater) {
                        activeAIs.add(ai);
                    }
                }
            } catch (e) {
                // Silent fail for dimension issues
            }
        }

        for (const ai of activeAIs) {
            try {
                bridgeGap(ai);
            } catch (e) {
                // Ignore temporary failures
            }
        }
    }, PATHFINDING_CHECK_GAP);
}

function isWaterOrLava(block) {
    if (!block) return false;
    const id = block.typeId;
    return id === "minecraft:water" || id === "minecraft:lava" ||
           id === "minecraft:flowing_water" || id === "minecraft:flowing_lava";
}

function bridgeGap(ai) {
    // Get target from dynamic property
    const target = getAITarget(ai);
    if (!target) return;
    
    const aiLoc = ai.location;
    const targetLoc = target.location;

    // Only bridge if target is on same elevation or higher
    if (targetLoc.y < aiLoc.y - 1) {
        return;
    }

    const dx = targetLoc.x - aiLoc.x;
    const dz = targetLoc.z - aiLoc.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.0) return;

    const normX = dx / dist;
    const normZ = dz / dist;

    // Check block ahead
    const aheadX = Math.floor(aiLoc.x + (normX * 1.25));
    const aheadZ = Math.floor(aiLoc.z + (normZ * 1.25));
    const feetY = Math.floor(aiLoc.y);
    const bodyY = feetY + 1;
    const belowFeetY = feetY - 1;

    const dim = ai.dimension;
    
    const bodyBlock = dim.getBlock({x: aheadX, y: bodyY, z: aheadZ});
    const feetBlock = dim.getBlock({x: aheadX, y: feetY, z: aheadZ});
    const belowFeetBlock = dim.getBlock({x: aheadX, y: belowFeetY, z: aheadZ});

    if (!bodyBlock || !feetBlock || !belowFeetBlock) return;

    // ✅ Never bridge over or into water/lava
    if (isWaterOrLava(feetBlock) || isWaterOrLava(belowFeetBlock) || isWaterOrLava(bodyBlock)) return;

    // Check if body is clear and there's a gap to bridge
    const isBodyClear = bodyBlock.isAir || !bodyBlock.isSolid;
    const isGap = (feetBlock.isAir || !feetBlock.isSolid) && 
                  (belowFeetBlock.isAir || !belowFeetBlock.isSolid);

    if (isBodyClear && isGap) {
        const currentTick = system.currentTick;
        const lastBridgeTick = ai.getDynamicProperty("rg:last_bridge_tick") || 0;
        if (currentTick < lastBridgeTick + 5) return;

        try {
            // Play sound (synchronous - no .catch needed)
            ai.runCommand(`playsound dig.stone @a ${aheadX} ${feetY} ${aheadZ}`);
            
            // Place bridging block (synchronous)
            dim.runCommand(`setblock ${aheadX} ${feetY} ${aheadZ} cobblestone`);
            
            // Give forward impulse (skip if in water to allow swimming)
            if (!ai.isInWater) {
                const moveSpeed = 0.15;
                ai.applyImpulse({ x: normX * moveSpeed, y: 0.1, z: normZ * moveSpeed });
            }

            ai.setDynamicProperty("rg:last_bridge_tick", currentTick);
        } catch (e) {
            // Silent fail
        }
    }
}