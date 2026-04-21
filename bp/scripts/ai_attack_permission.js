import { world, system, Entity } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

// ====================================================================
// Constants and dependencies
// ====================================================================

const ai_player_id = "rg:bot"; 
const HUNTING_TAG = "allow_attack"; // Hunting/attack tag
const TAG_DURATION_TICKS = 40; // Attack tag duration: 2 seconds
const FOOD_INVENTORY_PROPERTY = "rg:food_inventory"; // Depends on food.js inventory property
const COOKING_TAG = "is_busy_cooking"; // Cooking tag
const EATING_TAG = "on_eat";
const BUILDING_TAG = "is_busy_building";
const UPGRADING_TAG = "is_upgrading";
const NO_FOOD_TAG = "no_food";
const EATING_ANIM_TAG = "is_eating";
const BUSY_TAGS = ['allow_attack', 'on_eat', 'is_busy_building', 'is_upgrading', 'is_busy_cooking'];

// Hunting level configuration (determined by total food quantity)
const HUNTING_CONFIGS = [
    // Tier 1: Sufficient food
    { 
        name: "Sufficient", 
        maxQuantity: 9999999, // Quantity limit, ensure all covered
        minQuantity: 32,   // Quantity >= 32
        intervalTicks: 600, // 30 seconds
        probability: 0.05    // 5% probability
    },
    // Tier 2: Need replenishment
    { 
        name: "NeedsRefill", 
        maxQuantity: 31, 
        minQuantity: 9,      // Quantity 9 to 23
        intervalTicks: 300,  // 15 seconds
        probability: 0.20    // 20% probability
    },
    // Tier 3: Food critical
    { 
        name: "Critical", 
        maxQuantity: 8, 
        minQuantity: 0,      // Quantity 0 to 8
        intervalTicks: 160,  // 8 seconds
        probability: 0.40    // 40% probability
    }
];

// Kill reward configuration
const KILL_REWARDS = {
    "minecraft:cow": {
        foodId: "minecraft:beef", // Reward beef
        minCount: 1, 
        maxCount: 3,
        clearsDrops: true // Whether to clear drops (vanilla beef, leather, etc.)
    },
    "minecraft:pig": {
        foodId: "minecraft:porkchop", 
        minCount: 1, 
        maxCount: 3,
        clearsDrops: true
    },
    "minecraft:chicken": {
        foodId: "minecraft:chicken", 
        minCount: 1, 
        maxCount: 3,
        clearsDrops: true
    },
    "minecraft:sheep": {
        foodId: "minecraft:mutton", 
        minCount: 1, 
        maxCount: 3,
        clearsDrops: true
    },
    // Add more mobs...
};


// ====================================================================
// Helper utility functions
// ====================================================================

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Depends on getVirtualInventory from food.js
 * @param {Entity} ai
 * @returns {Object}
 */
