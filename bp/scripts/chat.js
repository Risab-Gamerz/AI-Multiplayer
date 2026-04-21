import { world, system } from "@minecraft/server";
import { CHAT_SYMPATHY_CONFIG, VOCABULARY } from './database/chat_config.js';

// Global index object, populated during system initialization
const keywordIndex = {
   
    trieRoot: { children: {}, configId: null },
    
    invertedIndex: new Map(),
    
    configMap: new Map()
};

let nextConfigId = 1;

const ai_player_id = "rg:bot";
const COOLDOWN_KEY = "sympathy_cooldown_until";
const SYMPATHY_BASE_KEY = "sympathy_player_";
const INTERACTION_RANGE = 96; 
const COUNTRY_KEY = "ai_home_country";

const COOLDOWN_CONFIG = {
    default: { min: 10, max: 30 },
    perConversation: true 
};

const MOVEMENT_LOCK_CONFIG = {
    enabled: true,
    lockEvent: "lock_movement", 
    unlockEvent: "unlock_movement"
};

function buildKeywordIndex(config) {
    keywordIndex.trieRoot = { children: {}, configId: null };
    keywordIndex.invertedIndex.clear();
    keywordIndex.configMap.clear();
    nextConfigId = 1;

    for (const configItem of config) {
        // 1. Add unique ID to config and store in Map
        const configId = nextConfigId++;
        const itemWithId = { ...configItem, id: configId };
        keywordIndex.configMap.set(configId, itemWithId);

        for (const keyword of configItem.keywords) {
            const normalizedKeyword = keyword.toLowerCase().trim();
            if (normalizedKeyword.length === 0) continue; // Skip empty keywords

            // --- A. Build Trie tree (for exact and prefix matching) ---
            let node = keywordIndex.trieRoot;
            for (const char of normalizedKeyword) {
                if (!node.children[char]) {
                    node.children[char] = { children: {}, configId: null };
                }
                node = node.children[char];
            }
            // Mark end of path as current config ID
            node.configId = configId;

            // --- B. Build inverted index (for keyword locating) ---
            let tokens;
            
            // Smart Tokenization logic:
            if (/\s/.test(normalizedKeyword)) {
                // If contains spaces, usually English/Pinyin, split by spaces into words
                tokens = normalizedKeyword.split(/\s+/).filter(t => t.length > 0);
            } else {
                // If no spaces, usually Chinese phrase, split by individual characters
                // This way when user inputs certain characters, it can match longer phrases
                tokens = normalizedKeyword.split('');
            }
            
            for (const token of tokens) {
                if (!keywordIndex.invertedIndex.has(token)) {
                    keywordIndex.invertedIndex.set(token, new Set());
                }
                // Use Set to ensure each config is added only once
                keywordIndex.invertedIndex.get(token).add(itemWithId);
            }
        }
    }
}



function getCooldownKey(conversationId = 'global') {
    return `${COOLDOWN_KEY}_${conversationId}`;
}

