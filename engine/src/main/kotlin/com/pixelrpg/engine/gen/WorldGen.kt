package com.pixelrpg.engine.gen

import com.pixelrpg.engine.model.BiomeDef
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.Exit
import com.pixelrpg.engine.model.Faction
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Location
import com.pixelrpg.engine.model.LocationKind
import com.pixelrpg.engine.rules.Hash
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin

/**
 * Каркас бесконечного мира. Мир — это сетка клеток-местностей, каждая клетка
 * вычисляется из сида и координат, поэтому мир не нужно хранить целиком:
 * клетка появляется в сохранении, только когда герой до неё дошёл.
 */
object WorldGen {

    data class CellInfo(
        val x: Int,
        val y: Int,
        val biome: BiomeDef,
        val danger: Int,
        val settlementSize: Int?,
        val factionId: String,
        val cultureId: String,
        val landmark: Boolean,
        val dungeon: Boolean,
    )

    private val DIRECTIONS = listOf(
        Triple("N", 0, -1), Triple("E", 1, 0), Triple("S", 0, 1), Triple("W", -1, 0),
    )

    private val DIRECTION_NAMES = mapOf("N" to "север", "E" to "восток", "S" to "юг", "W" to "запад")

    private val SETTLEMENT_NAMES = listOf("хутор", "деревня", "городок", "город")

    fun areaId(x: Int, y: Int) = "a_${x}_$y"

    /** Расставляет фракции вокруг стартовой точки и создаёт стартовую местность. */
    fun initWorld(state: GameState) {
        val canon = state.canon
        canon.factions.forEachIndexed { i, f ->
            val (hx, hy) = if (i == 0) 0 to 0 else {
                val angle = i * 2 * Math.PI / max(1, canon.factions.size - 1) + Hash.unit(state.seed, 77, i.toLong())
                val radius = 2 + Hash.unit(state.seed, 78, i.toLong()) * 4
                Math.round(cos(angle) * radius).toInt() to Math.round(sin(angle) * radius).toInt()
            }
            state.factions[f.id] = Faction(
                id = f.id, name = f.name, description = f.description, goals = f.goals,
                attitude = f.startAttitude, power = f.power, tags = f.tags,
                homeX = hx, homeY = hy, cultureId = f.cultureId,
            )
        }
        val start = ensureArea(state, 0, 0)
        start.visited = true
        state.currentLocationId = start.id
    }

    fun cell(state: GameState, x: Int, y: Int): CellInfo {
        val canon = state.canon
        val seed = state.seed
        val biome = biomeAt(canon, seed, x, y)
        val dist = max(abs(x), abs(y))
        val isStart = x == 0 && y == 0
        val settlementSize = when {
            isStart -> 1 + Hash.int(2, seed, 11)
            Hash.int(100, seed, 1, x.toLong(), y.toLong()) < biome.settlementChance -> {
                val r = Hash.int(100, seed, 2, x.toLong(), y.toLong())
                when {
                    r < 50 -> 0
                    r < 80 -> 1
                    r < 95 -> 2
                    else -> 3
                }
            }
            else -> null
        }
        val owner = state.factions.values
            .map { it to hypot((it.homeX - x).toDouble(), (it.homeY - y).toDouble()) }
            .filter { (f, d) -> d <= 1.5 + f.power / 2.0 }
            .minByOrNull { it.second }?.first
        val nearest = owner ?: state.factions.values.minByOrNull { hypot((it.homeX - x).toDouble(), (it.homeY - y).toDouble()) }
        val danger = (biome.danger + dist / 3 - (if (settlementSize != null) 2 else 0) - (if (owner != null) 1 else 0))
            .coerceIn(0, 10)
        return CellInfo(
            x = x, y = y, biome = biome, danger = if (isStart) minOf(danger, 1) else danger,
            settlementSize = settlementSize,
            factionId = owner?.id ?: "",
            cultureId = nearest?.cultureId?.ifBlank { null } ?: canon.cultures.firstOrNull()?.id ?: "",
            landmark = settlementSize == null && Hash.int(100, seed, 3, x.toLong(), y.toLong()) < 12,
            dungeon = !isStart && Hash.int(100, seed, 4, x.toLong(), y.toLong()) < 8 + danger * 2,
        )
    }

