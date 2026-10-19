package com.pixelrpg.app.ui.screens

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pixelrpg.ai.view.Entry
import com.pixelrpg.ai.view.GameSession
import com.pixelrpg.ai.view.Hud
import com.pixelrpg.ai.view.ItemRow
import com.pixelrpg.ai.view.SessionUi
import com.pixelrpg.app.AppViewModel
import com.pixelrpg.app.Screen
import com.pixelrpg.app.ui.components.ButtonKind
import com.pixelrpg.app.ui.components.BlinkingCursor
import com.pixelrpg.app.ui.components.LoadingLine
import com.pixelrpg.app.ui.components.PixelBar
import com.pixelrpg.app.ui.components.PixelButton
import com.pixelrpg.app.ui.components.PixelChip
import com.pixelrpg.app.ui.components.PixelDie
import com.pixelrpg.app.ui.components.PixelIcon
import com.pixelrpg.app.ui.components.PixelIconButton
import com.pixelrpg.app.ui.components.PixelIconView
import com.pixelrpg.app.ui.components.PixelLabel
import com.pixelrpg.app.ui.components.PixelPanel
import com.pixelrpg.app.ui.components.PixelText
import com.pixelrpg.app.ui.components.PixelTextField
import com.pixelrpg.app.ui.components.PixelTitle
import com.pixelrpg.app.ui.components.pixelFrame
import com.pixelrpg.app.ui.theme.Px
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.QuestStatus
import com.pixelrpg.engine.rules.CheckResult
import com.pixelrpg.engine.rules.Outcome
import com.pixelrpg.engine.turn.Tone
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.random.Random

private enum class Tab(val title: String) { STORY("История"), HERO("Герой"), ITEMS("Вещи"), JOURNAL("Журнал"), WORLD("Мир") }

@Composable
fun GameScreen(vm: AppViewModel) {
    val sessionState by vm.session.collectAsStateWithLifecycle()
    val session = sessionState ?: return
    val ui by session.ui.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(Tab.STORY) }
    val send: (String) -> Unit = { text ->
        session.send(text)
        tab = Tab.STORY
    }

    Column(Modifier.fillMaxSize()) {
        TopBar(ui.hud, onMenu = { vm.go(Screen.MENU) })
        StatusStrip(ui.hud)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                Tab.STORY -> StoryTab(session, ui, send)
                Tab.HERO -> HeroTab(ui.hud)
                Tab.ITEMS -> ItemsTab(ui.hud, ui.busy, send)
                Tab.JOURNAL -> JournalTab(ui.hud)
                Tab.WORLD -> WorldTab(ui.hud, ui.busy, send)
            }
        }
        TabBar(tab) { tab = it }
    }
}

@Composable
private fun TopBar(hud: Hud, onMenu: () -> Unit) {
    val s = Px.style
    val c = s.c
    Row(
        Modifier.fillMaxWidth().pixelFrame(c.panel, c.border, c.light, c.shadow, s.unit).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PixelIconButton(PixelIcon.MENU, onMenu)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            PixelText(hud.place, style = s.title.copy(fontSize = s.label.fontSize * 1.25f))
            PixelText(hud.time, style = s.small)
        }
        if (hud.inCombat) PixelChip("БОЙ", c.bad)
    }
}

@Composable
private fun StatusStrip(hud: Hud) {
    val s = Px.style
    val c = s.c
    Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            hud.resources.take(3).forEach { r ->
                PixelBar(r.name, r.current, r.max, r.color?.let { Color(it) } ?: if (r.health) c.bad else c.accent2, Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelIconView(PixelIcon.COIN, c.gold, 12.dp)
            Spacer(Modifier.width(6.dp))
            PixelText(hud.money, style = s.small.copy(color = c.gold), modifier = Modifier.weight(1f))
            hud.conditions.take(3).forEach {
                Spacer(Modifier.width(4.dp))
                PixelChip(it, c.accent2)
            }
        }
    }
}

