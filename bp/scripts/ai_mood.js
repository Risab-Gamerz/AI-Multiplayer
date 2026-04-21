import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

// ============================================================================
// MOOD STATES
// ============================================================================
export const MOODS = {
    HAPPY:   "happy",
    NEUTRAL: "neutral",
    ANGRY:   "angry",
    SCARED:  "scared",
    WOUNDED: "wounded"
};

const MOOD_PROPERTY       = "rg:mood";
const MOOD_UPDATE_GAP = 100; // Every 5s
const TIME_SYNC_GAP   = 200; // Every 10s

// Shared time-of-day cache (0 = midnight, 6000 = sunrise, 13000 = sunset)
let _cachedTimeOfDay = 6000;

/** Returns the last-synced in-game time of day (0–23999). */
export function getCachedTimeOfDay() { return _cachedTimeOfDay; }

/** Returns true if it is currently night (after sunset, before sunrise). */
export function isNightTime() { 
    // Direct check: night is after 13000 or before 6000
    return _cachedTimeOfDay > 13000 || _cachedTimeOfDay < 6000;
}

/** Get current mood of a bot. */
export function getMood(ai) {
    if (!ai?.isValid) return MOODS.NEUTRAL;
    return ai.getDynamicProperty(MOOD_PROPERTY) || MOODS.NEUTRAL;
}

/** Set current mood of a bot. */
export function setMood(ai, mood) {
    if (!ai?.isValid) return;
    try { ai.setDynamicProperty(MOOD_PROPERTY, mood); } catch (e) {}
}

// ============================================================================
// CHAT LINES PER MOOD CHANGE
// ============================================================================
const WOUNDED_CHAT = [
    "Ow.. I'm hurt!", "Someone help me!", "I need to heal..",
    "This is bad..", "Need a potion!", "Getting low here!", "Yikes.."
];
const HAPPY_CHAT = [
    "What a great day!", "Feeling good!", "Life is great!",
    "Love this server :D", "Best day ever!", "So peaceful out here~"
];

// ============================================================================
// startR
// ============================================================================
export function startMoodSystem() {

    // Sync in-game time of day every 10 seconds
    system.runInterval(() => {
        try {
            const res = world.getDimension("overworld").runCommand("time query daytime");
            // Bedrock outputs: "The time is XXXX" -- grab any number from it
            const m = (res?.statusMessage ?? "").match(/\d+/);
            if (m) _cachedTimeOfDay = parseInt(m[0]) % 24000;
        } catch (e) {
            // If command fails, use fallback: assume midnight as default
            _cachedTimeOfDay = 14000; // Default to night if check fails
        }
    }, TIME_SYNC_GAP);

    // Evaluate each bot's mood
    system.runInterval(() => {
        const allAis = ALL_AI_CACHE;
        if (!allAis || allAis.length === 0) return;

        const night = _cachedTimeOfDay > 13000;

        for (const ai of allAis) {
            if (!ai.isValid) continue;
            try {
                const hComp = ai.getComponent("minecraft:health");
                if (!hComp) continue;

                const hp    = hComp.currentValue;
                const maxHp = hComp.effectiveMax || 20;
                const pct   = hp / maxHp;

                const inCombat = !!ai.getDynamicProperty("rg:current_target");
                const sleeping = ai.hasTag("is_sleeping");

                const prev = getMood(ai);
                let next;

                if      (pct <= 0.25)              next = MOODS.WOUNDED;
                else if (inCombat)                 next = MOODS.ANGRY;
                else if (pct < 0.5)                next = MOODS.SCARED;
                else if (night && !sleeping)       next = MOODS.SCARED;
                else if (pct > 0.85 && !night)     next = MOODS.HAPPY;
                else                               next = MOODS.NEUTRAL;

                if (next === prev) continue;
                setMood(ai, next);

                // Occasional mood-change chat (stagger with random delay so bots
                // don't all speak at once when weather changes)
                if (next === MOODS.WOUNDED && prev !== MOODS.WOUNDED && Math.random() < 0.45) {
                    const msg   = WOUNDED_CHAT[Math.floor(Math.random() * WOUNDED_CHAT.length)];
                    const delay = Math.floor(Math.random() * 40) + 10;
                    system.runTimeout(() => {
                        if (ai.isValid) world.sendMessage(`<${ai.nameTag}> ${msg}`);
                    }, delay);

                } else if (next === MOODS.HAPPY && Math.random() < 0.15) {
                    const msg   = HAPPY_CHAT[Math.floor(Math.random() * HAPPY_CHAT.length)];
                    const delay = Math.floor(Math.random() * 80) + 30;
                    system.runTimeout(() => {
                        if (ai.isValid) world.sendMessage(`<${ai.nameTag}> ${msg}`);
                    }, );
                }

            } catch (e) {}
        }
    }, MOOD_UPDATE_GAP);
}
