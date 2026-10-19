package com.pixelrpg.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pixelrpg.app.ui.theme.Px

/** Иконки 8×8, нарисованные по клеткам: в пиксельных шрифтах таких значков нет. */
enum class PixelIcon(vararg rows: String) {
    SEND(
        "X.......",
        "XXX.....",
        "XXXXX...",
        "XXXXXXX.",
        "XXXXX...",
        "XXX.....",
        "X.......",
        "........",
    ),
    MENU(
        "........",
        "XXXXXXXX",
        "........",
        "XXXXXXXX",
        "........",
        "XXXXXXXX",
        "........",
        "........",
    ),
    PICTURE(
        "XXXXXXXX",
        "X....X.X",
        "X......X",
        "X..X...X",
        "X.XXX..X",
        "XXXXXX.X",
        "XXXXXXXX",
        "........",
    ),
    COIN(
        "...XX...",
        "..XXXX..",
        ".XXXXXX.",
        "XXXXXXXX",
        ".XXXXXX.",
        "..XXXX..",
        "...XX...",
        "........",
    ),
    CHECK(
        "........",
        ".......X",
        "......XX",
        "X....XX.",
        "XX..XX..",
        ".XXXX...",
        "..XX....",
        "........",
    ),
    CROSS(
        "X......X",
        "XX....XX",
        ".XX..XX.",
        "..XXXX..",
        "..XXXX..",
        ".XX..XX.",
        "XX....XX",
        "X......X",
    ),
    DIAMOND(
        "...XX...",
        "..X..X..",
        ".X....X.",
        "X......X",
        ".X....X.",
        "..X..X..",
        "...XX...",
        "........",
    ),
    ;

    val cells: List<Pair<Int, Int>> = rows.flatMapIndexed { y, row ->
        row.mapIndexedNotNull { x, ch -> if (ch == 'X') x to y else null }
    }
}

@Composable
fun PixelIconView(icon: PixelIcon, color: Color, size: Dp = 16.dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val u = this.size.minDimension / 8f
        icon.cells.forEach { (x, y) -> drawRect(color, Offset(x * u, y * u), Size(u, u)) }
    }
}

/** Квадратная кнопка с пиксельной иконкой. */
@Composable
fun PixelIconButton(icon: PixelIcon, onClick: () -> Unit, modifier: Modifier = Modifier, kind: ButtonKind = ButtonKind.NORMAL, enabled: Boolean = true) {
    val s = Px.style
    val c = s.c
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill = when {
        !enabled -> c.panelDeep
        kind == ButtonKind.PRIMARY -> c.accent
        kind == ButtonKind.DANGER -> c.bad
        else -> c.panel
    }
    val tint = when {
        !enabled -> c.dim
        kind == ButtonKind.PRIMARY || kind == ButtonKind.DANGER -> c.onAccent
        else -> c.text
    }
    val shift = if (pressed) s.unit / 2 else 0.dp
    Box(
        modifier
            .size(46.dp)
            .pixelFrame(fill, c.border, if (enabled) c.light else c.panelDeep, c.shadow, s.unit, pressed)
            .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
            .padding(13.dp),
        contentAlignment = Alignment.Center,
    ) {
        PixelIconView(icon, tint, 18.dp, Modifier.offset(shift, shift))
    }
}
