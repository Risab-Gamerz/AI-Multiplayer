scoreboard objectives add wiki:world dummy
scoreboard players add .Initialised wiki:world 0
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add rdmitem dummy rdmitem
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add rdmitemtick dummy rdmitemtick
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add item dummy item
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add response dummy response
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add select dummy select
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add FoodTransfer dummy FoodTransfer
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add PROGRESSION_PROPERTY dummy PROGRESSION_PROPERTY
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add cooldown dummy cooldown
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add blocking dummy blocking
execute if score .Initialised wiki:world matches 0 run scoreboard objectives add sympathy_set dummy sympathy_set
execute if score .Initialised wiki:world matches 0 run gamerule commandblockoutput false
scoreboard players set .Initialised wiki:world 1
playanimation @e[type=rg:bot,tag=is_greeting_sneaking] animation.humanoid.sneakingb