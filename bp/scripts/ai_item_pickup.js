import { world, system } from "@minecraft/server";

// ============================================================================
// CONFIG
// ============================================================================
const ai_player_id = "rg:bot";
const PICKUP_RADIUS     = 5;   // Blocks around item to search for a bot
const PICKUP_DELAY      = 10;  // Ticks after spawn before attempting pickup

// Items bots won't bother picking up
const SKIP_ITEMS = new Set([
    "minecraft:rotten_flesh",
    "minecraft:poisonous_potato",
    "minecraft:spider_eye",
    "minecraft:bone_meal",
    "minecraft:bone",
    "minecraft:string",
    "minecraft:gunpowder"
]);

// Occasional pickup announcement messages
const PICKUP_MSGS = [
    "Found some loot!",
    "ooh, free stuff",
    "I'll take that",
    "nice",
    "score!"
];

// ============================================================================
// startR
// ============================================================================
export function startItemPickup() {
    world.afterEvents.entitySpawn.subscribe(event => {
        const entity = event.entity;

        // Only care about dropped item entities
        if (entity.typeId !== "minecraft:item") return;

        // Delay so the item has settled and we're not in the same tick as the
        // spawn (avoids edge-case crashes with unloaded chunks)
        system.runTimeout(() => {
            if (!entity.isValid) return;

            // Retrieve the item stack from the dropped item entity
            let itemStack;
            try {
                const itemComp = entity.getComponent("minecraft:item");
                if (!itemComp) return;
                itemStack = itemComp.itemStack;
                if (!itemStack) return;
            } catch (e) {
                return;
            }

            // Skip junk items
            if (SKIP_ITEMS.has(itemStack.typeId)) return;

            // Find the nearest bot within pickup radius
            let nearestBot  = null;
            let nearestDist = PICKUP_RADIUS + 1;

            try {
                const candidates = entity.dimension.getEntities({
                    type:        ai_player_id,
                    location:    entity.location,
                    maxDistance: PICKUP_RADIUS
                });

                for (const bot of candidates) {
                    if (!bot.isValid || bot.isInWater) continue;

                    const dx   = bot.location.x - entity.location.x;
                    const dy   = bot.location.y - entity.location.y;
                    const dz   = bot.location.z - entity.location.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestBot  = bot;
                    }
                }
            } catch (e) {
                return;
            }

            if (!nearestBot || !nearestBot.isValid) return;

            // Add item to bot's inventory
            try {
                const invComp = nearestBot.getComponent("minecraft:inventory");
                if (!invComp || !invComp.container) return;

                invComp.container.addItem(itemStack);

                // Remove the dropped entity so it isn't picked up twice
                try { entity.kill(); } catch (e) {}

                // Occasionally say something about the pickup
                if (Math.random() < 0.09) {
                    const itemName = itemStack.typeId
                        .replace("minecraft:", "")
                        .replace(/_/g, " ");
                    const quip = PICKUP_MSGS[Math.floor(Math.random() * PICKUP_MSGS.length)];
                    system.runTimeout(() => {
                        if (nearestBot.isValid) {
                            world.sendMessage(`<${nearestBot.nameTag}> ${quip} (${itemName})`);
                        }
                    }, Math.floor(Math.random() * 20) + 5);
                }

            } catch (e) {}

        }, PICKUP_DELAY);
    });
}