@Composable
private fun TabBar(selected: Tab, onSelect: (Tab) -> Unit) {
    val s = Px.style
    val c = s.c
    Row(Modifier.fillMaxWidth().pixelFrame(c.panel, c.border, c.light, c.shadow, s.unit).padding(4.dp)) {
        Tab.entries.forEach { t ->
            val active = t == selected
            Box(
                Modifier
                    .weight(1f)
                    .padding(2.dp)
                    .let { if (active) it.pixelFrame(c.accent, c.border, c.light, c.shadow, 2.dp) else it }
                    .clickable { onSelect(t) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                PixelText(t.title, style = s.small.copy(color = if (active) c.onAccent else c.text))
            }
        }
    }
}

// ---------- История ----------

/** Печать текста: сколько символов «живого» текста уже показано. */
private class Typing {
    var shown by mutableIntStateOf(Int.MAX_VALUE)
    var armed by mutableStateOf(false)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StoryTab(session: GameSession, ui: SessionUi, send: (String) -> Unit) {
    val s = Px.style
    val c = s.c
    val speed = s.prefs.typeSpeed
    val typing = remember { Typing() }
    var input by rememberSaveable { mutableStateOf("") }
    val list = rememberLazyListState()

    // Новый ход: печатаем с нуля.
    LaunchedEffect(ui.busy) {
        if (ui.busy && !ui.painting) {
            typing.shown = 0
            typing.armed = speed > 0
        }
    }
    val lastStory = ui.entries.lastOrNull() as? Entry.Story
    val liveText = when {
        ui.streaming.isNotEmpty() -> ui.streaming
        typing.armed && lastStory != null -> lastStory.text
        else -> ""
    }
    LaunchedEffect(liveText.length, speed) {
        if (speed <= 0) {
            typing.shown = Int.MAX_VALUE
            return@LaunchedEffect
        }
        while (typing.shown < liveText.length) {
            delay(16)
            typing.shown = minOf(liveText.length, typing.shown + maxOf(1, speed * 16 / 1000))
        }
        if (!ui.busy && ui.streaming.isEmpty()) typing.armed = false
    }

    val total = ui.entries.size + 2
    LaunchedEffect(ui.entries.size, typing.shown / 60, ui.stage, ui.error) {
        val lastVisible = list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
        if (lastVisible >= list.layoutInfo.totalItemsCount - 3) list.scrollToItem(maxOf(0, total - 1))
    }

    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            state = list,
            modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item(key = "top") { Spacer(Modifier.height(6.dp)) }
            items(ui.entries, key = { it.key }) { e ->
                when (e) {
                    is Entry.Player -> PlayerLine(e.text)
                    is Entry.Story -> {
                        val live = typing.armed && e === lastStory && ui.streaming.isEmpty()
                        StoryText(if (live) e.text.take(typing.shown) else e.text, cursor = live && typing.shown < e.text.length)
                    }
                    is Entry.Roll -> RollCard(e.check, animate = ui.freshRoll == e.check && ui.busy)
                    is Entry.Changes -> ChangesRow(e.changes)
                    is Entry.System -> PixelText("~ ${e.text}", style = s.small)
                    is Entry.Image -> SceneImage(e.path, e.caption)
                }
            }
            item(key = "live") {
                Column {
                    if (ui.streaming.isNotEmpty()) StoryText(ui.streaming.take(typing.shown), cursor = true)
                    if (ui.busy && ui.streaming.isEmpty()) LoadingLine(ui.stage ?: "…", progress = ui.progress, onCancel = session::cancel)
                    ui.error?.let { ErrorPanel(it, canRetry = ui.lastInput != null || ui.entries.none { e -> e is Entry.Story }, onRetry = session::retry, onClose = session::dismissError) }
                    if (ui.hud.gameOver) {
                        PixelPanel(Modifier.fillMaxWidth(), title = "Конец") {
                            PixelText("История этого героя окончена. Его мир сохранится в списке миров.")
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }

        if (!ui.busy && ui.suggestions.isNotEmpty() && !ui.hud.gameOver) {
            FlowRow(
                Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                ui.suggestions.forEach { sug -> PixelButton(sug, { send(sug) }, small = true, kind = ButtonKind.GHOST) }
            }
        }
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.Bottom) {
            val submit = {
                if (input.isNotBlank() && !ui.busy) {
                    send(input)
                    input = ""
                }
            }
            PixelIconButton(PixelIcon.PICTURE, { session.paint() }, enabled = !ui.busy && !ui.hud.gameOver)
            Spacer(Modifier.width(6.dp))
            PixelTextField(
                input, { input = it }, Modifier.weight(1f),
                placeholder = if (ui.busy) "Мир отвечает…" else "Что ты делаешь?",
                maxLines = 4, onSend = submit, enabled = !ui.hud.gameOver,
            )
            Spacer(Modifier.width(6.dp))
            PixelIconButton(PixelIcon.SEND, submit, kind = ButtonKind.PRIMARY, enabled = !ui.busy && input.isNotBlank())
        }
    }
}

@Composable
private fun PlayerLine(text: String) {
    val s = Px.style
    val c = s.c
    Row(Modifier.fillMaxWidth()) {
        Canvas(Modifier.width(4.dp).height(22.dp)) { drawRect(c.accent2) }
        Spacer(Modifier.width(8.dp))
        PixelText(text, style = s.body.copy(color = c.accent2))
    }
}

@Composable
private fun StoryText(text: String, cursor: Boolean) {
    val c = Px.c
    Column {
        PixelText(text)
        if (cursor) BlinkingCursor(c.accent)
    }
}

@Composable
private fun RollCard(check: CheckResult, animate: Boolean) {
    val s = Px.style
    val c = s.c
    var rolling by remember(check) { mutableStateOf(animate) }
    var faces by remember(check) { mutableStateOf(check.dice) }
    LaunchedEffect(check, animate) {
        if (!animate) {
            faces = check.dice
            rolling = false
            return@LaunchedEffect
        }
        repeat(10) {
            faces = listOf(Random.nextInt(1, 7), Random.nextInt(1, 7))
            delay(60)
        }
        faces = check.dice
        rolling = false
    }
    val color = when (check.outcome) {
        Outcome.CRIT_SUCCESS, Outcome.SUCCESS -> c.good
        Outcome.PARTIAL -> c.gold
        else -> c.bad
    }
    PixelPanel(Modifier.fillMaxWidth(), deep = true, padding = 10.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            faces.forEach { f ->
                PixelDie(f, c.text, c.border, Modifier.size(34.dp))
                Spacer(Modifier.width(6.dp))
            }
            Spacer(Modifier.width(6.dp))
            Column(Modifier.weight(1f)) {
                if (check.skillName.isNotBlank()) PixelText(check.skillName, style = s.small)
                if (!rolling) {
                    val mods = check.modifierSum
                    PixelText(
                        "${check.dice.sum()}${if (mods != 0) (if (mods > 0) " + $mods" else " − ${abs(mods)}") else ""} = ${check.total}",
                        style = s.small.copy(color = c.text),
                    )
                    PixelText(check.outcome.label.uppercase(), style = s.label.copy(color = color))
                }
            }
        }
        if (!rolling && check.modifiers.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            PixelText(check.modifiers.joinToString(" · ") { (if (it.value > 0) "+" else "") + "${it.value} ${it.label}" }, style = s.small)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChangesRow(changes: List<com.pixelrpg.engine.turn.Change>) {
    val c = Px.c
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        changes.forEach {
            PixelChip(it.text, when (it.tone) { Tone.GOOD -> c.good; Tone.BAD -> c.bad; Tone.NEUTRAL -> c.dim })
        }
    }
}

@Composable
private fun ErrorPanel(text: String, canRetry: Boolean, onRetry: () -> Unit, onClose: () -> Unit) {
    val c = Px.c
    PixelPanel(Modifier.fillMaxWidth(), title = "Заминка") {
        PixelText(text, color = c.bad)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (canRetry) PixelButton("Повторить", onRetry, small = true, kind = ButtonKind.PRIMARY)
            PixelButton("Закрыть", onClose, small = true)
        }
    }
}

// ---------- Герой ----------

@Composable
private fun HeroTab(hud: Hud) {
    val s = Px.style
    val c = s.c
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        PixelPanel(Modifier.fillMaxWidth()) {
            PixelTitle(hud.heroName)
            PixelText(hud.heroConcept, color = c.accent2)
            if (hud.heroAppearance.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                PixelText(hud.heroAppearance, style = s.small)
            }
            Spacer(Modifier.height(6.dp))
            PixelText("Слава: ${hud.fame}", style = s.small.copy(color = c.gold))
        }
        Spacer(Modifier.height(10.dp))
        PixelPanel(Modifier.fillMaxWidth(), title = "Характеристики") {
            hud.attributes.forEach { (name, v) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                    PixelText(name, modifier = Modifier.weight(1f))
                    PixelText(if (v >= 0) "+$v" else "$v", color = if (v > 0) c.good else if (v < 0) c.bad else c.text)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        PixelPanel(Modifier.fillMaxWidth(), title = "Навыки") {
            hud.skills.forEach { sk ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        PixelText(sk.name, color = if (sk.rank > 0) c.text else c.dim)
                        PixelText(sk.attribute, style = s.small)
                    }
                    RankPips(sk.rank)
                }
                if (sk.rank < 4) XpLine(sk.xp, sk.need)
            }
        }
        if (hud.traits.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            PixelPanel(Modifier.fillMaxWidth(), title = "Черты") {
                hud.traits.forEach { (n, d) ->
                    PixelText(n, color = c.accent)
                    PixelText(d, style = s.small)
                    Spacer(Modifier.height(4.dp))
                }
            }
        }
        if (hud.factions.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            PixelPanel(Modifier.fillMaxWidth(), title = "Репутация") {
                hud.factions.forEach { f ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                        PixelText(f.name, modifier = Modifier.weight(1f))
                        PixelText(f.word, color = if (f.attitude >= 10) c.good else if (f.attitude <= -10) c.bad else c.dim)
                    }
                }
            }
        }
        if (hud.heroBackground.isNotBlank()) {
            Spacer(Modifier.height(10.dp))
            PixelPanel(Modifier.fillMaxWidth(), title = "Прошлое") { PixelText(hud.heroBackground, style = s.small.copy(color = c.text)) }
        }
    }
}

@Composable
private fun RankPips(rank: Int) {
    val c = Px.c
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        repeat(4) { i ->
            Box(Modifier.size(12.dp).pixelFrame(if (i < rank) c.accent else c.panelDeep, c.border, c.light, c.shadow, 2.dp))
        }
    }
}

