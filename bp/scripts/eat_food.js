import { world, system, Entity, ScoreboardObjective, EntityHealthComponent, ItemStack } from "@minecraft/server";

// ====================================================================
// AI entity and attribute constants
// ====================================================================
const ai_player_id = "rg:bot"; // Your AI entity ID
const FOOD_INVENTORY_PROPERTY = "rg:food_inventory"; // Dynamic property key for virtual inventory
const TRANSFER_SCOREBOARD_NAME = "FoodTransfer"; // Scoreboard name
const COOKING_TAG = "is_busy_cooking"; // Cooking tag
const EATING_TAG = "on_eat";
const BUILDING_TAG = "is_busy_building";
const UPGRADING_TAG = "is_upgrading";
const NO_FOOD_TAG = "no_food";
const EATING_ANIM_TAG = "is_eating";
import { ALL_AI_CACHE } from "./greeting.js"; 
const COOKING_EXCLUDE_TAGS = ["wooden", EATING_TAG, BUILDING_TAG, UPGRADING_TAG, COOKING_TAG];

// ====================================================================
// Food configuration table (FOOD_SETTINGS)
// (Based on your provided eat_food.js with corrected raw meat effects syntax)
// ====================================================================

const FOOD_SETTINGS = {
    "minecraft:enchanted_golden_apple":   { 
        weight: 50,
        code: 100,
        health: 8,
        target: true,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 36 },
            { id: 'absorption', level: 3, duration: 120 },
            { id: 'fire_resistance', level: 0, duration: 300 },
            { id: 'resistance', level: 0, duration: 300 }
        ]
    },
    "minecraft:golden_apple":   { 
        weight: 49,
        code: 200,
        health: 8,
        target: true,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 8 },
            { id: 'absorption', level: 0, duration: 120 }
        ]
    },
    "minecraft:chorus_fruit":   { 
        weight: 48,
        code: 300,
        health: 8,
        target: true,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 6 }
        ],
        commands: "spreadplayers ~ ~ 1 8 @s; playsound mob.endermen.portal @a[r=24]"
    },
    "minecraft:rabbit_stew":   { 
        weight: 47,
        code: 400,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 12 }
        ]
    },
    "minecraft:golden_carrot":   { 
        weight: 46,
        code: 500,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 10 }
        ]
    },
    "minecraft:cooked_beef":   { 
        weight: 45,
        code: 600,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 8 }
        ]
    },
    "minecraft:cooked_porkchop":   { 
        weight: 44,
        code: 700,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 8 }
        ]
    },
    "minecraft:pumpkin_pie":   { 
        weight: 43,
        code: 800,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 7 }
        ]
    },
    "minecraft:beetroot_soup":   { 
        weight: 42,
        code: 900,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 7 }
        ]
    },
    "minecraft:mushroom_stew":   { 
        weight: 41,
        code: 1000,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 7 }
        ]
    },
    "minecraft:suspicious_stew":   { 
        weight: 40,
        code: 1100,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 7 }
        ]
    },
    "minecraft:honey_bottle":   { 
        weight: 39,
        code: 1200,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 6 }
        ]
    },
    "minecraft:cooked_mutton":   { 
        weight: 38,
        code: 1300,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 6 }
        ]
    },
    "minecraft:cooked_chicken":   { 
        weight: 37,
        code: 1400,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 6 }
        ]
    },
    "minecraft:cooked_salmon":   { 
        weight: 36,
        code: 1500,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 6 }
        ]
    },
    "minecraft:baked_potato":   { 
        weight: 35,
        code: 1600,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 5 }
        ]
    },
    "minecraft:bread":   { 
        weight: 34,
        code: 1700,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 5 }
        ]
    },
    "minecraft:cooked_cod":   { 
        weight: 33,
        code: 1800,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 5 }
        ]
    },
    "minecraft:cooked_rabbit":   { 
        weight: 32,
        code: 1900,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 5 }
        ]
    },
    "minecraft:apple":   { 
        weight: 31,
        code: 2000,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 4 }
        ]
    },
    "minecraft:carrot":   { 
        weight: 30,
        code: 2100,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 3 }
        ]
    },
    "minecraft:sweet_berries":   { 
        weight: 29,
        code: 2200,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:tropical_fish":   { 
        weight: 28,
        code: 2300,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:glow_berries":   { 
        weight: 27,
        code: 2400,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:melon_slice":   { 
        weight: 25,
        code: 2600,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:cookie":   { 
        weight: 24,
        code: 2700,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:dried_kelp":   { 
        weight: 23,
        code: 2800,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:beetroot":   { 
        weight: 22,
        code: 2900,
        effects: [ 
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:beef": { 
        weight: 21,
        code: 3000,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_beef",
        effects: [
            { id: 'regeneration', level: 2, duration: 3 }
        ]
    },
    "minecraft:porkchop": { 
        weight: 20,
        code: 3100,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_porkchop",
        effects: [
            { id: 'regeneration', level: 2, duration: 3 }
        ]
    },
    "minecraft:rabbit": { 
        weight: 19,
        code: 3200,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_rabbit",
        effects: [
            { id: 'regeneration', level: 2, duration: 3 }
        ]
    },
    "minecraft:salmon": { 
        weight: 18,
        code: 3300,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_salmon",
        effects: [
            { id: 'regeneration', level: 2, duration: 3 }
        ]
    },
    "minecraft:cod": { 
        weight: 17,
        code: 3400,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_cod",
        effects: [
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:mutton": { 
        weight: 16,
        code: 3500,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_mutton",
        effects: [
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:chicken": { 
        weight: 15,
        code: 3600,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:cooked_chicken",
        effects: [
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
    "minecraft:potato": { 
        weight: 14,
        code: 3700,
        target: true,
        isRaw: true, 
        cookTo: "minecraft:baked_potato",
        effects: [
            { id: 'regeneration', level: 2, duration: 2 }
        ]
    },
};

// ====================================================================
// Initial food inventory configuration table
// ====================================================================

const INITIAL_FOOD_INVENTORY = {
    // Your equipment level tag
    "wooden": {
        "minecraft:apple": { min: 0, max: 2 }, 
        "minecraft:bread": { min: 0, max: 1 },
        "minecraft:porkchop": { min: 0, max: 2 } 
    },
    "stone": {
        "minecraft:apple": { min: 1, max: 2 },
        "minecraft:cooked_chicken": { min: 0, max: 4 },
        "minecraft:mutton": { min: 1, max: 5 } 
    },
    "copper": {
        "minecraft:cooked_chicken": { min: 3, max: 8 },
        "minecraft:cooked_beef": { min: 2, max: 10 },
        "minecraft:bread": { min: 3, max: 8 }
    },
    "iron": {
        "minecraft:cooked_beef": { min: 15, max: 20 },
        "minecraft:bread": { min: 15, max: 20 },
        "minecraft:cooked_porkchop": { min: 5, max: 10 }
    },
    "diamond": {
        "minecraft:cooked_beef": { min: 24, max: 32 },
        "minecraft:cooked_porkchop": { min: 10, max: 20 },
        "minecraft:chorus_fruit": { min: 0, max: 1 },
        "minecraft:golden_apple": { min: 1, max: 3 } 
    },
    "diamond_pro": {
        "minecraft:cooked_beef": { min: 32, max: 48 },
        "minecraft:enchanted_golden_apple": { min: 1, max: 2 },
        "minecraft:chorus_fruit": { min: 0, max: 2 },
        "minecraft:golden_carrot": { min: 16, max: 32 }
    }
};

// ====================================================================
// Helper utility functions
// ====================================================================

// food.js (New helper function section)

/**
 * Listen for entity death event, handle virtual inventory transfer and dropping.
 */
function listenForFoodTransferOnDeath() {
    world.afterEvents.entityDie.subscribe(event => {
        const deadEntity = event.deadEntity;
        const killer = event.damageSource.damagingEntity;

        // 1. Ensure the dead entity is an AI player
        if (deadEntity.typeId !== ai_player_id) {
            return;
        }

        const deadAiInventory = getVirtualInventory(deadEntity);
        // If inventory is empty, return directly
        if (Object.keys(deadAiInventory).length === 0) {
            return;
        }
        
        // Clear the dead entity's inventory (will be cleared regardless of how they died)
        setVirtualInventory(deadEntity, {}); 

        let isKillerAI = killer && killer.typeId === ai_player_id;
        let isKillerPlayer = killer && killer.typeId === 'minecraft:player';

        // ----------------------------------------
        // Case A: AI kills AI - Food transfer
        // ----------------------------------------
        if (isKillerAI) {
            const killerAi = killer;
            
            // Transfer all food from the dead to the killer
            for (const itemId in deadAiInventory) {
                const count = deadAiInventory[itemId];
                changeFoodCount(killerAi, itemId, count); 
            }
            

        // ----------------------------------------
        // ----------------------------------------
        // Case B: Player kills AI - Food drops
        // 【Fix: Execute only when the killer is a player】
        // 【New: Chunk Loaded check】
        // ----------------------------------------
        } else if (isKillerPlayer) {
            
            const dropLocation = deadEntity.location;
            const dimension = deadEntity.dimension;
            
            // 【New】Check if the chunk is loaded before dropping
            try {
                // Check if the chunk at the drop location is loaded
                if (!dimension.isChunkLoaded(dropLocation)) {
                     return; // Exit early
                }
            } catch (e) {
                 return;
            }

            // Drop all food
            for (const itemId in deadAiInventory) {
             const count = deadAiInventory[itemId];
                // Ensure ItemStack is available
                const itemStack = new ItemStack(itemId, count); 
                
                try {
                    // 使用 dimension.spawnItem 掉落
                    dimension.spawnItem(itemStack, dropLocation);
                } catch (e) {
                }
            }
        }
    });
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {Entity} ai
 * @returns {Object}
 */
function getVirtualInventory(ai) {
    const raw = ai.getDynamicProperty(FOOD_INVENTORY_PROPERTY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error(`解析AI背包失败: ${ai.id}`, e);
        return {};
    }
}

/**
 * @param {Entity} ai
 * @param {Object} inventory
 */
function setVirtualInventory(ai, inventory) {
    ai.setDynamicProperty(FOOD_INVENTORY_PROPERTY, JSON.stringify(inventory));
    updateNoFoodTag(ai, inventory);
}

/**
 * @param {Entity} ai
 * @param {Object} inventory
 */
function updateNoFoodTag(ai, inventory) {
    if (!ai.isValid) return;

    const hasFood = Object.values(inventory).some(count => count > 0);
    
    if (hasFood) {
        ai.removeTag("no_food");
    } else {
        ai.addTag("no_food");
    }
}

/**
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
    
    setVirtualInventory(ai, inventory); // setVirtualInventory 会自动调用 updateNoFoodTag
}

/**
 * @returns {Map<number, string>}
 */
function buildCodeToIdMap() {
    const map = new Map();
    for (const itemId in FOOD_SETTINGS) {
        const config = FOOD_SETTINGS[itemId];
        if (config.code) {
            map.set(config.code, itemId);
        }
    }
    return map;
}


/**
 * @param {Entity} ai
 */
function startFoodInventory(ai) {
    
    const existingInventory = ai.getDynamicProperty(FOOD_INVENTORY_PROPERTY);
    if (existingInventory) {
       
        updateNoFoodTag(ai, getVirtualInventory(ai));
        return; 
    }
    
    const aiTags = ai.getTags();
    let tierConfig = null;
    
  
    const tiers = ["diamond_pro", "diamond", "iron", "copper", "stone", "wooden"];
    for (const tag of tiers) {
        if (aiTags.includes(tag) && INITIAL_FOOD_INVENTORY[tag]) {
            tierConfig = INITIAL_FOOD_INVENTORY[tag];
            break; 
        }
    }

    const initialInventory = {};
    if (tierConfig) {
        
        for (const itemId in tierConfig) {
            const range = tierConfig[itemId];
            if (range.min !== undefined && range.max !== undefined && range.max >= range.min) {
                const count = getRandomInt(range.min, range.max);
                if (count > 0) {
                    initialInventory[itemId] = count;
                }
            }
        }
       
    }
    
  
    setVirtualInventory(ai, initialInventory);
}

/**

 * @param {Entity} ai
 * @param {Map<number, string>} codeToIdMap
 * @param {ScoreboardObjective} scoreboard
 */
function processFoodTransfer(ai, codeToIdMap, scoreboard) {
    try {
        const score = scoreboard.getScore(ai); 

        if (score && score > 0) {
            const itemCode = score;
            
            const transferCount = 1; 

            const itemId = codeToIdMap.get(itemCode); 
            
            if (itemId) {
                const finalCount = transferCount; // * randomMultiplier;

                changeFoodCount(ai, itemId, finalCount);
            }
            
            scoreboard.setScore(ai, 0); 
        }
    } catch (e) {
        try { scoreboard.setScore(ai, 0); } catch (e2) {}
    }
}

/**
 * @param {Entity} ai
 */
function handleAiEating(ai) {
    const inventory = getVirtualInventory(ai);
    let bestFoodId = null;
    let highestWeight = -1;
    
    const healthComponent = ai.getComponent(EntityHealthComponent.componentId);
    if (!healthComponent) return;
    const currentHealth = healthComponent.currentValue;
    
    const isInCombat = !!ai.getDynamicProperty("rg:current_target");

    for (const itemId in inventory) {
        const config = FOOD_SETTINGS[itemId];

        if (inventory[itemId] > 0 && config) {
            
            if (config.health !== undefined && currentHealth > config.health) {
                continue; 
            }
            
            if (config.target === true && !isInCombat) {
                continue; 
            }
            
            if (config.weight > highestWeight) {
                highestWeight = config.weight;
                bestFoodId = itemId;
            }
        }
    }

    if (bestFoodId) {
        const foodSetting = FOOD_SETTINGS[bestFoodId];
        
        changeFoodCount(ai, bestFoodId, -1);
        
        try {
             ai.addTag(EATING_ANIM_TAG);
            ai.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${bestFoodId}`);
            ai.runCommand(`effect @s slowness 1 1 true`);  
           
            ai.runCommand('playanimation @s eat_item_custom');

            const soundTicks = [1, 5, 9, 13, 17, 21, 25, 29];
            for (const tick of soundTicks) {
                system.runTimeout(() => {
                    if (ai.isValid) {
                        ai.runCommand("playsound random.eat @a[r=8]");
                    }
                }, tick);
            }

            system.runTimeout(() => {
                if (!ai.isValid) return;

                ai.runCommand('playsound random.burp @a[r=8]');

                if (foodSetting.effects && Array.isArray(foodSetting.effects)) {
                    for (const effect of foodSetting.effects) {
                        ai.runCommand(`effect @s ${effect.id} ${effect.duration} ${effect.level}`);
                    }
                }
                
                if (foodSetting.commands) {
                    const commandList = foodSetting.commands.split(';').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
                    for (const command of commandList) {
                        try {
                            ai.runCommand(command);
                        } catch (e) {
                            console.error(`AI命令执行失败: ${command}`, e);
                        }
                    }
                }
                
                ai.removeTag('on_eat');
                ai.removeTag(EATING_ANIM_TAG);

            }, 30); 

        } catch (e) {
            console.error(`AI吃东西时出错: ${ai.id}`, e);
            ai.removeTag('on_eat');
        }
        
    } else {
        
        ai.removeTag('on_eat');
    }
}

/**

 * @param {Entity} ai
 */
function handleAiCooking(ai) {
    const inventory = getVirtualInventory(ai);
    const rawFoodIds = Object.keys(inventory).filter(id => 
        inventory[id] > 0 && FOOD_SETTINGS[id]?.isRaw
    );

    if (rawFoodIds.length === 0) return; 

    if (Math.random() > 0.15) return;

    
    ai.addTag(COOKING_TAG);

    const aiLoc = ai.location;
    const furnacePos = { x: Math.floor(aiLoc.x) + 2, y: Math.floor(aiLoc.y), z: Math.floor(aiLoc.z) };
    try {
        const dx = furnacePos.x + 0.5 - ai.location.x;
        const dz = furnacePos.z + 0.5 - ai.location.z;
        ai.setRotation({ x: 0, y: Math.atan2(-dx, dz) * (180 / Math.PI) });
    } catch (e) {}
    ai.runCommand('playanimation @s set_block');
    ai.dimension.runCommand(`setblock ${furnacePos.x} ${furnacePos.y} ${furnacePos.z} furnace`);
    ai.runCommand('playsound dig.stone @a[r=16]');

    ai.triggerEvent("rg:event_go_cooking"); 

    system.runTimeout(() => {
        if (!ai?.isValid) return; 
        ai.dimension.runCommand(`testforblock ${furnacePos.x} ${furnacePos.y} ${furnacePos.z} furnace`);
        ai.dimension.runCommand(`setblock ${furnacePos.x} ${furnacePos.y} ${furnacePos.z} lit_furnace`);
    }, 50); 

    system.runTimeout(() => {
        if (!ai?.isValid) return; 
        ai.runCommand('playanimation @s set_block');
        ai.dimension.runCommand(`setblock ${furnacePos.x} ${furnacePos.y} ${furnacePos.z} air`);
        ai.runCommand('playsound dig.stone @a[r=16]');
        
        ai.removeTag(COOKING_TAG);
        ai.triggerEvent("rg:event_stop_cooking");
        
        const currentInv = getVirtualInventory(ai);
        const itemsToAdd = {};
        
        for (const itemId in currentInv) {
            const config = FOOD_SETTINGS[itemId];
            if (currentInv[itemId] > 0 && config?.isRaw && config.cookTo) {
                const count = currentInv[itemId];
                const cookedId = config.cookTo;
                
                itemsToAdd[cookedId] = (itemsToAdd[cookedId] || 0) + count;
                
                delete currentInv[itemId];
            }
        }
        
        for (const cookedId in itemsToAdd) {
            currentInv[cookedId] = (currentInv[cookedId] || 0) + itemsToAdd[cookedId];
        }
        setVirtualInventory(ai, currentInv);
        

    }, 300); // 15 秒
}


export function startFoodSystem() {
    
    const codeToIdMap = buildCodeToIdMap();

    world.afterEvents.entitySpawn.subscribe(event => {
        const entity = event.entity;
        if (entity.typeId === ai_player_id) {
            startFoodInventory(entity);
        }
    });
    
    listenForFoodTransferOnDeath(); 
    
    system.runInterval(() => {
        
        const allAis = ALL_AI_CACHE; 
        if (!allAis || allAis.length === 0) return;
        
        let scoreboard;
        try {
            scoreboard = world.scoreboard.getObjective(TRANSFER_SCOREBOARD_NAME);
        } catch (e) {
            scoreboard = null;
        }

        for (const ai of allAis) {
            
            if (!ai.isValid) continue;

            if (scoreboard) {
                processFoodTransfer(ai, codeToIdMap, scoreboard);
            }
            
            let threatCount = 0;
            try {
                const nearbyMobs = ai.dimension.getEntities({
                    location: ai.location,
                    maxDistance: 16,
                    excludeFamilies: ['player']
                });
                threatCount = nearbyMobs.filter(mob => 
                    mob.typeId.includes('zombie') || 
                    mob.typeId.includes('creeper') ||
                    mob.typeId.includes('skeleton') ||
                    mob.typeId.includes('spider') ||
                    mob.typeId.includes('enderman') ||
                    mob.typeId.includes('phantom')
                ).length;
            } catch (e) {
                threatCount = 0;
            }
            
            const healthComp = ai.getComponent(EntityHealthComponent.componentId);
            const currentHealth = healthComp?.currentValue || 20;
            const maxHealth = healthComp?.maxValue || 20;
            const healthPercent = currentHealth / maxHealth;
            
            // C. FLEE LOGIC: If health < 30% AND surrounded by 2+ threats, RUN
            if (healthPercent < 0.3 && threatCount >= 2 && !ai.hasTag('is_fleeing')) {
                ai.addTag('is_fleeing');
                try {
                    ai.runCommand('effect @s speed 2 2 false');
                } catch (e) {}
                system.runTimeout(() => {
                    if (ai.isValid) ai.removeTag('is_fleeing');
                }, 200);
            }
            
            // D. STOP EATING if multiple threats detected  
            if (threatCount >= 2 && ai.hasTag(EATING_TAG)) {
                ai.removeTag(EATING_TAG);
                ai.removeTag(EATING_ANIM_TAG);
                continue;
            }
            
            // E. Handle eating if conditions safe
            if (ai.hasTag(EATING_TAG) && 
                !ai.hasTag(NO_FOOD_TAG) && 
                !ai.hasTag(BUILDING_TAG) && 
                !ai.hasTag(UPGRADING_TAG) &&
                !ai.hasTag(EATING_ANIM_TAG)) 
            {
                handleAiEating(ai);
            }
        }
    }, 10); 

    system.runInterval(() => {
        
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;
        
        const cookableAis = allAis.filter(ai => {
            if (!ai.isValid) return false;

            for (const tag of COOKING_EXCLUDE_TAGS) {
                if (ai.hasTag(tag)) {
                    return false;
                }
            }
            
            // Check if bot has a combat target (idle state check)
            if (ai.getDynamicProperty("rg:current_target")) {
                 return false;
            }

            return true; 
        });

        for (const ai of cookableAis) {
            if (!ai.isValid) continue;
            
            handleAiCooking(ai);
        }
    }, 200);
    
    
}