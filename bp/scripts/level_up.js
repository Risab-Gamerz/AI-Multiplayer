import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

const ai_player_id = "rg:bot";
const PROGRESSION_PROPERTY = "rg:progression_points";
const PROGRESSION_PROPERTY_SC = "PROGRESSION_PROPERTY";
const UPGRADING_TAG = "is_upgrading";
const SUODING_TAG = "suoding";
const BUSY_TAGS = ["is_upgrading", "on_eat", "is_busy_cooking", "is_busy_building"];

const MOB_KILL_POINTS = {
    // === Undead ===
    "minecraft:zombie": 6,
    "minecraft:husk": 8,        // Desert variant, slightly stronger
    "minecraft:drowned": 8,     // Underwater combat, slightly harder
    "minecraft:zombie_villager": 6, // Slightly higher than normal zombie
    "minecraft:skeleton": 7,
    "minecraft:stray": 9,       // Frost variant, with slowness arrows
    "minecraft:bogged": 10,      // Poison arrow variant
    "minecraft:wither_skeleton": 13, // Nether fortress, high HP, withering effect
    "minecraft:zombie_pigman": 14, // Legacy ID for zombified piglin
    "minecraft:zombified_piglin": 14, // Modern Nether variant ID

    // === Basic/Crawlers ===
    "minecraft:creeper": 12,    // High explosion risk
    "minecraft:spider": 6,
    "minecraft:cave_spider": 8,  // With poison effect
    "minecraft:slime": 2,
    "minecraft:pig": 3,
    "minecraft:cow": 5,
    "minecraft:chicken": 4,
    "minecraft:sheep": 3,
    "minecraft:magma_cube": 3,  // Nether variant
    "minecraft:iron_golem": 100,
    "minecraft:warden": 200,

    // === Special/Casters ===
    "minecraft:witch": 15,      // Throws potions
    "minecraft:phantom": 12,    // Flying and high altitude sneak attack
    "minecraft:enderman": 18,   // Teleportation, high HP
    "minecraft:shulker": 12,    // Levitation projectiles with levitation effect
    "minecraft:endermite": 6,
    "minecraft:breeze": 18,     // Strong melee and wind projectiles, high difficulty

    // === Ocean ===
    "minecraft:guardian": 25,
    "minecraft:elder_guardian": 60, // Mini Boss level

    // === Pillagers ===
    "minecraft:pillager": 10,
    "minecraft:vindicator": 25,
    "minecraft:evoker": 30,     // Summoning/fangs attack, high threat
    "minecraft:ravager": 50,    // High HP, charging attack

    // === Nether ===
    "minecraft:piglin": 12,
    "minecraft:piglin_brute": 40, // Brute, high threat
    "minecraft:ghast": 30,
    "minecraft:blaze": 20,
    "minecraft:hoglin": 16,
    "minecraft:zoglin": 25      // Zombified hoglins
};

const PROGRESSION_TIERS = [
    { threshold: 5000, tag: "diamond_pro", event: "rg:event_upgrade_to_diamond_pro" },
    { threshold: 3000, tag: "diamond", event: "rg:event_upgrade_to_diamond" },
    { threshold: 1500, tag: "iron", event: "rg:event_upgrade_to_iron" },
    { threshold: 600, tag: "copper", event: "rg:event_upgrade_to_copper" },
    { threshold: 120, tag: "stone", event: "rg:event_upgrade_to_stone" },
    { threshold: 0, tag: "wooden", event: "rg:event_upgrade_to_wooden" }
];

const UPGRADE_ANIMATION_DURATION_TICKS = 100;

function getAIPoints(ai) {
    if (!ai?.isValid) return 0;
    const points = ai.getDynamicProperty(PROGRESSION_PROPERTY);
    return typeof points === "number" ? points : 0;
}

function addAIPoints(ai, points) {
    if (!ai?.isValid || typeof points !== "number" || points === 0) return;
    const currentPoints = getAIPoints(ai);
    ai.setDynamicProperty(PROGRESSION_PROPERTY, currentPoints + points);
}

function ensureProgressionStateForAI(ai) {
    if (!ai?.isValid || ai.typeId !== ai_player_id) return;

    const currentTier = PROGRESSION_TIERS.find(tier => ai.hasTag(tier.tag));
    const existingPoints = ai.getDynamicProperty(PROGRESSION_PROPERTY);
    const hasProgression = existingPoints !== undefined && existingPoints !== null;

    if (!hasProgression) {
        const initialPoints = currentTier ? currentTier.threshold : 0;
        ai.setDynamicProperty(PROGRESSION_PROPERTY, initialPoints);
    }

    if (!currentTier && !ai.getTags().some(tag => PROGRESSION_TIERS.some(t => t.tag === tag))) {
        ai.addTag(PROGRESSION_TIERS[PROGRESSION_TIERS.length - 1].tag);
    }
}

function startExistingAIsProgression() {
    const allAis = ALL_AI_CACHE || [];
    if (allAis.length > 0) {
        for (const ai of allAis) {
            ensureProgressionStateForAI(ai);
        }
        return;
    }

    const dimensionIds = ["overworld", "nether", "the_end"];
    for (const dimId of dimensionIds) {
        try {
            const dimension = world.getDimension(dimId);
            const aiList = dimension.getEntities({ type: ai_player_id });
            for (const ai of aiList) {
                ensureProgressionStateForAI(ai);
            }
        } catch (e) {
        }
    }
}

