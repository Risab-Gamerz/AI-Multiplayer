// ============================================================================
// IMPORTS (Only what you actually use)
// ============================================================================
import { world, system, EntityDamageCause, EntityComponentTypes } from "@minecraft/server";
import { startSympathyListener } from "./ai_sympathy_listener.js";
import { startInteractionUI } from "./ai_interaction_ui.js";
import { startStrafingBehavior } from "./strafing.js";
import { startAISpawner } from "./ai_spawn.js";
import { startBuilderSystem } from "./ai_builder.js";
import { dogs_rank } from './database/dogs_rank.js';
import { regularChatMessages } from './database/message_language.js';
import { action } from './database/join_message_database.js';
import { mobNames, environmentalDeathMessages } from './database/died_message_database.js';
import { name_prefix, name_suffix, name_Nouns, presetNames } from './database/name_database.js';
import { startSympathySystem } from "./chat.js";
import { detectfallingbehavior } from "./ai_fall_detector.js";
import { startmediatorBehavior } from "./ai_mediator.js";
import { startFoodSystem } from "./eat_food.js";
import { startShieldKnockback } from "./shield_block.js";
import { startGreetingBehavior } from "./greeting.js";
import { startProgressionSystem } from "./level_up.js";
import { startStrollSwitcherBehavior } from "./ai_stroll_switcher.js";
import { startAttackPermissionBehavior } from "./ai_attack_permission.js";
import { AiTrapProof } from "./ai_trap_proof.js";
import { startSleepBehavior } from "./ai_sleep.js";
import { startGoalSystem } from "./ai_goals.js";
import { startObstacleBreaker } from "./ai_obstacle_breaker.js";
import { startBotConversations } from "./ai_conversations.js";
import { startEnvironmentBehavior } from "./ai_environment.js";
import { startCombatTactics } from "./ai_combat_tactics.js";
import { startPathfindingTweaks } from "./ai_pathfinding_tweaks.js";
import { startSocialMemory } from "./ai_social_memory.js";
import { startMoodSystem } from "./ai_mood.js";
import { startTorchPlacement } from "./ai_torch.js";
import { startShelterBuilder } from "./ai_shelter_builder.js";
import { startItemPickup } from "./ai_item_pickup.js";
import { startReactionSystem } from "./ai_reactions.js";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================
const NAMESPACE = "rg";
const ai_player_id = `${NAMESPACE}:bot`;
const pet_dog_id = "minecraft:wolf";

// Wolf teleport settings
const Dog_TP_FOLLOW_CHECK_DELAY = 65;
const Dog_MAX_DISTANCE = 13;
const Dog_tp_aim_RADIUS_MIN = 2;
const Dog_tp_aim_RADIUS_MAX = 5;

// Wolf combat settings
const Dog_DEFEND_MODE_DURATION_TICKS = 300;
const DEFEND_aim_TAG = "rg_target_for_wolves_DEFEND";
const ASSIST_aim_TAG = "rg_target_for_wolves_ASSIST";
const Dog_ASSIST_MODE_DURATION_TICKS = 300;
const SAFE_SEARCH_RANGE = 5;

// Bunny hop settings
const GLOBAL_BUNNY_HOP_CHECK_GAP_TICKS = 2;
const BUNNY_HOP_SPEED_THRESHOLD = 0.37;
const BUNNY_HOP_STRENGTH = 0.51;
const FORWARD_HOP_STRENGTH = 0.17;
const BUNNY_HOP_COOLDOWN_TICKS = 8;
const PLAYER_PROXIMITY_CHECK_RADIUS = 32;

// Cache refresh intervals
const PLAYER_CACHE_REFRESH_GAP_TICKS = 600;
const AI_CACHE_REFRESH_GAP_TICKS = 100;

// Structure data for chat messages
const structureID = {
    "minecraft:ocean_monument": "ocean monument",
    "minecraft:village": "village",
    "minecraft:pillager_outpost": "outpost",
    "minecraft:mineshaft": "mineshaft",
    "minecraft:ruined_portal": "portal"
};
const STRUCTURE_IDS = Object.keys(structureID);

