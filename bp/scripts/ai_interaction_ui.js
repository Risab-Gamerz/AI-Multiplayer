import { world, system, EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// --- Configuration ---
const ai_player_id = "rg:bot";         
const SYMPATHY_BASE_KEY = "sympathy_player_"; 
const aim_ITEM_ID = "rg:friend_request";
const FRIEND_LIST_ITEM_ID = "rg:friend_list_opener"; 

// --- Persistence & Status Keys (Dynamic Properties) ---
const AI_PERSISTENT_ID_KEY = "rg:p_id";             // Stored on AI entity: Persistent unique ID
const FRIEND_STATUS_BASE_KEY = "friend_status_";    // Stored on AI entity: Friend status for specific player
const FRIEND_COOLDOWN_BASE_KEY = "friend_cooldown_"; // Stored on AI entity: Friend request cooldown deadline
const PLAYER_FRIENDS_DATA_KEY = "rg:friends_list_data"; // Stored on player entity: Friends list

// --- World Global Status Key ---
const DEAD_AI_LIST_KEY = "rg:dead_ais"; // Stored on world property: List of dead AI P-IDs
const REVIVE_COOLDOWN_BASE_KEY = "rg:revive_cd_"; // Stored on world property: rg:revive_cd_[persistentId]
const tp_COOLDOWN_BASE_KEY = "rg:tp_cd_";   // Stored on AI entity: rg:tp_cd_[playerId]

// --- Cooldowns and Delays ---
const FRIEND_COOLDOWN_SECONDS = 120;                // 2 minutes
const MIN_RESPONSE_DELAY_TICKS = 100;               // 5 seconds
const MAX_RESPONSE_DELAY_TICKS = 600;              // 30 seconds
const GLOBAL_REVIVE_COOLDOWN_SECONDS = 300; // 5 minutes
const tp_COOLDOWN_SECONDS = 60;       // 1 minute

// Revive reset
const PROGRESSION_PROPERTY = "rg:progression_points"; 
const FACTION_TAGS = ['crazy', 'bad', 'good'];
const LV_TAGS = ['lv1', 'lv2', 'lv3', 'lv4', 'lv5', 'lv6'];
const TIER_TAGS = ['wooden', 'stone', 'copper', 'iron', 'diamond', 'diamond_pro'];
const ALL_CLEANUP_TAGS = [...FACTION_TAGS, ...LV_TAGS, ...TIER_TAGS, 'captain'];

// Features - Export these for other modules
export const FOLLOW_AI_TAG = 'follow_player';
export const CAN_FOLLOW_PLAYER_TAG = 'can_followed';
export const LOCK_EQUIPMENT_TAG = 'suoding';
export const PROHIBIT_BUILDING_TAG = 'prohibit_building';

// --- Item and Initialization Keys ---
const ITEM_friend_request = "rg:friend_request";
const PLAYER_INIT_FLAG_KEY = "rg:startd_player"; // Stored on player entity

// --- Global Pending Action Key ---
const PENDING_KEY = "rg:pending_action"; // Global request lock

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or start player's friend list array
 */
function getPlayerFriends(player) {
    try {
        const data = player.getDynamicProperty(PLAYER_FRIENDS_DATA_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Store player friend list
 */
function setPlayerFriends(player, friendsList) {
    player.setDynamicProperty(PLAYER_FRIENDS_DATA_KEY, JSON.stringify(friendsList));
}

/**
 * Get list of dead AI IDs stored in world dynamic property
 */
function getDeadAiIds() {
    const data = world.getDynamicProperty(DEAD_AI_LIST_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
}

/**
 * Store dead AI ID list to world dynamic property
 */
function setDeadAiIds(deadAiSet) {
    world.setDynamicProperty(DEAD_AI_LIST_KEY, JSON.stringify(Array.from(deadAiSet)));
}

/**
 * Find AI entity in loaded chunks by persistent ID
 */
function getAiByPersistentId(persistentId) {
    const dimensionIds = ["overworld", "nether", "the_end"];    
    for (const dimId of dimensionIds) {
        try {
            const dimension = world.getDimension(dimId);
            const entities = dimension.getEntities({
                type: ai_player_id,
            });            
            for (const entity of entities) {
                const entityPId = entity.getDynamicProperty(AI_PERSISTENT_ID_KEY);                  
                if (entityPId === persistentId) {
                    if (!entity.hasTag('online')) {
                        entity.addTag('online');
                    }                   
                    return entity;
                }
            }
        } catch (e) { 
        }
    }
    return null;
}

/**
 * Ensure AI entity has persistent ID. If AI is new, generate a GUID
 */
function ensurePersistentId(ai) {
    let pId = ai.getDynamicProperty(AI_PERSISTENT_ID_KEY);
    if (!pId) {
        pId = `${Date.now()}-${Math.floor(Math.random() * 10000)}-${ai.id}`; 
        ai.setDynamicProperty(AI_PERSISTENT_ID_KEY, pId);
    }
    return pId;
}

/**
 * Get friend data from cache
 */
function friendDataFromCache(ai, player) {
    const persistentId = ai.getDynamicProperty(AI_PERSISTENT_ID_KEY);
    if (!persistentId) return null;
    return getPlayerFriends(player).find(f => f.id === persistentId);
}

/**
 * Give friend configuration items to player
 */
function giveFriendConfigItems(player) {
    player.runCommand(`give @s ${ITEM_friend_request}`);
    player.runCommand(`give @s ${FRIEND_LIST_ITEM_ID}`);
}

/**
 * Trigger faction-specific events
 */
function triggerFactionalEvent(ai, baseEventName) {
    if (!ai?.isValid) return;

    if (ai.hasTag("good")) {
        ai.triggerEvent(`rg:good_${baseEventName}`);
    } else if (ai.hasTag("bad")) {
        ai.triggerEvent(`rg:bad_${baseEventName}`);
    } else if (ai.hasTag("crazy")) {
        ai.triggerEvent(`rg:crazy_${baseEventName}`);
    } else {
        ai.triggerEvent(`rg:${baseEventName}`);
    }
}

// ============================================================================
// PROBABILISTIC ACTION SYSTEM
// ============================================================================

function runProbabilisticAction({
    player, ai, actionType, requestSentMessage,
    baseChance, sympathy, 
    cooldownKey, cooldownSeconds, cooldownScope,
    onSuccess, onFailure = () => {},
    successMessage, failureMessage, cooldownMessage
}) {
    if (!ai.isValid || !player.isValid) return;

    const aiName = ai.nameTag;
    const cdKey = cooldownKey + player.id;
    const currentTime = Date.now();
    const expiry = ai.getDynamicProperty(cdKey) || 0;

    // 1. Check if AI is already processing another request
    const pendingAction = ai.getDynamicProperty(PENDING_KEY);
    if (pendingAction) {
        player.sendMessage(`§8[${aiName}] Is processing the previous request, please wait...`);
        return;
    }

    // 2. Check player's personal cooldown
    if (expiry > currentTime) {
        const remaining = Math.ceil((expiry - currentTime) / 1000);
        
        let cdMsg = `§8[${aiName}] Cooldown for this action, please wait ${remaining} seconds.`;
        if (actionType === 'assist') {
            cdMsg = `§8[${aiName}] Assist request on cooldown, please wait ${remaining} seconds before trying again.`;
        } else if (actionType === 'follow') {
            cdMsg = `§8[${aiName}] Follow request on cooldown, please wait ${remaining} seconds before trying again.`;
        } else if (actionType === 'teleport') {
            cdMsg = `§8[${aiName}] Teleport request on cooldown, please wait ${remaining} seconds before trying again.`;
        }
        player.sendMessage(cdMsg);
        return;
    }

    // 3. Calculate probability (sympathy can be negative, which reduces chance)
    let finalChance = baseChance + sympathy;
    finalChance = Math.max(0, Math.min(100, finalChance));
    const isSuccess = Math.random() * 100 < finalChance;

    // 4. Set delay (3-10 seconds)
    const delayTicks = Math.floor(Math.random() * (200 - 60 + 1)) + 60;

    // 5. Set global lock and send immediate message
    ai.setDynamicProperty(PENDING_KEY, actionType);
    if (requestSentMessage) {
        player.sendMessage(requestSentMessage);
    }

    // 6. Delayed execution
    system.runTimeout(() => {
        // Always clear lock after delay
        ai.setDynamicProperty(PENDING_KEY, null);
        
        if (!ai.isValid || !player.isValid) return;

        const newExpiry = currentTime + (cooldownSeconds * 1000);

        if (isSuccess) {
            player.sendMessage(`§a§l[${aiName}] ${successMessage}`);
            onSuccess();
            if (cooldownScope === 'always' || cooldownScope === 'success') {
                ai.setDynamicProperty(cdKey, newExpiry);
            }
        } else {
            player.sendMessage(`§c§l[${aiName}] ${failureMessage}`);
            onFailure();
            if (cooldownScope === 'always' || cooldownScope === 'failure') {
                ai.setDynamicProperty(cdKey, newExpiry);
            }
        }
        
        // Refresh menu
        system.runTimeout(() => {
            if (ai.isValid && player.isValid) {
                const friendData = friendDataFromCache(ai, player);
                if (friendData) {
                    showFriendActionMenu(player, ai, friendData);
                }
            }
        }, 5); 

    }, delayTicks);
}

// ============================================================================
// AUTO-UNFRIEND ON NEGATIVE SYMPATHY
// ============================================================================

function checkNegativeSympathyUnfriend() {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        let friendsList = getPlayerFriends(player);
        let updatedList = [];
        let playerListChanged = false;

        for (const friendData of friendsList) {
            const persistentId = friendData.id;
            const aiName = friendData.name;
            
            const ai = getAiByPersistentId(persistentId);
            const isDead = getDeadAiIds().has(persistentId);

            let sympathy = 0;
            let dataAvailable = false;
            const SYMPATHY_CACHE_KEY = `rg:dead_ai_sympathy_${persistentId}`;
            
            // Get sympathy value (prioritize from online entity, else from dead cache)
            if (ai && ai.isValid) {
                sympathy = ai.getDynamicProperty(SYMPATHY_BASE_KEY + player.id) || 0;
                dataAvailable = true;
            } else if (isDead) {
                try {
                    const sympathyDataStr = world.getDynamicProperty(SYMPATHY_CACHE_KEY);
                    if (sympathyDataStr) {
                        const sympathyData = JSON.parse(sympathyDataStr);
                        if (sympathyData[player.id] !== undefined) {
                            sympathy = sympathyData[player.id];
                            dataAvailable = true;
                        }
                    }
                } catch (e) { /* Ignore read errors */ }
            }
            
            // Only check when sympathy data is available and sympathy < 0
            if (dataAvailable && sympathy < 0) {
                const unfriendChance = Math.abs(sympathy); // 1% per point of negative sympathy
                
                if (Math.random() * 100 < unfriendChance) {
                    // Execute unfriend logic
                    
                    // A. Clean up status on online/loaded entity
                    if (ai && ai.isValid) {
                        ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + player.id, null);
                        ai.setDynamicProperty(FRIEND_COOLDOWN_BASE_KEY + player.id, null);
                        ai.setDynamicProperty(SYMPATHY_BASE_KEY + player.id, null); 
                        ai.removeTag(FOLLOW_AI_TAG);
                        player.removeTag(CAN_FOLLOW_PLAYER_TAG);
                    }

                    // B. Clean up sympathy in dead cache
                    if (isDead) {
                        try {
                            const sympathyDataStr = world.getDynamicProperty(SYMPATHY_CACHE_KEY);
                            if (sympathyDataStr) {
                                let sympathyData = JSON.parse(sympathyDataStr);
                                delete sympathyData[player.id];
                                world.setDynamicProperty(SYMPATHY_CACHE_KEY, JSON.stringify(sympathyData));
                            }
                        } catch (e) { /* Ignore cleanup errors */ }
                    }
                    
                    // C. Notify player
                    player.sendMessage(`§c§l${aiName}§r§c has unfriended you.`);
                    playerListChanged = true;
                    
                    // D. Skip adding to updatedList (remove from friends)
                    continue;
                }
            }
            
            // Keep in list if not removed
            updatedList.push(friendData);
        }
        
        // Only update player's friend list if removals occurred
        if (playerListChanged) {
            setPlayerFriends(player, updatedList);
        }
    }
}

// ============================================================================
// FRIEND REQUEST HANDLER
// ============================================================================

function handleFriendRequest(ai, player, sympathy) {
    if (!ai.isValid || !player.isValid) return;

    const playerId = player.id;
    const aiName = ai.nameTag || "AI Player";
    
    const delayTicks = Math.floor(Math.random() * (MAX_RESPONSE_DELAY_TICKS - MIN_RESPONSE_DELAY_TICKS + 1)) + MIN_RESPONSE_DELAY_TICKS;

    ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId, "requested");
    player.sendMessage(`§a§lYour friend request has been submitted to [${aiName}].`);

    system.runTimeout(() => {
        if (!ai.isValid || !player.isValid) return;

        let isAccepted = false;
        let responseMessage = "";
        
        // --- Logic check ---
        if (sympathy < 0) {
            // Sympathy < 0: Directly refused
            responseMessage = `§c§l[${aiName}] refused your friend request.`;
            isAccepted = false;
        } else {
            // Sympathy >= 0: Conduct probability check
            let successRate = 20 + sympathy; // Base 20% + 1% per sympathy point
            successRate = Math.min(successRate, 100); 
            
            if (Math.random() * 100 < successRate) {
                responseMessage = `§a§l[${aiName}] accepted your friend request.`;
                isAccepted = true;
            } else {
                responseMessage = `§c§l[${aiName}] refused your friend request.`;
                isAccepted = false;
            }
        }
        
        if (isAccepted) {
            // A. Agree: Set permanent accept status
            ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId, "accepted");
            ai.setDynamicProperty(FRIEND_COOLDOWN_BASE_KEY + playerId, 0); 
            if (ai.isValid && !ai.hasTag('online')) { 
                ai.addTag('online');
            }
            
            let variantId = null;
            try {
                const variantComp = ai.getComponent('minecraft:variant');
                if (variantComp) {
                    variantId = variantComp.value;
                }
            } catch (e) {
                console.warn(`[HandleFriend] Failed to get variant component for AI: ${e}`);
            }
            
            // Store AI info to player's dynamic property (using persistent ID)
            const persistentId = ensurePersistentId(ai);
            const friends = getPlayerFriends(player);
            const existingIndex = friends.findIndex(f => f.id === persistentId);
            if (existingIndex === -1) {
                const storedFactionTag = FACTION_TAGS.find(tag => ai.hasTag(tag)) || null;
                const storedLvTag = LV_TAGS.find(tag => ai.hasTag(tag)) || null;

                friends.push({ 
                    id: persistentId, 
                    name: aiName, 
                    isTamed: false, 
                    factionTag: storedFactionTag, 
                    lvTag: storedLvTag,            
                    variantId: variantId
                });
                setPlayerFriends(player, friends);
            }
        } else {
            // B. Reject: Set cooldown status
            ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId, "cooldown");
            const expiryTick = system.currentTick + (FRIEND_COOLDOWN_SECONDS * 20);
            ai.setDynamicProperty(FRIEND_COOLDOWN_BASE_KEY + playerId, expiryTick);
        }

        player.sendMessage(responseMessage);
        player.sendMessage("§b[Tip] Please re-open the menu to check the new friend status.");

    }, delayTicks);
}