@Composable
private fun XpLine(xp: Int, need: Int) {
    val c = Px.c
    Canvas(Modifier.fillMaxWidth().height(3.dp)) {
        drawRect(c.panelDeep)
        drawRect(c.accent2.copy(alpha = 0.7f), Offset.Zero, Size(size.width * (xp.toFloat() / need).coerceIn(0f, 1f), size.height))
    }
}

// ---------- Вещи ----------

@Composable
private fun ItemsTab(hud: Hud, busy: Boolean, send: (String) -> Unit) {
    val s = Px.style
    val c = s.c
    var open by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        PixelPanel(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PixelIconView(PixelIcon.COIN, c.gold, 14.dp)
                Spacer(Modifier.width(8.dp))
                PixelText(hud.money, color = c.gold)
            }
        }
        Spacer(Modifier.height(10.dp))
        if (hud.inventory.isEmpty()) PixelText("Карманы пусты.", style = s.small)
        hud.inventory.forEach { item ->
            ItemCard(item, open == item.id, busy, onToggle = { open = if (open == item.id) null else item.id }, send = send)
            Spacer(Modifier.height(8.dp))
        }
        if (hud.itemsHere.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            PixelPanel(Modifier.fillMaxWidth(), title = "Лежит рядом") {
                hud.itemsHere.forEach { name ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                        PixelText(name, modifier = Modifier.weight(1f))
                        PixelButton("Взять", { send("Беру «$name»") }, small = true, enabled = !busy)
                    }
                }
            }
        }
    }
}