// ============================================================================
// EXPORTED CACHES
// ============================================================================
export let REAL_PLAYERS_CACHE = [];
export let ALL_AI_CACHE_EXPORT = [];

// ============================================================================
// GLOBAL STATE (Maps for tracking)
// ============================================================================
const hopLockMap = new Map();
const lastHopCheckMap = new Map();

// ============================================================================
// MESSAGE GENERATION SYSTEM
// ============================================================================

const MESSAGE_GENERATORS = [
    { threshold: 0.60, generator: NormalChatMessage },
    { threshold: 0.80, generator: generateJoinLeaveMessage },
    { threshold: 0.90, generator: generateCombatDeathMessage },
    { threshold: 1.00, generator: generateEnvironmentalDeathMessage }
];

function getRandomInt(min, max) {
    return ((Math.random() * (max - min + 1)) | 0) + min;
}

function getRandomElement(arr) {
    if (!arr || arr.length === 0) return "";
    const randomIndex = (Math.random() * arr.length) | 0;
    return arr[randomIndex];
}

function getRandomTwoDigitNumber() {
    return ((Math.random() * 90) | 0) + 10;
}

function generateRandomPlayerName() {
    if (Math.random() < 0.5) {
        const partA = getRandomElement(name_prefix);
        const partC = getRandomElement(name_Nouns);
        const partB = getRandomElement(name_suffix);
        const partD = getRandomTwoDigitNumber();

        if (partA && partB && partC) {
            return `${partA}${partB}${partC}${partD}`;
        }
    }
    return getRandomElement(presetNames) || "Steve";
}

function NormalChatMessage(realPlayers) {
    const name = generateRandomPlayerName();
    let content = getRandomElement(regularChatMessages);

    if (content.includes("{real_player}")) {
        let replacementName;
        if (realPlayers.length > 0) {
            const randomPlayer = getRandomElement(realPlayers);
            replacementName = `§e@${randomPlayer.name}§r`;
        } else {
            replacementName = generateRandomPlayerName();
        }
        content = content.replace("{real_player}", replacementName);
    }

    if (content.includes("{structure_coords}")) {
        const randX = ((Math.random() * 5000) | 0) - 2500;
        const randZ = ((Math.random() * 5000) | 0) - 2500;
        const coords = `${randX} ~ ${randZ}`;
        const randomStructureId = getRandomElement(STRUCTURE_IDS);
        const structureName = structureID[randomStructureId] || "a structure";
        content = content
            .replace("{structure_coords}", `§a${coords}§r`)
            .replace("{structure_name}", `§b${structureName}§r`);
    }
    return `§f<${name}> ${content}`;
}

function generateJoinLeaveMessage() {
    const name = generateRandomPlayerName();
    return `§e${name} ${action}`;
}

function generateCombatDeathMessage() {
    const victim = generateRandomPlayerName();
    let killer = "";

    if (Math.random() < 0.5) {
        killer = getRandomElement(mobNames);
    } else {
        killer = generateRandomPlayerName();
        while (killer === victim) {
            killer = generateRandomPlayerName();
        }
    }
    return `§f${victim} was killed by ${killer}`;
}

function generateEnvironmentalDeathMessage() {
    const victim = generateRandomPlayerName();
    const reason = getRandomElement(environmentalDeathMessages);
    return `§f${victim} ${reason}`;
}

function scheduleNextMessage() {
    const randomDelayTicks = 200 + Math.floor(Math.random() * 400);
    system.runTimeout(() => {
        const realPlayersCache = REAL_PLAYERS_CACHE;
        const messageTypeRoll = Math.random();
        let messageToSend = null;

        for (const item of MESSAGE_GENERATORS) {
            if (messageTypeRoll < item.threshold) {
                if (item.generator === NormalChatMessage) {
                    messageToSend = item.generator(realPlayersCache);
                } else {
                    messageToSend = item.generator();
                }
                break;
            }
        }

        try {
            if (messageToSend && messageToSend instanceof Promise) {
                messageToSend.then(msg => {
                    if (msg) world.sendMessage(msg);
                }).catch(error => console.warn(`[ChatSim] Async message failed: ${error}`));
            } else if (messageToSend) {
                world.sendMessage(messageToSend);
            }
        } catch (e) {
            console.warn(`[ChatSim] Failed to send message: ${e}`);
        }
        scheduleNextMessage();
    }, randomDelayTicks);
}
scheduleNextMessage();

