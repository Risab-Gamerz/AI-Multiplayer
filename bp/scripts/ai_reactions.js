import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";
import { isNightTime } from "./ai_mood.js";

// ============================================================================
// CONFIG
// ============================================================================
const ai_player_id = "rg:bot";

// --- Explosion ---
const EXPLOSION_REACTION_RADIUS = 20;
const EXPLOSION_FLEE_SPEED      = 0.45;
const EXPLOSION_MSGS = [
    "What was that?!", "Run!!", "BOOM!", "Watch out!",
    "That scared me!", "TNT?!", "Everyone scatter!", "whoa.."
];

// --- Player death ---
const DEATH_REACTION_RADIUS = 50;
const DEATH_REACTION_CHANCE = 0.55; // 55% of player deaths get a reaction
const DEATH_MSGS = [
    "RIP...", "F", "Damn..", "Another one bites the dust",
    "GG no re", "That's rough buddy", "Yikes", "o7", "Press F to pay respects"
];

// --- Group behavior ---
const GROUP_CHECK_GAP  = 60;  // Every 3s
const GROUP_SEARCH_RADIUS   = 16;  // Increased from 10
const GROUP_CLOSE_THRESHOLD = 2;   // Don't group closer than this (was 3)
const GROUP_IMPULSE         = 0.15; // Increased from 0.05
const GROUP_APPLY_CHANCE    = 0.40; // Increased from 0.25

// --- Home base ---
const HOME_LOC_PROP          = "rg:home_loc";
const HOME_RETURN_GAP   = 100;  // Every 5s
const HOME_RETURN_MIN_DIST   = 14;   // Must be this far to bother heading home
const HOME_RETURN_SPEED      = 0.18;
const HOME_RETURN_CHANCE     = 0.20; // 20% of idle night bots check each cycle

