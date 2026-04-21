import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

const ai_player_id = "rg:bot";
const BREAKING_TAG = "is_breaking_block";
const OBSTACLE_CHECK_GAP = 5; // Check every 0.25 seconds

// Blocks that are breakable by bots
const BREAKABLE_BLOCKS = [
    "minecraft:oak_leaves", "minecraft:birch_leaves", "minecraft:spruce_leaves", "minecraft:dark_oak_leaves", "minecraft:acacia_leaves", "minecraft:jungle_leaves",
    "minecraft:oak_log", "minecraft:birch_log", "minecraft:spruce_log", "minecraft:dark_oak_log", "minecraft:acacia_log", "minecraft:jungle_log",
    "minecraft:oak_wood", "minecraft:birch_wood", "minecraft:spruce_wood", "minecraft:dark_oak_wood", "minecraft:acacia_wood", "minecraft:jungle_wood",
    "minecraft:dirt", "minecraft:grass_block", "minecraft:gravel", "minecraft:sand", "minecraft:red_sand",
    "minecraft:tall_grass", "minecraft:large_fern", "minecraft:seagrass", "minecraft:tall_seagrass",
    "minecraft:snow", "minecraft:snow_block", "minecraft:ice", "minecraft:packed_ice",
    "minecraft:cobweb", "minecraft:hay_block", "minecraft:sugar_cane", "minecraft:kelp_plant",
    "minecraft:crimson_fungus", "minecraft:warped_fungus", "minecraft:crimson_roots", "minecraft:warped_roots",
    "minecraft:hanging_roots", "minecraft:sculk_sensor"
];

// Unbreakable blocks that bots should avoid
const UNBREAKABLE_BLOCKS = [
    "minecraft:bedrock", "minecraft:obsidian", "minecraft:crying_obsidian", "minecraft:reinforced_deepslate"
];

// Check if block type is breakable
function isBreakableBlock(blockTypeId) {
    if (!blockTypeId) return false;
    
    // Check if it's in breakable list
    if (BREAKABLE_BLOCKS.includes(blockTypeId)) return true;
    
    // Avoid unbreakable blocks
    if (UNBREAKABLE_BLOCKS.includes(blockTypeId)) return false;
    
    // Breakable: most natural blocks, crops, saplings
    return blockTypeId.includes('sapling') ||
           blockTypeId.includes('crop') ||
           blockTypeId.includes('flower') ||
           blockTypeId.includes('cactus') ||
           blockTypeId.includes('vine') ||
           blockTypeId.includes('mushroom') ||
           blockTypeId.includes('fungus');
}

// Get blocks in front of the bot based on direction
function getBlocksInFront(ai, distance = 2) {
    if (!ai?.isValid || !ai.dimension) return [];
    
    const loc = ai.location;
    const rotation = ai.getRotation();
    const yaw = (rotation.y * Math.PI) / 180;
    
    // Calculate direction vector from yaw
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);
    
    const blocksInFront = [];
    
    // Check blocks in front (at feet level and head level)
    for (let i = 1; i <= distance; i++) {
        const x = Math.floor(loc.x + dirX * i);
        const z = Math.floor(loc.z + dirZ * i);
        
        // Check feet level
        const feetBlock = ai.dimension.getBlock({ x, y: Math.floor(loc.y), z });
        if (feetBlock && feetBlock.typeId !== "minecraft:air" && feetBlock.typeId !== "minecraft:cave_air") {
            blocksInFront.push({ block: feetBlock, location: { x, y: Math.floor(loc.y), z } });
        }
        
        // Check head level (might be taller obstacle)
        const headBlock = ai.dimension.getBlock({ x, y: Math.floor(loc.y) + 1, z });
        if (headBlock && headBlock.typeId !== "minecraft:air" && headBlock.typeId !== "minecraft:cave_air") {
            blocksInFront.push({ block: headBlock, location: { x, y: Math.floor(loc.y) + 1, z } });
        }
    }
    
    return blocksInFront;
}

// Check if bot is stuck (hasn't moved)
function isBotStuck(ai) {
    if (!ai?.isValid) return false;
    
    const lastPos = ai.getDynamicProperty("rg:last_position");
    const lastCheck = ai.getDynamicProperty("rg:last_stuck_check") || 0;
    const currentTick = system.currentTick;
    
    // Only check every second
    if (currentTick < lastCheck + 20) return false;
    
    ai.setDynamicProperty("rg:last_stuck_check", currentTick);
    
    if (!lastPos) {
        ai.setDynamicProperty("rg:last_position", JSON.stringify(ai.location));
        return false;
    }
    
    try {
        const prev = JSON.parse(lastPos);
        const distance = Math.sqrt(
            Math.pow(ai.location.x - prev.x, 2) +
            Math.pow(ai.location.y - prev.y, 2) +
            Math.pow(ai.location.z - prev.z, 2)
        );
        
        ai.setDynamicProperty("rg:last_position", JSON.stringify(ai.location));
        
        // If moved less than 1.0 blocks in last second, considered stuck
        return distance < 1.0;
    } catch (e) {
        return false;
    }
}

