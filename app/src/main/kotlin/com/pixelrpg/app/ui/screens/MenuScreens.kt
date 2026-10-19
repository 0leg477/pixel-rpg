package com.pixelrpg.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pixelrpg.ai.AiSettings
import com.pixelrpg.ai.LlmTask
import com.pixelrpg.app.AppViewModel
import com.pixelrpg.app.Screen
import com.pixelrpg.app.ui.components.ButtonKind
import com.pixelrpg.app.ui.components.PixelButton
import com.pixelrpg.app.ui.components.PixelDivider
import com.pixelrpg.app.ui.components.PixelLabel
import com.pixelrpg.app.ui.components.PixelPanel
import com.pixelrpg.app.ui.components.PixelSelector
import com.pixelrpg.app.ui.components.PixelText
import com.pixelrpg.app.ui.components.PixelTextField
import com.pixelrpg.app.ui.components.PixelTitle
import com.pixelrpg.app.ui.components.PixelToggle
import com.pixelrpg.app.ui.components.pixelFrame
import com.pixelrpg.app.ui.theme.Palettes
import com.pixelrpg.app.ui.theme.PixelTheme
import com.pixelrpg.app.ui.theme.Px
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MenuScreen(vm: AppViewModel) {
    val worlds by vm.worlds.collectAsStateWithLifecycle()
    val s = Px.style
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        Logo()
        Spacer(Modifier.height(16.dp))
        PixelTitle("ПИКСЕЛЬНЫЕ", color = s.c.text)
        Spacer(Modifier.height(6.dp))
        PixelTitle("ХРОНИКИ")
        Spacer(Modifier.height(8.dp))
        PixelText("бесконечная текстовая RPG", style = s.small)
        Spacer(Modifier.height(32.dp))

        if (!vm.hasKey) {
            PixelPanel(Modifier.fillMaxWidth(), title = "Нужен ключ") {
                PixelText("Чтобы мир ожил, добавь API-ключ Claude в настройках.", style = s.small.copy(color = s.c.text))
                Spacer(Modifier.height(8.dp))
                PixelButton("Открыть настройки", { vm.go(Screen.SETTINGS) }, Modifier.fillMaxWidth(), kind = ButtonKind.PRIMARY)
            }
            Spacer(Modifier.height(16.dp))
        }

        val buttons = Modifier.fillMaxWidth()
        if (worlds.isNotEmpty()) {
            val last = worlds.first()
            PixelButton("Продолжить: ${last.heroName}", { vm.continueLast() }, buttons, kind = ButtonKind.PRIMARY)
            Spacer(Modifier.height(10.dp))
        }
        PixelButton("Новый мир", { vm.openWorkshop(fresh = true) }, buttons, kind = if (worlds.isEmpty()) ButtonKind.PRIMARY else ButtonKind.NORMAL)
        if (vm.hasDraft) {
            Spacer(Modifier.height(10.dp))
            PixelButton("Вернуться к черновику мира", { vm.openWorkshop(fresh = false) }, buttons)
        }
        if (worlds.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            PixelButton("Мои миры (${worlds.size})", { vm.go(Screen.WORLDS) }, buttons)
        }
        Spacer(Modifier.height(10.dp))
        PixelButton("Настройки", { vm.go(Screen.SETTINGS) }, buttons)
    }
}

/** Пиксельный меч — эмблема игры. */
@Composable
private fun Logo() {
    val c = Px.c
    Canvas(Modifier.size(96.dp)) {
        val u = size.minDimension / 16f
        fun px(r: Int, col: Int, color: androidx.compose.ui.graphics.Color) = drawRect(color, Offset(col * u, r * u), Size(u, u))
        for (r in 0..9) {
            px(r, 15 - r, c.text)
            if (16 - r <= 15) px(r, 16 - r, c.dim)
        }
        listOf(8 to 3, 9 to 4, 10 to 5, 11 to 6, 12 to 7).forEach { (r, col) -> px(r, col, c.gold) }
        listOf(11 to 4, 12 to 3, 13 to 2).forEach { (r, col) -> px(r, col, c.shadow) }
        listOf(14 to 0, 14 to 1, 15 to 0, 15 to 1).forEach { (r, col) -> px(r, col, c.bad) }
        listOf(2 to 4, 1 to 4, 3 to 4, 2 to 3, 2 to 5).forEach { (r, col) -> px(r, col, c.accent2) }
    }
}

@Composable
fun WorldsScreen(vm: AppViewModel) {
    val worlds by vm.worlds.collectAsStateWithLifecycle()
    val s = Px.style
    var confirm by remember { mutableStateOf<String?>(null) }
    val fmt = remember { SimpleDateFormat("d MMM, HH:mm", Locale("ru")) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelButton("‹", { vm.go(Screen.MENU) }, small = true)
            Spacer(Modifier.width(12.dp))
            PixelTitle("Мои миры")
        }
        Spacer(Modifier.height(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(worlds, key = { it.id }) { w ->
                PixelPanel(Modifier.fillMaxWidth()) {
                    PixelText(w.title, style = s.body.copy(color = s.c.accent))
                    PixelText("${w.heroName} · ${w.place}", style = s.small.copy(color = s.c.text))
                    PixelText("День ${w.day} · ходов: ${w.turn} · ${fmt.format(Date(w.updatedAt))}", style = s.small)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PixelButton("Играть", { vm.openWorld(w.id) }, Modifier.weight(1f), kind = ButtonKind.PRIMARY, small = true)
                        PixelButton("Удалить", { confirm = w.id }, small = true, kind = ButtonKind.GHOST)
                    }
                }
            }
        }
    }
    confirm?.let { id ->
        ConfirmDialog("Удалить мир навсегда?", "Удалить", onConfirm = { vm.deleteWorld(id); confirm = null }, onDismiss = { confirm = null })
    }
}

