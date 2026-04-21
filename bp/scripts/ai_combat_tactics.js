import { world, system, EntityComponentTypes, ItemStack, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { REAL_PLAYERS_CACHE } from "./rgstart.js";

const ai_player_id = "rg:bot";
const ACTIVATION_GAP = 20;
const PROXIMITY_RADIUS = 32;

const FLYING_ENEMIES = ["minecraft:ghast", "minecraft:phantom", "minecraft:blaze", "minecraft:ender_dragon"];

// ========== aim MANAGEMENT FUNCTIONS (EXPORTED) ==========

export function setAITarget(ai, target) {
    if (!ai || !ai.isValid) return;
    if (!target || !target.isValid) return;
    
    ai.setDynamicProperty("rg:current_target", target.id);
    ai.setDynamicProperty("rg:target_acquired_time", system.currentTick);
    ai.setDynamicProperty("rg:target_type", target.typeId);
}

export function clearAITarget(ai) {
    if (!ai || !ai.isValid) return;
    
    ai.setDynamicProperty("rg:current_target", null);
    ai.setDynamicProperty("rg:target_acquired_time", null);
    ai.setDynamicProperty("rg:target_type", null);
}

export function getCurrentTarget(ai) {
    if (!ai || !ai.isValid) return null;
    
    const targetId = ai.getDynamicProperty("rg:current_target");
    if (!targetId) return null;
    
    try {
        const target = world.getEntity(targetId);
        if (!target || !target.isValid) {
            clearAITarget(ai);
            return null;
        }
        return target;
    } catch (e) {
        return null;
    }
}

export function hasValidTarget(ai) {
    return getCurrentTarget(ai) !== null;
}

// ========== MAIN COMBAT TACTICS ==========

export function startCombatTactics() {
    system.runInterval(() => {
        const allPlayers = REAL_PLAYERS_CACHE;
        if (!allPlayers || allPlayers.length === 0) return;

        const activeAIinCombat = new Set();

        // 1. Find all active bots in combat near players
        for (const player of allPlayers) {
            if (!player.isValid) continue;

            const nearbyAI = player.dimension.getEntities({
                type: ai_player_id,
                maxDistance: PROXIMITY_RADIUS,
                location: player.location
            });

            for (const ai of nearbyAI) {
                if (ai.isValid && hasValidTarget(ai)) {
                    activeAIinCombat.add(ai);
                }
            }
        }

        // 2. Apply Tactics
        for (const ai of activeAIinCombat) {
            if (!ai.isValid) continue;
            
            const target = getCurrentTarget(ai);
            if (!target || !target.isValid) continue;

            const healthComp = ai.getComponent(EntityComponentTypes.Health);
            const equippable = ai.getComponent(EntityComponentTypes.Equippable);

            // A. Healing & Retreating (Health below 30%)
            if (healthComp) {
                const healthPercent = healthComp.currentValue / healthComp.effectiveMax;
                
                if (healthPercent < 0.3) {
                    // Try to trigger eating/healing
                    if (!ai.hasTag("is_eating") && healthComp.currentValue > 0) {
                        try {
                            ai.addTag("on_eat");
                        } catch (e) {}
                    }

                    // Retreat: Apply impulse away from target (skip if in water to allow swimming)
                    const dx = ai.location.x - target.location.x;
                    const dz = ai.location.z - target.location.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist > 0 && dist < 8 && !ai.isInWater) {
                        try {
                            ai.applyImpulse({ x: (dx/dist) * 0.4, y: 0.3, z: (dz/dist) * 0.4 });
                        } catch (e) {}
                    }

                    // B. Group Coordination: Call for help
                    try {
                        const friends = ai.dimension.getEntities({
                            type: ai_player_id,
                            location: ai.location,
                            maxDistance: 16
                        });

                        for (const friend of friends) {
                            if (friend.id !== ai.id && friend.isValid && !hasValidTarget(friend)) {
                                setAITarget(friend, target);
                            }
                        }
                    } catch (e) {}
                }
            }

            // C. Dynamic Weapon Switching
            if (equippable) {
                const targetLoc = target.location;
                const aiLoc = ai.location;
                const heightDiff = targetLoc.y - aiLoc.y;
                
                const needsRanged = FLYING_ENEMIES.includes(target.typeId) || heightDiff > 3;
                
                try {
                    const currentMainhand = equippable.getEquipment(EquipmentSlot.Mainhand);
                    const hasBow = currentMainhand && currentMainhand.typeId === "minecraft:bow";
                    
                    if (needsRanged && !hasBow) {
                        equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:bow", 1));
                    } else if (!needsRanged && hasBow) {
                        equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:diamond_sword", 1));
                    }
                } catch (e) {}
            }
        }
    }, ACTIVATION_GAP);
}