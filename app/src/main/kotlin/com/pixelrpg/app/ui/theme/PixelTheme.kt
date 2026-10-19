package com.pixelrpg.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.pixelrpg.app.R
import kotlinx.serialization.Serializable

/** Палитра темы. Всё в интерфейсе рисуется только этими цветами — так держится пиксельный стиль. */
data class PixelPalette(
    val id: String,
    val name: String,
    val bg: Color,
    val bgDither: Color,
    val panel: Color,
    val panelDeep: Color,
    val border: Color,
    val light: Color,
    val shadow: Color,
    val text: Color,
    val dim: Color,
    val accent: Color,
    val onAccent: Color,
    val accent2: Color,
    val good: Color,
    val bad: Color,
    val gold: Color,
    val scanlines: Boolean = false,
)

object Palettes {
    val DUNGEON = PixelPalette(
        "dungeon", "Подземелье",
        bg = Color(0xFF14141E), bgDither = Color(0xFF1B1B28),
        panel = Color(0xFF232335), panelDeep = Color(0xFF1A1A28),
        border = Color(0xFF0B0B12), light = Color(0xFF3E3E5C), shadow = Color(0xFF111119),
        text = Color(0xFFEAE2CF), dim = Color(0xFF8F8AA3),
        accent = Color(0xFFD9A441), onAccent = Color(0xFF1A1208), accent2 = Color(0xFF6FA8DC),
        good = Color(0xFF7BC96F), bad = Color(0xFFE0574F), gold = Color(0xFFF2C14E),
    )
    val PARCHMENT = PixelPalette(
        "parchment", "Пергамент",
        bg = Color(0xFFD8C08E), bgDither = Color(0xFFCFB57F),
        panel = Color(0xFFF1E2BC), panelDeep = Color(0xFFE6D2A3),
        border = Color(0xFF4A3220), light = Color(0xFFFFF6DC), shadow = Color(0xFFB99A66),
        text = Color(0xFF3A2716), dim = Color(0xFF7D6446),
        accent = Color(0xFF9B2D2D), onAccent = Color(0xFFFFF1D6), accent2 = Color(0xFF2F5D7C),
        good = Color(0xFF3F7A2F), bad = Color(0xFFA3282B), gold = Color(0xFFA8741A),
    )
    val TERMINAL = PixelPalette(
        "terminal", "Терминал",
        bg = Color(0xFF050B05), bgDither = Color(0xFF081208),
        panel = Color(0xFF0A170A), panelDeep = Color(0xFF071007),
        border = Color(0xFF1F5E1F), light = Color(0xFF2E8B2E), shadow = Color(0xFF0B2A0B),
        text = Color(0xFF8CFF8C), dim = Color(0xFF3FA63F),
        accent = Color(0xFFC8FF6A), onAccent = Color(0xFF051005), accent2 = Color(0xFF5EF0D0),
        good = Color(0xFFB6FF8C), bad = Color(0xFFFF6B4A), gold = Color(0xFFE8FF6A),
        scanlines = true,
    )
    val NEON = PixelPalette(
        "neon", "Неон",
        bg = Color(0xFF0D0718), bgDither = Color(0xFF140B24),
        panel = Color(0xFF1B1030), panelDeep = Color(0xFF130A22),
        border = Color(0xFFFF2A6D), light = Color(0xFF3A2466), shadow = Color(0xFF0A0512),
        text = Color(0xFFD1F7FF), dim = Color(0xFF8A7BB8),
        accent = Color(0xFF05D9E8), onAccent = Color(0xFF051014), accent2 = Color(0xFFFF2A6D),
        good = Color(0xFF3DF5A6), bad = Color(0xFFFF4D6D), gold = Color(0xFFFFD84D),
    )
    val GAMEBOY = PixelPalette(
        "gameboy", "Game Boy",
        bg = Color(0xFF9BBC0F), bgDither = Color(0xFF8BAC0F),
        panel = Color(0xFF8BAC0F), panelDeep = Color(0xFF7FA00E),
        border = Color(0xFF0F380F), light = Color(0xFFB4D02A), shadow = Color(0xFF306230),
        text = Color(0xFF0F380F), dim = Color(0xFF306230),
        accent = Color(0xFF306230), onAccent = Color(0xFF9BBC0F), accent2 = Color(0xFF0F380F),
        good = Color(0xFF0F380F), bad = Color(0xFF0F380F), gold = Color(0xFF306230),
    )
    val FOREST = PixelPalette(
        "forest", "Лесная чаща",
        bg = Color(0xFF101A14), bgDither = Color(0xFF14211A),
        panel = Color(0xFF1C2E23), panelDeep = Color(0xFF15241B),
        border = Color(0xFF0A110C), light = Color(0xFF34503D), shadow = Color(0xFF0C140F),
        text = Color(0xFFE6EBD0), dim = Color(0xFF8FA58A),
        accent = Color(0xFFE39B3B), onAccent = Color(0xFF1C1206), accent2 = Color(0xFF9CC6E0),
        good = Color(0xFF9AD66B), bad = Color(0xFFE2624B), gold = Color(0xFFF0C45A),
    )

    val all = listOf(DUNGEON, PARCHMENT, TERMINAL, NEON, GAMEBOY, FOREST)

    fun byId(id: String) = all.firstOrNull { it.id == id } ?: DUNGEON
}

@Serializable
data class UiPrefs(
    val themeId: String = "dungeon",
    val font: String = "tiny5",
    val textScale: Float = 1f,
    /** Символов в секунду; 0 — без эффекта печати. */
    val typeSpeed: Int = 90,
    val crt: Boolean = false,
    val dither: Boolean = true,
)

class PixelStyle(
    val c: PixelPalette,
    val prefs: UiPrefs,
    val body: TextStyle,
    val small: TextStyle,
    val title: TextStyle,
    val label: TextStyle,
    /** Размер «пикселя» рамок. */
    val unit: Dp,
)

val LocalPixel = staticCompositionLocalOf<PixelStyle> { error("PixelTheme не задана") }

object Px {
    val style: PixelStyle @Composable get() = LocalPixel.current
    val c: PixelPalette @Composable get() = LocalPixel.current.c
}

val Tiny5 = FontFamily(Font(R.font.tiny5))
val Handjet = FontFamily(Font(R.font.handjet))
val PressStart = FontFamily(Font(R.font.press_start))

@Composable
fun PixelTheme(prefs: UiPrefs, content: @Composable () -> Unit) {
    val palette = Palettes.byId(prefs.themeId)
    val scale = prefs.textScale
    val bodyFamily = if (prefs.font == "handjet") Handjet else Tiny5
    val bodySize = if (prefs.font == "handjet") 21f else 17f
    val style = PixelStyle(
        c = palette,
        prefs = prefs,
        body = TextStyle(fontFamily = bodyFamily, fontSize = (bodySize * scale).sp, lineHeight = 1.4.em, color = palette.text),
        small = TextStyle(fontFamily = bodyFamily, fontSize = (bodySize * 0.8f * scale).sp, lineHeight = 1.3.em, color = palette.dim),
        title = TextStyle(fontFamily = PressStart, fontSize = (13f * scale).sp, lineHeight = 1.5.em, color = palette.accent),
        label = TextStyle(fontFamily = PressStart, fontSize = (9f * scale).sp, lineHeight = 1.5.em, color = palette.dim),
        unit = 3.dp,
    )
    CompositionLocalProvider(LocalPixel provides style, content = content)
}