// ============================================================================
// tp / INVITE FUNCTIONS
// ============================================================================

function inviteOnline(ai, player) {
    if (!ai.isValid || !player.isValid) {
        player.sendMessage("§cTarget is no longer valid.");
        return;
    }
    
    if (ai.hasTag('online')) {
        const playerId = player.id;
        const aiName = ai.nameTag;
        const tpCooldownKey = tp_COOLDOWN_BASE_KEY + playerId;
        const tpExpiry = ai.getDynamicProperty(tpCooldownKey) || 0;
        const currentTime = Date.now();

        if (tpExpiry > currentTime) {
            const remainingSeconds = Math.ceil((tpExpiry - currentTime) / 1000);
            player.sendMessage(`§c[${aiName}] Teleport is on cooldown, please wait ${remainingSeconds} seconds before trying again.`);
            return;
        }
        
        // Check if dimensions match
        if (ai.dimension.id !== player.dimension.id) {
            const playerDimName = player.dimension.id.split(':')[1] || "Unknown";
            player.sendMessage(`§c[${ai.nameTag}] is currently in a different dimension (${playerDimName}), cannot teleport.`);
            player.sendMessage("§e[Tip] Please go to their dimension first.");
            return;
        }
        
        // Execute teleport
        player.sendMessage(`§e[System] Teleporting ${aiName}, please wait...`);
        
        try {
            ai.teleport(player.location, player.dimension);
            player.sendMessage(`§a[System] ${ai.nameTag} has been teleported to your side.`);
            const newTpExpiry = currentTime + (tp_COOLDOWN_SECONDS * 1000);
            ai.setDynamicProperty(tpCooldownKey, newTpExpiry);
        } catch (e) {
            player.sendMessage(`§c[System] Teleport failed, please check the friend's location.`);
        }
    } else {
        player.sendMessage(`§c[${ai.nameTag}] is currently offline, cannot teleport.`);
    }
}

