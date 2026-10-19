package com.pixelrpg.ai.image

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** Пиксели ARGB, построчно. */
class Pixels(val width: Int, val height: Int, val argb: IntArray) {
    init {
        require(argb.size == width * height)
    }
}

/**
 * Превращает любую картинку в настоящий пиксель-арт: уменьшение с усреднением,
 * ограниченная палитра и упорядоченный дизеринг. Поэтому картинки разных
 * генераторов выглядят в одном стиле и подходят к интерфейсу.
 */
object Pixelator {

    /**
     * @param targetWidth ширина результата в «больших пикселях».
     * @param palette готовая палитра (цвета мира или темы); если пусто — палитра подбирается по картинке.
     * @param colors сколько цветов подобрать, если палитра не задана.
     */
    fun pixelate(src: Pixels, targetWidth: Int, palette: List<Int> = emptyList(), colors: Int = 16, dither: Float = 0.6f): Pixels {
        val w = targetWidth.coerceIn(16, src.width)
        val h = max(1, (src.height.toLong() * w / src.width).toInt())
        val small = downscale(src, w, h)
        boostContrast(small)
        val pal = if (palette.size >= 2) palette.toIntArray() else extractPalette(small, colors)
        return quantize(small, pal, dither)
    }

    /**
     * Тональный режим: картинка раскладывается по яркости на цвета [ramp] (от тёмного к светлому),
     * как на старых консолях. Подходит для палитр темы и мира, где мало цветов разного оттенка.
     */
    fun pixelateRamp(src: Pixels, targetWidth: Int, ramp: List<Int>, dither: Float = 0.8f): Pixels {
        val w = targetWidth.coerceIn(16, src.width)
        val h = max(1, (src.height.toLong() * w / src.width).toInt())
        val small = downscale(src, w, h)
        val sortedRamp = ramp.distinct().sortedBy { luma(it) }.toIntArray()
        if (sortedRamp.size < 2) return quantize(small, extractPalette(small, 16), 0.6f)
        // Растягиваем яркость по 2–98 перцентилям, чтобы задействовать весь ряд цветов.
        val lumas = FloatArray(small.argb.size) { luma(small.argb[it]).toFloat() }
        val sorted = lumas.sortedArray()
        val lo = sorted[(sorted.size * 0.02).toInt()]
        val hi = max(lo + 1f, sorted[((sorted.size - 1) * 0.98).toInt()])
        val steps = sortedRamp.size - 1
        val out = IntArray(small.argb.size)
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x
            val t = ((lumas[i] - lo) / (hi - lo)).coerceIn(0f, 1f) * steps
            val noise = (BAYER[(y and 3) * 4 + (x and 3)] / 16f - 0.5f) * dither
            out[i] = sortedRamp[(t + noise).roundToInt().coerceIn(0, steps)]
        }
        return Pixels(w, h, out)
    }

    /** Уменьшение усреднением по области — без мыла и без «рваных» пикселей. */
    fun downscale(src: Pixels, w: Int, h: Int): Pixels {
        val out = IntArray(w * h)
        for (y in 0 until h) {
            val y0 = y * src.height / h
            val y1 = max(y0 + 1, (y + 1) * src.height / h)
            for (x in 0 until w) {
                val x0 = x * src.width / w
                val x1 = max(x0 + 1, (x + 1) * src.width / w)
                var r = 0L
                var g = 0L
                var b = 0L
                var n = 0L
                for (yy in y0 until y1) {
                    val row = yy * src.width
                    for (xx in x0 until x1) {
                        val p = src.argb[row + xx]
                        r += (p shr 16) and 0xFF
                        g += (p shr 8) and 0xFF
                        b += p and 0xFF
                        n++
                    }
                }
                out[y * w + x] = rgb((r / n).toInt(), (g / n).toInt(), (b / n).toInt())
            }
        }
        return Pixels(w, h, out)
    }

    /** Лёгкое усиление контраста и насыщенности — пиксель-арт любит яркие, чистые цвета. */
    private fun boostContrast(p: Pixels) {
        for (i in p.argb.indices) {
            val c = p.argb[i]
            var r = ((c shr 16) and 0xFF) / 255f
            var g = ((c shr 8) and 0xFF) / 255f
            var b = (c and 0xFF) / 255f
            val l = 0.299f * r + 0.587f * g + 0.114f * b
            r = l + (r - l) * 1.2f
            g = l + (g - l) * 1.2f
            b = l + (b - l) * 1.2f
            r = (r - 0.5f) * 1.1f + 0.5f
            g = (g - 0.5f) * 1.1f + 0.5f
            b = (b - 0.5f) * 1.1f + 0.5f
            p.argb[i] = rgb((r * 255).roundToInt(), (g * 255).roundToInt(), (b * 255).roundToInt())
        }
    }

    /** Подбор палитры по картинке: k-средних с детерминированной инициализацией. */
    fun extractPalette(p: Pixels, k: Int): IntArray {
        val px = p.argb
        val n = px.size
        val count = min(k, n)
        // Старт — равномерно по яркости, чтобы были и тени, и блики.
        val sorted = px.sortedBy { luma(it) }
        val centers = Array(count) { i -> floatArrayOf(0f, 0f, 0f) }
        for (i in 0 until count) {
            val c = sorted[((i + 0.5) * n / count).toInt().coerceIn(0, n - 1)]
            centers[i][0] = ((c shr 16) and 0xFF).toFloat()
            centers[i][1] = ((c shr 8) and 0xFF).toFloat()
            centers[i][2] = (c and 0xFF).toFloat()
        }
        val assign = IntArray(n)
        repeat(8) {
            for (i in 0 until n) assign[i] = nearestCenter(px[i], centers)
            val sum = Array(count) { DoubleArray(3) }
            val cnt = IntArray(count)
            for (i in 0 until n) {
                val c = px[i]
                val a = assign[i]
                sum[a][0] += ((c shr 16) and 0xFF).toDouble()
                sum[a][1] += ((c shr 8) and 0xFF).toDouble()
                sum[a][2] += (c and 0xFF).toDouble()
                cnt[a]++
            }
            for (j in 0 until count) if (cnt[j] > 0) {
                centers[j][0] = (sum[j][0] / cnt[j]).toFloat()
                centers[j][1] = (sum[j][1] / cnt[j]).toFloat()
                centers[j][2] = (sum[j][2] / cnt[j]).toFloat()
            }
        }
        return centers.map { rgb(it[0].roundToInt(), it[1].roundToInt(), it[2].roundToInt()) }.distinct().toIntArray()
    }

    private val BAYER = intArrayOf(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5)

    /** Сведение к палитре с упорядоченным дизерингом Байера 4×4. */
    fun quantize(p: Pixels, palette: IntArray, dither: Float): Pixels {
        val spread = estimateSpread(palette) * dither
        val out = IntArray(p.argb.size)
        for (y in 0 until p.height) for (x in 0 until p.width) {
            val c = p.argb[y * p.width + x]
            val t = (BAYER[(y and 3) * 4 + (x and 3)] / 16f - 0.5f) * spread
            val r = ((c shr 16) and 0xFF) + t
            val g = ((c shr 8) and 0xFF) + t
            val b = (c and 0xFF) + t
            out[y * p.width + x] = nearest(r, g, b, palette)
        }
        return Pixels(p.width, p.height, out)
    }

    /** Насколько далеко соседние цвета палитры — столько «шума» и подмешиваем. */
    private fun estimateSpread(palette: IntArray): Float {
        if (palette.size < 2) return 0f
        var total = 0f
        for (c in palette) {
            var best = Float.MAX_VALUE
            for (o in palette) if (o != c) best = min(best, dist(c, o))
            total += sqrt(best)
        }
        return total / palette.size
    }

    private fun nearest(r: Float, g: Float, b: Float, palette: IntArray): Int {
        var best = palette[0]
        var bestD = Float.MAX_VALUE
        for (c in palette) {
            val dr = r - ((c shr 16) and 0xFF)
            val dg = g - ((c shr 8) and 0xFF)
            val db = b - (c and 0xFF)
            // Взвешенное расстояние: глаз чувствительнее к зелёному.
            val d = 0.3f * dr * dr + 0.59f * dg * dg + 0.11f * db * db
            if (d < bestD) {
                bestD = d
                best = c
            }
        }
        return best
    }

    private fun nearestCenter(c: Int, centers: Array<FloatArray>): Int {
        val r = ((c shr 16) and 0xFF).toFloat()
        val g = ((c shr 8) and 0xFF).toFloat()
        val b = (c and 0xFF).toFloat()
        var best = 0
        var bestD = Float.MAX_VALUE
        for (i in centers.indices) {
            val dr = r - centers[i][0]
            val dg = g - centers[i][1]
            val db = b - centers[i][2]
            val d = dr * dr + dg * dg + db * db
            if (d < bestD) {
                bestD = d
                best = i
            }
        }
        return best
    }

    private fun dist(a: Int, b: Int): Float {
        val dr = ((a shr 16) and 0xFF) - ((b shr 16) and 0xFF)
        val dg = ((a shr 8) and 0xFF) - ((b shr 8) and 0xFF)
        val db = (a and 0xFF) - (b and 0xFF)
        return (dr * dr + dg * dg + db * db).toFloat()
    }

    private fun luma(c: Int) = 0.299 * ((c shr 16) and 0xFF) + 0.587 * ((c shr 8) and 0xFF) + 0.114 * (c and 0xFF)

    private fun rgb(r: Int, g: Int, b: Int) =
        (0xFF shl 24) or (r.coerceIn(0, 255) shl 16) or (g.coerceIn(0, 255) shl 8) or b.coerceIn(0, 255)

    /** «#rrggbb» → ARGB; неверные строки пропускаются. */
    fun parsePalette(hex: List<String>): List<Int> = hex.mapNotNull { h ->
        if (h.length == 7 && h[0] == '#') h.substring(1).toIntOrNull(16)?.let { it or (0xFF shl 24) } else null
    }
}
