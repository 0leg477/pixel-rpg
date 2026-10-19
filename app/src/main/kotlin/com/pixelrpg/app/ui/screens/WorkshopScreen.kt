package com.pixelrpg.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pixelrpg.ai.view.WorkshopStep
import com.pixelrpg.ai.view.WorldWorkshop
import com.pixelrpg.app.AppViewModel
import com.pixelrpg.app.Screen
import com.pixelrpg.app.ui.components.ButtonKind
import com.pixelrpg.app.ui.components.LoadingLine
import com.pixelrpg.app.ui.components.PixelButton
import com.pixelrpg.app.ui.components.PixelChip
import com.pixelrpg.app.ui.components.PixelPanel
import com.pixelrpg.app.ui.components.PixelText
import com.pixelrpg.app.ui.components.PixelTextField
import com.pixelrpg.app.ui.components.PixelTitle
import com.pixelrpg.app.ui.components.PixelToggle
import com.pixelrpg.app.ui.theme.Px
import com.pixelrpg.engine.gen.BaseConditions
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.Hero
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.RuleTrigger

private val WORLD_IDEAS = listOf(
    "Тёмное фэнтези: магия питается кровью, а Инквизиция сжигает магов. Я — беглый ученик чародея.",
    "Киберпанк-мегаполис под куполом, снаружи ядовитые пустоши. Корпорации против уличных банд.",
    "Мир после падения луны: осколки парят в небе, люди живут на летающих островах.",
    "Славянские леса, где боги ещё ходят среди людей, а за каждой рекой своя нечисть.",
    "Постапокалипсис: грибные леса поглотили города, споры дают людям странные силы.",
)