function getVirtualInventory(ai) {
    const raw = ai.getDynamicProperty(FOOD_INVENTORY_PROPERTY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

/**
 * Calculate total food quantity in AI's virtual inventory
 * @param {Entity} ai
 * @returns {number}
 */
function getTotalFoodCount(ai) {
    const inventory = getVirtualInventory(ai);
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

/**
 * Depends on changeFoodCount from food.js
 * (To avoid circular dependencies, we simply simulate here, but should use exported functions from food.js in final project)
 * @param {Entity} ai
 * @param {string} itemId
 * @param {number} count
 */
function changeFoodCount(ai, itemId, count) {
    const inventory = getVirtualInventory(ai);
    inventory[itemId] = (inventory[itemId] || 0) + count;
    
    if (inventory[itemId] <= 0) {
        delete inventory[itemId];
    }
    
    // Note: Here we need to reset DynamicProperty and implement setVirtualInventory logic from food.js (including no_food tag update)
    // To allow this file to run independently, we assume setVirtualInventory logic has been simplified or imported elsewhere.
    // In final project, ensure to use setVirtualInventory exported from food.js.
    ai.setDynamicProperty(FOOD_INVENTORY_PROPERTY, JSON.stringify(inventory));
    
    // Assume food.js's updateNoFoodTag will be called or imported somewhere.
}


// ====================================================================
// Core logic functions
// ====================================================================

/**
 * Grant AI hunting tag and remove it shortly after
 * @param {Entity} ai
 */
function giveAndRemoveTag(ai) {
    if (!ai.isValid) {
        return;
    }
    
    ai.addTag(HUNTING_TAG);
    // console.log(`AI ${ai.nameTag} obtained hunting tag.`);

    system.runTimeout(() => {
        if (ai.isValid) {
            ai.removeTag(HUNTING_TAG);
            // console.log(`AI ${ai.nameTag} removed hunting tag.`);
        }
    }, TAG_DURATION_TICKS);
}

/**
 * Dynamically check if AI enters hunting state based on food quantity
 * @param {Entity} ai
 * @param {string[]} excludeTags Tags that AI should skip
 */
function checkAndScheduleHunting(ai, excludeTags) {
    if (!ai.isValid) return;
    
    // 2. Calculate total food, determine hunting tier
    const foodCount = getTotalFoodCount(ai);
    let currentConfig = null;

    for (const config of HUNTING_CONFIGS) {
        if (foodCount >= config.minQuantity && foodCount <= config.maxQuantity) {
            currentConfig = config;
            break;
        }
    }

    if (!currentConfig) {
        // Theoretically won't happen, but as a fallback
        currentConfig = HUNTING_CONFIGS[0]; 
    }

    // 3. Probability judgment
    if (Math.random() < currentConfig.probability) {
        giveAndRemoveTag(ai);
    }
}


/**
 * Listen to entity death events, grant AI kill rewards and clear drops
 */
function listenForKillRewards() {
    world.afterEvents.entityDie.subscribe(event => {
        const deadEntity = event.deadEntity;
        const killer = event.damageSource.damagingEntity;

        if (!killer || killer.typeId !== ai_player_id) {
            return; // Ensure it's AI entity kill
        }

        const rewardConfig = KILL_REWARDS[deadEntity.typeId];

        if (rewardConfig) {
            const ai = killer;
            const count = getRandomInt(rewardConfig.minCount, rewardConfig.maxCount);
            
            // A. Fill food to virtual inventory
            changeFoodCount(ai, rewardConfig.foodId, count);
            
            // B. Clear drops
            if (rewardConfig.clearsDrops) {
                const loc = deadEntity.location;
                const dim = deadEntity.dimension;
                
                // Clear drops in small radius around kill location (radius 2 blocks)
                dim.runCommand(`kill @e[type=item, x=${loc.x}, y=${loc.y}, z=${loc.z}, r=2]`);
            }
            
            // console.log(`AI ${ai.nameTag} killed ${deadEntity.typeId}, obtained ${count} ${rewardConfig.foodId}`);
        }
    });
}


// ====================================================================
// Main system initialization (export)
// ====================================================================

export function startAttackPermissionBehavior(excludeTags = []) {
    
    // Ensure kill event listener is registered (unchanged)
     listenForKillRewards(); 

    // Dynamic hunting dispatch loop (checks every 10 ticks)
    system.runInterval(() => {
        
        // [Core Optimization 1] Use global cache to get all AI
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        // [Core Optimization 2] Fast filtering in JS memory
        const idleAis = allAis.filter(ai => {
            // Ensure entity is valid
            if (!ai.isValid) return false;
            
            // Check if contains any busy tags
            for (const tag of BUSY_TAGS) {
                if (ai.hasTag(tag)) {
                    return false; // Busy, exclude
                }
            }
            
            return true; // Idle, keep
        });

        for (const ai of idleAis) {
            // Probability judgment and scheduling in the loop
            checkAndScheduleHunting(ai); // Assume checkAndScheduleHunting already exists
        }

    }, 60); // High-frequency check every 10 ticks (0.5 seconds), now has extremely low overhead

}
