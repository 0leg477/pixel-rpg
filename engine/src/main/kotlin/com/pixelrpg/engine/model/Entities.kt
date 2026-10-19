package com.pixelrpg.engine.model

import kotlinx.serialization.Serializable

@Serializable
data class Pool(var current: Int, var max: Int) {
    fun change(delta: Int): Int {
        val before = current
        current = (current + delta).coerceIn(0, max)
        return current - before
    }
}

@Serializable
data class SkillProgress(var rank: Int = 0, var xp: Int = 0)

@Serializable
data class ActiveCondition(
    val id: String,
    /** Минута игрового времени, когда состояние спадёт; null — бессрочно. */
    var until: Long? = null,
)

@Serializable
data class Trait(
    val name: String,
    val description: String,
    /** Бонус к проверкам с этими тегами (может быть отрицательным). */
    val modifier: Int = 0,
    val tags: List<String> = emptyList(),
)

@Serializable
enum class ItemSlot { WEAPON, ARMOR, TRINKET, NONE }

@Serializable
data class Item(
    val id: String,
    var name: String,
    var description: String = "",
    val tags: List<String> = emptyList(),
    var quantity: Int = 1,
    /** Цена в валюте мира. */
    var value: Int = 1,
    /** 0 обычный … 4 легендарный. */
    val rarity: Int = 0,
    val slot: ItemSlot = ItemSlot.NONE,
    /** Урон оружия или защита брони. */
    val power: Int = 0,
    var equipped: Boolean = false,
)

@Serializable
data class Hero(
    var name: String,
    var concept: String,
    var background: String = "",
    var appearance: String = "",
    val attributes: MutableMap<String, Int> = mutableMapOf(),
    val skills: MutableMap<String, SkillProgress> = mutableMapOf(),
    val resources: MutableMap<String, Pool> = mutableMapOf(),
    val conditions: MutableList<ActiveCondition> = mutableListOf(),
    val inventory: MutableList<Item> = mutableListOf(),
    var money: Int = 0,
    val traits: MutableList<Trait> = mutableListOf(),
    var fame: Int = 0,
    /** Сколько раз герой терял сознание — для летописи. */
    var defeats: Int = 0,
) {
    fun attr(id: String) = attributes[id] ?: 0
    fun skillRank(id: String) = skills[id]?.rank ?: 0
    fun item(id: String) = inventory.firstOrNull { it.id == id }
    fun hasCondition(id: String) = conditions.any { it.id == id }
}

@Serializable
data class Memory(val minute: Long, val text: String)

@Serializable
data class Npc(
    val id: String,
    var name: String,
    var role: String,
    var appearance: String = "",
    var personality: String = "",
    var goals: String = "",
    var secret: String = "",
    var speech: String = "",
    var factionId: String = "",
    var cultureId: String = "",
    var locationId: String,
    /** Отношение к герою -100..100. */
    var attitude: Int = 0,
    var hostile: Boolean = false,
    var alive: Boolean = true,
    /** Боевой уровень 1..10. */
    var power: Int = 2,
    var hp: Int = 10,
    var maxHp: Int = 10,
    val knowledge: MutableList<String> = mutableListOf(),
    val memories: MutableList<Memory> = mutableListOf(),
    val tags: MutableList<String> = mutableListOf(),
    val inventory: MutableList<Item> = mutableListOf(),
    var money: Int = 0,
    var met: Boolean = false,
)

@Serializable
enum class LocationKind { AREA, SETTLEMENT, PLACE, DUNGEON, LANDMARK }

@Serializable
data class Exit(
    val id: String,
    var name: String,
    val targetId: String,
    var minutes: Int,
    var hidden: Boolean = false,
    /** Сторона света для переходов между клетками: N, E, S, W; пусто — внутренний проход. */
    val direction: String = "",
)

@Serializable
data class Location(
    val id: String,
    var name: String,
    val kind: LocationKind,
    val x: Int,
    val y: Int,
    val parentId: String? = null,
    val biomeId: String,
    var danger: Int,
    var description: String = "",
    var visual: String = "",
    val tags: MutableList<String> = mutableListOf(),
    val features: MutableList<String> = mutableListOf(),
    val exits: MutableList<Exit> = mutableListOf(),
    val items: MutableList<Item> = mutableListOf(),
    var factionId: String = "",
    var cultureId: String = "",
    /** Размер поселения 0..3 (хутор … город), для остальных 0. */
    val size: Int = 0,
    /** Наполнена ли локация описанием от ИИ. */
    var generated: Boolean = false,
    var visited: Boolean = false,
    /** Короткая подсказка генератору: чем должна стать эта локация. */
    var seedHint: String = "",
    /** Путь к сохранённой картинке сцены. */
    var imagePath: String = "",
)

@Serializable
data class Faction(
    val id: String,
    var name: String,
    var description: String,
    var goals: String,
    var attitude: Int,
    var power: Int,
    val tags: List<String> = emptyList(),
    val homeX: Int = 0,
    val homeY: Int = 0,
    val cultureId: String = "",
)

@Serializable
enum class QuestStatus { ACTIVE, DONE, FAILED }

@Serializable
data class Quest(
    val id: String,
    var title: String,
    var description: String,
    val giverNpcId: String = "",
    var status: QuestStatus = QuestStatus.ACTIVE,
    val notes: MutableList<String> = mutableListOf(),
    val startedAt: Long = 0,
)

@Serializable
enum class LogKind { PLAYER, STORY, ROLL, SYSTEM, CHANGE, IMAGE }

@Serializable
data class LogEntry(
    val turn: Int,
    val minute: Long,
    val kind: LogKind,
    val text: String,
)

@Serializable
data class Chapter(val fromTurn: Int, val toTurn: Int, val summary: String)

@Serializable
data class CodexEntry(
    val id: String,
    val title: String,
    var text: String,
    val category: String,
    val minute: Long,
)

/** Картинка сцены в альбоме путешествия. */
@Serializable
data class AlbumEntry(val path: String, val caption: String, val minute: Long)
