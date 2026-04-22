import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";
import { isNightTime } from "./ai_mood.js";

const ai_player_id = "rg:bot";
const SHELTER_CHECK_GAP = 200;  // Every 10s
const SHELTER_TAG = "has_shelter";
const BUILDING_SHELTER_TAG = "building_shelter";

// Check if bot is exposed (no roof within 2 blocks above)
function isExposed(bot) {
    if (!bot?.isValid) return false;
    
    const pos = bot.location;
    const dim = bot.dimension;
    const cx = Math.floor(pos.x);
    const cy = Math.floor(pos.y);
    const cz = Math.floor(pos.z);
    
    // Check 2 blocks above in all directions
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const block = dim.getBlock({ x: cx + dx, y: cy + 2, z: cz + dz });
            if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
                return false; // Found roof
            }
        }
    }
    return true; // No roof, exposed
}

// Build a simple 5x5x4 shelter
function buildShelter(bot) {
    if (!bot?.isValid) return;
    
    const pos = bot.location;
    const cx = Math.floor(pos.x);
    const cy = Math.floor(pos.y) - 1;
    const cz = Math.floor(pos.z);
    
    try {
        bot.addTag(BUILDING_SHELTER_TAG);
        
        // Build walls and roof using setblock command
        // Walls (4 high)
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                // Only perimeter walls
                if (x === -2 || x === 2 || z === -2 || z === 2) {
                    for (let y = 0; y < 4; y++) {
                        const bx = cx + x;
                        const by = cy + y;
                        const bz = cz + z;
                        world.runCommand(`setblock ${bx} ${by} ${bz} cobblestone replace`);
                    }
                }
            }
        }
        
        // Roof
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                const bx = cx + x;
                const by = cy + 4;
                const bz = cz + z;
                world.runCommand(`setblock ${bx} ${by} ${bz} cobblestone replace`);
            }
        }
        
        // Door entrance (front wall)
        world.runCommand(`setblock ${cx} ${cy} ${cz - 2} air replace`);
        world.runCommand(`setblock ${cx} ${cy + 1} ${cz - 2} air replace`);
        
        bot.addTag(SHELTER_TAG);
        bot.removeTag(BUILDING_SHELTER_TAG);
    } catch (e) {}
}

export function startShelterBuilder() {
    system.runInterval(() => {
        if (!isNightTime()) return;
        
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;
        
        for (const bot of allAis) {
            if (!bot.isValid) continue;
            
            // Skip if already has shelter
            if (bot.hasTag(SHELTER_TAG)) continue;
            
            // Skip if building right now
            if (bot.hasTag(BUILDING_SHELTER_TAG)) continue;
            
            // Skip if in combat or eating
            if (bot.getDynamicProperty("rg:current_target")) continue;
            if (bot.hasTag("on_eat")) continue;
            
            // Check if exposed - if yes, build immediately
            if (isExposed(bot)) {
                buildShelter(bot);
            }
        }
    }, SHELTER_CHECK_GAP);
    
    // Remove shelter tag at dawn
    system.runInterval(() => {
        if (isNightTime()) return;
        
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;
        
        for (const bot of allAis) {
            if (bot.isValid && bot.hasTag(SHELTER_TAG)) {
                bot.removeTag(SHELTER_TAG);
            }
        }
    }, 200);
}
