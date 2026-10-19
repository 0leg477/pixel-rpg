package com.pixelrpg.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pixelrpg.ai.Progress
import com.pixelrpg.app.ui.theme.Px
import kotlinx.coroutines.delay

enum class ButtonKind { NORMAL, PRIMARY, DANGER, GHOST }

@Composable
fun PixelPanel(
    modifier: Modifier = Modifier,
    title: String? = null,
    deep: Boolean = false,
    padding: Dp = 12.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val s = Px.style
    val c = s.c
    Column(
        modifier
            .pixelFrame(if (deep) c.panelDeep else c.panel, c.border, c.light, c.shadow, s.unit)
            .padding(padding),
    ) {
        if (title != null) {
            BasicText(title.uppercase(), style = s.label.copy(color = c.accent))
            Spacer(Modifier.height(8.dp))
        }
        content()
    }
}

@Composable
fun PixelButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.NORMAL,
    enabled: Boolean = true,
    small: Boolean = false,
) {
    val s = Px.style
    val c = s.c
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill = when {
        !enabled -> c.panelDeep
        kind == ButtonKind.PRIMARY -> c.accent
        kind == ButtonKind.DANGER -> c.bad
        kind == ButtonKind.GHOST -> c.panelDeep
        else -> c.panel
    }
    val textColor = when {
        !enabled -> c.dim
        kind == ButtonKind.PRIMARY || kind == ButtonKind.DANGER -> c.onAccent
        else -> c.text
    }
    val shift = if (pressed) s.unit / 2 else 0.dp
    Box(
        modifier
            .heightIn(min = if (small) 34.dp else 46.dp)
            .pixelFrame(fill, c.border, if (enabled) c.light else c.panelDeep, c.shadow, s.unit, pressed)
            .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = if (small) 10.dp else 14.dp, vertical = if (small) 6.dp else 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text,
            style = (if (small) s.small else s.body).copy(color = textColor, textAlign = TextAlign.Center),
            modifier = Modifier.offset(x = shift, y = shift),
        )
    }
}

@Composable
fun PixelTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    minLines: Int = 1,
    maxLines: Int = 6,
    password: Boolean = false,
    onSend: (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    val s = Px.style
    val c = s.c
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        textStyle = s.body,
        cursorBrush = SolidColor(c.accent),
        minLines = if (password) 1 else minLines,
        maxLines = if (password) 1 else maxLines,
        singleLine = password,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            capitalization = if (password) KeyboardCapitalization.None else KeyboardCapitalization.Sentences,
            imeAction = if (onSend != null) ImeAction.Send else ImeAction.Default,
        ),
        keyboardActions = KeyboardActions(onSend = { onSend?.invoke() }),
        modifier = modifier,
        decorationBox = { inner ->
            Box(
                Modifier
                    .pixelFrame(c.panelDeep, c.border, c.shadow, c.light, s.unit)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                if (value.isEmpty()) BasicText(placeholder, style = s.body.copy(color = c.dim))
                inner()
            }
        },
    )
}

/** Сегментная полоска ресурса: 12 делений, как в старых играх. */
@Composable
fun PixelBar(label: String, current: Int, max: Int, color: Color, modifier: Modifier = Modifier) {
    val s = Px.style
    val c = s.c
    Column(modifier) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            BasicText(label, style = s.small.copy(color = c.text))
            BasicText("$current/$max", style = s.small)
        }
        Spacer(Modifier.height(2.dp))
        Canvas(Modifier.fillMaxWidth().height(10.dp)) {
            val segments = 12
            val gap = 2.dp.toPx()
            val w = (size.width - gap * (segments - 1)) / segments
            val filled = if (max <= 0) 0f else current.toFloat() / max * segments
            for (i in 0 until segments) {
                val x = i * (w + gap)
                drawRect(c.border, Offset(x, 0f), Size(w, size.height))
                val fill = when {
                    i + 1 <= filled -> color
                    i < filled -> color.copy(alpha = 0.5f)
                    else -> c.panelDeep
                }
                drawRect(fill, Offset(x + 1, 1f), Size(w - 2, size.height - 2))
            }
        }
    }
}

@Composable
fun PixelChip(text: String, color: Color, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val s = Px.style
    val c = s.c
    Box(
        modifier
            .pixelFrame(c.panelDeep, color, c.panelDeep, c.panelDeep, 2.dp)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        BasicText(text, style = s.small.copy(color = color))
    }
}

@Composable
fun PixelLabel(text: String, modifier: Modifier = Modifier, color: Color? = null) {
    val s = Px.style
    BasicText(text.uppercase(), style = s.label.copy(color = color ?: s.c.dim), modifier = modifier)
}

@Composable
fun PixelText(text: String, modifier: Modifier = Modifier, style: TextStyle? = null, color: Color? = null) {
    val s = Px.style
    val base = style ?: s.body
    BasicText(text, style = if (color != null) base.copy(color = color) else base, modifier = modifier)
}

