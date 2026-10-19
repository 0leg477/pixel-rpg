package com.pixelrpg.ai.view

import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.WorldGen
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.Clock
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.LocationKind
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.model.QuestStatus
import com.pixelrpg.engine.rules.CheckResult
import com.pixelrpg.engine.turn.Change
import com.pixelrpg.engine.turn.Tone
import com.pixelrpg.engine.turn.TurnResolver

/** Записи ленты истории. */
sealed interface Entry {
    val key: String
    data class Player(override val key: String, val text: String) : Entry
    data class Story(override val key: String, val text: String) : Entry
    data class Roll(override val key: String, val check: CheckResult) : Entry
    data class Changes(override val key: String, val changes: List<Change>) : Entry
    data class System(override val key: String, val text: String) : Entry
}

data class ResBar(val name: String, val current: Int, val max: Int, val color: Long?, val health: Boolean)
data class ItemRow(
    val id: String, val name: String, val description: String, val tags: List<String>, val quantity: Int,
    val value: Int, val slot: ItemSlot, val power: Int, val equipped: Boolean, val rarity: Int,
)
data class SkillRow(val name: String, val attribute: String, val rank: Int, val xp: Int, val need: Int)
data class NpcRow(val id: String, val name: String, val role: String, val attitude: String, val hostile: Boolean)
data class QuestRow(val title: String, val description: String, val status: QuestStatus, val notes: List<String>)
data class CodexRow(val title: String, val text: String, val category: String)
data class FactionRow(val name: String, val attitude: Int, val word: String)
data class MapCell(val x: Int, val y: Int, val biome: Int, val name: String, val settlement: Boolean, val visited: Boolean)

/** Неизменяемый снимок состояния для интерфейса: UI никогда не трогает [GameState] напрямую. */
data class Hud(
    val worldTitle: String,
    val heroName: String,
    val heroConcept: String,
    val heroAppearance: String,
    val heroBackground: String,
    val place: String,
    val placeDescription: String,
    val time: String,
    val resources: List<ResBar>,
    val money: String,
    val fame: Int,
    val conditions: List<String>,
    val attributes: List<Pair<String, Int>>,
    val skills: List<SkillRow>,
    val traits: List<Pair<String, String>>,
    val inventory: List<ItemRow>,
    val quests: List<QuestRow>,
    val codex: List<CodexRow>,
    val npcs: List<NpcRow>,
    val exits: List<String>,
    val itemsHere: List<String>,
    val factions: List<FactionRow>,
    val map: List<MapCell>,
    val mapX: Int,
    val mapY: Int,
    val canon: Canon,
    val inCombat: Boolean,
    val gameOver: Boolean,
    val turn: Int,
)

object HudBuilder {

    fun build(state: GameState): Hud {
        val canon = state.canon
        val hero = state.hero
        val loc = state.location
        val conditionDefs = CanonValidator.conditionsOf(canon)
        val areas = state.locations.values.filter { it.parentId == null }
        return Hud(
            worldTitle = canon.title,
            heroName = hero.name,
            heroConcept = hero.concept,
            heroAppearance = hero.appearance,
            heroBackground = hero.background,
            place = loc.name,
            placeDescription = loc.description,
            time = Clock.format(state.minute) + ", " + WorldGen.weather(state, loc.x, loc.y, state.minute),
            resources = canon.resources.mapNotNull { r ->
                hero.resources[r.id]?.let { p ->
                    ResBar(r.name, p.current, p.max, parseColor(r.color), r.role == com.pixelrpg.engine.model.ResourceRole.HEALTH)
                }
            },
            money = "${hero.money} ${canon.currency.name}",
            fame = hero.fame,
            conditions = hero.conditions.map { c -> conditionDefs.firstOrNull { it.id == c.id }?.name ?: c.id },
            attributes = canon.attributes.map { it.name to hero.attr(it.id) },
            skills = canon.skills.map { s ->
                val p = hero.skills[s.id]
                SkillRow(s.name, canon.attribute(s.attributeId)?.name ?: "", p?.rank ?: 0, p?.xp ?: 0, ((p?.rank ?: 0) + 1) * 4)
            }.sortedByDescending { it.rank },
            traits = hero.traits.map { it.name to it.description },
            inventory = hero.inventory.map {
                ItemRow(it.id, it.name, it.description, it.tags, it.quantity, it.value, it.slot, it.power, it.equipped, it.rarity)
            },
            quests = state.quests.sortedBy { it.status.ordinal }.map { QuestRow(it.title, it.description, it.status, it.notes.toList()) },
            codex = state.codex.reversed().map { CodexRow(it.title, it.text, it.category) },
            npcs = state.npcsHere().map { NpcRow(it.id, it.name, it.role, TurnResolver.attitudeWord(it.attitude), it.hostile) },
            exits = loc.exits.filter { !it.hidden }.map { it.name },
            itemsHere = loc.items.map { it.name },
            factions = state.factions.values.map { FactionRow(it.name, it.attitude, TurnResolver.attitudeWord(it.attitude)) },
            map = buildMap(state, areas.map { it.x to it.y }.toSet()),
            mapX = loc.x,
            mapY = loc.y,
            canon = canon,
            inCombat = state.combat != null,
            gameOver = state.gameOver,
            turn = state.turn,
        )
    }

