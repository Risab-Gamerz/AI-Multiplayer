import { world, system } from "@minecraft/server";
import { recordBotMessage } from "./ai_conversations.js";

// =================================================================
// --- Core Configuration ---
// =================================================================

const ai_player_id = "rg:bot";
const SCOREBOARD_NAME = "sympathy_set"; // Your relay scoreboard
const PLAYER_GIVE_TAG = "sympathy_give";  // Tag applied to players after giving items
const SYMPATHY_BASE_KEY = "sympathy_player_"; // Prefix for AI dynamic attributes
const LOOP_GAP_TICKS = 5;       // Check frequency (5 ticks = 0.25 seconds)
const INTERACTION_RANGE = 8;         // AI must be within 8 blocks of the player
const MOVEMENT_LOCK_CONFIG = {
    enabled: true,
    lockEvent: "lock_movement", 
    unlockEvent: "unlock_movement"
};

// =================================================================
// --- Scoreboard Trigger Configuration ---
// =================================================================
const SYMPATHY_CONFIG = new Map([
    [1, {
        sympathyChance: 1.0,
        sympathyMin: 1,
        sympathyMax: 3,
        messageChance: 0.10,
        messages: ["thx", "that's good", "yeah"],
        cooldownSeconds: 30,
        messageCooldownSeconds: 5
    }],
    
    [3, {
        sympathyChance: 1.0,
        sympathyMin: 4,
        sympathyMax: 6,
        messageChance: 0.50,
        messages: ["thx a lot man", "yo bro thank", "haha thx"],
        cooldownSeconds: 60,
        messageCooldownSeconds: 10
    }],
    
    [5, {
        sympathyChance: 1.0,
        sympathyMin: 7,
        sympathyMax: 10,
        messageChance: 1.0,
        messages: ["that's great dude", "wow thx homie", "yeah bro thx u"],
        cooldownSeconds: 120,
        messageCooldownSeconds: 15
    }]
]);

// =================================================================
// --- Internal Cache ---
// =================================================================

let SCOREBOARD_OBJECTIVE = null;
let isReady = false;  // ✅ Track if system is ready
const aiCooldowns = new Map();
const aiMessageCooldowns = new Map();

// =================================================================
// --- Core Logic ---
// =================================================================

function checkSympathyEvents() {
    // ✅ Don't run if system isn't ready
    if (!isReady) return;
    
    // 1. Get or cache scoreboard
    if (!SCOREBOARD_OBJECTIVE) {
        try {
            SCOREBOARD_OBJECTIVE = world.scoreboard.getObjective(SCOREBOARD_NAME);
            if (!SCOREBOARD_OBJECTIVE) return;
        } catch (e) {
            return;
        }
    }

    // 2. Get players with the give tag
    const playersWhoGave = world.getPlayers({ tags: [PLAYER_GIVE_TAG] });
    if (playersWhoGave.length === 0) return;

    for (const player of playersWhoGave) {
        if (!player.isValid) continue;

        // 3. Get nearby AIs
        const nearbyAis = player.dimension.getEntities({
            type: ai_player_id,
            location: player.location,
            maxDistance: INTERACTION_RANGE
        });

        for (const ai of nearbyAis) {
            if (!ai.isValid) continue;

            let score;
            try {
                score = SCOREBOARD_OBJECTIVE.getScore(ai);
                if (score === undefined || score < 1) continue;
            } catch (e) {
                continue;
            }

            processSympathyEvent(ai, player, score);
        }
        
        player.removeTag(PLAYER_GIVE_TAG);
    }
}

