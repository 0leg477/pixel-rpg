package com.pixelrpg.engine.turn

import com.pixelrpg.engine.rules.CheckResult
import kotlinx.serialization.Serializable

@Serializable
enum class Tone { GOOD, BAD, NEUTRAL }

/** Видимое игроку изменение: «−3 Здоровье», «+ Ржавый ключ». */
@Serializable
data class Change(val text: String, val tone: Tone)

/** Случайная встреча в пути — её содержание придумает ИИ, а движок решил, что она есть. */
@Serializable
data class Encounter(
    val locationId: String,
    val kind: String,
    val danger: Int,
    val hostile: Boolean,
)

/** Итог хода: всё, что произошло по правилам. Рассказчик описывает именно это. */
@Serializable
data class TurnReport(
    val input: String,
    val summary: String,
    val action: ActionType,
    val refused: String? = null,
    val check: CheckResult? = null,
    val facts: List<String> = emptyList(),
    val changes: List<Change> = emptyList(),
    val moved: Boolean = false,
    val needsGeneration: List<String> = emptyList(),
    val encounter: Encounter? = null,
    val defeated: Boolean = false,
    val gameOver: Boolean = false,
)