function calculateCooldownDuration(cooldownConfig) {
    if (!cooldownConfig) {
        cooldownConfig = COOLDOWN_CONFIG.default;
    }
    const min = cooldownConfig.min || COOLDOWN_CONFIG.default.min;
    const max = cooldownConfig.max || COOLDOWN_CONFIG.default.max;
    return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

const MIN_FOLLOW_DURATION_SECONDS = 30;
const MAX_FOLLOW_DURATION_SECONDS = 60;
const FOLLOW_LEAVE_MESSAGES = ["alright i gotta go", "c u around bro", "see u later bro", "look i gotta go", "bye bro"];

const COUNTRIES = ["china", "jp", "usa", "uk", "france", "ger", "brazil", "india", "rus", "aus"];

function startAiCountry(ai) {
    if (!ai.getDynamicProperty(COUNTRY_KEY)) {
        const randomCountry = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        ai.setDynamicProperty(COUNTRY_KEY, randomCountry);
    }
}

function replaceVocabularyPlaceholders(message, ai = null) {
    return message.replace(/\{(\w+)\}/g, (match, vocabKey) => {
     
        if (vocabKey === 'countries' && ai && ai.isValid) {
            const aiCountry = ai.getDynamicProperty(COUNTRY_KEY);
            if (aiCountry) {
                return aiCountry;
            }
        }
        const vocabArray = VOCABULARY[vocabKey];
        if (vocabArray && vocabArray.length > 0) {
            return vocabArray[Math.floor(Math.random() * vocabArray.length)];
        }
        return match; 
    });
}


function triggerFactionalEvent(ai, baseEventName) {
    if (!ai?.isValid) return;

    if (ai.hasTag("good")) {
        ai.triggerEvent(`rg:good_${baseEventName}`);
    } else if (ai.hasTag("bad")) {
        ai.triggerEvent(`rg:bad_${baseEventName}`);
    } else if (ai.hasTag("crazy")) {
        ai.triggerEvent(`rg:crazy_${baseEventName}`);
    } else {
        
        ai.triggerEvent(`rg:${baseEventName}`);
    }
}


function calculateRandomChange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function calculateProbabilityCheck(baseProbability, sympathyBonusPerPoint, currentSympathy, threshold) {
 
    const successProbability = baseProbability + 
        Math.max(0, currentSympathy - threshold) * sympathyBonusPerPoint;
    
    const finalProbability = Math.min(100, Math.max(0, successProbability));
    
    const randomValue = Math.random() * 100;
    return {
        success: randomValue <= finalProbability,
        probability: finalProbability,
        randomValue: randomValue
    };
}

const WEIGHTS = {
    LEVENSHTEIN: 0.5,   // Edit distance (lower is better, convert to score)
    NGRAM: 0.3,         // N-Gram similarity
    JACCARD: 0.2        // Jaccard similarity
};
const LEVENSHTEIN_THRESHOLD = 3; // Beyond this distance, weight drops sharply

/**
 * Find exact match (Trie tree)
 */
function findExactMatch(message) {
    let node = keywordIndex.trieRoot;
    for (const char of message) {
        if (!node.children[char]) return null;
        node = node.children[char];
    }
    return node.configId ? keywordIndex.configMap.get(node.configId) : null;
}


/**
 * Optimized core matching function (weight + pruning)
 */
function findBestMatchConfigOptimized(message) {
    const normalizedMessage = message.toLowerCase().trim();

    // 1. A. Exact match (Trie tree): Highest priority, fastest
    const exactMatch = findExactMatch(normalizedMessage);
    if (exactMatch) {
        return { config: exactMatch, method: "exact (Trie)" };
    }

    // 1. B. Pruning (inverted index): Generate candidate list
    const tokenize = (s) => /\s/.test(s) ? s.split(/\s+/) : s.split('');
    const messageTokens = tokenize(normalizedMessage).filter(t => t.length > 0);
    const candidateSet = new Set();
    
    // Aggregate all configs containing any word from the message
    for (const token of messageTokens) {
        if (keywordIndex.invertedIndex.has(token)) {
            keywordIndex.invertedIndex.get(token).forEach(config => candidateSet.add(config));
        }
    }

    // If no candidates, return null directly
    if (candidateSet.size === 0) return null;

    // 2. Weighted scoring for candidates list
    let bestScore = -1;
    let bestConfig = null;
    let bestKeyword = "";
    let bestIndividualScores = { levenshtein: 0, nGram: 0, jaccard: 0 }; 
    
    // Iterate through candidate configs
    for (const config of candidateSet) {
        for (const keyword of config.keywords) {
            const normalizedKeyword = keyword.toLowerCase();

            // Similarity calculation
            const dist = levenshtein(normalizedMessage, normalizedKeyword);
            const nGramSim = nGramSimilarity(normalizedMessage, normalizedKeyword, 2);
            const jaccardSim = jaccardSimilarity(normalizedMessage, normalizedKeyword);
            
            // Convert Levenshtein distance to score (lower is better -> higher is better)
            // Closer distance means higher score. Beyond threshold, score quickly goes to zero.
            const levenshteinScore = dist <= LEVENSHTEIN_THRESHOLD 
                ? (1 - (dist / Math.max(normalizedMessage.length, normalizedKeyword.length, 1))) 
                : 0; 
                
            // Comprehensive weighted score
            // Comprehensive weighted score
            const score = (WEIGHTS.LEVENSHTEIN * levenshteinScore) +
                          (WEIGHTS.NGRAM * nGramSim) +
                          (WEIGHTS.JACCARD * jaccardSim);

            if (score > bestScore) {
                bestScore = score;
                bestConfig = config;
                bestKeyword = keyword;
                // Key change: Record original scores for the highest weighted score
                bestIndividualScores.levenshtein = levenshteinScore;
                bestIndividualScores.nGram = nGramSim;
                bestIndividualScores.jaccard = jaccardSim;
            }
        }
    }
    
    // 3. Final decision: Set a minimum score threshold to avoid matching unrelated configs
        // 3. Final decision: Hybrid decision logic
    
    const MIN_SCORE_THRESHOLD = 0.33; // Minimum requirement for weighted total score (adjustable)
    // [New Threshold] Extremely high confidence threshold for any single algorithm (adjustable, recommended 0.8+)
    const CONFIDENT_SCORE_THRESHOLD = 0.8; 
    
    // If no matches found (theoretically won't happen, but just in case)
    if (!bestConfig) return null;

    // Find the highest score among the three algorithms of the best match (for 'confidence' judgment)
    const maxIndividualScore = Math.max(
        bestIndividualScores.levenshtein,
        bestIndividualScores.nGram,
        bestIndividualScores.jaccard
    );

    // Core matching logic:
    // 1. Through weighted total score (requires strong overall strength)
    // OR
    // 2. Through confidence (requires any algorithm to score very high, covering old single-algorithm champion scenarios)
    if (bestScore >= MIN_SCORE_THRESHOLD || maxIndividualScore >= CONFIDENT_SCORE_THRESHOLD) {
        
        // Decide which method explanation to return (for debugging convenience)
        let method = `weighted_score (${bestScore.toFixed(2)} based on: ${bestKeyword})`;
        if (maxIndividualScore >= CONFIDENT_SCORE_THRESHOLD && bestScore < MIN_SCORE_THRESHOLD) {
             method = `individual_score (${maxIndividualScore.toFixed(2)} based on: ${bestKeyword})`;
        }

        return { config: bestConfig, method: method };
    }

    // If both thresholds are not met, return null
    return null;
} // Function end


function executeAiActions(ai, actions, player) {
    const SEARCH_RANGE = 16; 
    
    for (const action of actions) {

        let targetEntity = ai; 
        if (action.target === 'player') {
            targetEntity = player;
        }
        
        switch (action.type) {
            case 'AddTag':
            case 'RemoveTag':
                if (targetEntity && targetEntity.isValid) {
                 
                    targetEntity[action.type === 'AddTag' ? 'addTag' : 'removeTag'](action.value);
                }
                break;
                
            case 'RunCommand':
                const command = action.value.replace(/@s/g, `@e[id="${ai.id}"]`);
                try {
                    ai.dimension.runCommand(command);
                } catch (e) {
                    console.error(`Failed to run command: ${command}. Error: ${e}`);
                }
                break;
                
                case 'Tame':
                if (ai.isValid && player.isValid) {
                    try {
                        const tameable = ai.getComponent('minecraft:tameable');
                        if (tameable && !tameable.isTamed) {
                            const isTamed = tameable.tame(player);
                        } else {
                            
                        }
                    } catch (e) {
                        console.error(`Failed to execute Tame action for AI ${ai.id}. Error: ${e}`);
                    }
                }
                break;
                
                case 'AddTempTag': 
                targetEntity.addTag(action.value);
                
                system.runTimeout(() => {
                    if (targetEntity.isValid) {
                        targetEntity.removeTag(action.value);
                    }
                }, 20);
                break;
                
                case 'TriggerEvent': 

                 if (targetEntity && targetEntity.isValid) {

                    triggerFactionalEvent(targetEntity, action.value);
                 }
                break;
                
                        case 'StartTimedFollow':
                if (!ai.isValid || !player.isValid) return;

                const sympathyKey = SYMPATHY_BASE_KEY + player.id;
                const sympathy = ai.getDynamicProperty(sympathyKey) ?? 0;

                if (sympathy >= 80) {
                    ai.addTag('follow_player');
                    player.addTag('can_followed');
                    triggerFactionalEvent(ai, "follow");
                    
                } else {
    
                    const baseDurationSeconds = 60;
      
                    const sympathyBonusSeconds = Math.max(0, sympathy) * 5;
                    const totalFollowDurationSeconds = baseDurationSeconds + sympathyBonusSeconds;
                    const totalFollowDurationTicks = Math.floor(totalFollowDurationSeconds * 20);

                    ai.addTag('follow_player');
                    player.addTag('can_followed');
                    triggerFactionalEvent(ai, "follow");

    
                    system.runTimeout(() => {
                        if (player?.isValid) player.removeTag('can_followed');
                        if (ai?.isValid) {
                            ai.removeTag('follow_player');
                            triggerFactionalEvent(ai, "no_follow");
                            
                            const response = FOLLOW_LEAVE_MESSAGES[Math.floor(Math.random() * FOLLOW_LEAVE_MESSAGES.length)];
                            const aiName = ai.nameTag || ai_player_id;
                            
                            system.runTimeout(() => {
                               if (!ai?.isValid) return;
                               world.sendMessage(`<${aiName}> ${response}`);
                            }, 40); 
                        }
                    }, totalFollowDurationTicks);
                }
                break;
        }
    }
}


function findMatchingResponse(sympathy, responseConfigs) {
    return responseConfigs.find(config => 
        sympathy >= config.sympathyRange[0] && sympathy <= config.sympathyRange[1]
    );
}

function levenshtein(a, b) {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) {
        tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
        tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[a.length][b.length];
}


function nGrams(str, n = 2) {
    const result = [];
    for (let i = 0; i < str.length - n + 1; i++) {
        result.push(str.slice(i, i + n));
    }
    return result;
}

function nGramSimilarity(str1, str2, n = 2) {
    const ngrams1 = nGrams(str1, n);
    const ngrams2 = nGrams(str2, n);
    
    const intersection = ngrams1.filter(ngram => ngrams2.includes(ngram));
    return intersection.length / Math.max(ngrams1.length, ngrams2.length);
}

function jaccardSimilarity(str1, str2) {
    // If string has no spaces, split by characters; otherwise split by spaces
    const tokenize = (s) => /\s/.test(s) ? s.split(/\s+/) : s.split('');

    const set1 = new Set(tokenize(str1)); 
    const set2 = new Set(tokenize(str2));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // Avoid division by zero
    return union.size === 0 ? 0 : intersection.size / union.size;
}

function longestCommonSubstring(str1, str2) {
    const dp = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
    let maxLength = 0;
    let endIndex = -1;

    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxLength) {
                    maxLength = dp[i][j];
                    endIndex = i - 1;
                }
            }
        }
    }

    return str1.slice(endIndex - maxLength + 1, endIndex + 1);
}