// ============================================================================
// CACHE REFRESH SYSTEMS (Delayed to avoid early execution)
// ============================================================================

let cacheRefreshstartd = false;

function refreshAICache() {
    try {
        ALL_AI_CACHE_EXPORT = [];
        const dimensionIds = ["overworld", "nether", "the_end"];
        for (const dimId of dimensionIds) {
            try {
                const dimension = world.getDimension(dimId);
                const ais = dimension.getEntities({ type: ai_player_id });
                ALL_AI_CACHE_EXPORT.push(...ais);
            } catch (e) { }
        }
    } catch (e) { }
}

function refreshPlayerCache() {
    try {
        REAL_PLAYERS_CACHE = world.getAllPlayers();
    } catch (e) {
        REAL_PLAYERS_CACHE = [];
    }
}

function startCaches() {
    try {
        // Test if world is ready
        world.getDimension("overworld");

        refreshPlayerCache();
        refreshAICache();

        // Start cache refresh intervals
        system.runInterval(refreshPlayerCache, PLAYER_CACHE_REFRESH_GAP_TICKS);
        system.runInterval(refreshAICache, AI_CACHE_REFRESH_GAP_TICKS);

        cacheRefreshstartd = true;
        console.warn(`[${NAMESPACE.toUpperCase()} AI Script] Cache system startd.`);
    } catch (e) {
        // World not ready, retry in 2 seconds
        system.runTimeout(startCaches, 40);
    }
}

// Start cache initialization
startCaches();

// ============================================================================
// Dog tp FOLLOW SYSTEM (Delayed)
// ============================================================================
system.runInterval(() => {
    if (!cacheRefreshstartd) return;

    const allAiPlayers = ALL_AI_CACHE_EXPORT;
    if (!allAiPlayers || allAiPlayers.length === 0) return;

    for (const aiPlayer of allAiPlayers) {
        if (!aiPlayer.isValid || !aiPlayer.dimension) continue;

        let companionWolves;
        try {
            companionWolves = aiPlayer.dimension.getEntities({
                type: pet_dog_id,
                location: aiPlayer.location,
                maxDistance: Dog_MAX_DISTANCE * 2
            });
        } catch (e) {
            continue;
        }

        for (const wolf of companionWolves) {
            if (!wolf || !wolf.isValid) continue;

            const ownerId = wolf.getDynamicProperty(`${NAMESPACE}:ai_owner_id`);
            if (ownerId === aiPlayer.id) {
                const wolfIsInCombat = wolf.getDynamicProperty(`${NAMESPACE}:is_in_combat`) || false;
                if (wolfIsInCombat) continue;

                const wolfLoc = wolf.location;
                const aiLoc = aiPlayer.location;
                const dx = wolfLoc.x - aiLoc.x;
                const dy = wolfLoc.y - aiLoc.y;
                const dz = wolfLoc.z - aiLoc.z;
                const distanceSquared = dx * dx + dy * dy + dz * dz;
                const maxDistanceSquared = Dog_MAX_DISTANCE * Dog_MAX_DISTANCE;

                if (distanceSquared > maxDistanceSquared) {
                    const safeTargetLoc = {
                        x: aiLoc.x + (Math.random() * 2 - 1),
                        y: aiLoc.y,
                        z: aiLoc.z + (Math.random() * 2 - 1)
                    };

                    try {
                        wolf.teleport(safeTargetLoc, {
                            dimension: aiPlayer.dimension,
                            checkForBlocks: true,
                            facingLocation: aiLoc
                        });
                    } catch (e_teleport) { }
                }
            }
        }
    }
}, Dog_TP_FOLLOW_CHECK_DELAY);

// ============================================================================
// BUNNY HOP SYSTEM
// ============================================================================

