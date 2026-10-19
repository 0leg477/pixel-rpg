package com.pixelrpg.engine.turn

import kotlinx.serialization.Serializable

/** Что в целом пытается сделать герой. От этого зависит, какую механику включит движок. */
@Serializable
enum class ActionType {
    MOVE, LOOK, TALK, ATTACK, USE, TAKE, DROP, EQUIP, GIVE, TRADE, REST, WAIT, SEARCH, EXPLORE, SNEAK, CRAFT, OTHER;

    companion object {
        fun parse(s: String): ActionType = entries.firstOrNull { it.name.equals(s.trim(), ignoreCase = true) } ?: OTHER
    }
}

@Serializable
enum class EffectType {
    HERO_RESOURCE,
    HERO_CONDITION,
    REMOVE_CONDITION,
    GAIN_ITEM,
    LOSE_ITEM,
    TAKE_ITEM,
    GIVE_ITEM,
    BUY,
    SELL,
    MONEY,
    NPC_ATTITUDE,
    NPC_MEMORY,
    NPC_HOSTILE,
    NPC_CALM,
    NPC_LEAVE,
    NPC_REVEAL,
    SPAWN_NPC,
    DISCOVER_PLACE,
    REVEAL_EXIT,
    LORE,
    QUEST_ADD,
    QUEST_UPDATE,
    FACTION,
    FAME,
    TIME,
    FEATURE,
    ;

    companion object {
        fun parse(s: String): EffectType? = entries.firstOrNull { it.name.equals(s.trim(), ignoreCase = true) }
    }
}

/**
 * Одно последствие, предложенное мастером (ИИ). Движок проверяет и ограничивает каждое.
 * Значение полей зависит от [type]; неиспользуемые поля остаются пустыми.
 */
@Serializable
data class EffectSpec(
    val type: String,
    val target: String = "",
    val npcId: String = "",
    val amount: Int = 0,
    val name: String = "",
    val text: String = "",
    val tags: List<String> = emptyList(),
    val slot: String = "none",
    val power: Int = 0,
)

/**
 * Решение мастера по заявке игрока: что это за действие и какие ставки на каждый исход.
 * Ставки объявляются ДО броска, а движок применяет ровно одну ветку — поэтому
 * рассказчик потом описывает уже случившееся и не может «додумать» лишнего.
 */
@Serializable
data class Adjudication(
    val action: String,
    val summary: String,
    val feasible: Boolean = true,
    val refusal: String = "",
    val needsRoll: Boolean = false,
    val skillId: String = "",
    val attributeId: String = "",
    val difficulty: String = "normal",
    val tags: List<String> = emptyList(),
    val targetNpcId: String = "",
    val itemIds: List<String> = emptyList(),
    val exitId: String = "",
    val minutes: Int = 5,
    val speech: String = "",
    val always: List<EffectSpec> = emptyList(),
    val success: List<EffectSpec> = emptyList(),
    val partial: List<EffectSpec> = emptyList(),
    val failure: List<EffectSpec> = emptyList(),
) {
    val actionType: ActionType get() = ActionType.parse(action)
}