@Composable
private fun ItemCard(item: ItemRow, expanded: Boolean, busy: Boolean, onToggle: () -> Unit, send: (String) -> Unit) {
    val s = Px.style
    val c = s.c
    val rarityColor = when (item.rarity) {
        0 -> c.text
        1 -> c.good
        2 -> c.accent2
        3 -> c.accent
        else -> c.gold
    }
    PixelPanel(Modifier.fillMaxWidth().clickable(onClick = onToggle), deep = !expanded, padding = 10.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                PixelText(item.name + if (item.quantity > 1) " ×${item.quantity}" else "", color = rarityColor)
                val stats = buildList {
                    if (item.slot == ItemSlot.WEAPON) add("урон ${item.power}")
                    if (item.slot == ItemSlot.ARMOR) add("защита ${item.power}")
                    add("цена ${item.value}")
                }
                PixelText(stats.joinToString(" · "), style = s.small)
            }
            if (item.equipped) PixelChip("в деле", c.accent)
        }
        if (expanded) {
            if (item.description.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                PixelText(item.description, style = s.small.copy(color = c.text))
            }
            if (item.tags.isNotEmpty()) PixelText(item.tags.joinToString(" ") { "#$it" }, style = s.small)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PixelButton("Использовать", { send("Использую «${item.name}»") }, small = true, enabled = !busy)
                if (item.slot == ItemSlot.WEAPON || item.slot == ItemSlot.ARMOR) {
                    PixelButton(if (item.equipped) "Снять" else "Надеть", {
                        send(if (item.equipped) "Убираю «${item.name}»" else "Беру в руки/надеваю «${item.name}»")
                    }, small = true, enabled = !busy)
                }
                PixelButton("Выбросить", { send("Выбрасываю «${item.name}»") }, small = true, kind = ButtonKind.GHOST, enabled = !busy)
            }
        }
    }
}