    /** Карта: посещённые клетки и их соседи (их видно с края). */
    private fun buildMap(state: GameState, known: Set<Pair<Int, Int>>): List<MapCell> {
        val cells = mutableMapOf<Pair<Int, Int>, MapCell>()
        for ((x, y) in known) {
            for (dx in -1..1) for (dy in -1..1) {
                val k = (x + dx) to (y + dy)
                if (k in cells) continue
                val loc = state.locations[WorldGen.areaId(k.first, k.second)]
                val visited = loc?.visited == true
                val cell = WorldGen.cell(state, k.first, k.second)
                cells[k] = MapCell(
                    k.first, k.second, state.canon.biomes.indexOf(cell.biome),
                    if (visited) loc!!.name else cell.biome.name,
                    settlement = visited && loc!!.kind == LocationKind.SETTLEMENT,
                    visited = visited,
                )
            }
        }
        return cells.values.toList()
    }

    fun entries(state: GameState): List<Entry> {
        val out = ArrayList<Entry>()
        // Внутри хода показываем: заявка → бросок → изменения → рассказ (рассказ печатается последним).
        val order = mapOf(LogKind.PLAYER to 0, LogKind.ROLL to 1, LogKind.CHANGE to 2, LogKind.SYSTEM to 3, LogKind.STORY to 4)
        state.log.withIndex()
            .groupBy { it.value.turn }
            .toSortedMap()
            .forEach { (_, group) ->
                group.sortedWith(compareBy({ order[it.value.kind] ?: 9 }, { it.index })).forEach { (i, e) ->
                    val key = "e$i-${e.turn}-${e.kind}"
                    when (e.kind) {
                        LogKind.PLAYER -> out += Entry.Player(key, e.text)
                        LogKind.STORY -> out += Entry.Story(key, e.text)
                        LogKind.SYSTEM -> if (!e.text.startsWith("Место: ")) out += Entry.System(key, e.text)
                        LogKind.ROLL -> runCatching { SaveCodec.json.decodeFromString(CheckResult.serializer(), e.text) }
                            .getOrNull()?.let { out += Entry.Roll(key, it) }
                        LogKind.CHANGE -> out += Entry.Changes(key, e.text.lines().mapNotNull { line ->
                            val parts = line.split("|", limit = 2)
                            if (parts.size == 2) Change(parts[1], runCatching { Tone.valueOf(parts[0]) }.getOrDefault(Tone.NEUTRAL)) else null
                        })
                    }
                }
            }
        return out
    }

    private fun parseColor(hex: String): Long? = runCatching {
        if (hex.length == 7 && hex.startsWith("#")) 0xFF000000 or hex.substring(1).toLong(16) else null
    }.getOrNull()
}
