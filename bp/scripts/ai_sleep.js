import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

const ai_player_id = "rg:bot";
const SLEEPING_TAG = "is_sleeping";
const BED_PLACED_TAG = "bed_placed";
const MOVING_TO_BED_TAG = "moving_to_bed";
const NIGHT_TIME_START = 12500;
const NIGHT_TIME_END = 23000;
const SLEEP_CHECK_GAP = 40;

// Track bed locations and movement progress
const bedTracker = new Map();
const movementAttempts = new Map();

function isNight(world) {
    try {
        const dayTime = world.gameRules.doDaylightCycle ? 
            (world.getAbsoluteTime() % 24000) : 
            world.getAbsoluteTime();
        return dayTime >= NIGHT_TIME_START || dayTime < 2000;
    } catch (e) {
        return false;
    }
}

function findSafeBedLocation(ai, searchRadius = 20) {
    if (!ai?.isValid || !ai.dimension) return null;
    
    const loc = ai.location;
    const startX = Math.floor(loc.x);
    const startY = Math.floor(loc.y);
    const startZ = Math.floor(loc.z);
    
    // Check immediate area first (within 5 blocks)
    for (let radius = 3; radius <= searchRadius; radius += 3) {
        for (let x = star - radius; x <= startX + radius; x++) {
            for (let z = startZ - radius; z <= startZ + radius; z++) {
                for (let y = startY - 1; y <= startY + 2; y++) {
                    const groundBlock = ai.dimension.getBlock({ x, y: y - 1, z });
                    const bedBlock = ai.dimension.getBlock({ x, y, z });
                    const headBlock = ai.dimension.getBlock({ x, y: y + 1, z });
                    
                    if (!groundBlock || !bedBlock || !headBlock) continue;
                    
                    const groundTypeId = groundBlock.typeId;
                    const bedTypeId = bedBlock.typeId;
                    const headTypeId = headBlock.typeId;
                    
                    const isSolidGround = groundTypeId !== "minecraft:air" && 
                                         groundTypeId !== "minecraft:cave_air" && 
                                         groundTypeId !== "minecraft:void_air" &&
                                         groundTypeId !== "minecraft:water" &&
                                         groundTypeId !== "minecraft:lava";
                    
                    const isAirBed = bedTypeId === "minecraft:air" || 
                                    bedTypeId === "minecraft:cave_air";
                    
                    const isAirHead = headTypeId === "minecraft:air" || 
                                     headTypeId === "minecraft:cave_air";
                    
                    if (isSolidGround && isAirBed && isAirHead) {
                        return { x, y, z };
                    }
                }
            }
        }
    }
    
    return null;
}

function determineBedFacing(ai, bedLoc) {
    // Determine which direction the bed should face based on available space
    const aiLoc = ai.location;
    const dx = bedLoc.x - aiLoc.x;
    const dz = bedLoc.z - aiLoc.z;
    
    // Simple cardinal direction
    if (Math.abs(dx) > Math.abs(dz)) {
        return dx > 0 ? "west" : "east";
    } else {
        return dz > 0 ? "north" : "south";
    }
}

