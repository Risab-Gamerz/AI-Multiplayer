import { world, system } from "@minecraft/server";
// [Core Modification] Import AI entity cache
import { ALL_AI_CACHE } from "./greeting.js"; 

const ai_player_id = "rg:bot";
const ANTI_TRAP_GAP_TICKS = 60; // Check every 3 seconds (60 ticks)
const ANTI_TRAP_RADIUS = 3;       
const TRAP_VEHICLE_TYPES = [         
    "minecraft:minecart",
    "minecraft:boat",
    "minecraft:chest_boat"
];


export function AiTrapProof() {
    system.runInterval(() => {
     
        // -----------------------------------------------------------
        // [Ultimate Optimization] Use global cache ALL_AI_CACHE instead of expensive dimension query loops
        // -----------------------------------------------------------
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;
        
        for (const ai of allAis) {
            // [Micro Optimization] Check if entity is still valid
            if (!ai.isValid) continue; 
            
            // [Necessary API Overhead] Query entities within 3 blocks of AI (real-time requirement, can't be cached)
            const nearbyEntities = ai.dimension.getEntities({
                location: ai.location,
                maxDistance: ANTI_TRAP_RADIUS,
                // Exclude common mobs to improve query efficiency
                excludeFamilies: [ "player", "monster", "animal" ] 
            });

            for (const entity of nearbyEntities) {
                // [Micro Optimization] Ensure entity is valid before checking typeId
                if (entity.isValid && TRAP_VEHICLE_TYPES.includes(entity.typeId)) {
                    
                    // Found trap vehicle, kill it to escape
                    entity.kill();
                    
                    // [Optimization] Once escaped, immediately break inner loop and move to next AI check
                    break;
                }
            }
        }
    }, ANTI_TRAP_GAP_TICKS);
}