function askCoordinates(ai, player) {
    if (!ai.isValid || !player.isValid) return;

    const loc = ai.location;
    const dim = ai.dimension.id.split(':')[1]; 
    
    player.sendMessage(`§a[${ai.nameTag}] §fCurrent coordinates: §bX: ${loc.x.toFixed(1)}, Y: ${loc.y.toFixed(1)}, Z: ${loc.z.toFixed(1)} (§e${dim}§f)`);
}

// ============================================================================
// REVIVE / RESURRECT FUNCTION
// ============================================================================

function resurrectAI(player, friendData) {
    const persistentId = friendData.id;
    const deadAiSet = getDeadAiIds();
    const reviveCooldownKey = REVIVE_COOLDOWN_BASE_KEY + persistentId;
    const reviveExpiry = world.getDynamicProperty(reviveCooldownKey) || 0;
    const currentTime = Date.now();
    
    if (reviveExpiry > currentTime) {
        const remainingSeconds = Math.ceil((reviveExpiry - currentTime) / 1000);
        player.sendMessage(`§c[System] Please wait ${remainingSeconds} seconds before trying again.`);
        return;
    }

    // Core check: Death mark
    if (!deadAiSet.has(persistentId)) {
        player.sendMessage(`§e[System] ${friendData.name} has only temporarily departed and cannot be invited online.`);
        return; 
    }
    
    // Anti-clone check
    const existingAi = getAiByPersistentId(persistentId);
    if (existingAi) {
        player.sendMessage(`§e[System] ${friendData.name} is already online.`);
        deadAiSet.delete(persistentId);
        setDeadAiIds(deadAiSet);
        showFriendActionMenu(player, existingAi, friendData); 
        return; 
    }

    // Execute spawn
    const dimension = player.dimension;
    const spawnLoc = player.location;
    
    try {
        const RESURRECT_TAG = "rg:resurrected_ai"; 
        const newAi = dimension.spawnEntity(ai_player_id, spawnLoc);
        
        // Set revive marker, persistent ID, and name
        newAi.addTag(RESURRECT_TAG); 
        newAi.setDynamicProperty(AI_PERSISTENT_ID_KEY, persistentId); 
        newAi.nameTag = friendData.name; 
        
        // Remove death marker
        deadAiSet.delete(persistentId);
        setDeadAiIds(deadAiSet);
        
        const newReviveExpiry = currentTime + (GLOBAL_REVIVE_COOLDOWN_SECONDS * 1000);
        world.setDynamicProperty(reviveCooldownKey, newReviveExpiry);
        player.sendMessage(`§e${friendData.name} joined the game`);

        // Delayed cleanup and state recovery
        system.runTimeout(() => {
            if (!newAi.isValid) return; 

            // Clear all tags
            for (const tag of ALL_CLEANUP_TAGS) {
                newAi.removeTag(tag);
            }
            
            // Reset progress and set initial equipment
            newAi.setDynamicProperty(PROGRESSION_PROPERTY, 0);
            newAi.addTag('wooden');

            // Restore stored tags
            if (friendData.factionTag) {
                newAi.addTag(friendData.factionTag);
            }
            if (friendData.lvTag) {
                newAi.addTag(friendData.lvTag);
            }
            
            if (!newAi.hasTag('online')) {
                newAi.addTag('online');
            }
            
            // Restore Sympathy
            const INTERACTED_PLAYERS_KEY = "rg:interacted_players_list";
            const SYMPATHY_CACHE_KEY = `rg:dead_ai_sympathy_${persistentId}`;
            
            try {
                // Restore player list
                const playersListData = world.getDynamicProperty(INTERACTED_PLAYERS_KEY + "_" + persistentId);
                if (playersListData) {
                    newAi.setDynamicProperty(INTERACTED_PLAYERS_KEY, playersListData);
                    world.setDynamicProperty(INTERACTED_PLAYERS_KEY + "_" + persistentId, null);
                }
                
                // Restore sympathy data
                const sympathyDataStr = world.getDynamicProperty(SYMPATHY_CACHE_KEY);
                if (sympathyDataStr) {
                    const sympathyData = JSON.parse(sympathyDataStr);
                    for (const playerId in sympathyData) {
                        newAi.setDynamicProperty(SYMPATHY_BASE_KEY + playerId, sympathyData[playerId]);
                    }
                    world.setDynamicProperty(SYMPATHY_CACHE_KEY, null);
                }
            } catch (e) {
                console.warn(`[AI Resurrect] Failed to restore sympathy data for AI ${persistentId}: ${e}`);
            }
            
            // Skin variant recovery
            if (friendData.variantId !== null && friendData.variantId !== undefined) {
                const variantId = friendData.variantId;
                newAi.triggerEvent("delete_skin");
                
                if (variantId >= 0) {
                    const variantEvent = `become_skin${(variantId + 1).toString().padStart(2, '0')}`;
                    newAi.triggerEvent(variantEvent);
                }
            }
            
            // Clear inventory
            const commands = [
                `replaceitem entity @s slot.weapon.mainhand 0 air`,
                `replaceitem entity @s slot.weapon.offhand 0 air`,
                `replaceitem entity @s slot.armor.head 0 air`,
                `replaceitem entity @s slot.armor.chest 0 air`,
                `replaceitem entity @s slot.armor.legs 0 air`,
                `replaceitem entity @s slot.armor.feet 0 air`
            ];

            const TEMP_aim_TAG = "rg:temp_target_ai";
            newAi.addTag(TEMP_aim_TAG);
            
            commands.forEach(cmd => {
                const finalCmd = cmd.replace(/@s/, `@e[tag=${TEMP_aim_TAG},c=1]`);
                dimension.runCommand(finalCmd);
            });
            
            newAi.removeTag(TEMP_aim_TAG); 

        }, 10); 
        
    } catch (e) {
        player.sendMessage(`§c[System] Can't Invite: ${friendData.name}.`);
    }
}

