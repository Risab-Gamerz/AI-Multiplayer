import { world, system } from "@minecraft/server";
import { recordBotMessage } from "./ai_conversations.js";

const ai_player_id = "rg:bot";
const PEACE_KEYWORDS = ["stop fighting", "stop", "don't fight", "stop", "dont hit", "don't hit", "do not hit"];
const SEARCH_RADIUS = 32;
const PEACE_CHANCE = 0.5;
const PEACEFUL_TAG_PREFIX = "peaceful_";
const PEACE_MEMORY_PROPERTY = "rg:peace_interacted_players";

const ACCEPT_MESSAGES = ["Okay", "Sure", "Then don't hit me either", "Can do"];
const REFUSE_MESSAGES = ["No", "Why should I", "Go dream", "No"];
const AI_TAGS = "peacefulAIPairTag"
const PLAYER_TAGS = "peacefulPairTag"
const RESPONSE_DELAY_MIN_SECONDS = 2;
const RESPONSE_DELAY_MAX_SECONDS = 5;


export function startmediatorBehavior() {
    world.afterEvents.chatSend.subscribe(event => {
        const { message, sender: player } = event;
        const lowerCaseMessage = message.toLowerCase();

        const foundKeyword = PEACE_KEYWORDS.some(keyword => lowerCaseMessage.includes(keyword));
        if (!foundKeyword) {
            return;
        }

        const nearbyAis = player.dimension.getEntities({
            location: player.location,
            maxDistance: SEARCH_RADIUS,
            type: ai_player_id
        });

        let aggressorAI = undefined;
        for (const ai of nearbyAis) {
            const targetId = ai.getDynamicProperty("rg:current_target");
            if (targetId && targetId === player.id) {
                aggressorAI = ai;
                break;
            }
        }

        if (!aggressorAI) {
            return;
        }


        const memoryString = aggressorAI.getDynamicProperty(PEACE_MEMORY_PROPERTY) || "[]";
        const memoryArray = JSON.parse(memoryString);


        if (memoryArray.includes(player.id)) {
            return;
        }


        memoryArray.push(player.id);
        aggressorAI.setDynamicProperty(PEACE_MEMORY_PROPERTY, JSON.stringify(memoryArray));



        const responseDelay = (RESPONSE_DELAY_MIN_SECONDS + Math.random() * (RESPONSE_DELAY_MAX_SECONDS - RESPONSE_DELAY_MIN_SECONDS));
        const responseDelayTicks = Math.floor(responseDelay * 20);

        if (Math.random() < PEACE_CHANCE) {

            player.addTag(PLAYER_TAGS);
            aggressorAI.addTag(AI_TAGS);

            system.runTimeout(() => {
                if (!aggressorAI?.isValid) return;
                const aiName = aggressorAI.nameTag || "An AI player";
                const response = ACCEPT_MESSAGES[Math.floor(Math.random() * ACCEPT_MESSAGES.length)];
                world.sendMessage(`<${aiName}> ${response}`);
                recordBotMessage(aiName, response, aggressorAI.location);
            }, responseDelayTicks);

            system.runTimeout(() => {
                if (player?.isValid) player.removeTag(PLAYER_TAGS);
                if (aggressorAI?.isValid) aggressorAI.removeTag(AI_TAGS);
            }, 60 * 20);

        } else {

            system.runTimeout(() => {
                if (!aggressorAI?.isValid) return;
                const aiName = aggressorAI.nameTag || "An AI player";
                const response = REFUSE_MESSAGES[Math.floor(Math.random() * REFUSE_MESSAGES.length)];
                world.sendMessage(`<${aiName}> ${response}`);
                recordBotMessage(aiName, response, aggressorAI.location);
            }, responseDelayTicks);
        }
    });

    
}