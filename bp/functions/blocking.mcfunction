scoreboard players remove @e[scores={cooldown=1..}] cooldown 1
scoreboard players add @e[tag=blocking] blocking 1
effect @e[tag=blocking,tag=lv1,scores={blocking=..40}] slowness 1 1 true
effect @e[tag=blocking,tag=lv2,scores={blocking=..45}] slowness 1 1 true
effect @e[tag=blocking,tag=lv3,scores={blocking=..50}] slowness 1 1 true
effect @e[tag=blocking,tag=lv4,scores={blocking=..55}] slowness 1 1 true
effect @e[tag=blocking,tag=lv5,scores={blocking=..60}] slowness 1 1 true
effect @e[tag=blocking,tag=lv6,scores={blocking=..65}] slowness 1 1 true
tag @e[scores={cooldown=..0}] add can_block
tag @e[scores={cooldown=1..}] remove can_block
event entity @e[scores={blocking=65..},tag=lv2] lv2_quit_shield
event entity @e[scores={blocking=70..},tag=lv3] lv3_quit_shield
event entity @e[scores={blocking=75..},tag=lv4] lv4_quit_shield
event entity @e[scores={blocking=80..},tag=lv5] lv5_quit_shield
event entity @e[scores={blocking=85..},tag=lv6] lv6_quit_shield
tag @e[scores={blocking=60..},tag=lv1] remove blocking
event entity @e[scores={blocking=60..},tag=lv1] quit_block_ani
scoreboard players set @e[scores={blocking=60..},tag=lv1] blocking 0
tag @e[scores={blocking=65..},tag=lv2] remove blocking
event entity @e[scores={blocking=65..},tag=lv2] quit_block_ani
scoreboard players set @e[scores={blocking=65..},tag=lv2] blocking 0
tag @e[scores={blocking=70..},tag=lv3] remove blocking
event entity @e[scores={blocking=70..},tag=lv3] quit_block_ani
scoreboard players set @e[scores={blocking=70..},tag=lv3] blocking 0
tag @e[scores={blocking=75..},tag=lv4] remove blocking
event entity @e[scores={blocking=75..},tag=lv4] quit_block_ani
scoreboard players set @e[scores={blocking=75..},tag=lv4] blocking 0
tag @e[scores={blocking=80..},tag=lv5] remove blocking
event entity @e[scores={blocking=80..},tag=lv5] quit_block_ani
scoreboard players set @e[scores={blocking=80..},tag=lv5] blocking 0
tag @e[scores={blocking=85..},tag=lv6] remove blocking
event entity @e[scores={blocking=85..},tag=lv6] quit_block_ani
scoreboard players set @e[scores={blocking=85..},tag=lv6] blocking 0