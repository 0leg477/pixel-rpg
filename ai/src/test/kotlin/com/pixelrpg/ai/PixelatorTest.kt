package com.pixelrpg.ai

import com.pixelrpg.ai.image.Pixelator
import com.pixelrpg.ai.image.Pixels
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PixelatorTest {

    /** Плавная «картина»: небо-градиент, солнце, холмы — чтобы было что сводить к палитре. */
    private fun scene(w: Int, h: Int): Pixels {
        val px = IntArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            val t = y.toFloat() / h
            var r = (40 + 160 * t).toInt()
            var g = (60 + 90 * t).toInt()
            var b = (140 + 60 * (1 - t)).toInt()
            val dx = x - w * 0.7
            val dy = y - h * 0.3
            if (dx * dx + dy * dy < (h * 0.08) * (h * 0.08)) { r = 255; g = 220; b = 120 }
            val hill = h * (0.65 + 0.08 * sin(x / (w / 6.0)))
            if (y > hill) { r = (30 + (y - hill) / 3).toInt(); g = (90 + (x % 37)).toInt(); b = 40 }
            px[y * w + x] = (0xFF shl 24) or (r.coerceIn(0, 255) shl 16) or (g.coerceIn(0, 255) shl 8) or b.coerceIn(0, 255)
        }
        return Pixels(w, h, px)
    }

    private fun load(f: File): Pixels {
        val img = ImageIO.read(f)
        val px = IntArray(img.width * img.height)
        img.getRGB(0, 0, img.width, img.height, px, 0, img.width)
        return Pixels(img.width, img.height, px)
    }

    private fun save(p: Pixels, scale: Int, f: File) {
        val img = BufferedImage(p.width * scale, p.height * scale, BufferedImage.TYPE_INT_RGB)
        for (y in 0 until img.height) for (x in 0 until img.width) img.setRGB(x, y, p.argb[(y / scale) * p.width + x / scale])
        f.parentFile.mkdirs()
        ImageIO.write(img, "png", f)
    }

    @Test
    fun `result is small and uses few colors`() {
        val out = Pixelator.pixelate(scene(1024, 576), targetWidth = 160, colors = 16)
        assertEquals(160, out.width)
        assertEquals(90, out.height)
        assertTrue(out.argb.toSet().size <= 16)
        save(out, 4, File("build/pixelator/synthetic.png"))
    }

    @Test
    fun `fixed palette is respected`() {
        val palette = Pixelator.parsePalette(listOf("#0f380f", "#306230", "#8bac0f", "#9bbc0f"))
        val out = Pixelator.pixelate(scene(640, 360), targetWidth = 120, palette = palette)
        assertTrue(out.argb.all { it in palette })
        save(out, 4, File("build/pixelator/gameboy.png"))
    }

    /** Ручная проверка на настоящей картинке: PIXELATE_IN=/path/to/image.png */
    @Test
    fun `pixelate a real picture when given`() {
        val path = System.getenv("PIXELATE_IN") ?: return
        val src = load(File(path))
        save(Pixelator.pixelate(src, 160), 4, File("build/pixelator/real-auto.png"))
        save(Pixelator.pixelateRamp(src, 120, Pixelator.parsePalette(listOf("#14141E", "#3E3E5C", "#8F8AA3", "#D9A441", "#EAE2CF"))), 4, File("build/pixelator/real-theme.png"))
        save(Pixelator.pixelateRamp(src, 120, Pixelator.parsePalette(listOf("#0f380f", "#306230", "#8bac0f", "#9bbc0f"))), 4, File("build/pixelator/real-gameboy.png"))
    }
}