function hammingDistance(str1, str2) {
    if (str1.length !== str2.length) {
        throw new Error("Strings must be of the same length");
    }

    let distance = 0;
    for (let i = 0; i < str1.length; i++) {
        if (str1[i] !== str2[i]) {
            distance++;
        }
    }

    return distance;
}

function findBestMatchConfig(message) {
    let matchedConfig = null;

    
    matchedConfig = CHAT_SYMPATHY_CONFIG.find(config => 
        config.keywords.some(keyword => 
            message === keyword || 
            message.startsWith(keyword + " ") || 
            message.endsWith(" " + keyword) ||
            message.includes(" " + keyword + " ")
        )
    );
    if (matchedConfig) return { config: matchedConfig, method: "exact" };

    
    let bestLevenshtein = { distance: Infinity, config: null };
    for (const config of CHAT_SYMPATHY_CONFIG) {
        for (const keyword of config.keywords) {
            const distance = levenshtein(message, keyword);
            if (distance < bestLevenshtein.distance && distance <= 3) {
                bestLevenshtein = { distance, config };
            }
        }
    }
    if (bestLevenshtein.config) return { config: bestLevenshtein.config, method: "levenshtein" };

    
    let bestNGram = { similarity: 0, config: null };
    for (const config of CHAT_SYMPATHY_CONFIG) {
        for (const keyword of config.keywords) {
            const similarity = nGramSimilarity(message, keyword, 2);
            if (similarity > bestNGram.similarity && similarity >= 0.5) {
                bestNGram = { similarity, config };
            }
        }
    }
    if (bestNGram.config) return { config: bestNGram.config, method: "ngram" };

    
    let bestJaccard = { similarity: 0, config: null };
    for (const config of CHAT_SYMPATHY_CONFIG) {
        for (const keyword of config.keywords) {
            const similarity = jaccardSimilarity(message, keyword);
            if (similarity > bestJaccard.similarity && similarity >= 0.5) {
                bestJaccard = { similarity, config };
            }
        }
    }
    if (bestJaccard.config) return { config: bestJaccard.config, method: "jaccard" };

    
    let bestLCS = { length: 0, config: null };
    for (const config of CHAT_SYMPATHY_CONFIG) {
        for (const keyword of config.keywords) {
            const lcs = longestCommonSubstring(message, keyword);
            if (lcs.length > bestLCS.length && lcs.length >= 3) {
                bestLCS = { length: lcs.length, config };
            }
        }
    }
    if (bestLCS.config) return { config: bestLCS.config, method: "lcs" };

    
    let bestHamming = { distance: Infinity, config: null };
    for (const config of CHAT_SYMPATHY_CONFIG) {
        for (const keyword of config.keywords) {
            
            if (message.length === keyword.length) {
                try {
                    const distance = hammingDistance(message, keyword);
                    if (distance < bestHamming.distance && distance <= 2) {
                        bestHamming = { distance, config };
                    }
                } catch (e) {
                    
                }
            }
        }
    }
    if (bestHamming.config) return { config: bestHamming.config, method: "hamming" };

    return null;
}



