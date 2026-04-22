import { world, system } from "@minecraft/server";

// --- Constant Configuration ---
const KNOCKBACK_TAG = "knockshield"; // Tag to detect
const KNOCKBACK_STRENGTH = 1.0; // Knockback strength (1.0 is approximately equivalent to 1 block knockback effect)
const VERTICAL_STRENGTH = 0.2; // Vertical impulse to slightly lift the entity
const WATCH_GAP_TICKS = 3; // Check every 1 tick (as real-time as possible)
const RadianConvert = Math.PI / 180;
export function startShieldKnockback() {
    system.runInterval(() => {

        // 1. Iterate through all dimensions
        const dimensionIdsToQuery = ["overworld", "nether", "the_end"];

        for (const dimId of dimensionIdsToQuery) {
            try {
                const dimension = world.getDimension(dimId);

                // 2. Filter entities with 'knockshield' tag
                const entitiesToKnockback = dimension.getEntities({
                    tags: [KNOCKBACK_TAG]
                });

                for (const entity of entitiesToKnockback) {
                    if (!entity.isValid) continue;

                    // 3. Calculate reverse direction impulse

                    // Get entity's current rotation angle (Yaw)
                    const rotation = entity.getRotation();

                    // Convert Yaw to radians and adjust:
                    // Minecraft's Yaw (Y-axis rotation) 0 degrees is usually south, we want 0 degrees to correspond to positive Z-axis (north)
                    // And in trigonometric calculations, 0 degrees is usually the positive X-axis.
                    // Conversion formula: (Yaw + 90) * (PI / 180) can convert Minecraft's Yaw to radians suitable for calculation.
                    const yawRadians = (rotation.y + 90) * RadianConvert;

                    // Calculate the direction vector the entity is facing (unit vector)
                    const directionVector = {
                        x: Math.cos(yawRadians),
                        z: Math.sin(yawRadians)
                    };

                    // Reverse impulse: negate the direction vector and multiply by strength
                    // Note: here we use a standard JS object { x, y, z } as a Vector3 substitute
                    const impulse = {
                        x: -directionVector.x * KNOCKBACK_STRENGTH, // X-axis reverse impulse
                        y: VERTICAL_STRENGTH,                       // Vertical upward impulse
                        z: -directionVector.z * KNOCKBACK_STRENGTH  // Z-axis reverse impulse
                    };

                    try {
                        // 4. Apply impulse
                        // entity.applyImpulse accepts {x, y, z} object
                        entity.applyImpulse(impulse);

                        // 5. Remove tag
                        entity.removeTag(KNOCKBACK_TAG);

                    } catch (e) {
                        console.error(`[Knockback Error] Unable to apply impulse or remove tag for entity ${entity.typeId}: ${e}`);
                    }
                }

            } catch (e) {
                // Ignore errors such as dimension not existing
            }
        }
    }, WATCH_GAP_TICKS);
}
