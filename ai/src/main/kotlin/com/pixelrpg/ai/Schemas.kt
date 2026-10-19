package com.pixelrpg.ai

import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.model.RuleEffectKind
import com.pixelrpg.engine.model.RuleTrigger
import com.pixelrpg.engine.turn.ActionType
import com.pixelrpg.engine.turn.EffectType
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Мини-DSL для JSON Schema в подмножестве, которое понимают структурированные ответы API. */
private object S {
    fun str(description: String? = null) = obj("string", description)
    fun int(description: String? = null) = obj("integer", description)
    fun bool(description: String? = null) = obj("boolean", description)

    fun enum(values: List<String>, description: String? = null) = buildJsonObject {
        put("type", "string")
        put("enum", JsonArray(values.map(::JsonPrimitive)))
        description?.let { put("description", it) }
    }

    fun arr(items: JsonElement, description: String? = null) = buildJsonObject {
        put("type", "array")
        put("items", items)
        description?.let { put("description", it) }
    }

    fun ref(name: String) = buildJsonObject { put("\$ref", "#/\$defs/$name") }

    /** Объект, где все поля обязательны и лишних нет — так требует строгий режим. */
    fun o(vararg props: Pair<String, JsonElement>, defs: Map<String, JsonElement> = emptyMap()) = buildJsonObject {
        put("type", "object")
        put("properties", JsonObject(props.toMap()))
        put("required", JsonArray(props.map { JsonPrimitive(it.first) }))
        put("additionalProperties", false)
        if (defs.isNotEmpty()) put("\$defs", JsonObject(defs))
    }

    private fun obj(type: String, description: String?) = buildJsonObject {
        put("type", type)
        description?.let { put("description", it) }
    }
}

object Schemas {
    private val SLOTS = listOf("none", "weapon", "armor", "trinket")

    private val item = S.o(
        "name" to S.str(),
        "description" to S.str(),
        "tags" to S.arr(S.str()),
        "value" to S.int("цена в валюте мира"),
        "rarity" to S.int("0 обычный, 1 необычный, 2 редкий, 3 очень редкий, 4 легендарный"),
        "slot" to S.enum(SLOTS),
        "power" to S.int("урон оружия или защита брони, иначе 0"),
        "quantity" to S.int(),
    )

    private val npc = S.o(
        "name" to S.str(),
        "role" to S.str("кто это: занятие, положение"),
        "appearance" to S.str("внешность, одна-две фразы"),
        "personality" to S.str(),
        "goals" to S.str(),
        "secret" to S.str("тайна или пусто"),
        "speech" to S.str("манера речи"),
        "factionId" to S.str("id фракции из канона или пусто"),
        "attitude" to S.int("отношение к герою -100..100"),
        "hostile" to S.bool(),
        "power" to S.int("боевая сила 1..10"),
        "knowledge" to S.arr(S.str(), "слухи и знания, которыми может поделиться"),
        "tags" to S.arr(S.str()),
        "money" to S.int(),
        "items" to S.arr(S.ref("item")),
    )

    val canon: JsonObject = S.o(
        "title" to S.str(),
        "pitch" to S.str("суть мира в 2–3 предложениях"),
        "genre" to S.str(),
        "tone" to S.str(),
        "narratorStyle" to S.str("как вести повествование"),
        "laws" to S.arr(S.str()),
        "impossible" to S.arr(S.str()),
        "attributes" to S.arr(S.o("id" to S.str(), "name" to S.str(), "description" to S.str())),
        "skills" to S.arr(
            S.o("id" to S.str(), "name" to S.str(), "attributeId" to S.str(), "description" to S.str(), "tags" to S.arr(S.str())),
        ),
        "resources" to S.arr(
            S.o(
                "id" to S.str(), "name" to S.str(), "max" to S.int(),
                "role" to S.enum(ResourceRole.entries.map { it.name }),
                "regenPerHour" to S.int(), "zeroConditionId" to S.str(), "description" to S.str(),
                "color" to S.str("#rrggbb"),
            ),
        ),
        "conditions" to S.arr(
            S.o(
                "id" to S.str(), "name" to S.str(), "description" to S.str(), "checkModifier" to S.int(),
                "tags" to S.arr(S.str()), "resourceId" to S.str(), "resourcePerHour" to S.int(),
                "durationHours" to S.int(), "negative" to S.bool(),
            ),
        ),
        "currency" to S.o("name" to S.str(), "short" to S.str(), "startAmount" to S.int()),
        "rules" to S.arr(
            S.o(
                "id" to S.str(), "name" to S.str(), "description" to S.str(),
                "trigger" to S.enum(RuleTrigger.entries.map { it.name }),
                "tag" to S.str(), "witnessFactionId" to S.str(),
                "outcome" to S.enum(listOf("", "success", "partial", "failure")),
                "effects" to S.arr(
                    S.o(
                        "kind" to S.enum(RuleEffectKind.entries.map { it.name }),
                        "target" to S.str(), "amount" to S.int(), "text" to S.str(),
                    ),
                ),
            ),
        ),
        "cultures" to S.arr(S.o("id" to S.str(), "name" to S.str(), "description" to S.str(), "namingStyle" to S.str())),
        "factions" to S.arr(
            S.o(
                "id" to S.str(), "name" to S.str(), "description" to S.str(), "goals" to S.str(),
                "cultureId" to S.str(), "startAttitude" to S.int(), "power" to S.int(), "tags" to S.arr(S.str()),
            ),
        ),
        "biomes" to S.arr(
            S.o(
                "id" to S.str(), "name" to S.str(), "description" to S.str(), "danger" to S.int(),
                "settlementChance" to S.int(), "travelHours" to S.int(), "tags" to S.arr(S.str()),
            ),
        ),
        "itemTags" to S.arr(S.str()),
        "artStyle" to S.str(),
        "palette" to S.arr(S.str()),
        "startScenario" to S.str(),
    )