export function startSympathySystem() {
    buildKeywordIndex(CHAT_SYMPATHY_CONFIG);
    world.afterEvents.chatSend.subscribe(event => {
        
        const player = event.sender;
        const message = event.message.toLowerCase();

        const aiEntities = player.dimension.getEntities({
            type: ai_player_id,
            location: player.location,
            maxDistance: INTERACTION_RANGE
        });

        if (aiEntities.length === 0) return;
        
        const matchResult = findBestMatchConfigOptimized(message);
        if (!matchResult) return;

        const { config: matchedConfig, method: matchMethod } = matchResult;

        for (const ai of aiEntities) {
            
            if (!ai.isValid) continue;

            if (ai.getDynamicProperty("rg:current_target")) continue; 
             
            startAiCountry(ai);

            const sympathyKey = SYMPATHY_BASE_KEY + player.id;
            let sympathy = ai.getDynamicProperty(sympathyKey);
            if (sympathy === undefined) {
                sympathy = Math.floor(Math.random() * 51) - 30;
                ai.setDynamicProperty(sympathyKey, sympathy);
            }

            const conversationCooldownKey = getCooldownKey(matchedConfig.keywords[0]);
            const cooldownUntil = ai.getDynamicProperty(conversationCooldownKey);
            if (cooldownUntil && Date.now() < cooldownUntil) return;

            let responseConfig = matchedConfig.responses.find(resp => 
                sympathy >= resp.sympathyRange[0] && sympathy <= resp.sympathyRange[1]
            );

            if (!responseConfig) {
                responseConfig = matchedConfig.responses[0];
            }

            let changeRange = responseConfig.change;
            let responseList = responseConfig.messages;
            let shouldExecuteActions = true;

            if (responseConfig.probabilityCheck) {
                const probCheck = calculateProbabilityCheck(
                    responseConfig.probabilityCheck.baseProbability,
                    responseConfig.probabilityCheck.sympathyBonusPerPoint,
                    sympathy,
                    responseConfig.sympathyRange[0]
                );
                
                if (probCheck.success) {
                } else {
        responseList = responseConfig.probabilityCheck.failResponse;
                    changeRange = responseConfig.probabilityCheck.failChange;
                    shouldExecuteActions = false;
                }
            }

            if (shouldExecuteActions && responseConfig.actions) {
                executeAiActions(ai, responseConfig.actions, player);
            }

            const changeValue = calculateRandomChange(changeRange.min, changeRange.max);

            sympathy = Math.min(100, Math.max(-100, sympathy + changeValue));
            ai.setDynamicProperty(sympathyKey, sympathy);

            const cooldownDurationMs = calculateCooldownDuration(matchedConfig.cooldown);
            ai.setDynamicProperty(conversationCooldownKey, Date.now() + cooldownDurationMs);

            const responseDelayTicks = Math.floor(Math.random() * 60) + 60;

            if (MOVEMENT_LOCK_CONFIG.enabled) {
ai.triggerEvent(MOVEMENT_LOCK_CONFIG.lockEvent);
            }

            system.runTimeout(() => {
                if (!ai.isValid) {
                    console.warn("AI entity is invalid, skip reply");
                    return;
                }

                const aiName = ai.nameTag || ai_player_id;
                const rawResponse = responseList[Math.floor(Math.random() * responseList.length)];
                
                const finalResponse = replaceVocabularyPlaceholders(rawResponse, ai);

                world.sendMessage(`<${aiName}> ${finalResponse}`);

                if (MOVEMENT_LOCK_CONFIG.enabled) {
                    ai.triggerEvent(MOVEMENT_LOCK_CONFIG.unlockEvent);
                }

            }, responseDelayTicks);

            break;
        }
    });
}