// ============================================================================
// UNFRIEND FUNCTION
// ============================================================================

function unfriendAI(player, persistentId, aiName) {
    // Calculate sympathy penalty (20-40 points)
    const penalty = Math.floor(Math.random() * 21) + 20;

    // Clean up state on AI entity (if alive)
    const ai = getAiByPersistentId(persistentId);
    if (ai) {
        ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + player.id, null);
        ai.setDynamicProperty(FRIEND_COOLDOWN_BASE_KEY + player.id, null);
        ai.removeTag(FOLLOW_AI_TAG);
        player.removeTag(CAN_FOLLOW_PLAYER_TAG);

        // Apply penalty instead of clearing sympathy
        let currentSympathy = ai.getDynamicProperty(SYMPATHY_BASE_KEY + player.id) || 0;
        let newSympathy = Math.max(-100, currentSympathy - penalty);
        ai.setDynamicProperty(SYMPATHY_BASE_KEY + player.id, newSympathy);
    }

    // Clean up player friend list
    const friends = getPlayerFriends(player);
    const updatedFriends = friends.filter(f => f.id !== persistentId);
    setPlayerFriends(player, updatedFriends);

    // Update dead sympathy cache (apply penalty)
    const SYMPATHY_CACHE_KEY = `rg:dead_ai_sympathy_${persistentId}`;
    try {
        const sympathyDataStr = world.getDynamicProperty(SYMPATHY_CACHE_KEY);
        if (sympathyDataStr) {
            let sympathyData = JSON.parse(sympathyDataStr);
            let currentSympathy = sympathyData[player.id] || 0;
            sympathyData[player.id] = Math.max(-100, currentSympathy - penalty);
            world.setDynamicProperty(SYMPATHY_CACHE_KEY, JSON.stringify(sympathyData));
        }
    } catch (e) { /* Ignore cleanup error */ }

    player.sendMessage(`§cYou have unfriended §l${aiName}§r§c.`);
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