// Break block in front of bot
function breakBlockInFront(ai, blockLocation) {
    if (!ai?.isValid) return false;
    
    try {
        // Don't break if already breaking
        if (ai.hasTag(BREAKING_TAG)) return false;
        
        // Don't break if in combat (need to fight)
        if (ai.getDynamicProperty("rg:current_target")) return false;
        
        const blockTypeId = ai.dimension.getBlock(blockLocation)?.typeId;
        
        // Only break if it's breakable
        if (!isBreakableBlock(blockTypeId)) return false;
        
        ai.addTag(BREAKING_TAG);
        
        // Look at the block (ai.lookAt doesn't exist — calculate rotation manually)
        try {
            const bx  = blockLocation.x + 0.5 - ai.location.x;
            const by  = blockLocation.y + 0.5 - (ai.location.y + 1.62); // eye height
            const bz  = blockLocation.z + 0.5 - ai.location.z;
            const yaw   = Math.atan2(-bx, bz) * (180 / Math.PI);
            const hDist = Math.sqrt(bx * bx + bz * bz);
            const pitch = -Math.atan2(by, hDist) * (180 / Math.PI);
            ai.setRotation({ x: pitch, y: yaw });
        } catch (e) {}
        
        // Play digging animation
        try {
            ai.runCommand('playanimation @s attack_mine');
        } catch (e) {}
        
        // Break block after delay
        const breakTime = 10; // Quick break
        system.runTimeout(() => {
            if (!ai.isValid) return;
            
            try {
                ai.dimension.runCommand(`setblock ${blockLocation.x} ${blockLocation.y} ${blockLocation.z} minecraft:air destroy`);
                
                // Play break sound
                ai.runCommand(`playsound dig.${blockTypeId.split(':')[1] || 'stone'} @a[r=16]`);
            } catch (e) {}
            
            ai.removeTag(BREAKING_TAG);
        }, breakTime);
        
        return true;
    } catch (e) {
        ai.removeTag(BREAKING_TAG);
        return false;
    }
}

// Get all blocks surrounding the bot (up, down, forward, back, left, right)
function getBlocksAround(ai, distance = 2) {
    if (!ai?.isValid || !ai.dimension) return [];
    
    const loc = ai.location;
    const rotation = ai.getRotation();
    const yaw = (rotation.y * Math.PI) / 180;
    
    // Calculate direction vectors
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);
    const leftX = Math.sin(yaw + Math.PI / 2);
    const leftZ = Math.cos(yaw + Math.PI / 2);
    
    const blocksAround = [];
    
    // Forward
    for (let i = 1; i <= distance; i++) {
        const x = Math.floor(loc.x + dirX * i);
        const z = Math.floor(loc.z + dirZ * i);
        const block = ai.dimension.getBlock({ x, y: Math.floor(loc.y), z });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x, y: Math.floor(loc.y), z } });
        }
    }
    
    // Backward
    for (let i = 1; i <= distance; i++) {
        const x = Math.floor(loc.x - dirX * i);
        const z = Math.floor(loc.z - dirZ * i);
        const block = ai.dimension.getBlock({ x, y: Math.floor(loc.y), z });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x, y: Math.floor(loc.y), z } });
        }
    }
    
    // Left
    for (let i = 1; i <= distance; i++) {
        const x = Math.floor(loc.x + leftX * i);
        const z = Math.floor(loc.z + leftZ * i);
        const block = ai.dimension.getBlock({ x, y: Math.floor(loc.y), z });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x, y: Math.floor(loc.y), z } });
        }
    }
    
    // Right
    for (let i = 1; i <= distance; i++) {
        const x = Math.floor(loc.x - leftX * i);
        const z = Math.floor(loc.z - leftZ * i);
        const block = ai.dimension.getBlock({ x, y: Math.floor(loc.y), z });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x, y: Math.floor(loc.y), z } });
        }
    }
    
    // Up
    for (let dy = 1; dy <= distance; dy++) {
        const block = ai.dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) + dy, z: Math.floor(loc.z) });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x: Math.floor(loc.x), y: Math.floor(loc.y) + dy, z: Math.floor(loc.z) } });
        }
    }
    
    // Down
    for (let dy = 1; dy <= distance; dy++) {
        const block = ai.dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) - dy, z: Math.floor(loc.z) });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
            blocksAround.push({ block, location: { x: Math.floor(loc.x), y: Math.floor(loc.y) - dy, z: Math.floor(loc.z) } });
        }
    }
    
    return blocksAround;
}

// Main obstacle breaker behavior
export function startObstacleBreaker() {
    system.runInterval(() => {
        try {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;
            
            for (const ai of allAis) {
                if (!ai.isValid || ai.hasTag(BREAKING_TAG)) continue;
                
                // Don't break blocks while eating or building
                if (ai.hasTag('on_eat') || 
                    ai.hasTag('is_busy_building') ||
                    ai.hasTag('is_busy_cooking') ||
                    ai.hasTag('is_upgrading')) {
                    continue;
                }
                
                // Check if stuck or obstacles in front
                const stuck = isBotStuck(ai);
                
                if (stuck) {
                    // When stuck, only check blocks in front and above (not below)
                    const blocksInFront = getBlocksInFront(ai, 2);
                    
                    if (blocksInFront.length > 0) {
                        // Try to break the closest breakable block
                        for (const blockInfo of blocksInFront) {
                            if (isBreakableBlock(blockInfo.block.typeId)) {
                                breakBlockInFront(ai, blockInfo.location);
                                break; // Only break one block at a time
                            }
                        }
                    }
                } else if (ai.hasTag('is_moving_to_build')) {
                    // Normal movement: check blocks in front
                    const blocksInFront = getBlocksInFront(ai, 3);
                    
                    if (blocksInFront.length > 0) {
                        // Try to break the closest breakable block
                        for (const blockInfo of blocksInFront) {
                            if (isBreakableBlock(blockInfo.block.typeId)) {
                                breakBlockInFront(ai, blockInfo.location);
                                break; // Only break one block at a time
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Silent fail
        }
    }, OBSTACLE_CHECK_GAP);
}