function placeBedAtLocation(ai, bedLoc) {
    if (!ai?.isValid || !bedLoc) return false;
    
    try {
        const block = ai.dimension.getBlock(bedLoc);
        if (!block || (block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air")) {
            return false;
        }
        
        const facing = determineBedFacing(ai, bedLoc);
        let bedCommand = `setblock ${bedLoc.x} ${bedLoc.y} ${bedLoc.z} minecraft:red_bed`;
        
        // Add facing direction
        switch(facing) {
            case "north": bedCommand += ` ["minecraft:direction"=0]`; break;
            case "west": bedCommand += ` ["minecraft:direction"=1]`; break;
            case "south": bedCommand += ` ["minecraft:direction"=2]`; break;
            case "east": bedCommand += ` ["minecraft:direction"=3]`; break;
        }
        
        ai.dimension.runCommand(bedCommand);
        ai.addTag(BED_PLACED_TAG);
        ai.addTag(MOVING_TO_BED_TAG);
        
        // Track this bed
        bedTracker.set(ai.id, { 
            location: bedLoc, 
            placedAt: system.currentTick,
            facing: facing 
        });
        
        return true;
    } catch (e) {
        return false;
    }
}

function moveAIToBed(ai, bedLoc) {
    if (!ai?.isValid || !bedLoc) return false;
    
    try {
        const distance = Math.sqrt(
            Math.pow(ai.location.x - bedLoc.x, 2) +
            Math.pow(ai.location.y - bedLoc.y, 2) +
            Math.pow(ai.location.z - bedLoc.z, 2)
        );
        
        // Check if already near bed
        if (distance < 2.0) {
            ai.removeTag(MOVING_TO_BED_TAG);
            movementAttempts.delete(ai.id);
            return true;
        }
        
        // Track movement attempts
        const attempts = movementAttempts.get(ai.id) || 0;
        movementAttempts.set(ai.id, attempts + 1);
        
        // If stuck for too long, try alternative approach
        if (attempts > 10) {
            // Try to find path around obstacles
            const navAttempt = tryNavigateToBed(ai, bedLoc);
            if (!navAttempt) {
                // Fallback: slight teleport if really stuck (but very small)
                const newLoc = {
                    x: ai.location.x + (bedLoc.x - ai.location.x) * 0.1,
                    y: ai.location.y,
                    z: ai.location.z + (bedLoc.z - ai.location.z) * 0.1
                };
                ai.teleport(newLoc, {
                    dimension: ai.dimension,
                    rotation: ai.getRotation(),
                    keepVelocity: false
                });
            }
            movementAttempts.set(ai.id, 0);
        }
        
        // Natural movement toward bed
        ai.lookAt({ x: bedLoc.x + 0.5, y: bedLoc.y, z: bedLoc.z + 0.5 });
        
        // Apply movement impulse (better for walking)
        const dx = bedLoc.x - ai.location.x;
        const dz = bedLoc.z - ai.location.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        
        if (length > 0) {
            const moveStrength = 0.2;
            ai.applyImpulse({
                x: (dx / length) * moveStrength,
                y: 0,
                z: (dz / length) * moveStrength
            });
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

function tryNavigateToBed(ai, bedLoc) {
    // Try to find a clear path
    try {
        const midX = Math.floor((ai.location.x + bedLoc.x) / 2);
        const midZ = Math.floor((ai.location.z + bedLoc.z) / 2);
        const midY = Math.floor(ai.location.y);
        
        const midBlock = ai.dimension.getBlock({ x: midX, y: midY, z: midZ });
        const midAbove = ai.dimension.getBlock({ x: midX, y: midY + 1, z: midZ });
        
        if (midBlock && midAbove) {
            const midType = midBlock.typeId;
            const aboveType = midAbove.typeId;
            
            const isClear = (midType === "minecraft:air" || midType === "minecraft:cave_air") &&
                           (aboveType === "minecraft:air" || aboveType === "minecraft:cave_air");
            
            if (isClear) {
                // Path is clear, continue normal movement
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function makeAISleep(ai) {
    if (!ai?.isValid) return false;
    
    try {
        ai.addTag(SLEEPING_TAG);
        
        // Get bed info for proper sleeping position
        const bedInfo = bedTracker.get(ai.id);
        
        // Look down slightly to simulate sleeping
        ai.lookAt({
            x: ai.location.x,
            y: ai.location.y - 0.5,
            z: ai.location.z
        });
        
        try {
            ai.runCommand('playanimation @s sleep');
        } catch (e) {}
        
        // Store that AI successfully slept
        ai.setDynamicProperty("rg:slept_at", system.currentTick);
        
        return true;
    } catch (e) {
        return false;
    }
}

function wakeUpAI(ai) {
    if (!ai?.isValid) return false;
    
    try {
        ai.removeTag(SLEEPING_TAG);
        ai.removeTag(BED_PLACED_TAG);
        ai.removeTag(MOVING_TO_BED_TAG);
        
        bedTracker.delete(ai.id);
        movementAttempts.delete(ai.id);
        
        try {
            ai.runCommand('playanimation @s wake');
        } catch (e) {}
        
        return true;
    } catch (e) {
        return false;
    }
}

function removeBed(ai) {
    if (!ai?.isValid) return;
    
    try {
        const bedInfo = bedTracker.get(ai.id);
        if (bedInfo) {
            const bedLoc = bedInfo.location;
            const block = ai.dimension.getBlock(bedLoc);
            if (block && block.typeId.includes("bed")) {
                ai.dimension.runCommand(`setblock ${bedLoc.x} ${bedLoc.y} ${bedLoc.z} minecraft:air`);
            }
            bedTracker.delete(ai.id);
        } else {
            // Fallback search
            const loc = ai.location;
            for (let x = Math.floor(loc.x) - 3; x <= Math.floor(loc.x) + 3; x++) {
                for (let y = Math.floor(loc.y) - 1; y <= Math.floor(loc.y) + 1; y++) {
                    for (let z = Math.floor(loc.z) - 3; z <= Math.floor(loc.z) + 3; z++) {
                        const block = ai.dimension.getBlock({ x, y, z });
                        if (block && block.typeId.includes("bed")) {
                            ai.dimension.runCommand(`setblock ${x} ${y} ${z} minecraft:air`);
                            return;
                        }
                    }
                }
            }
        }
    } catch (e) {}
}

function checkSleepInterruption(ai) {
    if (!ai?.isValid) return false;
    
    // Check if AI was damaged or entered combat
    const healthComponent = ai.getComponent("minecraft:health");
    if (healthComponent) {
        const currentHealth = healthComponent.currentValue;
        const lastHealth = ai.getDynamicProperty("rg:last_health");
        
        if (lastHealth !== undefined && currentHealth < lastHealth) {
            return true; // Took damage, wake up
        }
        
        ai.setDynamicProperty("rg:last_health", currentHealth);
    }
    
    // Check if there's a threat nearby
    const nearbyHostiles = ai.dimension.getEntities({
        location: ai.location,
        maxDistance: 10,
        families: ["monster", "hostile"]
    });
    
    if (nearbyHostiles.length > 0) {
        return true;
    }
    
    return false;
}

export function startSleepBehavior() {
    system.runInterval(() => {
        try {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;
            
            const currentWorld = world;
            const nightTime = isNight(currentWorld);
            
            for (const ai of allAis) {
                if (!ai.isValid) continue;
                
                const isSleeping = ai.hasTag(SLEEPING_TAG);
                const bedPlaced = ai.hasTag(BED_PLACED_TAG);
                const movingToBed = ai.hasTag(MOVING_TO_BED_TAG);
                
                // Check if sleeping AI was interrupted
                if (isSleeping && checkSleepInterruption(ai)) {
                    wakeUpAI(ai);
                    continue;
                }
                
                if (nightTime && !isSleeping) {
                    // Night time - try to sleep
                    
                    if (!bedPlaced) {
                        const bedLoc = findSafeBedLocation(ai);
                        if (bedLoc) {
                            placeBedAtLocation(ai, bedLoc);
                        }
                    } else {
                        const bedInfo = bedTracker.get(ai.id);
                        if (bedInfo) {
                            const nearBed = moveAIToBed(ai, bedInfo.location);
                            
                            if (nearBed) {
                                makeAISleep(ai);
                            }
                        }
                    }
                } else if (!nightTime && isSleeping) {
                    // Day time - wake up
                    wakeUpAI(ai);
                    removeBed(ai);
                } else if (!nightTime && bedPlaced && !isSleeping) {
                    // Cleanup any leftover beds during day
                    removeBed(ai);
                    wakeUpAI(ai);
                }
            }
        } catch (e) {
            // Silent fail
        }
    }, SLEEP_CHECK_GAP);
}