    /** Возвращает местность по координатам, создавая её каркас при первом обращении. */
    fun ensureArea(state: GameState, x: Int, y: Int): Location {
        val id = areaId(x, y)
        state.locations[id]?.let { return it }
        val c = cell(state, x, y)
        val kind = when {
            c.settlementSize != null -> LocationKind.SETTLEMENT
            c.landmark -> LocationKind.LANDMARK
            else -> LocationKind.AREA
        }
        val hint = buildList {
            add(c.biome.name)
            c.settlementSize?.let { add("поселение: ${SETTLEMENT_NAMES[it]}") }
            if (c.landmark) add("здесь есть приметное место или руины")
            if (c.dungeon) add("где-то здесь есть вход в опасное подземелье или логово")
            if (x == 0 && y == 0) add("стартовая точка истории")
        }.joinToString("; ")
        val loc = Location(
            id = id,
            name = c.settlementSize?.let { SETTLEMENT_NAMES[it].replaceFirstChar(Char::uppercase) } ?: c.biome.name,
            kind = kind,
            x = x, y = y,
            biomeId = c.biome.id,
            danger = c.danger,
            factionId = c.factionId,
            cultureId = c.cultureId,
            size = c.settlementSize ?: 0,
            seedHint = hint,
        )
        loc.tags += c.biome.tags
        for ((dir, dx, dy) in DIRECTIONS) {
            val neighbor = biomeAt(state.canon, state.seed, x + dx, y + dy)
            val minutes = (c.biome.travelHours + neighbor.travelHours) * 30
            loc.exits += Exit(
                id = "go_${dir.lowercase()}",
                name = "Путь на ${DIRECTION_NAMES.getValue(dir)}",
                targetId = areaId(x + dx, y + dy),
                minutes = minutes,
                direction = dir,
            )
        }
        state.locations[id] = loc
        return loc
    }

    /** Добавляет внутреннее место (таверну, пещеру, храм) в местность и связывает их проходами. */
    fun addPlace(state: GameState, parent: Location, name: String, kind: LocationKind, hint: String): Location {
        val id = state.newId("p")
        val place = Location(
            id = id, name = name, kind = kind, x = parent.x, y = parent.y, parentId = parent.id,
            biomeId = parent.biomeId,
            danger = if (kind == LocationKind.DUNGEON) (parent.danger + 2).coerceAtMost(10) else parent.danger,
            factionId = parent.factionId, cultureId = parent.cultureId, seedHint = hint,
        )
        place.exits += Exit(id = "back", name = "Назад: ${parent.name}", targetId = parent.id, minutes = 5)
        parent.exits += Exit(id = "to_$id", name = name, targetId = id, minutes = if (parent.parentId == null) 10 else 3)
        state.locations[id] = place
        return place
    }

    fun childCount(state: GameState, loc: Location) = state.locations.values.count { it.parentId == loc.id }

    private val WEATHER = listOf("ясно", "облачно", "моросит дождь", "туман", "сильный ветер", "ливень", "ясно", "облачно")

    fun weather(state: GameState, x: Int, y: Int, minute: Long): String {
        val day = minute / 1440
        val period = (minute % 1440) / 360
        return WEATHER[Hash.int(WEATHER.size, state.seed, 9, day, period, (x shr 2).toLong(), (y shr 2).toLong())]
    }

    /** Биом выбирается по двум плавным шумам (высота и влажность) — соседние клетки похожи. */
    fun biomeAt(canon: Canon, seed: Long, x: Int, y: Int): BiomeDef {
        val e = noise(seed, 101, x / 4.0, y / 4.0) * 0.7 + noise(seed, 102, x / 1.7, y / 1.7) * 0.3
        val m = noise(seed, 201, x / 5.0, y / 5.0) * 0.7 + noise(seed, 202, x / 2.1, y / 2.1) * 0.3
        return canon.biomes.withIndex().minBy { (i, _) ->
            val be = Hash.unit(seed, 301, i.toLong())
            val bm = Hash.unit(seed, 302, i.toLong())
            (be - e) * (be - e) + (bm - m) * (bm - m)
        }.value
    }

    private fun noise(seed: Long, channel: Long, x: Double, y: Double): Double {
        val x0 = floor(x).toInt()
        val y0 = floor(y).toInt()
        val fx = smooth(x - x0)
        val fy = smooth(y - y0)
        fun v(ix: Int, iy: Int) = Hash.unit(seed, channel, ix.toLong(), iy.toLong())
        val a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx
        val b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx
        return a + (b - a) * fy
    }

    private fun smooth(t: Double) = t * t * (3 - 2 * t)
}