function maintainHopRotation(entityToLock) {
    const lockKey = `${entityToLock.id}_hop`;
    if (hopLockMap.get(lockKey)) return;

    const isLocking = entityToLock?.getDynamicProperty(`${NAMESPACE}:is_hop_view_locking`);
    if (!entityToLock || !entityToLock.isValid || isLocking !== true) {
        if (entityToLock && entityToLock.isValid) {
            entityToLock.setDynamicProperty(`${NAMESPACE}:is_hop_view_locking`, false);
        }
        hopLockMap.delete(lockKey);
        return;
    }

    if (entityToLock.isOnGround && entityToLock.isValid) {
        entityToLock.setDynamicProperty(`${NAMESPACE}:is_hop_view_locking`, false);
        hopLockMap.delete(lockKey);
        return;
    }

    const lockedYaw = entityToLock.getDynamicProperty(`${NAMESPACE}:hop_target_yaw`);
    const lockedPitch = entityToLock.getDynamicProperty(`${NAMESPACE}:hop_target_pitch`);

    if (typeof lockedYaw === 'number' && typeof lockedPitch === 'number' && entityToLock.isValid) {
        try {
            entityToLock.setRotation({ x: lockedPitch, y: lockedYaw });
        } catch (e) {
            entityToLock.setDynamicProperty(`${NAMESPACE}:is_hop_view_locking`, false);
            hopLockMap.delete(lockKey);
            return;
        }
    } else if (entityToLock.isValid) {
        entityToLock.setDynamicProperty(`${NAMESPACE}:is_hop_view_locking`, false);
        hopLockMap.delete(lockKey);
        return;
    }

    hopLockMap.set(lockKey, true);
    system.runTimeout(() => {
        hopLockMap.delete(lockKey);
        maintainHopRotation(entityToLock);
    }, 1);
}

system.runInterval(() => {
    if (!cacheRefreshstartd) return;

    const allRealPlayers = REAL_PLAYERS_CACHE;
    if (allRealPlayers.length === 0) return;

    const currentTick = system.currentTick;
    let aiPlayersToProcess = new Set();

    for (const player of allRealPlayers) {
        if (!player || !player.isValid) continue;

        try {
            const dimension = player.dimension;
            const entitiesInProximity = dimension.getEntities({
                type: ai_player_id,
                location: player.location,
                maxDistance: PLAYER_PROXIMITY_CHECK_RADIUS
            });
            for (const entity of entitiesInProximity) {
                aiPlayersToProcess.add(entity);
            }
        } catch (e) { }
    }

    for (const entity of aiPlayersToProcess) {
        if (!entity || !entity.isValid) continue;

        if (entity.getDynamicProperty(`${NAMESPACE}:is_hop_view_locking`)) continue;

        const lastCheck = lastHopCheckMap.get(entity.id) || 0;
        if (currentTick - lastCheck < BUNNY_HOP_COOLDOWN_TICKS) continue;
        lastHopCheckMap.set(entity.id, currentTick);

        const lastHopTick = entity.getDynamicProperty(`${NAMESPACE}:last_bunny_hop_tick`) || 0;
        if (currentTick < lastHopTick + BUNNY_HOP_COOLDOWN_TICKS) continue;

        if (entity.isOnGround) {
            try {
                const velocity = entity.getVelocity();
                const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

                if (horizontalSpeed > BUNNY_HOP_SPEED_THRESHOLD) {
                    let impulseX = 0, impulseZ = 0;

                    if (horizontalSpeed > 0.01) {
                        const normalizedForwardX = velocity.x / horizontalSpeed;
                        const normalizedForwardZ = velocity.z / horizontalSpeed;
                        impulseX = normalizedForwardX * FORWARD_HOP_STRENGTH;
                        impulseZ = normalizedForwardZ * FORWARD_HOP_STRENGTH;
                    }

                    entity.applyImpulse({ x: impulseX, y: BUNNY_HOP_STRENGTH, z: impulseZ });
                    entity.setDynamicProperty(`${NAMESPACE}:last_bunny_hop_tick`, currentTick);

                    if (horizontalSpeed > 0.01) {
                        const initialRotation = entity.getRotation();
                        const targetYaw = Math.atan2(-velocity.x, velocity.z) * (180 / Math.PI);

                        entity.setDynamicProperty(`${NAMESPACE}:hop_target_yaw`, targetYaw);
                        entity.setDynamicProperty(`${NAMESPACE}:hop_target_pitch`, initialRotation.x);
                        entity.setDynamicProperty(`${NAMESPACE}:is_hop_view_locking`, true);

                        system.runTimeout(() => maintainHopRotation(entity), 1);
                    }
                }
            } catch (e_vel) { }
        }
    }

    if (currentTick % 100 === 0) {
        for (const [id, tick] of lastHopCheckMap.entries()) {
            if (currentTick - tick > 200) {
                lastHopCheckMap.delete(id);
            }
        }
    }
}, GLOBAL_BUNNY_HOP_CHECK_GAP_TICKS);