function processSympathyEvent(ai, player, score) {
    // Reset score immediately to prevent duplicate triggers
    try {
        SCOREBOARD_OBJECTIVE.setScore(ai, 0);
    } catch (e) {
        return;
    }

    const config = SYMPATHY_CONFIG.get(score);
    if (!config) return;

    const aiId = ai.id;
    const currentTick = system.currentTick;

    if (!aiCooldowns.has(aiId)) {
        aiCooldowns.set(aiId, new Map());
    }
    if (!aiMessageCooldowns.has(aiId)) {
        aiMessageCooldowns.set(aiId, new Map());
    }
    
    const aiPrivateCooldowns = aiCooldowns.get(aiId);
    const aiMessageCooldownsMap = aiMessageCooldowns.get(aiId);
    
    const cooldownExpiry = aiPrivateCooldowns.get(score) || 0;
    const messageCooldownExpiry = aiMessageCooldownsMap.get(score) || 0;

    // ===== SYMPATHY INCREASE LOGIC =====
    if (currentTick >= cooldownExpiry) {
        if (Math.random() < config.sympathyChance) {
            const sympathyGain = ((Math.random() * (config.sympathyMax - config.sympathyMin + 1)) | 0) + config.sympathyMin;
            
            const sympathyKey = SYMPATHY_BASE_KEY + player.id;
            const currentSympathy = ai.getDynamicProperty(sympathyKey) || 0;
            const newSympathy = currentSympathy + sympathyGain;
            ai.setDynamicProperty(sympathyKey, newSympathy);
        }
        
        const newCooldownTicks = (config.cooldownSeconds * 20) | 0;
        aiPrivateCooldowns.set(score, currentTick + newCooldownTicks);
    }

    // ===== MESSAGE LOGIC =====
    if (currentTick >= messageCooldownExpiry && Math.random() < config.messageChance) {
        const message = config.messages[(Math.random() * config.messages.length) | 0];
        const aiName = ai.nameTag || "AI Player";
        
        const newMessageCooldownTicks = (config.messageCooldownSeconds * 20) | 0;
        aiMessageCooldownsMap.set(score, currentTick + newMessageCooldownTicks);
        
        if (MOVEMENT_LOCK_CONFIG.enabled) {
            try {
                ai.triggerEvent(MOVEMENT_LOCK_CONFIG.lockEvent);
            } catch (e) {}
        }
        
        system.runTimeout(() => {
            if (ai.isValid) {
                world.sendMessage(`<${aiName}> ${message}`);
                
                try {
                    recordBotMessage(aiName, message, ai.location);
                } catch (e) {}
                
                if (MOVEMENT_LOCK_CONFIG.enabled) {
                    try {
                        ai.triggerEvent(MOVEMENT_LOCK_CONFIG.unlockEvent);
                    } catch (e) {}
                }
            }
        }, 50);
    }
}

function cleanupCooldowns() {
    const currentTick = system.currentTick;
    const maxAge = 36000; // 30 minutes in ticks
    
    for (const [aiId, cooldownMap] of aiCooldowns.entries()) {
        for (const [score, expiryTick] of cooldownMap.entries()) {
            if (currentTick - expiryTick > maxAge) {
                cooldownMap.delete(score);
            }
        }
        if (cooldownMap.size === 0) {
            aiCooldowns.delete(aiId);
        }
    }
    
    for (const [aiId, cooldownMap] of aiMessageCooldowns.entries()) {
        for (const [score, expiryTick] of cooldownMap.entries()) {
            if (currentTick - expiryTick > maxAge) {
                cooldownMap.delete(score);
            }
        }
        if (cooldownMap.size === 0) {
            aiMessageCooldowns.delete(aiId);
        }
    }
}

// Run cleanup every 5 minutes
system.runInterval(cleanupCooldowns, 6000);

// =================================================================
// --- Initialization with Delay (Fixes Early Execution Error) ---
// =================================================================

export function startSympathyListener() {
    // ✅ Delay initialization to avoid early execution errors
    const initAttempt = () => {
        try {
            // Try to access world.scoreboard - this will throw if in early execution
            SCOREBOARD_OBJECTIVE = world.scoreboard.getObjective(SCOREBOARD_NAME);
            
            if (SCOREBOARD_OBJECTIVE) {
                console.warn("[SympathyListener] Scoreboard found and cached.");
                isReady = true;
                
                // ✅ Start main loop only after successful initialization
                system.runInterval(checkSympathyEvents, LOOP_GAP_TICKS);
            } else {
                // Scoreboard doesn't exist yet, retry later
                console.warn("[SympathyListener] Scoreboard not found - retrying in 2 seconds...");
                system.runTimeout(initAttempt, 40); // 2 seconds (40 ticks)
            }
        } catch (e) {
            // Early execution error - retry later
            console.warn(`[SympathyListener] World not ready yet, retrying in 2 seconds...`);
            system.runTimeout(initAttempt, 40); // 2 seconds
        }
    };
    
    // Start the initialization attempt
    initAttempt();
}