@Composable
fun SettingsScreen(vm: AppViewModel) {
    val prefs by vm.uiPrefs.collectAsStateWithLifecycle()
    val ai by vm.ai.collectAsStateWithLifecycle()
    var key by remember(ai.apiKey) { mutableStateOf(ai.apiKey) }
    var showKey by remember { mutableStateOf(false) }
    val s = Px.style
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelButton("‹", { vm.back() }, small = true)
            Spacer(Modifier.width(12.dp))
            PixelTitle("Настройки")
        }
        Spacer(Modifier.height(16.dp))

        PixelPanel(Modifier.fillMaxWidth(), title = "Claude API") {
            PixelText("Ключ хранится только на этом телефоне, в зашифрованном виде. Получить: console.anthropic.com", style = s.small)
            Spacer(Modifier.height(8.dp))
            PixelTextField(key, { key = it }, Modifier.fillMaxWidth(), placeholder = "sk-ant-…", password = !showKey)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PixelButton(if (showKey) "Скрыть" else "Показать", { showKey = !showKey }, small = true)
                PixelButton("Сохранить ключ", { vm.saveAi(ai.copy(apiKey = key)) }, Modifier.weight(1f), kind = ButtonKind.PRIMARY, small = true, enabled = key != ai.apiKey)
            }
        }
        Spacer(Modifier.height(14.dp))

        PixelPanel(Modifier.fillMaxWidth(), title = "Оформление") {
            PixelSelector("Тема", Palettes.all, Palettes.byId(prefs.themeId), { it.name }, { vm.saveUi(prefs.copy(themeId = it.id)) })
            ThemePreview(prefs.themeId)
            PixelSelector("Шрифт", listOf("tiny5", "handjet"), prefs.font, { if (it == "tiny5") "Пиксельный" else "Узкий" }, { vm.saveUi(prefs.copy(font = it)) })
            PixelSelector(
                "Размер текста", listOf(0.85f, 1f, 1.15f, 1.3f), prefs.textScale,
                { when (it) { 0.85f -> "Мелкий"; 1f -> "Обычный"; 1.15f -> "Крупный"; else -> "Очень крупный" } },
                { vm.saveUi(prefs.copy(textScale = it)) },
            )
            PixelSelector(
                "Печать текста", listOf(40, 90, 200, 0), prefs.typeSpeed,
                { when (it) { 40 -> "Медленно"; 90 -> "Обычно"; 200 -> "Быстро"; else -> "Сразу весь текст" } },
                { vm.saveUi(prefs.copy(typeSpeed = it)) },
            )
            PixelToggle("Эффект старого экрана", prefs.crt, { vm.saveUi(prefs.copy(crt = it)) })
            PixelToggle("Пиксельный узор фона", prefs.dither, { vm.saveUi(prefs.copy(dither = it)) })
        }
        Spacer(Modifier.height(14.dp))

        PixelPanel(Modifier.fillMaxWidth(), title = "Модели ИИ") {
            PixelText("Для каждой задачи можно выбрать свою модель. Haiku — быстрее и дешевле, Sonnet и Opus — умнее и дороже.", style = s.small)
            Spacer(Modifier.height(6.dp))
            LlmTask.entries.forEach { task ->
                val cfg = ai.config(task)
                PixelSelector(
                    task.title, AiSettings.MODELS.map { it.first }, cfg.model,
                    { id -> AiSettings.MODELS.firstOrNull { it.first == id }?.second ?: id },
                    { vm.saveAi(ai.copy(tasks = ai.tasks + (task to cfg.copy(model = it)))) },
                )
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** Мини-предпросмотр темы: панель, кнопка, текст в её цветах. */
@Composable
private fun ThemePreview(themeId: String) {
    val current = Px.style.prefs
    PixelTheme(current.copy(themeId = themeId)) {
        val c = Px.c
        Box(Modifier.fillMaxWidth().padding(vertical = 6.dp).pixelFrame(c.bg, c.border, c.bgDither, c.bgDither, Px.style.unit).padding(10.dp)) {
            Column {
                PixelPanel(Modifier.fillMaxWidth(), padding = 8.dp) {
                    PixelText("Стражник щурится: «Проходи, путник».")
                    PixelText("+ Ржавый ключ", style = Px.style.small.copy(color = c.good))
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PixelButton("Действие", {}, small = true, kind = ButtonKind.PRIMARY)
                    PixelButton("Ещё", {}, small = true)
                }
            }
        }
    }
}

@Composable
fun MessageDialog(text: String, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        PixelPanel(Modifier.fillMaxWidth()) {
            PixelText(text)
            Spacer(Modifier.height(12.dp))
            PixelButton("Понятно", onDismiss, Modifier.fillMaxWidth(), kind = ButtonKind.PRIMARY)
        }
    }
}

@Composable
fun ConfirmDialog(text: String, confirm: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        PixelPanel(Modifier.fillMaxWidth()) {
            PixelText(text, style = Px.style.body.copy(textAlign = TextAlign.Center), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PixelButton("Отмена", onDismiss, Modifier.weight(1f))
                PixelButton(confirm, onConfirm, Modifier.weight(1f), kind = ButtonKind.DANGER)
            }
        }
    }
}

@Composable
fun SectionHeader(text: String) {
    Spacer(Modifier.height(10.dp))
    PixelLabel(text, color = Px.c.accent)
    Spacer(Modifier.height(4.dp))
    PixelDivider()
    Spacer(Modifier.height(6.dp))
}