// ============================================================================
// ENTITY SPAWN HANDLER
// ============================================================================
world.afterEvents.entitySpawn.subscribe(event => {
    const { entity } = event;
    if (entity.typeId !== "rg:bot") return;

    if (entity.hasTag('rg:resurrected_ai')) {
        entity.removeTag('rg:resurrected_ai');
        return;
    }

    // Set random name
    let finalName = "AI_Player";

    if (Math.random() < 0.5) {
        const partA = getRandomElement(name_prefix);
        const partB = getRandomElement(name_Nouns);
        const partC = getRandomElement(name_suffix);
        const partD = getRandomTwoDigitNumber();

        if (partA && partB && partC) {
            finalName = `${partA}${partB}${partC}${partD}`;
        }
    } else {
        finalName = getRandomElement(presetNames);
        if (!finalName) finalName = "AI_Player";
    }

    try {
        entity.nameTag = finalName;
    } catch (e) { }

    system.run(() => {
        try {
            if (!entity.isValid) return;
            entity.setDynamicProperty(`${NAMESPACE}:isInDanger`, false);
            entity.setDynamicProperty(`${NAMESPACE}:lastHostileTick`, 0);
            entity.setDynamicProperty(`${NAMESPACE}:lastPostCombatChatTick`, 0);

            let numDogs = 0;
            const tiers = Object.keys(dogs_rank).reverse();
            for (const tier of tiers) {
                if (entity.hasTag(tier)) {
                    const tierConfig = dogs_rank[tier];
                    numDogs = getRandomInt(tierConfig.min, tierConfig.max);
                    break;
                }
            }

            if (numDogs > 0) {
                system.runTimeout(() => {
                    if (!entity.isValid) return;

                    for (let i = 0; i < numDogs; i++) {
                        try {
                            const spawnLoc = entity.location;
                            const offsetSpawnLoc = {
                                x: spawnLoc.x + (Math.random() * 1.6 - 0.8),
                                y: spawnLoc.y,
                                z: spawnLoc.z + (Math.random() * 1.6 - 0.8)
                            };

                            if (entity.dimension.isChunkLoaded(offsetSpawnLoc)) {
                                const wolf = entity.dimension.spawnEntity(pet_dog_id, offsetSpawnLoc);

                                if (wolf && wolf.isValid) {
                                    wolf.setDynamicProperty(`${NAMESPACE}:ai_owner_id`, entity.id);

                                    const tameableComp = wolf.getComponent(EntityComponentTypes.Tameable);
                                    if (tameableComp && !tameableComp.isTamed) {
                                        wolf.triggerEvent("minecraft:on_tame");
                                    }
                                }
                            }
                        } catch (e_dog) { }
                    }
                }, 5);
            }
        } catch (error) {
            console.error(`[AI Namer] Error initializing: ${error}`);
        }
    });
});