/**
 * Friend request interface (non-friend status)
 */
function showAiInfoMenu(player, ai, sympathy) {
    const playerId = player.id;
    const aiName = ai.nameTag;

    const friendStatus = ai.getDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId) || "";
    const cooldownExpiry = ai.getDynamicProperty(FRIEND_COOLDOWN_BASE_KEY + playerId) || 0;
    const currentTick = system.currentTick;
    
    let isCoolingDown = (friendStatus === "cooldown" && currentTick < cooldownExpiry);
    let isRequested = (friendStatus === "requested");

    const form = new ActionFormData();
    form.title(aiName);

    let sympathyText;
    if (sympathy >= 50) sympathyText = `§a${sympathy} (Friendly)`;
    else if (sympathy > 20) sympathyText = `§e${sympathy} (Warm)`;
    else if (sympathy >= -20) sympathyText = `§f${sympathy} (Neutral)`;
    else sympathyText = `§c${sympathy} (Hostile)`;

    let bodyText = `§8Your sympathy with this person:\n§f${sympathyText}\n\n`;
    form.body(bodyText);

    let buttonText;
    let buttonIcon;
    let buttonAction;

    if (isCoolingDown) {
        const remainingTicks = cooldownExpiry - currentTick;
        const remainingSeconds = (remainingTicks / 20).toFixed(0);
        buttonText = `§e§lCooldown (${remainingSeconds}s)`; 
        buttonIcon = "textures/items/clock_item";
        buttonAction = 1; 
    } else if (isRequested) {
        buttonText = `§9Request Pending...`; 
        buttonIcon = "textures/items/pending";
        buttonAction = 1; 
    } else {
        buttonText = "§lFriend Request";
        buttonIcon = "textures/items/friend_request";
        buttonAction = 0; 
    }
    
    form.button(buttonText, buttonIcon);
    form.button("§cClose");

    form.show(player).then(response => {
        if (response.isCanceled || response.selection === 1) {
            return; 
        }

        if (response.selection === 0 && buttonAction === 0) {
            handleFriendRequest(ai, player, sympathy);
        }
    });
}

/**
 * Friend action menu (for existing friends)
 */
