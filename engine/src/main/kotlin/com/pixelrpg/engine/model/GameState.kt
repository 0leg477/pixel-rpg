package com.pixelrpg.engine.model

import com.pixelrpg.engine.rules.Dice
import kotlinx.serialization.Serializable

@Serializable
data class GameSettings(
    /** Смерть навсегда; иначе поражение — это потеря сознания и вещей. */
    val permadeath: Boolean = false,
)

/** Боевая сцена: кто сражается с героем прямо сейчас. */
@Serializable
data class CombatState(
    val enemyIds: MutableList<String> = mutableListOf(),
    var round: Int = 0,
)

/** Полное состояние одного мира — именно это и сохраняется. */
@Serializable
class GameState(
    val id: String,
    val seed: Long,
    val createdAt: Long,
    var canon: Canon,
    var hero: Hero,
    var settings: GameSettings = GameSettings(),
    var dice: Dice,
    /** Игровое время в минутах от начала. */
    var minute: Long = 8 * 60,
    var turn: Int = 0,
    var currentLocationId: String = "",
    val locations: MutableMap<String, Location> = mutableMapOf(),
    val npcs: MutableMap<String, Npc> = mutableMapOf(),
    val factions: MutableMap<String, Faction> = mutableMapOf(),
    val quests: MutableList<Quest> = mutableListOf(),
    val log: MutableList<LogEntry> = mutableListOf(),
    val chronicle: MutableList<Chapter> = mutableListOf(),
    val codex: MutableList<CodexEntry> = mutableListOf(),
    val album: MutableList<AlbumEntry> = mutableListOf(),
    val flags: MutableMap<String, String> = mutableMapOf(),
    var combat: CombatState? = null,
    var gameOver: Boolean = false,
    private var nextId: Long = 1,
) {
    val location: Location get() = locations.getValue(currentLocationId)

    fun newId(prefix: String): String = "${prefix}${nextId++}"

    fun npcsHere(): List<Npc> = npcs.values.filter { it.locationId == currentLocationId && it.alive }

    fun addLog(kind: LogKind, text: String) {
        log += LogEntry(turn, minute, kind, text)
        if (log.size > MAX_LOG) log.subList(0, log.size - MAX_LOG).clear()
    }

    companion object {
        const val MAX_LOG = 600
    }
}

/** Игровые сутки и время дня. */
object Clock {
    fun day(minute: Long): Int = (minute / 1440).toInt() + 1
    fun hour(minute: Long): Int = ((minute % 1440) / 60).toInt()

    fun partOfDay(minute: Long): String = when (hour(minute)) {
        in 5..10 -> "утро"
        in 11..16 -> "день"
        in 17..21 -> "вечер"
        else -> "ночь"
    }

    fun isDark(minute: Long): Boolean = hour(minute) !in 6..20

    fun format(minute: Long): String {
        val h = hour(minute)
        val m = (minute % 60).toInt()
        return "День ${day(minute)}, %02d:%02d (%s)".format(h, m, partOfDay(minute))
    }
}
