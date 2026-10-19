package com.pixelrpg.engine.rules

import kotlinx.serialization.Serializable

@Serializable
enum class Difficulty(val modifier: Int, val label: String) {
    TRIVIAL(2, "пустяк"),
    EASY(1, "легко"),
    NORMAL(0, "обычно"),
    HARD(-2, "трудно"),
    EXTREME(-4, "очень трудно"),
    ;

    /** Насколько крупные ставки допустимы: чем сложнее, тем больше награда и риск. */
    val stakes: Int get() = when (this) {
        TRIVIAL -> 0
        EASY -> 1
        NORMAL -> 2
        HARD -> 3
        EXTREME -> 4
    }

    companion object {
        fun parse(s: String): Difficulty = when (s.trim().lowercase()) {
            "trivial" -> TRIVIAL
            "easy" -> EASY
            "hard" -> HARD
            "extreme", "very_hard" -> EXTREME
            else -> NORMAL
        }
    }
}

@Serializable
enum class Outcome(val label: String) {
    CRIT_SUCCESS("блестящий успех"),
    SUCCESS("успех"),
    PARTIAL("успех с ценой"),
    FAILURE("провал"),
    CRIT_FAILURE("катастрофа"),
    ;

    val isSuccess get() = this == CRIT_SUCCESS || this == SUCCESS
    val isFailure get() = this == FAILURE || this == CRIT_FAILURE

    /** Ключ ветки ставок, которую объявил мастер: success / partial / failure. */
    val branch: String get() = when (this) {
        CRIT_SUCCESS, SUCCESS -> "success"
        PARTIAL -> "partial"
        FAILURE, CRIT_FAILURE -> "failure"
    }
}

@Serializable
data class Modifier(val label: String, val value: Int)

@Serializable
data class CheckResult(
    val dice: List<Int>,
    val modifiers: List<Modifier>,
    val difficulty: Difficulty,
    val total: Int,
    val outcome: Outcome,
    val skillName: String,
) {
    val modifierSum: Int get() = modifiers.sumOf { it.value }
}

/**
 * Проверка 2d6 + модификаторы:
 * 10+ — успех, 7–9 — успех с ценой, 6 и меньше — провал.
 * Две шестёрки — всегда блестящий успех, две единицы — всегда катастрофа.
 */
object Checks {
    const val MAX_MODIFIER = 6

    fun roll(dice: Dice, modifiers: List<Modifier>, difficulty: Difficulty, skillName: String): CheckResult {
        val all = modifiers.filter { it.value != 0 } +
            listOfNotNull(Modifier("сложность: ${difficulty.label}", difficulty.modifier).takeIf { it.value != 0 })
        val sum = all.sumOf { it.value }.coerceIn(-MAX_MODIFIER, MAX_MODIFIER)
        val d1 = dice.d(6)
        val d2 = dice.d(6)
        val total = d1 + d2 + sum
        val outcome = when {
            d1 == 6 && d2 == 6 -> Outcome.CRIT_SUCCESS
            d1 == 1 && d2 == 1 -> Outcome.CRIT_FAILURE
            total >= 10 -> Outcome.SUCCESS
            total >= 7 -> Outcome.PARTIAL
            else -> Outcome.FAILURE
        }
        return CheckResult(listOf(d1, d2), all, difficulty, total, outcome, skillName)
    }

    /** Вероятность исходов без учёта критов — для подсказок игроку. */
    fun successChance(modifierSum: Int): Int {
        var ok = 0
        for (a in 1..6) for (b in 1..6) if (a + b + modifierSum >= 7 || (a == 6 && b == 6)) ok++
        return ok * 100 / 36
    }
}
