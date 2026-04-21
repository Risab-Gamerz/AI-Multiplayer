import { world, system } from "@minecraft/server";
import { REAL_PLAYERS_CACHE } from "./rgstart.js"; 



export let ALL_AI_CACHE = [];
const AI_CACHE_REFRESH_GAP_TICKS = 200;
const ai_player_id = "rg:bot";
const NAMESPACE = "rg";

const AUTO_GREETING_CHECK_GAP_TICKS = 40; 
const AUTO_GREETING_SEARCH_RADIUS = 8;      

const INTERACTIVE_GREETING_CHECK_GAP_TICKS = 4; 
const INTERACTIVE_GREETING_RADIUS = 12;      
const GREETING_SNEAK_COUNT = 3;           
const GREETING_SNEAK_WINDOW_SECONDS = 3;   

const AI_GREETING_COOLDOWN_SECONDS = 2;   
const GREETING_ANIMATION_TAG = "is_greeting_sneaking";
const GREETING_DURATION_SECONDS = 2;    

const aiStates = new Map();
const playerSneakTracker = new Map(); 
const aiGreetingCooldown = new Set(); 

export function startGreetingBehavior() {  
    system.runInterval(() => {
        const tempAiList = [];
        const dimensionIdsToQuery = ["overworld", "nether", "the_end"];
        for (const dimId of dimensionIdsToQuery) {
            try {
                const dimension = world.getDimension(dimId);
                tempAiList.push(...dimension.getEntities({ type: ai_player_id }));
            } catch (e) {
            }
        }
        ALL_AI_CACHE = tempAiList;
    }, AI_CACHE_REFRESH_GAP_TICKS);
    startAutoGreetingLoop();
    startInteractiveGreetingLoop();    
}

function startAutoGreetingLoop() {
    system.runInterval(() => {
        const allAis = ALL_AI_CACHE;
        const idleAis = allAis.filter(ai => ai.isValid && !ai.getDynamicProperty("rg:current_target"));
        for (const ai of idleAis) {
            if (!aiStates.has(ai.id)) {
                aiStates.set(ai.id, { isGreeting: false, greetingTargetId: undefined, viewLockIntervalId: undefined });
            }
            const state = aiStates.get(ai.id);
            if (ai.isOnGround && !ai.isInWater && !ai.isFalling && !state.isGreeting && !ai.getDynamicProperty("rg:current_target") && !aiGreetingCooldown.has(ai.id)) {
                const metPlayerIds = JSON.parse(ai.getDynamicProperty(`${NAMESPACE}:met_players`) || "[]");
                const nearbyPlayers = ai.dimension.getPlayers({ location: ai.location, maxDistance: AUTO_GREETING_SEARCH_RADIUS });

                for (const player of nearbyPlayers) {
                    if (!metPlayerIds.includes(player.id)) {
                       
                        aiGreetingCooldown.add(ai.id);
                        system.runTimeout(() => { aiGreetingCooldown.delete(ai.id); }, (AI_GREETING_COOLDOWN_SECONDS * 20) | 0);

                        performGreeting(ai, player, state, metPlayerIds);
                        break; 
                    }
                }
            }
        }
    }, AUTO_GREETING_CHECK_GAP_TICKS);
}


function startInteractiveGreetingLoop() {
    system.runInterval(() => {
        const allPlayers = REAL_PLAYERS_CACHE; 
        if (!allPlayers || allPlayers.length === 0) return;
        for (const player of allPlayers) { 
            if (!player.isValid) continue;          
            if (!playerSneakTracker.has(player.id)) {
                playerSneakTracker.set(player.id, { sneakCount: 0, lastSneakTime: 0, isCurrentlySneaking: false });
            }
            const tracker = playerSneakTracker.get(player.id);
            const currentTime = Date.now();
            if (player.isSneaking && !tracker.isCurrentlySneaking) {
                if (currentTime - tracker.lastSneakTime > GREETING_SNEAK_WINDOW_SECONDS * 1000) {
                    tracker.sneakCount = 1;
                } else {
                    tracker.sneakCount++;
                }
                tracker.lastSneakTime = currentTime;

                if (tracker.sneakCount >= GREETING_SNEAK_COUNT) {
                    tracker.sneakCount = 0;
                    findNearbyIdleAIToGreetBack(player);
                }
            }
            tracker.isCurrentlySneaking = player.isSneaking;
        }
    }, INTERACTIVE_GREETING_CHECK_GAP_TICKS);
}

function findNearbyIdleAIToGreetBack(playerToDoGreeting) {
    const nearbyAis = playerToDoGreeting.dimension.getEntities({
        location: playerToDoGreeting.location,
        maxDistance: INTERACTIVE_GREETING_RADIUS,
        type: ai_player_id
    });

    for (const ai of nearbyAis) {
        if (ai.isOnGround && !ai.isInWater && !ai.isFalling && !ai.getDynamicProperty("rg:current_target") && !aiGreetingCooldown.has(ai.id)) {
            aiGreetingCooldown.add(ai.id);
            system.runTimeout(() => {
                aiGreetingCooldown.delete(ai.id);
            }, AI_GREETING_COOLDOWN_SECONDS * 20);

            const state = aiStates.get(ai.id) || { isGreeting: false };
const metPlayerIds = JSON.parse(ai.getDynamicProperty(`${NAMESPACE}:met_players`) || "[]");
performGreeting(ai, playerToDoGreeting, state, metPlayerIds);

            
            break; 
        }
    }
}


function performGreeting(ai, targetPlayer, state, metPlayerIds) {
    if (state.isGreeting) return; 
    state.isGreeting = true;
    state.greetingTargetName = targetPlayer.name; 
    state.greetingTargetId = targetPlayer.id;
    
    ai.triggerEvent("lock_movement");

    state.viewLockIntervalId = system.runInterval(() => {
        if (ai.isValid && !ai.getDynamicProperty("rg:current_target")) {
            ai.runCommand(`teleport @s ~ ~ ~ facing @e[name="${state.greetingTargetName}"]`);
        } else {
            cleanupGreeting(ai, state);
        }
    }, 1);
    if (!metPlayerIds.includes(targetPlayer.id)) {
        metPlayerIds.push(targetPlayer.id);
        ai.setDynamicProperty(`${NAMESPACE}:met_players`, JSON.stringify(metPlayerIds));
    }
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.addTag(GREETING_ANIMATION_TAG); }, 5);
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.removeTag(GREETING_ANIMATION_TAG); }, 6);
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.addTag(GREETING_ANIMATION_TAG); }, 15);
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.removeTag(GREETING_ANIMATION_TAG); }, 16);
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.addTag(GREETING_ANIMATION_TAG); }, 25);
    system.runTimeout(() => { if (ai.isValid && state.isGreeting) ai.removeTag(GREETING_ANIMATION_TAG); }, 26);    
    system.runTimeout(() => {
        cleanupGreeting(ai, state);
    }, (GREETING_DURATION_SECONDS * 20) | 0);
}


function cleanupGreeting(ai, state) {
    if (!state || !state.isGreeting) return;

    if (ai.isValid) {
        ai.removeTag(GREETING_ANIMATION_TAG);
        ai.triggerEvent("unlock_movement");
    }
    
    system.clearRun(state.viewLockIntervalId);

    state.isGreeting = false;
    state.greetingTargetId = undefined;
    state.viewLockIntervalId = undefined;
}