@Composable
fun PixelTitle(text: String, modifier: Modifier = Modifier, color: Color? = null) {
    val s = Px.style
    BasicText(text, style = s.title.copy(color = color ?: s.c.accent), modifier = modifier)
}

/** Пунктирный разделитель. */
@Composable
fun PixelDivider(modifier: Modifier = Modifier) {
    val c = Px.c
    Canvas(modifier.fillMaxWidth().height(3.dp)) {
        val step = 6.dp.toPx()
        var x = 0f
        while (x < size.width) {
            drawRect(c.light, Offset(x, 0f), Size(step / 2, size.height))
            x += step
        }
    }
}

/** Мигающий блок-курсор — пока что-то печатается или думается. */
@Composable
fun BlinkingCursor(color: Color, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "cursor")
    val a by t.animateFloat(1f, 0f, infiniteRepeatable(tween(500, easing = LinearEasing), RepeatMode.Reverse), label = "a")
    Canvas(modifier.size(10.dp, 16.dp)) { drawRect(color.copy(alpha = a)) }
}

/**
 * Индикатор ожидания: мигающий курсор, этап, время с начала и — если известен — прогресс в процентах.
 * [onCancel] добавляет кнопку «Отмена» для долгих генераций.
 */
@Composable
fun LoadingLine(text: String, modifier: Modifier = Modifier, progress: Progress? = null, onCancel: (() -> Unit)? = null) {
    val s = Px.style
    val c = s.c
    val t = rememberInfiniteTransition(label = "dots")
    val phase by t.animateFloat(0f, 4f, infiniteRepeatable(tween(1200, easing = LinearEasing)), label = "p")
    val start = remember { System.currentTimeMillis() }
    var now by remember { mutableLongStateOf(start) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            now = System.currentTimeMillis()
        }
    }
    val seconds = ((now - start) / 1000).toInt()
    val elapsed = "%d:%02d".format(seconds / 60, seconds % 60)
    Column(modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BlinkingCursor(c.accent)
            Spacer(Modifier.width(8.dp))
            BasicText(
                text.trimEnd('…', '.') + ".".repeat(phase.toInt().coerceIn(0, 3)),
                style = s.small.copy(color = c.accent),
                modifier = Modifier.weight(1f),
            )
            BasicText(elapsed, style = s.small)
        }
        if (progress != null) {
            Spacer(Modifier.height(6.dp))
            val percent = (progress.fraction * 100).toInt()
            Row(Modifier.fillMaxWidth()) {
                BasicText(progress.label, style = s.small.copy(color = c.text), modifier = Modifier.weight(1f))
                BasicText("$percent%", style = s.small.copy(color = c.accent))
            }
            Spacer(Modifier.height(3.dp))
            Canvas(Modifier.fillMaxWidth().height(12.dp)) {
                val segments = 20
                val gap = 2.dp.toPx()
                val w = (size.width - gap * (segments - 1)) / segments
                val filled = progress.fraction * segments
                for (i in 0 until segments) {
                    val x = i * (w + gap)
                    drawRect(c.border, Offset(x, 0f), Size(w, size.height))
                    drawRect(if (i < filled) c.accent else c.panelDeep, Offset(x + 1, 1f), Size(w - 2, size.height - 2))
                }
            }
        }
        if (onCancel != null) {
            Spacer(Modifier.height(8.dp))
            PixelButton("Отмена", onCancel, small = true, kind = ButtonKind.GHOST)
        }
    }
}

/** Переключатель «вкл/выкл». */
@Composable
fun PixelToggle(label: String, checked: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val s = Px.style
    val c = s.c
    Row(
        modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicText(label, style = s.body, modifier = Modifier.weight(1f))
        Box(
            Modifier.size(52.dp, 26.dp).pixelFrame(if (checked) c.accent else c.panelDeep, c.border, c.light, c.shadow, 2.dp),
            contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(Modifier.padding(4.dp).size(16.dp).pixelFrame(c.text, c.border, c.light, c.shadow, 2.dp))
        }
    }
}

/** Выбор из списка стрелками ‹ › — удобно большим пальцем. */
@Composable
fun <T> PixelSelector(label: String, options: List<T>, selected: T, title: (T) -> String, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    val s = Px.style
    val index = options.indexOf(selected).coerceAtLeast(0)
    Column(modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        BasicText(label, style = s.small)
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelButton("‹", { onSelect(options[(index - 1 + options.size) % options.size]) }, small = true)
            BasicText(
                title(options[index]),
                style = s.body.copy(textAlign = TextAlign.Center),
                modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
            )
            PixelButton("›", { onSelect(options[(index + 1) % options.size]) }, small = true)
        }
    }
}