function initiateUpgradeProcess(ai, oldTierTag, newTierObject) {
    if (ai.hasTag(UPGRADING_TAG) || ai.hasTag(SUODING_TAG)) {
        return;
    }
    ai.addTag(UPGRADING_TAG);

    const aiLoc = ai.location;
    const workbenchPos = { x: Math.floor(aiLoc.x) + 2, y: Math.floor(aiLoc.y), z: Math.floor(aiLoc.z) };
    // Calculate yaw to face the workbench (ai.lookAt doesn't exist in v2.x)
    try {
        const dx = workbenchPos.x + 0.5 - ai.location.x;
        const dz = workbenchPos.z + 0.5 - ai.location.z;
        ai.setRotation({ x: 0, y: Math.atan2(-dx, dz) * (180 / Math.PI) });
    } catch (e) { }
    ai.runCommand('playanimation @s set_block');
    ai.dimension.runCommand(`setblock ${workbenchPos.x} ${workbenchPos.y} ${workbenchPos.z} crafting_table`);
    ai.runCommand('playsound dig.wood @a[r=16]');

    ai.triggerEvent("rg:event_go_crafting");

    system.runTimeout(() => {
        if (!ai?.isValid) return;
        ai.removeTag(oldTierTag);
        ai.addTag(newTierObject.tag);
        ai.triggerEvent(newTierObject.event);
        try {
            const dx2 = workbenchPos.x + 0.5 - ai.location.x;
            const dz2 = workbenchPos.z + 0.5 - ai.location.z;
            ai.setRotation({ x: 0, y: Math.atan2(-dx2, dz2) * (180 / Math.PI) });
        } catch (e) { }
        ai.runCommand('playanimation @s set_block');
        ai.dimension.runCommand(`setblock ${workbenchPos.x} ${workbenchPos.y} ${workbenchPos.z} air`);
        ai.runCommand('playsound dig.wood @a[r=16]');
        ai.triggerEvent("rg:event_stop_crafting");
        ai.removeTag(UPGRADING_TAG);


    }, UPGRADE_ANIMATION_DURATION_TICKS);
}

export function startProgressionSystem() {
    world.afterEvents.entitySpawn.subscribe(event => {
        if (event.entity.typeId === ai_player_id) {
            ensureProgressionStateForAI(event.entity);
        }
    });

    startExistingAIsProgression();


    // [New] Handle logic for AI killing vanilla mobs
    world.afterEvents.entityDie.subscribe(event => {
        const { deadEntity, damageSource } = event;
        const killer = damageSource?.damagingProjectile?.owner ?? damageSource?.damagingEntity;

        // 1. Ensure the killer is an AI
        if (killer?.typeId === ai_player_id) {
            const points = MOB_KILL_POINTS[deadEntity.typeId];
            if (typeof points === "number" && points !== 0) {
                addAIPoints(killer, points);
            }
        }
    });

    // [New/Replace] Scoreboard sync and reset logic (runs every 100 ticks)
    system.runInterval(() => {
        // Try to get target scoreboard
        const objective = world.scoreboard.getObjective(PROGRESSION_PROPERTY_SC);

        // Skip sync if scoreboard target does not exist
        if (!objective) {
            // You can also add logic here to create a scoreboard if needed
            return;
        }

        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;
        for (const ai of allAis) {
            if (!ai.isValid) {
                continue;
            }
            try {
                // 1. Use AI entity as participant to get score
                const scoreValue = objective.getScore(ai);

                if (typeof scoreValue === "number" && scoreValue !== 0) {
                    addAIPoints(ai, scoreValue);
                    objective.setScore(ai, 0);
                }
            } catch (e) {
                // If entity is not on scoreboard, or getting/setting score fails, ignore
            }
        }
    }, 100);



    system.runInterval(() => {
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;


        for (const ai of allAis) {
            if (!ai.isValid) {
                continue;
            }
            addAIPoints(ai, 1);
        }
    }, 60);



    world.afterEvents.entityDie.subscribe(event => {
        const { deadEntity, damageSource } = event;
        const killer = damageSource?.damagingProjectile?.owner ?? damageSource?.damagingEntity;

        if (deadEntity.typeId === ai_player_id && killer?.typeId === ai_player_id) {
            const victimPoints = getAIPoints(deadEntity);
            addAIPoints(killer, victimPoints);
        }
    });


    system.runInterval(() => {

        // -------------------------------------------------------------------
        // [Core Optimization 1] Use global cache ALL_AI_CACHE instead of expensive dimension query loop
        // -------------------------------------------------------------------
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        // [Core Optimization 2] Fast filtering in JS memory
        const idleAis = allAis.filter(ai => {
            // [Safety Check] Exclude invalid entities (AI dead/removed)
            if (!ai.isValid) return false;

            if (!ai.getDynamicProperty("rg:current_target")) return false;

            // Exclude busy AI
            for (const tag of BUSY_TAGS) {
                if (ai.hasTag(tag)) {
                    return false;
                }
            }

            return true;
        });


        for (const ai of idleAis) {

            // [Safety Check] Although filter has already checked isValid, keeping this line is a good defensive programming habit
            if (!ai.isValid) continue;

            const currentPoints = ai.getDynamicProperty(PROGRESSION_PROPERTY) || 0;
            const aiTags = ai.getTags();
            let currentTierTag;

            // Find current tier tag
            for (const tier of PROGRESSION_TIERS) {
                if (aiTags.includes(tier.tag)) {
                    currentTierTag = tier.tag;
                    break;
                }
            }

            if (!currentTierTag) continue;

            // Find suitable upgrade target
            for (const targetTier of PROGRESSION_TIERS) {
                if (currentPoints >= targetTier.threshold) {
                    if (targetTier.tag !== currentTierTag) {

                        initiateUpgradeProcess(ai, currentTierTag, targetTier);
                    }
                    break; // Assume PROGRESSION_TIERS is sorted by threshold, stop immediately after finding the highest tier
                }
            }
        }
    }, 100);


}