function showFriendActionMenu(player, ai, friendData) {
    const persistentId = friendData.id;
    const isAlive = !!ai;
    const isDead = getDeadAiIds().has(persistentId);
    const isOnline = isAlive ? ai.hasTag('online') : false;
    const currentTime = Date.now(); 

    // Sympathy retrieval logic
    let sympathy = 0;
    let sympathyText = "§8Unknown";

    if (isAlive) {
        sympathy = ai.getDynamicProperty(SYMPATHY_BASE_KEY + player.id) || 0;
        sympathyText = `§f${sympathy}`;
    } else if (isDead) {
        try {
            const SYMPATHY_CACHE_KEY = `rg:dead_ai_sympathy_${persistentId}`;
            const sympathyDataStr = world.getDynamicProperty(SYMPATHY_CACHE_KEY);
            if (sympathyDataStr) {
                const sympathyData = JSON.parse(sympathyDataStr);
                if (sympathyData[player.id] !== undefined) {
                    sympathy = sympathyData[player.id];
                    sympathyText = `§f${sympathy} (Offline)`;
                }
            }
        } catch (e) { /* Ignore read error */ }
    }

    // Action codes
    const ACTION_INVITE_RESURRECT = 0; 
    const ACTION_ASK_COORDS = 1; 
    const ACTION_REQUEST_ASSISTANCE = 2;
    const ACTION_TOGGLE_FOLLOW = 3;
    const ACTION_TOGGLE_EQUIPMENT_LOCK = 4;
    const ACTION_TOGGLE_BUILDING_PROHIBITION = 5;
    const ACTION_UNFRIEND = 6;
    const ACTION_BACK = 7;
    
    // Read all cooldowns and global locks
    const reviveCooldownKey = REVIVE_COOLDOWN_BASE_KEY + persistentId;
    const reviveExpiry = world.getDynamicProperty(reviveCooldownKey) || 0;
    const reviveOnCooldown = reviveExpiry > currentTime;
    const reviveRemaining = reviveOnCooldown ? Math.ceil((reviveExpiry - currentTime) / 1000) : 0;
    
    const pendingAction = isAlive ? (ai.getDynamicProperty(PENDING_KEY) || null) : null;
    
    let tpRemaining = 0;
    let assistRemaining = 0;
    let followRemaining = 0;
    let tpOnCooldown = false;
    let assistOnCooldown = false;
    let followOnCooldown = false;

    if (isAlive) {
        const tpExpiry = ai.getDynamicProperty(tp_COOLDOWN_BASE_KEY + player.id) || 0;
        if (tpExpiry > currentTime) {
            tpOnCooldown = true;
            tpRemaining = Math.ceil((tpExpiry - currentTime) / 1000);
        }
        
        const assistExpiry = ai.getDynamicProperty("rg:prob_tame_cd_" + player.id) || 0;
        if (assistExpiry > currentTime) {
            assistOnCooldown = true;
            assistRemaining = Math.ceil((assistExpiry - currentTime) / 1000);
        }
        
        const followExpiry = ai.getDynamicProperty("rg:prob_follow_cd_" + player.id) || 0;
        if (followExpiry > currentTime) {
            followOnCooldown = true;
            followRemaining = Math.ceil((followExpiry - currentTime) / 1000);
        }
    }
    
    const aiName = friendData.name;
    const form = new ActionFormData();
    form.title(`§aFriend Actions: ${aiName}`);

    let statusText = isAlive ? '§aOnline' : (isDead ? '§8Offline' : '§8Offline');
    form.body(`Current Status: ${statusText}\n§8Your sympathy with this person: ${sympathyText}\n\nPlease select the action you want to perform.`);

    // Button 0: Invite Online / Resurrect
    let inviteText;
    let inviteIcon;
    let inviteEnabled = true;

    if (isDead) {
        if (reviveOnCooldown) {
            inviteText = `§8§lRevive Cooldown (${reviveRemaining}s)`;
            inviteIcon = "textures/items/clock_item";
            inviteEnabled = false;
        } else {
            inviteText = "§b§lInvite Online";
            inviteIcon = "textures/ui/worldsIcon";
        }
    } else if (isAlive) {
        if (pendingAction) {
            inviteText = "§9Request being processed...";
            inviteIcon = "textures/items/paper";
            inviteEnabled = false;
        } else if (tpOnCooldown) {
            inviteText = `§8§lTeleport Cooldown (${tpRemaining}s)`;
            inviteIcon = "textures/items/clock_item";
            inviteEnabled = false;
        } else {
            inviteText = isOnline ? "§6§lRequest Teleport" : "§8Offline (Cannot teleport)";
            inviteIcon = isOnline ? "textures/items/ender_eye" : "textures/items/bush";
            inviteEnabled = isOnline;
        }
    } else {
        inviteText = "§8Too far away to operate";
        inviteIcon = "textures/items/clock_item";
        inviteEnabled = false;
    }
    form.button(inviteText, inviteIcon);

    // Button 1: Ask Coordinates
    let coordsText = isAlive ? "§fAsk for Coordinates" : "§8Ask for Coordinates";
    form.button(coordsText, "textures/items/compass_item");

    // Button 2: Request Assistance
    let assistText, assistIcon, assistEnabled = false;
    let isTamed = false;
    if (isAlive) {
        try {
            const tameable = ai.getComponent('minecraft:tameable');
            isTamed = tameable ? tameable.isTamed : false;
        } catch (e) { /* No tame component */ }
    }
    
    if (isTamed) {
        assistText = "§aAlready Assisting";
        assistIcon = "textures/ui/check";
        assistEnabled = false;
    } else if (pendingAction) {
        assistText = "§9Request being processed...";
        assistIcon = "textures/items/paper";
        assistEnabled = false;
    } else if (assistOnCooldown) {
        assistText = `§8Assist Cooldown (${assistRemaining}s)`;
        assistIcon = "textures/items/clock_item";
        assistEnabled = false;
    } else if (isAlive) {
        assistText = "§6Request Assistance";
        assistIcon = "textures/items/lead";
        assistEnabled = true;
    } else {
        assistText = "§8Request Assistance (Offline)";
        assistIcon = "textures/items/lead";
        assistEnabled = false;
    }
    form.button(assistText, assistIcon);

    // Button 3: Request/Cancel Follow
    let followText, followIcon, followEnabled = false;
    const isPlayerFollowed = player.hasTag(CAN_FOLLOW_PLAYER_TAG);

    if (isPlayerFollowed) {
        followText = "§cCancel Follow";
        followIcon = "textures/ui/cancel";
        followEnabled = isAlive;
    } else if (pendingAction) {
        followText = "§9Request being processed...";
        followIcon = "textures/items/paper";
        followEnabled = false;
    } else if (followOnCooldown) {
        followText = `§8Follow Cooldown (${followRemaining}s)`;
        followIcon = "textures/items/clock_item";
        followEnabled = false;
    } else if (isAlive) {
        followText = "§6Request Follow";
        followIcon = "textures/items/stick";
        followEnabled = true;
    } else if (!isAlive && !isPlayerFollowed) {
        followText = "§8Follow (Offline)";
        followIcon = "textures/items/stick";
        followEnabled = false;
    } else {
        followText = "§8Follow (Offline)";
        followIcon = "textures/items/stick";
        followEnabled = false;
    }
    form.button(followText, followIcon);

    // Button 4: Lock/Unlock Equipment
    let lockText, lockIcon;
    const isEquipmentLocked = isAlive && ai.hasTag(LOCK_EQUIPMENT_TAG);
    lockText = isEquipmentLocked ? "§aUnlock Equipment" : "§cLock Equipment";
    lockIcon = "textures/ui/armor_full";
    if (!isAlive) {
        lockText = "§8Lock Equipment (Offline)";
    }
    form.button(lockText, lockIcon);

    // Button 5: Prohibit/Allow Building
    let buildText, buildIcon;
    const isBuildingProhibited = isAlive && ai.hasTag(PROHIBIT_BUILDING_TAG);
    buildText = isBuildingProhibited ? "§aAllow Building" : "§cProhibit Building";
    buildIcon = isBuildingProhibited ? "textures/items/iron_pickaxe" : "textures/ui/cancel";
    if (!isAlive) {
        buildText = "§8Prohibit Building (Offline)";
    }
    form.button(buildText, buildIcon);
    
    // Button 6: Delete Friend
    form.button("§cDelete Friend", "textures/ui/icon_trash"); 
    
    // Button 7: Back
    form.button("§eBack", "textures/ui/icon_import");

    form.show(player).then(response => {
        if (response.isCanceled || response.selection === ACTION_BACK) return;

        // Check if AI is valid for actions that require it
        if (response.selection !== ACTION_INVITE_RESURRECT && response.selection !== ACTION_UNFRIEND && (!isAlive && !isDead)) {
            if (response.selection === ACTION_ASK_COORDS) {
                player.sendMessage(`§8[System] ${aiName} is too far away from you to operate.`);
            } else {
                player.sendMessage(`§8[System] Operation failed: The target is not nearby or is offline.`);
            }
            return;
        }

        switch (response.selection) {
            case ACTION_INVITE_RESURRECT: // Teleport / Resurrect
                if (isDead && !reviveOnCooldown) {
                    resurrectAI(player, friendData); 
                } else if (isAlive && isOnline) {
                    runProbabilisticAction({
                        player: player, ai: ai,
                        actionType: 'teleport',
                        requestSentMessage: `§e[${aiName}] Your teleport request has been sent...`,
                        baseChance: 20,
                        sympathy: sympathy,
                        cooldownKey: tp_COOLDOWN_BASE_KEY, 
                        cooldownSeconds: 60,
                        cooldownScope: 'always', 
                        onSuccess: () => {
                            if (ai.isValid) inviteOnline(ai, player);
                            const sympathyKey = SYMPATHY_BASE_KEY + player.id;
                            let currentSympathy = ai.getDynamicProperty(sympathyKey) || 0;
                            const reduction = Math.floor(Math.random() * 7) + 2;
                            currentSympathy = currentSympathy - reduction;
                            ai.setDynamicProperty(sympathyKey, currentSympathy); 
                        },
                        successMessage: "agreed to your teleport request.",
                        failureMessage: "refused your teleport request."
                    });
                } else if (isAlive && !isOnline) {
                    player.sendMessage("§8Offline (Cannot teleport)");
                } else {
                    player.sendMessage("§8[System] Operation failed: The action is on cooldown or friend status does not match.");
                }
                break;

            case ACTION_ASK_COORDS: // Ask for Coordinates
                if (isAlive) {
                    askCoordinates(ai, player);
                } else {
                    player.sendMessage(`§8[System] ${aiName} is not online.`);
                }
                break;

            case ACTION_REQUEST_ASSISTANCE: // Request Assistance (Taming)
                if (isAlive && !isTamed) {
                    runProbabilisticAction({
                        player: player, ai: ai,
                        actionType: 'assist',
                        requestSentMessage: `§e[${aiName}] Your assistance request has been sent...`,
                        baseChance: 10,
                        sympathy: sympathy,
                        cooldownKey: "rg:prob_tame_cd_", 
                        cooldownSeconds: 60,
                        cooldownScope: 'failure', 
                        onSuccess: () => {
                            try {
                                const tameable = ai.getComponent('minecraft:tameable');
                                if (tameable) tameable.tame(player);
                                const sympathyKey = SYMPATHY_BASE_KEY + player.id;
                                let currentSympathy = ai.getDynamicProperty(sympathyKey) || 0;
                                const reduction = Math.floor(Math.random() * 14) + 5;
                                currentSympathy = currentSympathy - reduction;
                                ai.setDynamicProperty(sympathyKey, currentSympathy);
                            } catch (e) { /* Ignore error */ }
                        },
                        successMessage: "accepted your assistance request.",
                        failureMessage: "refused your assistance request."
                    });
                } else {
                    player.sendMessage(isTamed ? `§8[System] The target is currently assisting someone else.` : `§8[System] Operation failed: The target is not nearby or is offline.`);
                }
                break;

            case ACTION_TOGGLE_FOLLOW: // Request/Cancel Follow
                if (isAlive) {
                    if (isPlayerFollowed) {
                        // Cancel Follow (execute immediately)
                        triggerFactionalEvent(ai, "no_follow");
                        ai.removeTag(FOLLOW_AI_TAG);
                        player.removeTag(CAN_FOLLOW_PLAYER_TAG);
                        player.sendMessage(`§a[System] ${aiName} has stopped following.`);
                        system.runTimeout(() => showFriendActionMenu(player, ai, friendData), 5);
                    } else {
                        runProbabilisticAction({
                            player: player, ai: ai,
                            actionType: 'follow',
                            requestSentMessage: `§e[${aiName}] Your follow request has been sent...`,
                            baseChance: 20,
                            sympathy: sympathy,
                            cooldownKey: "rg:prob_follow_cd_", 
                            cooldownSeconds: 60,
                            cooldownScope: 'failure', 
                            onSuccess: () => {
                                triggerFactionalEvent(ai, "follow");
                                ai.addTag(FOLLOW_AI_TAG);
                                player.addTag(CAN_FOLLOW_PLAYER_TAG);
                                const sympathyKey = SYMPATHY_BASE_KEY + player.id;
                                let currentSympathy = ai.getDynamicProperty(sympathyKey) || 0;
                                const reduction = Math.floor(Math.random() * 10) + 3;
                                currentSympathy = currentSympathy - reduction;
                                ai.setDynamicProperty(sympathyKey, currentSympathy);
                            },
                            successMessage: "agreed to your follow request.",
                            failureMessage: "refused your follow request."
                        });
                    }
                }
                break;

            case ACTION_TOGGLE_EQUIPMENT_LOCK: // Lock/Unlock Equipment
                if (isAlive) {
                    if (isEquipmentLocked) {
                        ai.removeTag(LOCK_EQUIPMENT_TAG);
                        ai.triggerEvent("jiechu");
                        player.sendMessage(`§a[System] ${aiName}'s equipment has been unlocked.`);
                    } else {
                        ai.addTag(LOCK_EQUIPMENT_TAG);
                        ai.triggerEvent("suoding");
                        player.sendMessage(`§c[System] ${aiName}'s equipment has been locked.`);
                    }
                    system.runTimeout(() => showFriendActionMenu(player, ai, friendData), 5);
                }
                break;

            case ACTION_TOGGLE_BUILDING_PROHIBITION: // Prohibit/Allow Building
                if (isAlive) {
                    if (isBuildingProhibited) {
                        ai.removeTag(PROHIBIT_BUILDING_TAG);
                        player.sendMessage(`§a[System] ${aiName} is now allowed to build.`);
                    } else {
                        ai.addTag(PROHIBIT_BUILDING_TAG);
                        player.sendMessage(`§c[System] ${aiName} is now prohibited from building.`);
                    }
                    system.runTimeout(() => showFriendActionMenu(player, ai, friendData), 5);
                }
                break;

            case ACTION_UNFRIEND: // Delete Friend
                unfriendAI(player, persistentId, aiName);
                break;
        }
    });
}