// ---------- Журнал ----------

@Composable
private fun JournalTab(hud: Hud) {
    val s = Px.style
    val c = s.c
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        PixelPanel(Modifier.fillMaxWidth(), title = "Задания") {
            if (hud.quests.isEmpty()) PixelText("Пока никто ни о чём не просил.", style = s.small)
            hud.quests.forEach { q ->
                val (mark, color) = when (q.status) {
                    QuestStatus.ACTIVE -> PixelIcon.DIAMOND to c.accent
                    QuestStatus.DONE -> PixelIcon.CHECK to c.good
                    QuestStatus.FAILED -> PixelIcon.CROSS to c.bad
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PixelIconView(mark, color, 12.dp)
                    Spacer(Modifier.width(8.dp))
                    PixelText(q.title, color = color)
                }
                PixelText(q.description, style = s.small.copy(color = if (q.status == QuestStatus.ACTIVE) c.text else c.dim))
                q.notes.takeLast(3).forEach { PixelText("  · $it", style = s.small) }
                Spacer(Modifier.height(8.dp))
            }
        }
        if (hud.album.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            PixelPanel(Modifier.fillMaxWidth(), title = "Альбом") {
                hud.album.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (path, caption) -> SceneImage(path, caption, Modifier.weight(1f), small = true) }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        PixelPanel(Modifier.fillMaxWidth(), title = "Кодекс") {
            if (hud.codex.isEmpty()) PixelText("Здесь появятся знания о мире, слухи и тайны.", style = s.small)
            hud.codex.forEach { e ->
                PixelLabel(e.category, color = c.dim)
                PixelText(e.title, color = c.accent)
                PixelText(e.text, style = s.small.copy(color = c.text))
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

// ---------- Мир ----------

@Composable
private fun WorldTab(hud: Hud, busy: Boolean, send: (String) -> Unit) {
    val s = Px.style
    val c = s.c
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        PixelPanel(Modifier.fillMaxWidth(), title = "Карта") {
            WorldMap(hud)
        }
        Spacer(Modifier.height(10.dp))
        PixelPanel(Modifier.fillMaxWidth(), title = hud.place) {
            if (hud.placeDescription.isNotBlank()) PixelText(hud.placeDescription, style = s.small.copy(color = c.text))
            if (hud.npcs.isNotEmpty()) {
                SectionHeader("Рядом")
                hud.npcs.forEach { n ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            PixelText(n.name, color = if (n.hostile) c.bad else c.text)
                            PixelText("${n.role} · ${n.attitude}", style = s.small)
                        }
                        if (n.hostile) PixelButton("Бой", { send("Атакую: ${n.name}") }, small = true, kind = ButtonKind.DANGER, enabled = !busy)
                        else PixelButton("Говорить", { send("Заговариваю с: ${n.name}") }, small = true, enabled = !busy)
                    }
                }
            }
            if (hud.exits.isNotEmpty()) {
                SectionHeader("Пути")
                hud.exits.forEach { e ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                        PixelText(e, modifier = Modifier.weight(1f))
                        PixelButton("Идти", { send("Иду: $e") }, small = true, enabled = !busy)
                    }
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        CanonView(hud.canon)
    }
}

/** Пиксельная карта посещённых земель: каждая клетка — местность, ромб — поселение, мигающий квадрат — герой. */
@Composable
private fun WorldMap(hud: Hud) {
    val c = Px.c
    val biomeColors = remember(c) {
        listOf(c.good, c.accent2, c.gold, c.accent, c.bad, c.dim, c.text, c.light).map { it.copy(alpha = 0.55f) }
    }
    val radius = 4
    val cells = hud.map.associateBy { it.x to it.y }
    Canvas(Modifier.fillMaxWidth().height(220.dp)) {
        val n = radius * 2 + 1
        val cell = minOf(size.width, size.height) / n
        val ox = (size.width - cell * n) / 2
        val oy = (size.height - cell * n) / 2
        for (dx in -radius..radius) for (dy in -radius..radius) {
            val x = hud.mapX + dx
            val y = hud.mapY + dy
            val left = ox + (dx + radius) * cell
            val top = oy + (dy + radius) * cell
            val m = cells[x to y]
            val fill = when {
                m == null -> c.panelDeep
                m.visited -> biomeColors[m.biome.coerceAtLeast(0) % biomeColors.size]
                else -> biomeColors[m.biome.coerceAtLeast(0) % biomeColors.size].copy(alpha = 0.2f)
            }
            drawRect(c.border, Offset(left, top), Size(cell, cell))
            drawRect(fill, Offset(left + 2, top + 2), Size(cell - 4, cell - 4))
            if (m?.settlement == true) {
                val u = cell / 6
                drawRect(c.text, Offset(left + cell / 2 - u / 2, top + cell / 2 - u * 1.5f), Size(u, u))
                drawRect(c.text, Offset(left + cell / 2 - u * 1.5f, top + cell / 2 - u / 2), Size(u * 3, u))
                drawRect(c.text, Offset(left + cell / 2 - u / 2, top + cell / 2 + u / 2), Size(u, u))
            }
            if (dx == 0 && dy == 0) {
                val u = cell / 4
                drawRect(c.bad, Offset(left + cell / 2 - u / 2, top + cell / 2 - u / 2), Size(u, u))
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    PixelText("Север — вверху. Тусклые клетки — видно издалека, но ещё не исследовано.", style = Px.style.small)
}

/** Картинка сцены в пиксельной рамке; по нажатию — во весь экран. */
@Composable
private fun SceneImage(path: String, caption: String, modifier: Modifier = Modifier, small: Boolean = false) {
    val s = Px.style
    val c = s.c
    val bitmap = remember(path) { runCatching { BitmapFactory.decodeFile(path)?.asImageBitmap() }.getOrNull() }
    var full by remember { mutableStateOf(false) }
    if (bitmap == null) {
        PixelText("[картинка потеряна]", style = s.small, modifier = modifier)
        return
    }
    Column(modifier) {
        Box(
            Modifier
                .fillMaxWidth()
                .pixelFrame(c.border, c.border, c.light, c.shadow, s.unit)
                .padding(s.unit * 2)
                .clickable { full = true },
        ) {
            Image(
                bitmap, caption,
                Modifier.fillMaxWidth().aspectRatio(bitmap.width.toFloat() / bitmap.height),
                contentScale = ContentScale.FillWidth,
                filterQuality = FilterQuality.None,
            )
        }
        if (!small) PixelText(caption, style = s.small)
    }
    if (full) {
        Dialog(onDismissRequest = { full = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Column(Modifier.fillMaxWidth().padding(8.dp).clickable { full = false }) {
                Image(
                    bitmap, caption,
                    Modifier.fillMaxWidth().aspectRatio(bitmap.width.toFloat() / bitmap.height),
                    contentScale = ContentScale.FillWidth,
                    filterQuality = FilterQuality.None,
                )
                Spacer(Modifier.height(6.dp))
                PixelText(caption, style = s.small.copy(color = c.text))
            }
        }
    }
}