// ============================================================================
// HOME BASE HELPERS
// ============================================================================
function getHomeLoc(ai) {
    const raw = ai.getDynamicProperty(HOME_LOC_PROP);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function setHomeLoc(ai, loc) {
    try {
        ai.setDynamicProperty(HOME_LOC_PROP, JSON.stringify({
            x: loc.x, y: loc.y, z: loc.z
        }));
    } catch (e) {}
}

// ============================================================================
// UTILITY
// ============================================================================
function flatDist(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function yawToward(from, to) {
    return Math.atan2(-(to.x - from.x), to.z - from.z) * (180 / Math.PI);
}

// ============================================================================
// startR
// ============================================================================
export function startReactionSystem() {

    // ----------------------------------------------------------------
    // 1.  EXPLOSION REACTIONS  (event-driven, zero polling cost)
    // ----------------------------------------------------------------
    world.afterEvents.explosion.subscribe(event => {
        const dim    = event.dimension;
        const blocks = event.impactedBlocks;
        if (!dim || blocks.length === 0) return;

        // Derive explosion center from impacted block average
        let cx = 0, cy = 0, cz = 0;
        for (const b of blocks) {
            cx += b.location.x;
            cy += b.location.y;
            cz += b.location.z;
        }
        cx /= blocks.length;
        cy /= blocks.length;
        cz /= blocks.length;
        const center = { x: cx, y: cy, z: cz };

        let nearbyBots;
        try {
            nearbyBots = dim.getEntities({
                type:        ai_player_id,
                location:    center,
                maxDistance: EXPLOSION_REACTION_RADIUS
            });
        } catch (e) { return; }

        let chattedBot = false;
        for (const bot of nearbyBots) {
            if (!bot.isValid) continue;

            // Flee away from blast center
            const dx   = bot.location.x - cx;
            const dz   = bot.location.z - cz;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            try {
                bot.applyImpulse({
                    x: (dx / dist) * EXPLOSION_FLEE_SPEED,
                    y: 0.5,
                    z: (dz / dist) * EXPLOSION_FLEE_SPEED
                });
                bot.setRotation({ x: 0, y: yawToward(bot.location, center) + 180 });
            } catch (e) {}

            // One random bot reacts in chat
            if (!chattedBot && Math.random() < 0.5) {
                chattedBot = true;
                const msg   = EXPLOSION_MSGS[Math.floor(Math.random() * EXPLOSION_MSGS.length)];
                const delay = Math.floor(Math.random() * 30) + 5;
                system.runTimeout(() => {
                    if (bot.isValid) world.sendMessage(`<${bot.nameTag}> ${msg}`);
                }, delay);
            }
        }
    });

    // ----------------------------------------------------------------
    // 2.  PLAYER DEATH REACTIONS  (event-driven)
    // ----------------------------------------------------------------
    world.afterEvents.entityDie.subscribe(event => {
        const { deadEntity } = event;
        if (deadEntity.typeId !== "minecraft:player") return;
        if (Math.random() > DEATH_REACTION_CHANCE) return;

        // Stagger the reaction so it feels natural
        const delay = Math.floor(Math.random() * 80) + 20;
        system.runTimeout(() => {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;

            // Find the closest bot to where the player died
            let closestBot  = null;
            let closestDist = DEATH_REACTION_RADIUS;

            for (const ai of allAis) {
                if (!ai.isValid) continue;
                // Must be in the same dimension
                try {
                    if (ai.dimension.id !== deadEntity.dimension.id) continue;
                } catch (e) { continue; }

                const dist = flatDist(ai.location, deadEntity.location);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestBot  = ai;
                }
            }

            if (closestBot && closestBot.isValid) {
                const msg = DEATH_MSGS[Math.floor(Math.random() * DEATH_MSGS.length)];
                world.sendMessage(`<${closestBot.nameTag}> ${msg}`);
            }
        }, delay);
    });

    // ----------------------------------------------------------------
    // 3.  GROUP BEHAVIOR  (idle bots softly drift toward nearest bot)
    //     Low-frequency + stochastic skip = negligible CPU cost.
    // ----------------------------------------------------------------
    system.runInterval(() => {
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        for (const ai of allAis) {
            if (!ai.isValid || !ai.isOnGround || ai.isInWater || ai.isFalling) continue;

            // Skip only if actively busy
            if (ai.hasTag("is_busy_building") || ai.hasTag("on_eat")    ||
                ai.hasTag("is_sleeping")       || ai.hasTag("is_in_combat")) continue;
            if (ai.getDynamicProperty("rg:current_target")) continue;

            // Probabilistic skip so not all bots evaluate every cycle
            if (Math.random() > GROUP_APPLY_CHANCE) continue;

            try {
                const nearby = ai.dimension.getEntities({
                    type:        ai_player_id,
                    location:    ai.location,
                    maxDistance: GROUP_SEARCH_RADIUS
                });

                let nearest     = null;
                let nearestDist = GROUP_SEARCH_RADIUS;

                for (const other of nearby) {
                    if (!other.isValid || other.id === ai.id) continue;
                    const d = flatDist(ai.location, other.location);
                    if (d < nearestDist) { nearestDist = d; nearest = other; }
                }

                // Drift toward nearest bot only if they aren't too close already
                if (nearest && nearestDist > GROUP_CLOSE_THRESHOLD) {
                    const dx   = nearest.location.x - ai.location.x;
                    const dz   = nearest.location.z - ai.location.z;
                    const dist = nearestDist;
                    ai.applyImpulse({
                        x: (dx / dist) * GROUP_IMPULSE,
                        y: 0,
                        z: (dz / dist) * GROUP_IMPULSE
                    });
                }
            } catch (e) {}
        }
    }, GROUP_CHECK_GAP);

    // ----------------------------------------------------------------
    // 4.  HOME BASE — set home on spawn, return home at night
    // ----------------------------------------------------------------

    // Record home location when bot first spawns (only if not already set)
    world.afterEvents.entitySpawn.subscribe(event => {
        const entity = event.entity;
        if (entity.typeId !== ai_player_id) return;

        system.run(() => {
            if (!entity.isValid) return;
            if (!getHomeLoc(entity)) {
                setHomeLoc(entity, entity.location);
            }
        });
    });

    // At night, idle bots apply a gentle impulse toward their home
    system.runInterval(() => {
        if (!isNightTime()) return;

        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        for (const ai of allAis) {
            if (!ai.isValid || !ai.isOnGround || ai.isInWater) continue;

            // Skip busy bots
            if (ai.hasTag("is_busy_building") || ai.hasTag("on_eat") || ai.hasTag("is_sleeping")) continue;
            if (ai.getDynamicProperty("rg:current_target")) continue;

            if (Math.random() > HOME_RETURN_CHANCE) continue;

            try {
                const home = getHomeLoc(ai);
                if (!home) continue;

                const dist = flatDist(ai.location, home);
                if (dist < HOME_RETURN_MIN_DIST) continue; // Already close enough

                const dx = home.x - ai.location.x;
                const dz = home.z - ai.location.z;

                ai.applyImpulse({
                    x: (dx / dist) * HOME_RETURN_SPEED,
                    y: 0.05,
                    z: (dz / dist) * HOME_RETURN_SPEED
                });
                ai.setRotation({ x: 0, y: yawToward(ai.location, home) });
            } catch (e) {}
        }
    }, HOME_RETURN_GAP);
}
