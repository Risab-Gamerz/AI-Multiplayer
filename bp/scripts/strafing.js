import { world, system, EntityDamageCause, EntityHealthComponent,  EntityEquippableComponent, EntityComponentTypes, ItemStack, EquipmentSlot, Player, Container, EntityInventoryComponent, EffectType } from "@minecraft/server";

import { REAL_PLAYERS_CACHE } from "./rgstart.js";
const ai_player_id = "rg:bot"; 
const BUILD_aim_ENTITY_ID = "rg:build_target";

// --- Strafing Logic Configuration (Unchanged) ---
const STRAFE_THINK_GAP_MIN_SECONDS = 0.1;
const STRAFE_THINK_GAP_MAX_SECONDS = 0.1;

const STRAFE_STEP_COUNT_MIN = 5;    
const STRAFE_STEP_COUNT_MAX = 9;     
const STRAFE_STEP_GAP_TICKS = 3;  
const STRAFE_STEP_STRENGTH = 0.24;    

// --- Activation and Performance Configuration (Unchanged) ---
const PROXIMITY_RADIUS = 32; 
const AI_ACTIVATION_GAP = 30; 

const strafeStates = new Map();

function performStrafeStep(ai, state, direction, stepsRemaining) {
    // 【Core Fix】Before executing each strafe step, check in real-time if the AI is still on the ground
    // If AI is invalid, has no target, left the ground, fell into water, or is falling, immediately stop strafing
    if (
        stepsRemaining <= 0 || 
        !ai.isValid || 
        !ai.getDynamicProperty("rg:current_target") ||
        !ai.isOnGround || 
        ai.isInWater || 
        ai.isFalling
    ) {
        state.isStrafing = false; 
        return;
    }

    const impulse = {
        x: direction.x * STRAFE_STEP_STRENGTH,
        y: 0,
        z: direction.z * STRAFE_STEP_STRENGTH
    };

    ai.applyImpulse(impulse);

    system.runTimeout(() => {
        performStrafeStep(ai, state, direction, stepsRemaining - 1); 
    }, STRAFE_STEP_GAP_TICKS);
}

function initiateStrafe(ai) {
    if (!strafeStates.has(ai.id)) {
        strafeStates.set(ai.id, { isStrafing: false });
    }
    const state = strafeStates.get(ai.id);

    // 【Optimization 1】Merge boolean checks, use short-circuit evaluation
    if (state.isStrafing || !ai.isOnGround || ai.isInWater || ai.isFalling) {
        return;
    }
    
    const targetId = ai.getDynamicProperty("rg:current_target");
    if (targetId && targetId === BUILD_aim_ENTITY_ID) {
        return;
    }

    state.isStrafing = true;  
    
    // 【Optimization 2】Logic simplification: Since MIN = MAX, the delay is fixed at 0.1 seconds
    const thinkDelay = STRAFE_THINK_GAP_MIN_SECONDS;

    system.runTimeout(() => {
        // 【Core Fix】After the thinking delay (thinkDelay) ends, before truly starting the strafe, perform environment checks again
        // Prevent being knocked back during the thinking period (such as within this 0.1 second), causing aerial strafing
        if (
            !ai.isValid || 
            !ai.getDynamicProperty("rg:current_target") ||
            !ai.isOnGround || 
            ai.isInWater || 
            ai.isFalling
        ) {
            state.isStrafing = false; 
            return;
        }
        
        const randomX = Math.random() * 2 - 1;
        const randomZ = Math.random() * 2 - 1;
        const direction = { x: randomX, z: randomZ };

        // 【Optimization 3】Use bitwise operator | 0 instead of Math.floor
        // Note: Since MAX-MIN+1 always equals 1, this is just for generality
        const totalSteps = STRAFE_STEP_COUNT_MIN + ((Math.random() * (STRAFE_STEP_COUNT_MAX - STRAFE_STEP_COUNT_MIN + 1)) | 0);

        performStrafeStep(ai, state, direction, totalSteps);
        
    }, (thinkDelay * 20) | 0); // 【Optimization 4】Use bitwise operator | 0 instead of Math.floor
}

export function startStrafingBehavior() {
    
    system.runInterval(() => {
        
        const activeAIinCombat = new Set();
        
        // 【Core Optimization】Use global cache REAL_PLAYERS_CACHE to replace expensive world.getAllPlayers()
        // Assuming REAL_PLAYERS_CACHE has been obtained from rgstart.js and is available.
        const allPlayers = REAL_PLAYERS_CACHE; 
        
        // If the cache is not startd or there are no players, exit early
        if (!allPlayers || allPlayers.length === 0) {
            return;
        }

        // 1. Iterate through all players, query nearby AI
        for (const player of allPlayers) {
            
            // 【Code Unchanged】Entity query is a necessary API overhead that cannot be optimized
            const nearbyAI = player.dimension.getEntities({
                type: ai_player_id,
                maxDistance: PROXIMITY_RADIUS, 
                location: player.location
            });

            // 2. Add nearby AI with targets to the Set
            for (const ai of nearbyAI) {
                if (ai.isValid && ai.getDynamicProperty("rg:current_target")) { 
                    activeAIinCombat.add(ai);
                }
            }
        }
        
        // 3. Run strafe logic for all activated AI
        for (const ai of activeAIinCombat) {
            initiateStrafe(ai);
        }

        // 4. Cleanup logic
        // Unchanged, this is the idiomatic efficient way of Map cleanup
        const currentAiIds = new Set(Array.from(activeAIinCombat).map(ai => ai.id));
        for (const storedId of strafeStates.keys()) {
            if (!currentAiIds.has(storedId)) {
                strafeStates.delete(storedId);
            }
        }

    }, AI_ACTIVATION_GAP); 
}