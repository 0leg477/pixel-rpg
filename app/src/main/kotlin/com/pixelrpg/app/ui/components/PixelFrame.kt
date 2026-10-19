package com.pixelrpg.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas as GraphicsCanvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pixelrpg.app.ui.theme.Px
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Рамка в духе старых RPG: срезанные углы, тёмный контур и объёмная фаска.
 * [pressed] меняет местами свет и тень — кнопка «вдавливается».
 */
fun Modifier.pixelFrame(
    fill: Color,
    border: Color,
    light: Color,
    shadow: Color,
    unit: Dp,
    pressed: Boolean = false,
): Modifier = drawBehind { drawPixelFrame(fill, border, light, shadow, unit.toPx(), pressed) }

fun DrawScope.drawPixelFrame(fill: Color, border: Color, light: Color, shadow: Color, unitPx: Float, pressed: Boolean = false) {
    val u = max(1f, unitPx.roundToInt().toFloat())
    val w = size.width
    val h = size.height
    if (w < 3 * u || h < 3 * u) return
    drawRect(fill, Offset(u, u), Size(w - 2 * u, h - 2 * u))
    drawRect(border, Offset(u, 0f), Size(w - 2 * u, u))
    drawRect(border, Offset(u, h - u), Size(w - 2 * u, u))
    drawRect(border, Offset(0f, u), Size(u, h - 2 * u))
    drawRect(border, Offset(w - u, u), Size(u, h - 2 * u))
    val hl = if (pressed) shadow else light
    val sh = if (pressed) light else shadow
    drawRect(hl, Offset(u, u), Size(w - 2 * u, u))
    drawRect(hl, Offset(u, u), Size(u, h - 2 * u))
    drawRect(sh, Offset(u, h - 2 * u), Size(w - 2 * u, u))
    drawRect(sh, Offset(w - 2 * u, u), Size(u, h - 2 * u))
}

/** Фон экрана: мелкий дизеринг и, по желанию, строчная развёртка ЭЛТ. */
@Composable
fun PixelBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val style = Px.style
    val c = style.c
    val cell = with(LocalDensity.current) { style.unit.toPx().roundToInt().coerceAtLeast(1) }
    val brush = remember(c.bg, c.bgDither, style.prefs.dither, cell) {
        if (!style.prefs.dither) null else {
            val n = 4
            val bmp = ImageBitmap(n * cell, n * cell)
            val canvas = GraphicsCanvas(bmp)
            val paint = Paint()
            for (x in 0 until n) for (y in 0 until n) {
                paint.color = if (x == y % n && y % 2 == 0) c.bgDither else c.bg
                canvas.drawRect(
                    (x * cell).toFloat(), (y * cell).toFloat(),
                    ((x + 1) * cell).toFloat(), ((y + 1) * cell).toFloat(), paint,
                )
            }
            ShaderBrush(ImageShader(bmp, TileMode.Repeated, TileMode.Repeated))
        }
    }
    val crt = c.scanlines || style.prefs.crt
    Box(
        modifier
            .drawBehind {
                drawRect(c.bg)
                brush?.let { drawRect(it) }
            }
            .drawWithContent {
                drawContent()
                if (crt) {
                    val step = 3.dp.toPx()
                    val line = Color.Black.copy(alpha = 0.2f)
                    var y = 0f
                    while (y < size.height) {
                        drawRect(line, Offset(0f, y), Size(size.width, step / 3f))
                        y += step
                    }
                }
            },
        content = content,
    )
}

/** Пиксельный кубик d6 с точками. */
@Composable
fun PixelDie(value: Int, color: Color, pip: Color, modifier: Modifier = Modifier) {
    val c = Px.c
    Canvas(modifier) {
        val u = size.minDimension / 9f
        drawPixelFrame(color, c.border, Color.White.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.25f), u)
        val spots = when (value) {
            1 -> listOf(4 to 4)
            2 -> listOf(2 to 2, 6 to 6)
            3 -> listOf(2 to 2, 4 to 4, 6 to 6)
            4 -> listOf(2 to 2, 6 to 2, 2 to 6, 6 to 6)
            5 -> listOf(2 to 2, 6 to 2, 4 to 4, 2 to 6, 6 to 6)
            else -> listOf(2 to 2, 6 to 2, 2 to 4, 6 to 4, 2 to 6, 6 to 6)
        }
        spots.forEach { (x, y) -> drawRect(pip, Offset(x * u, y * u), Size(u, u)) }
    }
}
