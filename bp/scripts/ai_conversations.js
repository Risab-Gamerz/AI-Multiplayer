import { world, system } from "@minecraft/server";
import { ALL_AI_CACHE } from "./greeting.js";

const ai_player_id = "rg:bot";
const BOT_CHAT_COOLDOWN_KEY = "rg:chat_cooldown";
const BOT_SPEAKING_TAG = "is_speaking";
const CONVERSATION_TTL = 300; // 15 seconds - how long to remember a topic
const BOT_CHAT_RADIUS = 48; // How far bots can "hear"
const RESPONSE_CHANCE = 0.6; // 60% chance to respond if topic is interesting

// Recent bot messages storage
const recentBotMessages = [];

// Topics that are interesting and generate more responses
const INTERESTING_TOPICS = {
    combat: ["kill", "fight", "attack", "damage", "hurt", "mob", "monster", "zombie", "creeper"],
    gathering: ["found", "mining", "dig", "resource", "diamond", "gold", "iron", "block", "collect"],
    building: ["build", "building", "construct", "structure", "place", "create"],
    exploration: ["explore", "discover", "found", "cave", "dungeon", "area", "location"],
    social: ["hey", "bro", "dude", "mate", "friend", "thanks", "help", "awesome", "nice"],
    playful: ["lol", "haha", "funny", "joke", "cool", "epic", "noice", "gg"]
};

// Response templates for bot conversations
const BOT_RESPONSE_TEMPLATES = {
    combat: [
        "yeah bro that sounds crazy",
        "nice kill dude",
        "watch out for more",
        "yeah mobs are tough",
        "good job handling that"
    ],
    gathering: [
        "nice find bro",
        "i need some of that too",
        "good spot",
        "let me get some too",
        "thats a good haul"
    ],
    building: [
        "looks pretty cool",
        "nice structure bro",
        "that looks awesome",
        "i like what you did there",
        "looks good mate"
    ],
    exploration: [
        "sounds fun exploring",
        "find anything cool",
        "ill check that out",
        "nice discovery",
        "sounds interesting"
    ],
    social: [
        "hey whats up",
        "yooo",
        "same here bro",
        "totally",
        "for sure mate"
    ],
    playful: [
        "haha yeah",
        "no cap that was funny",
        "haha legit",
        "lmao true",
        "haha so true"
    ]
};

// Determine topic based on message keywords
function detectTopic(message) {
    const lowerMessage = message.toLowerCase();

    for (const [topic, keywords] of Object.entries(INTERESTING_TOPICS)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
            return topic;
        }
    }

    return null; // Not an interesting topic
}

// Get response for a detected topic
function getResponseForTopic(topic) {
    const templates = BOT_RESPONSE_TEMPLATES[topic];
    if (!templates || templates.length === 0) return null;

    return templates[Math.floor(Math.random() * templates.length)];
}

// Store a bot message for other bots to respond to
function storeBotMessage(aiName, message, location) {
    recentBotMessages.push({
        sender: aiName,
        message: message,
        location: location,
        timestamp: Date.now(),
        topic: detectTopic(message)
    });

    // Keep only last 20 messages
    if (recentBotMessages.length > 20) {
        recentBotMessages.shift();
    }
}

// Get recent messages that haven't expired
function getRecentMessages() {
    const now = Date.now();
    return recentBotMessages.filter(msg =>
        now - msg.timestamp < CONVERSATION_TTL * 1000 &&
        msg.topic !== null  // Only interesting topics
    );
}

// Calculate distance between two locations
function getDistance(loc1, loc2) {
    return Math.sqrt(
        Math.pow(loc1.x - loc2.x, 2) +
        Math.pow(loc1.y - loc2.y, 2) +
        Math.pow(loc1.z - loc2.z, 2)
    );
}

// Main bot conversation handler
export function startBotConversations() {
    system.runInterval(() => {
        try {
            const allAis = ALL_AI_CACHE;
            if (!allAis || allAis.length === 0) return;

            const recentMessages = getRecentMessages();
            if (recentMessages.length === 0) return;

            for (const ai of allAis) {
                if (!ai.isValid || ai.hasTag(BOT_SPEAKING_TAG)) continue;

                // Skip if in combat
                if (ai.getDynamicProperty("rg:current_target")) continue;

                // Skip if busy
                if (ai.hasTag('on_eat') ||
                    ai.hasTag('is_busy_building') ||
                    ai.hasTag('is_busy_cooking') ||
                    ai.hasTag('is_upgrading') ||
                    ai.hasTag('is_sleeping')) {
                    continue;
                }

                // Check cooldown
                const cooldownUntil = ai.getDynamicProperty(BOT_CHAT_COOLDOWN_KEY);
                if (cooldownUntil && Date.now() < cooldownUntil) continue;

                // Find nearby messages to respond to
                const aiLoc = ai.location;
                const nearbyMessages = recentMessages.filter(msg =>
                    msg.sender !== ai.nameTag && // Don't respond to self
                    getDistance(aiLoc, msg.location) <= BOT_CHAT_RADIUS
                );

                if (nearbyMessages.length === 0) continue;

                // Random chance to respond
                if (Math.random() > RESPONSE_CHANCE) continue;

                // Pick a random nearby message
                const messageToRespondTo = nearbyMessages[
                    Math.floor(Math.random() * nearbyMessages.length)
                ];

                // Get response
                const response = getResponseForTopic(messageToRespondTo.topic);
                if (!response) continue;

                // Send response
                ai.addTag(BOT_SPEAKING_TAG);

                try {
                    world.sendMessage(`<${ai.nameTag}> ${response}`);
                } catch (e) { }

                // Remove speaking tag
                system.runTimeout(() => {
                    if (ai.isValid) ai.removeTag(BOT_SPEAKING_TAG);
                }, 5);

                // Set cooldown (30-90 seconds)
                const cooldownMs = (30 + Math.random() * 60) * 1000;
                ai.setDynamicProperty(BOT_CHAT_COOLDOWN_KEY, Date.now() + cooldownMs);
            }
        } catch (e) {
            // Silent fail
        }
    }, 20); // Check every second
}

// Export function to be called when a bot sends a message
export function recordBotMessage(aiName, message, location) {
    storeBotMessage(aiName, message, location);
}