// ============================================================================
// ENTITY DEATH HANDLER
// ============================================================================
world.afterEvents.entityDie.subscribe(event => {
    const { deadEntity, damageSource } = event;
    if (deadEntity.typeId !== "rg:bot") return;

    const botName = deadEntity.nameTag || "A Player";
    let deathMessage = `${botName} died`;

    let realAttacker;
    if (damageSource?.damagingProjectile?.owner) {
        realAttacker = damageSource.damagingProjectile.owner;
    } else if (damageSource?.damagingEntity && damageSource.damagingEntity.typeId !== "rg:melee_attack_throw") {
        realAttacker = damageSource.damagingEntity;
    }

    if (realAttacker && realAttacker.isValid) {
        const attackerName = realAttacker.nameTag || realAttacker.typeId.replace("rg:", "").replace("minecraft:", "");

        if (damageSource.damagingProjectile) {
            if (damageSource.damagingProjectile.typeId === "rg:melee_attack_throw") {
                deathMessage = `${botName} was killed by ${attackerName}`;
            } else {
                deathMessage = `${botName} was shot by ${attackerName}`;
            }
        } else {
            deathMessage = `${botName} was killed by ${attackerName}`;
        }
    } else {
        const cause = damageSource?.cause;
        switch (cause) {
            case EntityDamageCause.fall:
                deathMessage = `${botName} fell from a high place`;
                break;
            case EntityDamageCause.lava:
                deathMessage = `${botName} tried to swim in lava`;
                break;
            case EntityDamageCause.fire:
            case EntityDamageCause.fireTick:
                deathMessage = `${botName} was roasted to a crisp`;
                break;
            case EntityDamageCause.drowning:
                deathMessage = `${botName} drowned`;
                break;
            case EntityDamageCause.suffocation:
                deathMessage = `${botName} suffocated in a wall`;
                break;
            case EntityDamageCause.starve:
                deathMessage = `${botName} starved to death`;
                break;
            case EntityDamageCause.void:
                deathMessage = `${botName} fell out of the world`;
                break;
            case EntityDamageCause.lightning:
                deathMessage = `${botName} was struck by lightning`;
                break;
            case EntityDamageCause.blockExplosion:
                deathMessage = `${botName} was blown up`;
                break;
            case EntityDamageCause.magic:
                deathMessage = `${botName} was killed by magic`;
                break;
            case EntityDamageCause.wither:
                deathMessage = `${botName} withered away`;
                break;
            case EntityDamageCause.freezing:
                deathMessage = `${botName} froze to death`;
                break;
            default:
                deathMessage = `${botName} died mysteriously`;
                break;
        }
    }
    world.sendMessage(deathMessage);
});

// ============================================================================
// Dog DEFEND MODE
// ============================================================================
world.afterEvents.entityHurt.subscribe(event => {
    const { hurtEntity, damageSource } = event;
    if (hurtEntity.typeId !== "rg:bot") return;

    if (damageSource.damagingEntity && damageSource.damagingEntity.isValid) {
        const aiPlayer = hurtEntity;
        const attacker = damageSource.damagingEntity;
        if (attacker.id === aiPlayer.id) return;

        attacker.addTag(DEFEND_aim_TAG);

        let companionWolves = [];
        try {
            if (aiPlayer.dimension) {
                companionWolves = aiPlayer.dimension.getEntities({
                    type: pet_dog_id,
                    location: aiPlayer.location,
                    maxDistance: 30
                });
            }
        } catch (e) { return; }

        for (const wolf of companionWolves) {
            if (wolf.isValid && wolf.getDynamicProperty(`${NAMESPACE}:ai_owner_id`) === aiPlayer.id) {
                wolf.triggerEvent("app:event_wolf_enter_defend_mode");
                wolf.setDynamicProperty(`${NAMESPACE}:is_in_combat`, true);
            }
        }

        system.runTimeout(() => {
            if (attacker.isValid) attacker.removeTag(DEFEND_aim_TAG);
            if (!aiPlayer || !aiPlayer.isValid) return;
            if (attacker && attacker.isValid) attacker.removeTag(DEFEND_aim_TAG);

            let currentWolvesAfterDefend = [];
            try {
                if (aiPlayer.dimension) {
                    currentWolvesAfterDefend = aiPlayer.dimension.getEntities({
                        type: pet_dog_id,
                        location: aiPlayer.location,
                        maxDistance: 30
                    });
                }
            } catch (e) { return; }

            for (const wolf of currentWolvesAfterDefend) {
                if (wolf.isValid && wolf.getDynamicProperty(`${NAMESPACE}:ai_owner_id`) === aiPlayer.id) {
                    wolf.triggerEvent("app:event_wolf_exit_defend_mode");
                    wolf.setDynamicProperty(`${NAMESPACE}:is_in_combat`, false);
                }
            }
        }, Dog_DEFEND_MODE_DURATION_TICKS);
    }
});