/**
 * Friend List UI (Level 1)
 */
function showFriendListUI(player) {
    const friends = getPlayerFriends(player);
    const form = new ActionFormData();
    form.title("§b§lFriend List");
    
    if (friends.length === 0) {
        form.body("You don't have any friends yet. Go interact with other players!");
    } else {
        form.body("Please select a friend to interact with:");
        
        friends.forEach(friend => {
            const isAlive = !!getAiByPersistentId(friend.id); 
            const isDead = getDeadAiIds().has(friend.id);
            
            let status;
            if (isAlive) {
                status = '§aOnline';
            } else if (isDead) {
                status = '§cOffline';
            } else {
                status = '§eNot Loaded';
            }
            form.button(`[${friend.name}] - ${status}`, 'textures/ui/icon_steve');
        });
    }

    form.button("§cClose");

    form.show(player).then(response => {
        if (response.isCanceled || response.selection === undefined) return;
        if (response.selection === friends.length) return;

        const selectedFriendData = friends[response.selection];
        const targetAi = getAiByPersistentId(selectedFriendData.id);
        showFriendActionMenu(player, targetAi, selectedFriendData); 
    });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleItemUse(event) {
    const { source, itemStack } = event;

    if (source.typeId === "minecraft:player" && itemStack?.typeId === FRIEND_LIST_ITEM_ID) {
        if (!source.isValid) return;
        showFriendListUI(source);
    }
}

function handleEntityInteract(event) {
    const { player, target, itemStack } = event; 

    // Target must be our AI
    if (target.typeId !== ai_player_id) return;

    // Player must hold friend offer item
    if (!itemStack || itemStack.typeId !== aim_ITEM_ID) return;

    const ai = target;
    const playerId = player.id;
    
    // Get AI's persistent ID
    const persistentId = ensurePersistentId(ai); 

    // Get/start sympathy
    const sympathyKey = SYMPATHY_BASE_KEY + playerId;
    let sympathy = ai.getDynamicProperty(sympathyKey);
    if (sympathy === undefined || sympathy === null) {
        sympathy = Math.floor(Math.random() * 51) - 30; 
        ai.setDynamicProperty(sympathyKey, sympathy); 
    }
    
    // Track players who have interacted
    const INTERACTED_PLAYERS_KEY = "rg:interacted_players_list";
    let interactedPlayers = [];
    try {
        const data = ai.getDynamicProperty(INTERACTED_PLAYERS_KEY);
        if (data) {
            interactedPlayers = JSON.parse(data);
        }
    } catch (e) { /* Ignore parsing errors */ }
    
    if (!interactedPlayers.includes(playerId)) {
        interactedPlayers.push(playerId);
        ai.setDynamicProperty(INTERACTED_PLAYERS_KEY, JSON.stringify(interactedPlayers));
    }
    
    // Core friend status check
    let friendStatus = ai.getDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId) || "";
    let isFriend = (friendStatus === "accepted");
    
    // If AI entity status is not "accepted", check player list
    if (!isFriend) {
        const friendsList = getPlayerFriends(player);
        const friendData = friendsList.find(f => f.id === persistentId);

        if (friendData) {
            isFriend = true;
            ai.setDynamicProperty(FRIEND_STATUS_BASE_KEY + playerId, "accepted");
        }
    }
    
    if (isFriend) {
        const friendData = getPlayerFriends(player).find(f => f.id === persistentId);
        if (friendData) {
            showFriendActionMenu(player, ai, friendData);
        } else {
            showAiInfoMenu(player, ai, sympathy);
        }
    } else {
        showAiInfoMenu(player, ai, sympathy);
    }
}

