export const CHAT_SYMPATHY_CONFIG = [
    // SERVER NAME QUESTIONS
    {
        keywords: ["what is ur server name", "server name", "u got a server name", "what server u on", "what server you on bro", "what's the server called", "server ip", "tell me server name", "whats the server"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 10],
                messages: ["why u asking", "none of ur business", "mind ur own server", "not telling u", "why do u need to know", "that's private", "i don't share that info", "u think i'd just tell anyone?"],
                change: { min: -2, max: 0 },
                actions: []
            },
            {
                sympathyRange: [11, 40],
                messages: ["it's a private one", "can't tell u that", "just a small world bro", "why u wanna know", "it's just a friend's server", "nothing special really", "just a small community server", "i keep it low key"],
                change: { min: 0, max: 1 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["it's called Diamond Miners", "server name is Creeper Haven", "just a modded survival world", "it's The Builder's Block", "u can check it out later", "pretty chill server actually", "it's called Crafters United", "we call it Blocktopia", "it's Survival Legacy", "the server is called Elysium"],
                change: { min: 1, max: 3 },
                actions: []
            }
        ]
    },

    // HANG OUT / FRIEND REQUESTS
    {
        keywords: ["wanna hang out", "play with me", "be my friend", "lets chill", "wanna team up", "come with me bro", "friend time", "pals now", "be my buddy", "gonna explore together", "let's play together", "wanna join me", "want to be friends", "can we be friends"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["why tho", "nah dude", "no way", "get lost", "what's in it for me", "seriously", "don't think so", "hard pass", "maybe never", "not interested", "go away", "i'm good alone"],
                change: { min: -5, max: -2 },
                actions: []
            },
            {
                sympathyRange: [1, 50],
                messages: ["hmm okay", "sure i guess", "fine whatever", "alright then", "if u insist", "maybe just for a bit", "i can do that", "yeah sure why not", "ok but don't annoy me", "fine but i'm busy later", "alight let's try it", "why not i'm bored anyway"],
                change: { min: 3, max: 5 },
                actions: [{ type: 'Tame' }],
                probabilityCheck: {
                    baseProbability: 10,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["maybe later", "i'm busy right now", "gotta pass this time", "next time for sure", "can't do it yet", "not today sorry", "maybe another time"],
                    failChange: { min: -2, max: 0 }
                }
            },
            {
                sympathyRange: [51, 100],
                messages: ["i'm coming", "absolutely let's go", "totally", "for sure what we doing", "best idea ever", "u got it buddy", "i'm with u", "yes totally in", "let's do this bro", "heck yes i've been waiting", "of course my friend", "wouldn't miss it for the world", "let's gooo", "finally someone asked"],
                change: { min: 5, max: 8 },
                actions: [{ type: 'Tame' }],
                probabilityCheck: {
                    baseProbability: 60,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["hold on a sec", "just a moment bud", "wait up need a sec", "gimme a minute", "one sec grabbing my gear"],
                    failChange: { min: -1, max: 0 }
                }
            }
        ]
    },

    // THANK YOU - ENGLISH
    {
        keywords: ["thanks bro", "thx bro", "tks bro", "thank you", "ty", "cheers bro", "appreciate it", "much thanks", "thanks man", "thank u so much", "thx a lot"],
        cooldown: { min: 3, max: 10 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["whatever", "np", "just go", "yeah yeah", "don't mention it", "didn't do it for u", "who asked", "u owe me one"],
                change: { min: -1, max: 3 },
                actions: []
            },
            {
                sympathyRange: [1, 50],
                messages: ["ur welcome", "np bro", "no problem", "sure thing", "anything for a friend", "anytime", "u got it", "don't worry about it", "happy to help"],
                change: { min: 2, max: 3 },
                actions: []
            },
            {
                sympathyRange: [51, 100],
                messages: ["my pleasure bro", "glad i could help", "for u anytime", "that's what bros are for", "we are a team right", "no need to thank me man", "always happy to help", "anytime my friend", "u deserve it", "just being a good teammate"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },
    {
        keywords: ["thank you", "thanks", "thanks bro", "thank you (formal)", "thx", "thanks", "many thanks", "thanks bro", "thanks boss"],
        cooldown: { min: 3, max: 10 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["whatever", "no problem", "just go away", "don't care", "whatever man"],
                change: { min: -1, max: 3 },
                actions: []
            },
            {
                sympathyRange: [1, 50],
                messages: ["you're welcome", "no problem", "anytime", "happy to help", "don't mention it"],
                change: { min: 2, max: 3 },
                actions: []
            },
            {
                sympathyRange: [51, 100],
                messages: ["haha no problem bro", "glad i could help", "anytime my friend", "that's what friends are for", "don't even mention it"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },

    // DIAMOND QUESTIONS
    {
        keywords: ["got any diamonds", "u find diamond", "any diamond bro", "where is diamond", "did u find any diamond", "diamonds?", "any diamonds yet", "find any diamonds", "u have diamonds", "diamond location"],
        cooldown: { min: 10, max: 25 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["no for u", "go find ur own", "why u always askin me for stuff", "none of ur business", "stop asking", "even if i did i wouldn't tell u", "mind ur own inventory", "u think i'd just give u diamonds?"],
                change: { min: -1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [1, 40],
                messages: ["nope not yet", "just found some iron tho", "been mining for hours nothing good", "maybe later", "not really bro why", "wish i did", "still looking", "no luck so far", "just a few coal", "found some redstone but no diamonds", "getting close i think"],
                change: { min: 0, max: 2 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["just a few but need them for gear", "i'm searching in deepslate right now", "got like 2 but saving them", "found a few, want to go mining together?", "yeah we can go mining soon", "almost have a full armor set", "just found 8 diamonds actually", "i have some to spare if u need", "found a vein of 5 earlier", "diamonds are rare but i'm getting there", "yep at y -58 is the spot"],
                change: { min: 1, max: 3 },
                actions: []
            }
        ]
    },

    // BOSS FIGHT REQUESTS
    {
        keywords: ["help me kill the dragon", "wanna team up", "need help with the boss", "let's fight the wither", "need a partner", "kill the wither with me", "fight the ender dragon", "help with dragon", "wanna fight the dragon", "help me with wither"],
        cooldown: { min: 10, max: 20 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["nah i'm busy", "maybe later", "u go first i'll wait", "don't feel like it", "find someone else", "not my problem", "i'm not ready for that", "too dangerous for me"],
                change: { min: -1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [1, 50],
                messages: ["sure what r we fighting", "gimme a sec to grab my gear", "ok but u better have potions", "i can help a bit", "already got my sword ready", "i'll try but no promises", "ok but we need good gear", "fine let's do it quick"],
                change: { min: 1, max: 3 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 30,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["no i gotta go", "i have something to do", "next time maybe bro", "can't right now", "maybe later today"],
                    failChange: { min: -2, max: 1 }
                }
            },
            {
                sympathyRange: [51, 100],
                messages: ["hell yea i was just looking for a fight", "easy boss kill incoming", "let's go bro i'm ready", "been preparing for this", "finally someone to fight with", "i've been waiting for this", "let's wreck that dragon", "wither doesn't stand a chance", "time to show what we got"],
                change: { min: 3, max: 5 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 80,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["bro next time ok", "want to but i have something", "not now bro", "maybe in an hour", "gotta prepare first"],
                    failChange: { min: -1, max: 1 }
                }
            }
        ]
    },

    // BUILD REQUESTS
    {
        keywords: ["build something for me", "make something for me", "build sth", "make sth", "show me your building talent", "display your architectural", "build something", "make something", "can u build", "create something", "build a house", "make a base"],
        cooldown: { min: 10, max: 20 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["nah i'm busy", "why should i show u", "don't want to do this man", "build it urself", "not in the mood", "i'm not ur builder", "do it urself", "no thanks"],
                change: { min: -3, max: 1 },
                actions: []
            },
            {
                sympathyRange: [1, 50],
                messages: ["sure i will show u", "ok i'll start", "ok just watch bro", "give me a minute", "i can try", "not my best but ok", "alright but don't expect much", "i'll do something small"],
                change: { min: 1, max: 2 },
                actions: [{ type: 'AddTempTag', value: 'builder', target: 'ai' }],
                probabilityCheck: {
                    baseProbability: 30,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["no i don't have enough blocks", "don't want to do it anyway", "next time okay", "not enough materials", "maybe later"],
                    failChange: { min: -2, max: 1 }
                }
            },
            {
                sympathyRange: [51, 100],
                messages: ["ok let's go", "i'm ready let's do this", "just watch and learn", "u got it bro", "time to show off my skills", "get ready to be impressed", "i'll make something awesome", "u picked the right builder", "let me cook"],
                change: { min: 1, max: 2 },
                actions: [{ type: 'AddTempTag', value: 'builder', target: 'ai' }],
                probabilityCheck: {
                    baseProbability: 80,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["bro next time ok", "want to but i have something", "not now homie", "gotta gather materials first", "maybe tomorrow"],
                    failChange: { min: -1, max: 1 }
                }
            }
        ]
    },
    // WHAT ARE YOU DOING
    {
        keywords: ["what r u doing", "what are you doing", "u r doing something", "what u up to", "what's up", "whatcha doing", "wyd", "what u doing right now"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, -31],
                messages: ["get out of my face", "none of ur business", "don't wanna tell u", "leave me alone", "why do u care", "go away"],
                change: { min: -2, max: 1 },
                actions: []
            },
            {
                sympathyRange: [-30, 0],
                messages: ["can't say", "doesn't matter to u", "who r u man", "why u asking", "nothing important", "just existing"],
                change: { min: 0, max: 3 },
                actions: []
            },
            {
                sympathyRange: [1, 40],
                messages: ["getting something to eat", "nothing much", "mind ur own business man", "just chilling", "taking a break", "looking around", "organizing my chests"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["trying to find diamonds", "nothing much bro", "really nothing bro", "just walking around", "mining some resources", "building a small house", "farming some food", "exploring a cave", "trading with villagers", "enchanting my gear"],
                change: { min: 2, max: 4 },
                actions: []
            }
        ]
    },


    // FOLLOW ME
    {
        keywords: ["follow me", "come with me", "come here", "let's go this way", "come on", "this way", "follow my lead"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["no", "why", "hell no", "not happening", "go away", "i'm not ur dog", "why would i", "no thanks"],
                change: { min: -5, max: -2 },
                actions: []
            },
            {
                sympathyRange: [1, 30],
                messages: ["alright", "okay", "fine", "coming", "sure", "i guess", "if i have to", "whatever"],
                change: { min: 3, max: 5 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 30,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["no", "i have something to do", "next time ok", "can't right now", "maybe later"],
                    failChange: { min: -2, max: 0 }
                }
            },
            {
                sympathyRange: [31, 100],
                messages: ["ok i'm coming", "alright bro", "of course bro", "right behind u", "let's go", "on my way", "lead the way", "i'm with u", "let's roll"],
                change: { min: 5, max: 8 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 80,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["wait a minute bro", "i have something to do bro", "one sec", "hold up"],
                    failChange: { min: 0, max: 0 }
                }
            }
        ]
    },

    // FOLLOW ME - CHINESE (translated)
    {
        keywords: ["跟着我", "跟我来", "跟我走", "过来", "这边"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["why", "no", "why should i", "not happening", "no way"],
                change: { min: -5, max: -2 },
                actions: []
            },
            {
                sympathyRange: [1, 30],
                messages: ["ok", "fine", "alright", "coming", "i guess"],
                change: { min: 3, max: 5 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 30,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["no", "i'm busy", "next time", "can't now"],
                    failChange: { min: -2, max: 0 }
                }
            },
            {
                sympathyRange: [31, 100],
                messages: ["coming", "no problem bro", "of course", "right behind u", "let's go"],
                change: { min: 5, max: 8 },
                actions: [{ type: 'StartTimedFollow' }],
                probabilityCheck: {
                    baseProbability: 80,
                    sympathyBonusPerPoint: 1,
                    failResponse: ["wait a sec bro", "something came up", "give me a minute"],
                    failChange: { min: -1, max: 0 }
                }
            }
        ]
    },

    // STOP FOLLOWING
    {
        keywords: ["stop", "stand down", "stop following", "don't follow", "go away", "leave me alone", "stop following me", "back off"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 100], 
                messages: ["ok", "fine", "as u wish bro", "alright then", "see ya", "got it", "understood", "later", "bye then"],
                change: { min: 1, max: 2 },
                actions: [
                    { type: 'RemoveTag', value: 'follow_player', target: 'ai' },
                    { type: 'RemoveTag', value: 'can_followed', target: 'player' },
                    { type: 'TriggerEvent', value: 'no_follow', target: 'ai' }
                ]
            }
        ]
    },

    // STOP - CHINESE (translated)
    {
        keywords: ["停下", "别跟了", "停止跟随", "别跟着我", "走开"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 100], 
                messages: ["ok", "fine", "alright", "got it", "bye"],
                change: { min: 1, max: 2 },
                actions: [
                    { type: 'RemoveTag', value: 'follow_player', target: 'ai' },
                    { type: 'RemoveTag', value: 'can_followed', target: 'player' },
                    { type: 'TriggerEvent', value: 'no_follow', target: 'ai' }
                ]
            }
        ]
    },

    // WHERE ARE YOU FROM - ENGLISH
    {
        keywords: ["where are you from", "where r u from", "what country u from", "what's ur nationality", "where u live", "what's ur country"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["don't wanna tell u", "do i know u", "why u asking", "none of ur business", "not sharing that", "why does it matter"],
                change: { min: -2, max: 0 },
                actions: []
            },
            {
                sympathyRange: [1, 40],
                messages: ["{countries}", "came from {countries}", "originally from {countries}", "i'm from {countries}", "from {countries}"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["{countries}, beautiful place right?", "from {countries}. what about u", "{countries}, u been there before?", "i'm from {countries}, u?", "{countries} represent", "born and raised in {countries}"],
                change: { min: 2, max: 4 },
                actions: []
            }
        ]
    },
    {
        keywords: ["where are you from", "where do you come from", "your hometown", "where are you from", "which country are you from"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["why u asking", "none of ur business", "who r u", "why does it matter", "not telling u"],
                change: { min: -2, max: 0 },
                actions: []
            },
            {
                sympathyRange: [1, 40],
                messages: ["from {countries}", "i'm from {countries}", "originally {countries}"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["{countries}, what do u think", "from {countries}, u been there?", "i'm from {countries}, u?"],
                change: { min: 2, max: 4 },
                actions: []
            }
        ]
    },

    // HAHA / LAUGHING
    {
        keywords: ["haha", "lol", "lmao", "rofl", "hehe", "xd", "lul", "laughing", "funny"],
        cooldown: { min: 5, max: 10 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["haha what", "r u laughing at me bro", "screw u", "not funny", "what's so funny", "u think that's funny?", "i don't get it"],
                change: { min: -1, max: 1 },
                actions: []
            },
            {
                sympathyRange: [1, 30],
                messages: ["what", "why r u laughing", "what's so funny bro", "i don't get it", "explain the joke", "ok? lol i guess"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [31, 100],
                messages: ["dude what", "what's so funny bro", "haha ok bro", "glad i made u laugh", "lol same", "u crazy lol", "haha u funny", "lmao me too"],
                change: { min: 1, max: 3 },
                actions: []
            }
        ]
    },


    // INSULTS / CURSING - ENGLISH
    {
        keywords: ["fuck you", "f u", "fxxk u", "screw you", "you asshole", "you coward", "you shit", "you bitch", "suck my", "kys", "kill yourself", "ur trash", "you suck"],
        cooldown: { min: 5, max: 10 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["fxxk u too man", "u lost ur mind bro", "ok fxxk u", "whatever dude", "u started it", "back at u", "u wanna go?", "watch ur mouth", "who hurt u"],
                change: { min: -10, max: -5 },
                actions: []
            },
            {
                sympathyRange: [1, 80],
                messages: ["why u cursing at me", "get out my way bro", "not cool bro", "calm down", "what's ur problem", "u good?", "chill out man", "no need for that", "u ok bro?"],
                change: { min: -3, max: 1 },
                actions: []
            },
            {
                sympathyRange: [81, 100],
                messages: ["haha screw u bro", "haha bro u funny", "ok whatever u say", "u good bro?", "lol u mad?", "calm down my guy", "u need a hug?"],
                change: { min: -1, max: 1 },
                actions: []
            }
        ]
    },

    // HELLO / HI
    {
        keywords: ["hello", "hi", "sup", "hiya", "hey", "yo", "greetings", "good day", "howdy", "salutations"],
        cooldown: { min: 3, max: 8 },
        responses: [
            {
                sympathyRange: [-100, 0], 
                messages: ["what's up", "what", "alright", "yeah", "hi i guess", "sup", "hey", "yo"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [1, 20],
                messages: ["hi there", "hi", "hello", "hey", "good to see u", "hey what's up", "hello friend"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [21, 50],
                messages: ["hey bro", "hi bro", "hello friend", "what's good", "yo what's up", "hey buddy", "sup dude"],
                change: { min: 2, max: 3 },
                actions: []
            },
            {
                sympathyRange: [51, 100],
                messages: ["haha hey bro", "u messing with me right bro", "ok bro hello", "hey bestie", "long time no see", "my favorite person", "there u are", "finally u showed up"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },

    // HELLO - CHINESE (translated)
    {
        keywords: ["hello", "hi", "are you there", "hello (dialect)", "hello (formal)", "hey", "good morning", "good evening"],
        cooldown: { min: 3, max: 8 },
        responses: [
            {
                sympathyRange: [-100, 0], 
                messages: ["what's up", "what", "yeah?", "hi", "sup"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [1, 20],
                messages: ["hi", "hello", "hey", "good to see u", "what's up"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [21, 50],
                messages: ["hey bro", "hi bro", "what's good", "hello friend", "sup buddy"],
                change: { min: 2, max: 3 },
                actions: []
            },
            {
                sympathyRange: [51, 100],
                messages: ["what's up bro", "hey bro what's good", "there u are", "finally", "my guy"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },

    // GOODNIGHT
    {
        keywords: ["goodnight", "gn", "night", "sleep well", "bedtime", "good night", "nite", "sweet dreams"],
        cooldown: { min: 3, max: 7 },
        responses: [
            {
                sympathyRange: [-100, 30],
                messages: ["night", "sleep well", "later", "see u tomorrow", "bye", "gn", "take care"],
                change: { min: 0, max: 1 },
                actions: []
            },
            {
                sympathyRange: [31, 100],
                messages: ["goodnight don't let creepers bite", "sweet dreams pro builder", "gn gn see u next time", "night bro sleep well", "rest up for tomorrow", "sleep tight", "dream of diamonds", "see u in the morning"],
                change: { min: 1, max: 3 },
                actions: []
            }
        ]
    },

    // COMPLIMENTS - ENGLISH
    {
        keywords: ["u r good", "you are good", "ur great", "u r the best", "you're awesome", "you're cool", "u a pro", "u r amazing", "nice one bro", "awesome job", "great work", "nice build", "well done", "good job", "u killed it", "impressive"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 10],
                messages: ["i know", "stop talking nonsense", "not true", "nah u better", "shut up", "whatever", "don't flatter me", "u lying"],
                change: { min: -1, max: 4 },
                actions: []
            },
            {
                sympathyRange: [11, 40],
                messages: ["thanks bro", "u think so", "just a bit of luck", "i try my best", "u too man", "appreciate it", "that means a lot", "i do what i can"],
                change: { min: 2, max: 4 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["haha thanks bro u flatter me", "i learn from the best (u)", "stop it u make me blush", "yeah i'm a pro miner lol", "thanks for noticing it means a lot", "we are a good team that's why", "u r much better at fighting tho", "right back at u bro", "u made my day", "i try my best"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },

    // HOW ARE YOU - ENGLISH
    {
        keywords: ["how are you", "how r u", "how u doin", "how's it going", "u ok bro", "you good", "how's life", "all good", "whats up", "how's everything", "how u feeling", "u alright"],
        cooldown: { min: 5, max: 15 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["none of ur business", "i was fine until u showed up", "why do u care", "just leave me alone man", "piss off", "not great", "been better", "u really wanna know?"],
                change: { min: -1, max: 3 },
                actions: []
            },
            {
                sympathyRange: [1, 30],
                messages: ["i'm ok u", "same old same old", "just trying to survive the night", "not bad what about u", "i'm alright kinda tired tho", "could be worse", "living the dream", "just chillin"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [31, 70],
                messages: ["i'm pretty good thanks for asking", "chilling just finished a long day of mining", "doing well but my back hurts from all the digging", "great just waiting for the weekend", "i'm good life outside minecraft is kinda busy tho", "can't complain", "everything's good", "just taking it easy"],
                change: { min: 2, max: 4 },
                actions: []
            },
            {
                sympathyRange: [71, 100],
                messages: ["i'm great how about my best bro", "awesome just hanging out waiting for u to join", "life's good man classes are finally over", "doing really well my new gaming chair arrived today", "i'm fantastic always better when talking to u", "busy with school/work but always time for minecraft", "never been better", "on top of the world", "living my best life"],
                change: { min: 4, max: 6 },
                actions: []
            }
        ]
    },

    // ENCHANTMENT QUESTIONS
    {
        keywords: ["what enchant u got", "what enchantments u got", "best enchant", "what enchant should i get", "max level enchant", "what enchantment level", "enchant my tool", "best enchantments", "what enchants", "enchantment advice"],
        cooldown: { min: 10, max: 20 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["don't care about enchants", "none of ur business", "go search the wiki", "why u asking me", "just put mending on it", "figure it out urself", "not my problem"],
                change: { min: -1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [1, 40],
                messages: ["only got unbreaking III on my pick", "mending is a must-have", "need to find a villager for trades first", "running out of lapis", "depends on what tool u want to enchant", "i'm still learning too", "mending and unbreaking are solid"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [41, 100],
                messages: ["my sword has sharpness V mending and unbreaking III", "u should always aim for mending first for tools", "for a pickaxe go for efficiency V and fortune III that's max level", "using protection IV on my armor", "need a full book setup to get the best enchants", "can lend u my fortune pick if u need diamonds", "definitely get feather falling IV for boots", "sharpness V is a game changer", "looting III for mob farming is great"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    },

    // BRO / DUDE (Casual address)
    {
        keywords: ["bro", "man", "dude", "hey bro", "yo man", "sup dude", "yo", "hey there", "brother", "buddy", "bruh", "brah"],
        cooldown: { min: 3, max: 8 },
        responses: [
            {
                sympathyRange: [-100, 0],
                messages: ["what", "speak up", "u wanna fight", "i'm busy what is it", "don't call me that", "what do u want", "not now"],
                change: { min: -1, max: 4 },
                actions: []
            },
            {
                sympathyRange: [1, 30],
                messages: ["hey", "yeah bro", "what's up", "what do u need", "u alright", "sup", "yo"],
                change: { min: 1, max: 2 },
                actions: []
            },
            {
                sympathyRange: [31, 70],
                messages: ["yo bro what's good", "sup man u need something", "yeah dude what's going on", "what's up bro come here", "hey man been a while", "what's cracking", "how's it going"],
                change: { min: 2, max: 3 },
                actions: []
            },
            {
                sympathyRange: [71, 100],
                messages: ["haha what's up my guy", "my best bro what is it", "yo u sound excited what's the news", "what's cooking man wanna join my farm", "yeah bro i got a gift for u", "my dude! what's happening", "there's my favorite person"],
                change: { min: 3, max: 5 },
                actions: []
            }
        ]
    }
];

export const VOCABULARY = {
    colors: ["red", "blue", "green", "yellow", "purple", "orange", "black", "white", "pink", "brown", "cyan", "lime", "magenta", "gray", "light blue", "dark green"],
    foods: ["pizza", "burger", "sushi", "noodles", "rice", "salad", "roast", "hot pot", "tacos", "pasta", "fried chicken", "ice cream", "steak", "sandwich", "burrito"],
    emotions: ["happy", "sad", "excited", "calm", "angry", "surprised", "fearful", "hopeful", "anxious", "grateful", "lonely", "content", "stressed", "relaxed", "energetic"],
    activities: ["mining", "building", "farming", "exploring", "fighting", "trading", "fishing", "crafting", "enchanting", "breeding", "hunting", "decorating", "redstoning"],
    countries: ["USA", "Canada", "UK", "Australia", "Germany", "France", "Japan", "South Korea", "Brazil", "Mexico", "India", "China", "Russia", "Italy", "Spain", "Netherlands", "Sweden", "Norway", "Poland", "Turkey", "Vietnam", "Thailand", "Philippines", "Argentina", "South Africa"]
};