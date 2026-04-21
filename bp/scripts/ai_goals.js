import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

const ai_player_id = "rg:bot";
const MINING_TAG = "is_mining";
const BUILDING_TAG = "is_building";
const EXPLORING_TAG = "is_exploring";
const MINING_GOAL_GAP = 600; // Check every 30 seconds
const MINING_PROBABILITY = 0.05; // 5% chance
const MINING_DURATION_TICKS = 6000; // 5 minutes
const EXPLORING_DURATION_TICKS = 4000; // ~3.3 minutes
const BUILDING_DURATION_TICKS = 8000; // ~6.6 minutes

// Goal types
export const AI_GOALS = {
    MINING: "mining",
    BUILDING: "building",
    EXPLORING: "exploring",
    IDLE: "idle"
};

// Goal priorities (higher = more important)
const GOAL_PRIORITIES = {
    [AI_GOALS.IDLE]: 0,
    [AI_GOALS.EXPLORING]: 1,
    [AI_GOALS.BUILDING]: 2,
    [AI_GOALS.MINING]: 3
};

// Track active goal timeouts
const goalTimeouts = new Map();

// Clear existing goal timeout
function clearGoalTimeout(ai) {
    const timeoutId = goalTimeouts.get(ai.id);
    if (timeoutId) {
        system.clearRun(timeoutId);
        goalTimeouts.delete(ai.id);
    }
}

// Get current goal for AI
export function getAIGoal(ai) {
    if (!ai?.isValid) return AI_GOALS.IDLE;
    
    // Check tags (more reliable than dynamic properties for quick checks)
    if (ai.hasTag(MINING_TAG)) {
        return AI_GOALS.MINING;
    }
    if (ai.hasTag(BUILDING_TAG)) {
        return AI_GOALS.BUILDING;
    }
    if (ai.hasTag(EXPLORING_TAG)) {
        return AI_GOALS.EXPLORING;
    }
    
    const goal = ai.getDynamicProperty("rg:current_goal") || AI_GOALS.IDLE;
    return goal;
}

// Set AI goal with priority check
export function setAIGoal(ai, goal, force = false) {
    if (!ai?.isValid) return false;
    
    const currentGoal = getAIGoal(ai);
    
    // Don't change if same goal
    if (currentGoal === goal) return true;
    
    // Check priority unless forced
    if (!force) {
        const currentPriority = GOAL_PRIORITIES[currentGoal] || 0;
        const newPriority = GOAL_PRIORITIES[goal] || 0;
        
        // Don't interrupt higher priority goals
        if (newPriority < currentPriority) {
            return false;
        }
    }
    
    // Clear existing timeout
    clearGoalTimeout(ai);
    
    // Remove all goal tags
    ai.removeTag(MINING_TAG);
    ai.removeTag(BUILDING_TAG);
    ai.removeTag(EXPLORING_TAG);
    
    // Add new goal tag
    switch (goal) {
        case AI_GOALS.MINING:
            ai.addTag(MINING_TAG);
            break;
        case AI_GOALS.BUILDING:
            ai.addTag(BUILDING_TAG);
            break;
        case AI_GOALS.EXPLORING:
            ai.addTag(EXPLORING_TAG);
            break;
    }
    
    ai.setDynamicProperty("rg:current_goal", goal);
    ai.setDynamicProperty("rg:goal_start_tick", system.currentTick);
    
    return true;
}

// Set goal with automatic timeout
export function setTimedGoal(ai, goal, durationTicks) {
    if (!setAIGoal(ai, goal)) return false;
    
    const timeoutId = system.runTimeout(() => {
        if (ai.isValid && getAIGoal(ai) === goal) {
            setAIGoal(ai, AI_GOALS.IDLE);
        }
        goalTimeouts.delete(ai.id);
    }, durationTicks);
    
    goalTimeouts.set(ai.id, timeoutId);
    return true;
}

// Check if AI can perform an action based on current goal
export function canPerformAction(ai, actionType) {
    if (!ai?.isValid) return false;
    
    const currentGoal = getAIGoal(ai);
    
    // Define allowed actions per goal
    const allowedActions = {
        [AI_GOALS.MINING]: ["mining", "combat", "eating", "sleeping", "moving"],
        [AI_GOALS.BUILDING]: ["building", "combat", "eating", "sleeping", "moving"],
        [AI_GOALS.EXPLORING]: ["exploring", "combat", "eating", "sleeping", "moving"],
        [AI_GOALS.IDLE]: ["building", "exploring", "combat", "eating", "sleeping", "moving", "socializing"]
    };
    
    const allowed = allowedActions[currentGoal] || [];
    return allowed.includes(actionType);
}

// Prevent building when mining is priority
export function shouldSkipBuilding(ai) {
    if (!ai?.isValid) return false;
    return !canPerformAction(ai, "building");
}

// Prevent exploring when mining or building
export function shouldSkipExploring(ai) {
    if (!ai?.isValid) return false;
    return !canPerformAction(ai, "exploring");
}