    val hero: JsonObject = S.o(
        "name" to S.str(),
        "concept" to S.str("кто герой в нескольких словах"),
        "background" to S.str(),
        "appearance" to S.str(),
        "attributes" to S.arr(S.o("id" to S.str(), "value" to S.int())),
        "skills" to S.arr(S.o("id" to S.str(), "value" to S.int())),
        "items" to S.arr(S.ref("item")),
        "traits" to S.arr(S.o("name" to S.str(), "description" to S.str(), "modifier" to S.int(), "tags" to S.arr(S.str()))),
        defs = mapOf("item" to item),
    )

    val location: JsonObject = S.o(
        "name" to S.str(),
        "description" to S.str(),
        "visual" to S.str("что видно глазами, для художника"),
        "tags" to S.arr(S.str()),
        "features" to S.arr(S.str()),
        "places" to S.arr(S.o("name" to S.str(), "kind" to S.enum(listOf("place", "dungeon", "landmark")), "hint" to S.str())),
        "npcs" to S.arr(S.ref("npc")),
        "items" to S.arr(S.ref("item")),
        "exitNames" to S.arr(S.o("exitId" to S.str(), "name" to S.str())),
        "lore" to S.arr(S.str()),
        defs = mapOf("item" to item, "npc" to npc),
    )

    val encounter: JsonObject = S.o(
        "description" to S.str("что происходит, одна-две фразы"),
        "npcs" to S.arr(S.ref("npc")),
        "items" to S.arr(S.ref("item")),
        defs = mapOf("item" to item, "npc" to npc),
    )

    private val effect = S.o(
        "type" to S.enum(EffectType.entries.map { it.name.lowercase() }),
        "target" to S.str(),
        "npcId" to S.str(),
        "amount" to S.int(),
        "name" to S.str(),
        "text" to S.str(),
        "tags" to S.arr(S.str()),
        "slot" to S.enum(SLOTS),
        "power" to S.int(),
    )

    val adjudication: JsonObject = S.o(
        "action" to S.enum(ActionType.entries.map { it.name.lowercase() }),
        "summary" to S.str("что пытается сделать герой, одной фразой"),
        "feasible" to S.bool(),
        "refusal" to S.str(),
        "needsRoll" to S.bool(),
        "skillId" to S.str(),
        "attributeId" to S.str(),
        "difficulty" to S.enum(listOf("trivial", "easy", "normal", "hard", "extreme")),
        "tags" to S.arr(S.str()),
        "targetNpcId" to S.str(),
        "itemIds" to S.arr(S.str()),
        "exitId" to S.str(),
        "minutes" to S.int(),
        "speech" to S.str(),
        "always" to S.arr(S.ref("effect")),
        "success" to S.arr(S.ref("effect")),
        "partial" to S.arr(S.ref("effect")),
        "failure" to S.arr(S.ref("effect")),
        defs = mapOf("effect" to effect),
    )

    val chronicle: JsonObject = S.o("summary" to S.str())

    val imagePrompt: JsonObject = S.o("prompt" to S.str("описание сцены на английском для генератора изображений"))

    /**
     * Пределы только для служебных списков решения мастера (сколько последствий у одного исхода).
     * Содержимое мира — фракции, навыки, предметы, персонажи — не ограничивается.
     */
    private val COMPACT_LIMITS = mapOf(
        "itemIds" to 4, "always" to 4, "success" to 4, "partial" to 4, "failure" to 4,
    )

    /**
     * Та же схема, но со служебными пределами (maxItems) — чтобы маленькая модель на телефоне
     * не расписывала решение мастера бесконечно. Для Claude не используется.
     */
    fun bounded(schema: JsonObject): JsonObject = bound(schema, null) as JsonObject

    private fun bound(node: JsonElement, name: String?): JsonElement = when (node) {
        is JsonObject -> {
            val props = node["properties"] as? JsonObject
            val mapped = node.mapValues { (k, v) ->
                when {
                    k == "properties" && props != null -> JsonObject(props.mapValues { (pk, pv) -> bound(pv, pk) })
                    k == "\$defs" && v is JsonObject -> JsonObject(v.mapValues { bound(it.value, null) })
                    k == "items" -> bound(v, null)
                    else -> v
                }
            }.toMutableMap()
            val limit = name?.let { COMPACT_LIMITS[it] }
            if (node["type"] == JsonPrimitive("array") && limit != null) mapped["maxItems"] = JsonPrimitive(limit)
            JsonObject(mapped)
        }
        is JsonArray -> JsonArray(node.map { bound(it, null) })
        else -> node
    }
}