// ============================================================================
// EXPORT INITIALIZATION FUNCTION
// ============================================================================

export function startInteractionUI() {
    // Run negative sympathy check every 30 seconds (600 ticks)
    system.runInterval(checkNegativeSympathyUnfriend, 600);
    
    // Player interacts with AI while holding request item
    world.afterEvents.playerInteractWithEntity.subscribe(handleEntityInteract);
    
    // Player uses friend list item
    world.afterEvents.itemUse.subscribe(handleItemUse);
    
    // Player first entry into world trigger
    world.afterEvents.playerSpawn.subscribe(event => {
        const { player, initialSpawn } = event;
        
        const isstartd = player.getDynamicProperty(PLAYER_INIT_FLAG_KEY);
        
        if (initialSpawn && !isstartd) {
            giveFriendConfigItems(player);
            player.setDynamicProperty(PLAYER_INIT_FLAG_KEY, true);
            player.sendMessage("§a[Server] Welcome! Friend configuration items have been given. Hold the 'Friend Request' item and right-click an AI to interact!");
        }
        
        if (!initialSpawn && player.isValid) {
            giveFriendConfigItems(player);
        }
    });
    
    // Chat command trigger
    world.afterEvents.chatSend.subscribe(event => {
        const { message, sender } = event;
        
        if (message.toLowerCase() === "!givemefriendconfig") {
            event.cancel = true;
            giveFriendConfigItems(sender);
            sender.sendMessage("§a[Server] Friend system configuration items have been given.");
        }
    });
    
    // Listen to entity death events, mark AI as dead
    world.afterEvents.entityDie.subscribe(event => {
        const { deadEntity } = event;        
        if (deadEntity.typeId === ai_player_id) {
            deadEntity.removeTag('online');
            const pId = deadEntity.getDynamicProperty(AI_PERSISTENT_ID_KEY);

            if (pId) {
                const deadAiSet = getDeadAiIds();
                deadAiSet.add(pId);
                setDeadAiIds(deadAiSet);
                
                // Store sympathy data for dead AI
                const INTERACTED_PLAYERS_KEY = "rg:interacted_players_list";
                const SYMPATHY_CACHE_KEY = `rg:dead_ai_sympathy_${pId}`;
                let sympathyData = {};
                
                let killerPlayerId = null;
                if (event.damageSource && event.damageSource.damagingEntity && event.damageSource.damagingEntity.typeId === 'minecraft:player') {
                    killerPlayerId = event.damageSource.damagingEntity.id;
                }
                
                try {
                    const data = deadEntity.getDynamicProperty(INTERACTED_PLAYERS_KEY);
                    if (data) {
                        const interactedPlayers = JSON.parse(data);
                        for (const playerId of interactedPlayers) {
                            let sympathy = deadEntity.getDynamicProperty(SYMPATHY_BASE_KEY + playerId);
                            if (sympathy !== undefined) {
                                if (playerId === killerPlayerId) {
                                    const penalty = Math.floor(Math.random() * 21) + 10;
                                    sympathy -= penalty;
                                }
                                sympathyData[playerId] = sympathy;
                            }
                        }
                        world.setDynamicProperty(SYMPATHY_CACHE_KEY, JSON.stringify(sympathyData));
                        world.setDynamicProperty(INTERACTED_PLAYERS_KEY + "_" + pId, data); 
                    }
                } catch (e) {
                    console.warn(`[AI Death] Failed to save sympathy data for AI ${pId}: ${e}`);
                }
            }
        }
    });
}