tag @s add blocking
tag @s remove can_block
scoreboard players random @s[tag=!can_block,tag=lv1] cooldown 240 300
scoreboard players random @s[tag=!can_block,tag=lv2] cooldown 240 300
scoreboard players random @s[tag=!can_block,tag=lv3] cooldown 210 270
scoreboard players random @s[tag=!can_block,tag=lv4] cooldown 190 250
scoreboard players random @s[tag=!can_block,tag=lv5] cooldown 170 220
scoreboard players random @s[tag=!can_block,tag=lv6] cooldown 150 200
event entity @s block_ani
event entity @s[tag=lv2] lv2_on_shield
event entity @s[tag=lv3] lv3_on_shield
event entity @s[tag=lv4] lv4_on_shield
event entity @s[tag=lv5] lv5_on_shield
event entity @s[tag=lv6] lv6_on_shield