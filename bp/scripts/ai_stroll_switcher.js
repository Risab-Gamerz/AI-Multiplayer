import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";
const ai_player_id = "rg:bot"; 
const EVENT_NAME_TO_TRIGGER = "stroll_switch";

const MIN_GAP_SECONDS = 10; 
const MAX_GAP_SECONDS = 60; 
const POPULATION_CHECK_GAP_TICKS = 100; 


const trackedAis = new Set();


function scheduleNextStrollSwitch(ai) {

    if (!ai.isValid) {
        trackedAis.delete(ai.id);
        return;
    }
  
    // [Extreme Optimization] Use | 0 instead of Math.floor
    const randomDelayTicks = ((MIN_GAP_SECONDS + Math.random() * (MAX_GAP_SECONDS - MIN_GAP_SECONDS)) * 20) | 0;

    system.runTimeout(() => {
 
        if (!ai.isValid) {
            trackedAis.delete(ai.id);
            return;
        }

        ai.triggerEvent(EVENT_NAME_TO_TRIGGER);

        scheduleNextStrollSwitch(ai);

    }, randomDelayTicks);
}



export function startStrollSwitcherBehavior() {

    system.runInterval(() => {
        
        // -----------------------------------------------------------
        // [Core Optimization] Use global cache ALL_AI_CACHE instead of expensive dimension query loop
        // -----------------------------------------------------------
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) {
            return; // Cache is empty, exit early
        }

        for (const ai of allAis) {
            // [Micro-optimization] Ensure AI is valid, avoid Map overflow and unnecessary processing
            if (!ai.isValid) {
                trackedAis.delete(ai.id);
                continue;
            }

            // Check if AI is already in tracking list, if it's new AI start scheduling
            if (!trackedAis.has(ai.id)) {
                trackedAis.add(ai.id);
                scheduleNextStrollSwitch(ai);
            }
        }
        
        // [Optimization] Cleanup logic: remove AI that no longer exists in cache
        const currentAiIds = new Set(allAis.map(ai => ai.id));
        for (const storedId of trackedAis.keys()) {
            if (!currentAiIds.has(storedId)) {
                trackedAis.delete(storedId);
            }
        }

    }, POPULATION_CHECK_GAP_TICKS);
}