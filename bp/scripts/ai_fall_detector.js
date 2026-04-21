import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";


const ai_player_id = "rg:bot"; 
const FALLING_TAG = "falling";
const CHECK_GAP_TICKS = 5;


export function startFallDetectorBehavior() {
    system.runInterval(() => {
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;        
        for (const ai of allAis) {           
            if (!ai.isValid) continue;             
            const isCurrentlyFalling = ai.isFalling;
            const hasTheTag = ai.hasTag(FALLING_TAG);
            if (isCurrentlyFalling && !hasTheTag) {
                ai.addTag(FALLING_TAG);
            } else if (!isCurrentlyFalling && hasTheTag) {
                ai.removeTag(FALLING_TAG);
            }
        }
    }, CHECK_GAP_TICKS);
}