@Composable
fun WorkshopScreen(vm: AppViewModel) {
    val workshop by vm.workshop.collectAsStateWithLifecycle()
    val w = workshop ?: return
    val ui by w.ui.collectAsStateWithLifecycle()
    val s = Px.style

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelButton("‹", {
                when (ui.step) {
                    WorkshopStep.WORLD -> vm.go(Screen.MENU)
                    WorkshopStep.CANON -> w.goTo(WorkshopStep.WORLD)
                    WorkshopStep.HERO -> w.goTo(WorkshopStep.CANON)
                    WorkshopStep.HERO_REVIEW -> w.goTo(WorkshopStep.HERO)
                }
            }, small = true, enabled = !ui.busy)
            Spacer(Modifier.width(12.dp))
            PixelTitle(
                when (ui.step) {
                    WorkshopStep.WORLD -> "Новый мир"
                    WorkshopStep.CANON -> "Канон мира"
                    WorkshopStep.HERO -> "Герой"
                    WorkshopStep.HERO_REVIEW -> "Герой"
                },
            )
        }
        Spacer(Modifier.height(14.dp))
        StepDots(ui.step.ordinal.coerceAtMost(2))
        Spacer(Modifier.height(14.dp))

        ui.error?.let {
            PixelPanel(Modifier.fillMaxWidth(), title = "Ошибка") {
                PixelText(it, color = s.c.bad)
                Spacer(Modifier.height(8.dp))
                PixelButton("Закрыть", { w.dismissError() }, small = true)
            }
            Spacer(Modifier.height(12.dp))
        }

        when (ui.step) {
            WorkshopStep.WORLD -> WorldStep(w, ui.draft.worldText, ui.busy)
            WorkshopStep.CANON -> ui.draft.canon?.let { CanonStep(w, it, ui.busy) }
            WorkshopStep.HERO -> HeroStep(w, ui.draft.heroText, ui.busy)
            WorkshopStep.HERO_REVIEW -> ui.draft.hero?.let { hero ->
                ui.draft.canon?.let { canon -> HeroReview(vm, w, canon, hero, ui.draft.permadeath, ui.busy) }
            }
        }

        if (ui.busy) {
            Spacer(Modifier.height(16.dp))
            LoadingLine(ui.stage ?: "Думаю…")
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun StepDots(active: Int) {
    val c = Px.c
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("мир", "канон", "герой").forEachIndexed { i, label ->
            PixelChip(label, if (i <= active) c.accent else c.dim)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WorldStep(w: WorldWorkshop, text: String, busy: Boolean) {
    val s = Px.style
    PixelPanel(Modifier.fillMaxWidth(), title = "Опиши свой мир") {
        PixelText(
            "Пиши как хочешь: жанр, настроение, магия или технологии, кто правит, с чем борются люди, чего в мире нет. " +
                "Чем больше деталей — тем точнее будет канон. Остальное ИИ додумает в том же духе.",
            style = s.small,
        )
        Spacer(Modifier.height(10.dp))
        PixelTextField(text, w::setWorldText, Modifier.fillMaxWidth(), placeholder = "Мой мир — это…", minLines = 6, maxLines = 14, enabled = !busy)
        Spacer(Modifier.height(10.dp))
        PixelText("Идеи для старта:", style = s.small)
        Spacer(Modifier.height(6.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WORLD_IDEAS.forEach { idea ->
                PixelChip(idea.substringBefore(":").substringBefore(",").take(28) + "…", s.c.accent2) { w.setWorldText(idea) }
            }
        }
        Spacer(Modifier.height(12.dp))
        PixelButton("Создать мир", { w.createCanon() }, Modifier.fillMaxWidth(), kind = ButtonKind.PRIMARY, enabled = !busy && text.isNotBlank())
    }
}

@Composable
private fun CanonStep(w: WorldWorkshop, canon: Canon, busy: Boolean) {
    val s = Px.style
    var instruction by remember { mutableStateOf("") }
    CanonView(canon)
    Spacer(Modifier.height(12.dp))
    PixelPanel(Modifier.fillMaxWidth(), title = "Поправить канон") {
        PixelText("Что-то не так? Напиши, что изменить — ИИ перепишет канон, сохранив остальное.", style = s.small)
        Spacer(Modifier.height(8.dp))
        PixelTextField(instruction, { instruction = it }, Modifier.fillMaxWidth(), placeholder = "Например: пусть магия будет запрещена везде…", minLines = 2, enabled = !busy)
        Spacer(Modifier.height(8.dp))
        PixelButton("Изменить", { w.refineCanon(instruction); instruction = "" }, Modifier.fillMaxWidth(), enabled = !busy && instruction.isNotBlank())
    }
    Spacer(Modifier.height(12.dp))
    PixelButton("Дальше: создать героя", { w.goTo(WorkshopStep.HERO) }, Modifier.fillMaxWidth(), kind = ButtonKind.PRIMARY, enabled = !busy)
}

/** Канон в читаемом виде — его же показывает вкладка «Мир» в игре. */
@Composable
fun CanonView(canon: Canon) {
    val s = Px.style
    val c = s.c
    PixelPanel(Modifier.fillMaxWidth()) {
        PixelText(canon.title, style = s.title)
        Spacer(Modifier.height(6.dp))
        PixelText("${canon.genre} · ${canon.tone}", style = s.small)
        Spacer(Modifier.height(6.dp))
        PixelText(canon.pitch)

        if (canon.laws.isNotEmpty()) {
            SectionHeader("Законы мира")
            canon.laws.forEach { PixelText("• $it") }
        }
        if (canon.impossible.isNotEmpty()) {
            SectionHeader("Чего здесь не бывает")
            canon.impossible.forEach { PixelText("✗ $it", color = c.dim) }
        }
        if (canon.rules.isNotEmpty()) {
            SectionHeader("Жёсткие правила")
            canon.rules.forEach { r ->
                val trigger = when (r.trigger) {
                    RuleTrigger.ACTION -> "когда герой делает [${r.tag.ifBlank { "что угодно" }}]"
                    RuleTrigger.CHECK -> "после проверки [${r.tag.ifBlank { "любой" }}]"
                    RuleTrigger.HOURLY -> "каждый час"
                    RuleTrigger.REST -> "на отдыхе"
                    RuleTrigger.ENTER -> "входя в место [${r.tag}]"
                }
                PixelText(r.name, color = c.accent)
                PixelText("$trigger. ${r.description}", style = s.small)
                Spacer(Modifier.height(4.dp))
            }
        }
        SectionHeader("Герой измеряется")
        PixelText(canon.attributes.joinToString(" · ") { it.name })
        Spacer(Modifier.height(4.dp))
        PixelText("Навыки: " + canon.skills.joinToString(", ") { it.name }, style = s.small)
        Spacer(Modifier.height(4.dp))
        PixelText("Ресурсы: " + canon.resources.joinToString(", ") { "${it.name} (${it.max})" }, style = s.small)
        val special = canon.conditions.filter { it.id !in BASE_IDS }
        if (special.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            PixelText("Особые состояния: " + special.joinToString(", ") { it.name }, style = s.small)
        }
        if (canon.factions.isNotEmpty()) {
            SectionHeader("Силы мира")
            canon.factions.forEach { f ->
                PixelText(f.name, color = c.accent)
                PixelText(f.description + (if (f.goals.isNotBlank()) " Цель: ${f.goals}" else ""), style = s.small)
                Spacer(Modifier.height(4.dp))
            }
        }
        if (canon.cultures.isNotEmpty()) {
            SectionHeader("Народы")
            canon.cultures.forEach { cu -> PixelText("${cu.name} — ${cu.description}", style = s.small) }
        }
        SectionHeader("Земли")
        PixelText(canon.biomes.joinToString(", ") { it.name }, style = s.small)
        if (canon.startScenario.isNotBlank()) {
            SectionHeader("Начало истории")
            PixelText(canon.startScenario)
        }
    }
}

private val BASE_IDS = BaseConditions.all.map { it.id }.toSet()

@Composable
private fun HeroStep(w: WorldWorkshop, text: String, busy: Boolean) {
    val s = Px.style
    PixelPanel(Modifier.fillMaxWidth(), title = "Кто твой герой?") {
        PixelText("Имя, прошлое, характер, чем силён и слаб. Можно коротко — или оставить пустым, и ИИ придумает героя под мир.", style = s.small)
        Spacer(Modifier.height(10.dp))
        PixelTextField(text, w::setHeroText, Modifier.fillMaxWidth(), placeholder = "Мой герой…", minLines = 4, maxLines = 10, enabled = !busy)
        Spacer(Modifier.height(12.dp))
        PixelButton(if (text.isBlank()) "Придумай героя сам" else "Создать героя", { w.createHero() }, Modifier.fillMaxWidth(), kind = ButtonKind.PRIMARY, enabled = !busy)
    }
}

@Composable
private fun HeroReview(vm: AppViewModel, w: WorldWorkshop, canon: Canon, hero: Hero, permadeath: Boolean, busy: Boolean) {
    val s = Px.style
    val c = s.c
    PixelPanel(Modifier.fillMaxWidth()) {
        PixelText(hero.name, style = s.title)
        PixelText(hero.concept, color = c.accent2)
        Spacer(Modifier.height(6.dp))
        if (hero.appearance.isNotBlank()) PixelText(hero.appearance, style = s.small)
        Spacer(Modifier.height(6.dp))
        PixelText(hero.background)
        SectionHeader("Характеристики")
        canon.attributes.forEach { a ->
            val v = hero.attr(a.id)
            PixelText("${a.name}: ${if (v >= 0) "+$v" else "$v"}", color = if (v > 0) c.good else if (v < 0) c.bad else c.text)
        }
        SectionHeader("Навыки")
        hero.skills.filter { it.value.rank > 0 }.forEach { (id, p) -> PixelText("${canon.skill(id)?.name ?: id}: ${p.rank}") }
        if (hero.traits.isNotEmpty()) {
            SectionHeader("Черты")
            hero.traits.forEach { t -> PixelText(t.name, color = c.accent); PixelText(t.description, style = s.small) }
        }
        SectionHeader("Снаряжение")
        hero.inventory.forEach { i ->
            val extra = when (i.slot) {
                ItemSlot.WEAPON -> " · урон ${i.power}"
                ItemSlot.ARMOR -> " · защита ${i.power}"
                else -> ""
            }
            PixelText("• ${i.name}$extra", style = s.small.copy(color = c.text))
        }
        PixelText("Деньги: ${hero.money} ${canon.currency.name}", style = s.small)
    }
    Spacer(Modifier.height(12.dp))
    PixelPanel(Modifier.fillMaxWidth()) {
        PixelToggle("Смерть навсегда", permadeath, { w.setPermadeath(it) })
        PixelText(
            if (permadeath) "Если герой погибнет, его история закончится." else "Поражение — это потеря сознания, денег и времени, но не конец.",
            style = s.small,
        )
    }
    Spacer(Modifier.height(12.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PixelButton("Другой герой", { w.goTo(WorkshopStep.HERO) }, Modifier.weight(1f), enabled = !busy)
        PixelButton("Начать историю", { vm.startWorld() }, Modifier.weight(1f), kind = ButtonKind.PRIMARY, enabled = !busy)
    }
}
