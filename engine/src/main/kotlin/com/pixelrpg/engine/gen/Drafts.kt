package com.pixelrpg.engine.gen

import kotlinx.serialization.Serializable

/** Черновики, которые пишет ИИ. Движок проверяет их и превращает в настоящие сущности. */

@Serializable
data class ItemDraft(
    val name: String,
    val description: String = "",
    val tags: List<String> = emptyList(),
    val value: Int = 1,
    val rarity: Int = 0,
    val slot: String = "none",
    val power: Int = 0,
    val quantity: Int = 1,
)

@Serializable
data class NpcDraft(
    val name: String,
    val role: String,
    val appearance: String = "",
    val personality: String = "",
    val goals: String = "",
    val secret: String = "",
    val speech: String = "",
    val factionId: String = "",
    val attitude: Int = 0,
    val hostile: Boolean = false,
    val power: Int = 2,
    val knowledge: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val money: Int = 0,
    val items: List<ItemDraft> = emptyList(),
)

@Serializable
data class PlaceDraft(
    val name: String,
    val kind: String = "place",
    val hint: String = "",
)

@Serializable
data class LocationDraft(
    val name: String,
    val description: String,
    val visual: String = "",
    val tags: List<String> = emptyList(),
    val features: List<String> = emptyList(),
    val places: List<PlaceDraft> = emptyList(),
    val npcs: List<NpcDraft> = emptyList(),
    val items: List<ItemDraft> = emptyList(),
    /** Названия выходов по их id — чтобы «Дорога на север» стала «Старым трактом». */
    val exitNames: List<ExitName> = emptyList(),
    val lore: List<String> = emptyList(),
)

@Serializable
data class ExitName(val exitId: String, val name: String)

@Serializable
data class StatValue(val id: String, val value: Int)

@Serializable
data class TraitDraft(
    val name: String,
    val description: String,
    val modifier: Int = 0,
    val tags: List<String> = emptyList(),
)

@Serializable
data class HeroDraft(
    val name: String,
    val concept: String,
    val background: String = "",
    val appearance: String = "",
    val attributes: List<StatValue> = emptyList(),
    val skills: List<StatValue> = emptyList(),
    val items: List<ItemDraft> = emptyList(),
    val traits: List<TraitDraft> = emptyList(),
)
