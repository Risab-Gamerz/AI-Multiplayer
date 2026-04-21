import { world, system, WeatherType } from "@minecraft/server";

const ai_player_id = "rg:bot";
const EXPLOSIVE_AVOIDANCE_RADIUS = 8;
const SHELTER_SEARCH_RADIUS = 10;
const CHECK_GAP_TICKS = 20;

// Track current weather state
let currentWeather = WeatherType.Clear;
let weatherstartd = false;
let isReady = false; // ✅ Track if system is ready

/**
 * Check if a location is exposed to sky (no solid blocks above)
 */
function isExposedToSky(dimension, location) {
    const startY = Math.floor(location.y);
    const worldHeight = 320; // Max build height
    
    // Scan upward from the given location
    for (let y = startY + 1; y <= worldHeight; y++) {
        try {
            const block = dimension.getBlock({
                x: Math.floor(location.x),
                y: y,
                z: Math.floor(location.z)
            });
            
            // If we find a solid block, location is covered
            if (block && !block.isAir && block.isSolid) {
                return false; // Has cover above
            }
        } catch (e) {
            // If we can't get block, assume exposed
            return true;
        }
    }
    
    return true; // No solid blocks found - exposed to sky
}

/**
 * Check if a location has a solid block above it (is covered)
 */
function isCovered(dimension, location) {
    const checkY = Math.floor(location.y) + 1;
    try {
        const blockAbove = dimension.getBlock({
            x: Math.floor(location.x),
            y: checkY,
            z: Math.floor(location.z)
        });
        
        // Location is covered if there's a solid block above
        return blockAbove && !blockAbove.isAir && blockAbove.isSolid;
    } catch (e) {
        return false;
    }
}

/**
 * start weather tracking by querying current weather
 */
async function startWeatherTracking() {
    try {
        const overworld = world.getDimension("overworld");
        const result = await overworld.runCommand("weather query");
        const output = result.statusMessage.toLowerCase();
        
        if (output.includes("clear")) currentWeather = WeatherType.Clear;
        else if (output.includes("rain")) currentWeather = WeatherType.Rain;
        else if (output.includes("thunder")) currentWeather = WeatherType.Thunder;
        
        weatherstartd = true;
        console.warn(`[Environment] Weather startd: ${currentWeather}`);
    } catch (e) {
        console.warn(`[Environment] Failed to start weather: ${e}`);
        currentWeather = WeatherType.Clear;
        weatherstartd = true;
    }
}

/**
 * Listen for weather change events to keep weather state updated
 */
function setupWeatherListener() {
    world.afterEvents.weatherChange.subscribe(event => {
        currentWeather = event.newWeather;
        console.warn(`[Environment] Weather changed to: ${currentWeather}`);
    });
}

/**
 * Check if it's currently raining or thundering
 */
function isRaining() {
    return currentWeather === WeatherType.Rain || currentWeather === WeatherType.Thunder;
}

/**
 * Seek shelter from rain by finding a covered location
 */
function seekShelter(bot, dimension) {
    const startLoc = bot.location;
    let foundShelter = false;
    let bestLoc = null;

    // Scan nearby blocks to find a location that is covered
    for (let x = -SHELTER_SEARCH_RADIUS; x <= SHELTER_SEARCH_RADIUS; x += 2) {
        for (let z = -SHELTER_SEARCH_RADIUS; z <= SHELTER_SEARCH_RADIUS; z += 2) {
            for (let y = -2; y <= 2; y++) {
                const checkLoc = {
                    x: Math.floor(startLoc.x + x),
                    y: Math.floor(startLoc.y + y),
                    z: Math.floor(startLoc.z + z)
                };
                
                try {
                    // Check if this location has a solid block above it (cover)
                    if (isCovered(dimension, checkLoc)) {
                        foundShelter = true;
                        bestLoc = checkLoc;
                        break;
                    }
                } catch(e) {
                    // Silent fail
                }
            }
            if (foundShelter) break;
        }
        if (foundShelter) break;
    }

    if (foundShelter && bestLoc) {
        // Apply movement towards shelter
        const dx = bestLoc.x - startLoc.x;
        const dz = bestLoc.z - startLoc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 0) {
            const moveSpeed = 0.3;
            try {
                bot.applyImpulse({ 
                    x: (dx / dist) * moveSpeed, 
                    y: 0.3, 
                    z: (dz / dist) * moveSpeed 
                });
                
                // Face direction of movement
                const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
                bot.setRotation({ x: 0, y: yaw });
            } catch (e) {}
        }
    }
}

/**
 * start the environment behavior system
 * Handles explosive avoidance and weather sheltering for AI bots
 */
export function startEnvironmentBehavior() {
    // ✅ Delayed initialization to avoid early execution errors
    const initAttempt = () => {
        try {
            // Test if world is ready
            const testDim = world.getDimension("overworld");
            if (!testDim) {
                system.runTimeout(initAttempt, 40); // Retry in 2 seconds
                return;
            }
            
            // start weather tracking
            startWeatherTracking().then(() => {
                setupWeatherListener();
                isReady = true;
                console.warn("[Environment] Environment behavior system startd with weather detection");
            }).catch(() => {
                weatherstartd = true;
                isReady = true;
            });
            
        } catch (e) {
            // Early execution - retry later
            console.warn(`[Environment] Waiting for world to be ready...`);
            system.runTimeout(initAttempt, 40); // Retry in 2 seconds
        }
    };
    
    // Start main interval (will only do work when ready)
    system.runInterval(() => {
        if (!isReady) return;
        
        try {
            const overworld = world.getDimension("overworld");
            
            const bots = overworld.getEntities({ type: ai_player_id });
            
            for (const bot of bots) {
                if (!bot.isValid) continue;
                
                const botLoc = bot.location;
                
                // 1. Explosive Danger Avoidance (Priority 1)
                const nearbyExplosives = overworld.getEntities({
                    location: botLoc,
                    maxDistance: EXPLOSIVE_AVOIDANCE_RADIUS,
                    type: "minecraft:tnt"
                });
                
                if (nearbyExplosives.length > 0) {
                    const nearestTnt = nearbyExplosives[0];
                    const tntLoc = nearestTnt.location;
                    
                    const dx = botLoc.x - tntLoc.x;
                    const dz = botLoc.z - tntLoc.z;
                    const distanceXY = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distanceXY > 0.1) {
                        const fleeSpeed = 0.6;
                        const velocityX = (dx / distanceXY) * fleeSpeed;
                        const velocityZ = (dz / distanceXY) * fleeSpeed;
                        
                        try {
                            bot.applyImpulse({ x: velocityX, y: 0.4, z: velocityZ });
                            const yaw = Math.atan2(-velocityX, velocityZ) * (180 / Math.PI);
                            bot.setRotation({ x: 0, y: yaw });
                        } catch (e) {}
                    }
                    continue;
                }
                
                // 2. Weather Sheltering
                if (isRaining() && weatherstartd) {
                    // Check if bot is exposed to sky using manual scan
                    const isExposed = isExposedToSky(overworld, botLoc);
                    
                    // 20% chance per check to seek shelter if exposed
                    if (isExposed && Math.random() < 0.2) {
                        seekShelter(bot, overworld);
                    }
                }
            }
        } catch (e) {
            // Silent fail for dimension errors
        }
    }, CHECK_GAP_TICKS);
    
    // Start initialization
    initAttempt();
}