// Check if AI is busy with important task
export function isAIBusy(ai) {
    if (!ai?.isValid) return false;
    
    const goal = getAIGoal(ai);
    
    // Consider these goals as "busy"
    const busyGoals = [AI_GOALS.MINING, AI_GOALS.BUILDING];
    
    if (busyGoals.includes(goal)) {
        return true;
    }
    
    // Also check other busy states
    return ai.hasTag('on_eat') || 
           ai.hasTag('is_sleeping') || 
           ai.hasTag('is_in_combat') ||
           (ai.getDynamicProperty('rg:current_target') !== undefined && 
            ai.getDynamicProperty('rg:current_target') !== null);
}

// Get goal description for debugging
export function getGoalDescription(ai) {
    if (!ai?.isValid) return "Invalid AI";
    
    const goal = getAIGoal(ai);
    const startTick = ai.getDynamicProperty("rg:goal_start_tick") || 0;
    const elapsedTicks = system.currentTick - startTick;
    const elapsedSeconds = Math.floor(elapsedTicks / 20);
    
    const goalNames = {
        [AI_GOALS.MINING]: "⛏️ Mining",
        [AI_GOALS.BUILDING]: "🏗️ Building",
        [AI_GOALS.EXPLORING]: "🗺️ Exploring",
        [AI_GOALS.IDLE]: "💤 Idle"
    };
    
    return `${goalNames[goal] || goal} (${elapsedSeconds}s)`;
}

// start goal system
export function startGoalSystem() {
    // Main goal assignment loop
    system.runInterval(() => {
        try {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;
            
            for (const ai of allAis) {
                if (!ai.isValid) continue;
                
                // Skip if AI is already busy with something
                if (isAIBusy(ai)) continue;
                
                const currentGoal = getAIGoal(ai);
                
                // Only assign new goals to idle AIs
                if (currentGoal !== AI_GOALS.IDLE) continue;
                
                const rand = Math.random();
                
                // Weighted random goal selection
                if (rand < 0.05) {
                    // 5% chance - Mining
                    setTimedGoal(ai, AI_GOALS.MINING, MINING_DURATION_TICKS);
                } else if (rand < 0.15) {
                    // 10% chance - Building
                    setTimedGoal(ai, AI_GOALS.BUILDING, BUILDING_DURATION_TICKS);
                } else if (rand < 0.30) {
                    // 15% chance - Exploring
                    setTimedGoal(ai, AI_GOALS.EXPLORING, EXPLORING_DURATION_TICKS);
                }
                // 70% chance - Stay idle
            }
        } catch (e) {
            // Silent fail
        }
    }, MINING_GOAL_GAP);
    
    // Cleanup loop - check for stuck goals
    system.runInterval(() => {
        try {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;
            
            for (const ai of allAis) {
                if (!ai.isValid) {
                    // Clean up timeout for invalid AI
                    clearGoalTimeout(ai);
                    continue;
                }
                
                const goal = getAIGoal(ai);
                if (goal === AI_GOALS.IDLE) continue;
                
                const startTick = ai.getDynamicProperty("rg:goal_start_tick") || 0;
                const elapsedTicks = system.currentTick - startTick;
                
                // Reset stuck goals (longer than 10 minutes)
                if (elapsedTicks > 12000) {
                    setAIGoal(ai, AI_GOALS.IDLE, true);
                }
                
                // Force idle if AI is sleeping or in water
                if (ai.hasTag('is_sleeping') || ai.isInWater) {
                    if (goal !== AI_GOALS.IDLE) {
                        setAIGoal(ai, AI_GOALS.IDLE, true);
                    }
                }
            }
        } catch (e) {
            // Silent fail
        }
    }, 200); // Check every 10 seconds
    
    // Clean up timeouts for dead AIs
    world.afterEvents.entityDie.subscribe(event => {
        const { deadEntity } = event;
        if (deadEntity.typeId === ai_player_id) {
            clearGoalTimeout(deadEntity);
        }
    });
    
    console.warn(`[Goal System] startd with priorities and weighted selection`);
}

// Export utility functions for other modules
export function forceIdleState(ai) {
    if (!ai?.isValid) return;
    clearGoalTimeout(ai);
    setAIGoal(ai, AI_GOALS.IDLE, true);
}

export function getRemainingGoalTime(ai) {
    if (!ai?.isValid) return 0;
    
    const goal = getAIGoal(ai);
    if (goal === AI_GOALS.IDLE) return 0;
    
    const startTick = ai.getDynamicProperty("rg:goal_start_tick") || 0;
    let maxDuration = 0;
    
    switch (goal) {
        case AI_GOALS.MINING:
            maxDuration = MINING_DURATION_TICKS;
            break;
        case AI_GOALS.BUILDING:
            maxDuration = BUILDING_DURATION_TICKS;
            break;
        case AI_GOALS.EXPLORING:
            maxDuration = EXPLORING_DURATION_TICKS;
            break;
    }
    
    const elapsed = system.currentTick - startTick;
    return Math.max(0, maxDuration - elapsed);
}