// ============================================================================
// Dog ASSIST MODE
// ============================================================================
world.afterEvents.projectileHitEntity.subscribe(event => {
    const projectile = event.projectile;
    const shooter = event.source;
    const hitInfo = event.getEntityHit();

    if (!shooter || !shooter.isValid) return;
    if (shooter.typeId !== ai_player_id) return;
    if (!hitInfo) return;

    const entityHit = hitInfo.entity;
    if (!entityHit || !entityHit.isValid) return;
    if (projectile && projectile.isValid && projectile.typeId !== "rg:melee_attack_throw") return;
    if (entityHit.id === shooter.id) return;

    let companionWolves = [];
    try {
        if (shooter.dimension) {
            companionWolves = shooter.dimension.getEntities({
                type: pet_dog_id,
                location: shooter.location,
                maxDistance: 30
            });
        }
    } catch (e) { return; }

    for (const wolf of companionWolves) {
        if (wolf.isValid && wolf.getDynamicProperty(`${NAMESPACE}:ai_owner_id`) === shooter.id) {
            const isWolfDefending = wolf.getDynamicProperty(`${NAMESPACE}:is_in_combat`) || false;
            if (isWolfDefending) continue;

            try { entityHit.addTag(ASSIST_aim_TAG); } catch (e) { continue; }

            wolf.triggerEvent("app:event_wolf_enter_assist_mode");
            system.runTimeout(() => {
                if (entityHit.isValid) entityHit.removeTag(ASSIST_aim_TAG);
                if (wolf.isValid && !wolf.getDynamicProperty(`${NAMESPACE}:is_in_combat`)) {
                    wolf.triggerEvent("app:event_wolf_exit_assist_mode");
                }
            }, Dog_ASSIST_MODE_DURATION_TICKS);
        }
    }
});

// ============================================================================
// Dog ORPHAN CLEANUP
// ============================================================================
world.afterEvents.entityDie.subscribe(event => {
    const { deadEntity } = event;
    if (deadEntity.typeId !== "rg:bot") return;

    const deadAiPlayerId = deadEntity.id;
    let potentialOrphanedWolves = [];
    try {
        if (deadEntity.dimension) {
            potentialOrphanedWolves = deadEntity.dimension.getEntities({ type: pet_dog_id });
        }
    } catch (e) { return; }

    for (const wolf of potentialOrphanedWolves) {
        if (wolf.isValid) {
            const ownerId = wolf.getDynamicProperty(`${NAMESPACE}:ai_owner_id`);
            if (ownerId === deadAiPlayerId) {
                wolf.setDynamicProperty(`${NAMESPACE}:ai_owner_id`, "none_orphaned");
                wolf.triggerEvent("app:event_wolf_exit_defend_mode");
                wolf.setDynamicProperty(`${NAMESPACE}:is_in_combat`, false);
                wolf.triggerEvent("rg:event_start_despawn_timer");
            }
        }
    }
});

// ============================================================================
// start ALL BEHAVIOR MODULES (Delayed)
// ============================================================================

function startAllModules() {
    try {
        startStrafingBehavior();
        startGreetingBehavior();
        startAttackPermissionBehavior();
        startStrollSwitcherBehavior();
        AiTrapProof();
        startProgressionSystem();
        detectfallingbehavior();
        startmediatorBehavior();
        startSympathySystem();
        startBuilderSystem();
        startShieldKnockback();
        startFoodSystem();
        startSleepBehavior();
        startGoalSystem();
        startObstacleBreaker();
        startBotConversations();
        startAISpawner();
        startSympathyListener();
        startInteractionUI();
        startEnvironmentBehavior();
        startCombatTactics();
        startPathfindingTweaks();
        startSocialMemory();
        startMoodSystem();
        startTorchPlacement();
        startShelterBuilder();
        startItemPickup();
        startReactionSystem();

        console.warn(`[${NAMESPACE.toUpperCase()} AI Script] All modules startd.`);
    } catch (e) {
        console.warn(`[${NAMESPACE.toUpperCase()} AI Script] Module init failed: ${e}`);
        system.runTimeout(startAllModules, 100);
    }
}

// Delay module initialization to avoid early execution errors
system.runTimeout(startAllModules, 100);