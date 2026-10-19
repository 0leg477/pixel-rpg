package com.pixelrpg.engine.rules

import kotlinx.serialization.Serializable

/**
 * Детерминированный генератор (SplitMix64). Состояние сохраняется вместе с игрой,
 * поэтому перезагрузка не даёт «перебросить» неудачный бросок.
 */
@Serializable
class Dice(private var state: Long) {

    fun nextLong(): Long {
        state += -0x61c8864680b583ebL
        var z = state
        z = (z xor (z ushr 30)) * -0x40a7b892e31b1a47L
        z = (z xor (z ushr 27)) * -0x6b2fb644ecceee15L
        return z xor (z ushr 31)
    }

    /** Случайное число в [0, bound). */
    fun nextInt(bound: Int): Int {
        require(bound > 0)
        return ((nextLong() ushr 1) % bound).toInt()
    }

    fun range(from: Int, to: Int): Int = from + nextInt(to - from + 1)

    fun d(sides: Int): Int = nextInt(sides) + 1

    fun chance(percent: Int): Boolean = nextInt(100) < percent

    fun <T> pick(list: List<T>): T = list[nextInt(list.size)]
}

/** Чистые хеш-функции для генерации мира по координатам: один и тот же сид — один и тот же мир. */
object Hash {
    fun mix(vararg parts: Long): Long {
        var h = 0x9E3779B97F4A7C15uL.toLong()
        for (p in parts) {
            h = h xor p
            h *= -0x40a7b892e31b1a47L
            h = h xor (h ushr 29)
        }
        h *= -0x6b2fb644ecceee15L
        return h xor (h ushr 32)
    }

    /** Число в [0, 1). */
    fun unit(vararg parts: Long): Double = (mix(*parts) ushr 11).toDouble() / (1L shl 53).toDouble()

    fun int(bound: Int, vararg parts: Long): Int = ((mix(*parts) ushr 1) % bound).toInt()

    fun ofString(s: String): Long = s.fold(1125899906842597L) { h, c -> 31 * h + c.code }
}
