package com.pixelrpg.engine

import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.WorldGen
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.Clock
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.model.QuestStatus
import com.pixelrpg.engine.model.RuleTrigger
import com.pixelrpg.engine.turn.TurnResolver

/**
 * Компактные текстовые сводки состояния для ИИ. ИИ не помнит игру сам:
 * каждый ход он получает ровно то, что нужно, с id сущностей для ссылок.
 */
object Briefing {

    /** Неизменная часть — описание мира. Идёт в кэшируемый системный промпт. */
    fun canon(c: Canon): String = buildString {
        appendLine("# МИР: ${c.title}")
        appendLine(c.pitch)
        appendLine("Жанр: ${c.genre}. Тон: ${c.tone}.")
        appendLine("Манера повествования: ${c.narratorStyle}")
        if (c.laws.isNotEmpty()) appendLine("Законы мира:\n" + c.laws.joinToString("\n") { "- $it" })
        if (c.impossible.isNotEmpty()) appendLine("Чего в этом мире НЕ бывает:\n" + c.impossible.joinToString("\n") { "- $it" })
        appendLine("Характеристики: " + c.attributes.joinToString("; ") { "${it.id} = ${it.name} (${it.description})" })
        appendLine("Навыки (id: название — характеристика [теги]):")
        c.skills.forEach { appendLine("- ${it.id}: ${it.name} — ${it.attributeId} [${it.tags.joinToString(", ")}] ${it.description}") }
        appendLine("Ресурсы героя: " + c.resources.joinToString("; ") { "${it.id} = ${it.name} (макс ${it.max}, ${it.role.name.lowercase()}) ${it.description}" })
        appendLine("Состояния (id: название — эффект):")
        CanonValidator.conditionsOf(c).forEach {
            appendLine("- ${it.id}: ${it.name} — ${it.description}${if (it.checkModifier != 0) " (${signed(it.checkModifier)} к проверкам)" else ""}")
        }
        appendLine("Валюта: ${c.currency.name}.")
        if (c.rules.isNotEmpty()) {
            appendLine("Жёсткие правила мира (их исполняет движок, ты учитываешь их в описании):")
            c.rules.forEach { r ->
                val trigger = when (r.trigger) {
                    RuleTrigger.ACTION -> "действие [${r.tag.ifBlank { "любое" }}]"
                    RuleTrigger.CHECK -> "проверка [${r.tag.ifBlank { "любая" }}] ${r.outcome}"
                    RuleTrigger.HOURLY -> "каждый час"
                    RuleTrigger.REST -> "отдых"
                    RuleTrigger.ENTER -> "вход в место [${r.tag}]"
                }
                appendLine("- ${r.name}: $trigger. ${r.description}")
            }
        }
        if (c.cultures.isNotEmpty()) appendLine("Культуры:\n" + c.cultures.joinToString("\n") { "- ${it.id}: ${it.name} — ${it.description} Имена: ${it.namingStyle}" })
        if (c.factions.isNotEmpty()) appendLine("Фракции:\n" + c.factions.joinToString("\n") { "- ${it.id}: ${it.name} — ${it.description} Цели: ${it.goals}" })
        if (c.itemTags.isNotEmpty()) appendLine("Теги предметов и действий: ${c.itemTags.joinToString(", ")}")
    }

    fun time(state: GameState): String {
        val loc = state.location
        return "${Clock.format(state.minute)}; погода: ${WorldGen.weather(state, loc.x, loc.y, state.minute)}"
    }

    /** Сцена: место, выходы, предметы, люди. [master] — видны секреты и знания NPC. */
    fun scene(state: GameState, master: Boolean): String = buildString {
        val loc = state.location
        appendLine("## СЦЕНА — ${time(state)}")
        appendLine("Место [${loc.id}]: ${loc.name} (${kindWord(loc.kind.name)}, опасность ${loc.danger}/10)")
        if (loc.description.isNotBlank()) appendLine(loc.description)
        state.factions[loc.factionId]?.let { appendLine("Земли фракции: ${it.name}") }
        if (loc.features.isNotEmpty()) appendLine("Детали: " + loc.features.joinToString("; "))
        val exits = loc.exits.filter { !it.hidden || master }
        if (exits.isNotEmpty()) {
            appendLine("Выходы:")
            exits.forEach { e ->
                val target = state.locations[e.targetId]
                val known = if (target?.visited == true) " → ${target.name}" else ""
                appendLine("- [${e.id}] ${e.name}$known, ${TurnResolver.minutesWord(e.minutes)}${if (e.hidden) " (СКРЫТ)" else ""}")
            }
        }
        if (loc.items.isNotEmpty()) appendLine("Предметы здесь: " + loc.items.joinToString("; ") { "[${it.id}] ${it.name}" })
        val npcs = state.npcsHere()
        if (npcs.isEmpty()) appendLine("Рядом никого.")
        npcs.forEach { n ->
            appendLine("Персонаж [${n.id}] ${n.name} — ${n.role}. Отношение к герою: ${TurnResolver.attitudeWord(n.attitude)} (${n.attitude})" +
                (if (n.hostile) ". ВРАЖДЕБЕН, сражается (${TurnResolver.woundWord(n)})" else "") +
                ". Сила ${n.power}/10.")
            if (n.appearance.isNotBlank()) appendLine("  Вид: ${n.appearance}")
            if (n.personality.isNotBlank()) appendLine("  Характер: ${n.personality}. Речь: ${n.speech}")
            state.factions[n.factionId]?.let { appendLine("  Фракция: ${it.name}") }
            if (master) {
                if (n.goals.isNotBlank()) appendLine("  Цели: ${n.goals}")
                if (n.secret.isNotBlank()) appendLine("  Секрет (герой не знает): ${n.secret}")
                if (n.knowledge.isNotEmpty()) appendLine("  Знает: " + n.knowledge.joinToString(" | "))
                if (n.inventory.isNotEmpty()) appendLine("  При себе: " + n.inventory.joinToString("; ") { "[${it.id}] ${it.name} (${it.value})" } + "; денег ${n.money}")
            }
            if (n.memories.isNotEmpty()) appendLine("  Помнит о герое: " + n.memories.takeLast(5).joinToString(" | ") { it.text })
        }
        state.combat?.let { appendLine("ИДЁТ БОЙ, раунд ${it.round + 1}.") }
    }

    fun hero(state: GameState): String = buildString {
        val h = state.hero
        val c = state.canon
        appendLine("## ГЕРОЙ: ${h.name} — ${h.concept}")
        if (h.appearance.isNotBlank()) appendLine("Внешность: ${h.appearance}")
        appendLine("Характеристики: " + c.attributes.joinToString(", ") { "${it.name} ${signed(h.attr(it.id))}" })
        val skills = h.skills.filter { it.value.rank > 0 }
        appendLine("Навыки: " + if (skills.isEmpty()) "нет развитых" else skills.entries.joinToString(", ") { (id, p) -> "${c.skill(id)?.name ?: id} ${p.rank}" })
        appendLine("Ресурсы: " + c.resources.joinToString(", ") { r -> h.resources[r.id]?.let { "${r.name} ${it.current}/${it.max}" } ?: "" })
        if (h.conditions.isNotEmpty()) {
            val defs = CanonValidator.conditionsOf(c)
            appendLine("Состояния: " + h.conditions.joinToString(", ") { cond -> defs.firstOrNull { it.id == cond.id }?.name ?: cond.id })
        }
        if (h.traits.isNotEmpty()) appendLine("Черты: " + h.traits.joinToString("; ") { "${it.name} — ${it.description}" })
        appendLine("Деньги: ${h.money} ${c.currency.name}. Слава: ${h.fame}.")
        appendLine("Снаряжение и вещи:")
        if (h.inventory.isEmpty()) appendLine("- ничего")
        h.inventory.forEach { i ->
            val slot = when (i.slot) {
                ItemSlot.WEAPON -> ", оружие ${i.power}"
                ItemSlot.ARMOR -> ", броня ${i.power}"
                ItemSlot.TRINKET -> ", амулет"
                ItemSlot.NONE -> ""
            }
            appendLine("- [${i.id}] ${i.name}${if (i.quantity > 1) " ×${i.quantity}" else ""}$slot${if (i.equipped) " (в руках/надето)" else ""} [${i.tags.joinToString(", ")}] цена ${i.value}")
        }
    }

    fun quests(state: GameState): String {
        val active = state.quests.filter { it.status == QuestStatus.ACTIVE }
        if (active.isEmpty()) return "## ЗАДАНИЯ: нет активных"
        return "## ЗАДАНИЯ\n" + active.joinToString("\n") { q ->
            "- [${q.id}] ${q.title}: ${q.description}" + (q.notes.lastOrNull()?.let { " (последнее: $it)" } ?: "")
        }
    }

    /** Последние события: реплики игрока и рассказ, без бросков. */
    fun recent(state: GameState, entries: Int): String {
        val items = state.log.filter { it.kind == LogKind.PLAYER || it.kind == LogKind.STORY }.takeLast(entries)
        if (items.isEmpty()) return "## НЕДАВНО: история только начинается"
        return "## НЕДАВНО\n" + items.joinToString("\n") { e ->
            if (e.kind == LogKind.PLAYER) "> Игрок: ${e.text}" else e.text.take(900)
        }
    }

    fun chronicle(state: GameState): String {
        if (state.chronicle.isEmpty()) return ""
        return "## ЛЕТОПИСЬ (что было раньше)\n" + state.chronicle.takeLast(4).joinToString("\n") { "- ${it.summary}" }
    }

    fun full(state: GameState, master: Boolean, recentEntries: Int = 8): String = listOf(
        chronicle(state), quests(state), hero(state), scene(state, master), recent(state, recentEntries),
    ).filter { it.isNotBlank() }.joinToString("\n\n")

    // ---------- Сжатые сводки для маленьких моделей ----------

    /** Канон без описаний и примеров: только то, на что модель может сослаться. */
    fun canonCompact(c: Canon): String = buildString {
        appendLine("# МИР: ${c.title}. ${c.pitch.take(300)}")
        appendLine("Тон: ${c.tone}. Стиль: ${c.narratorStyle.take(200)}")
        if (c.laws.isNotEmpty()) appendLine("Законы: " + c.laws.joinToString("; "))
        if (c.impossible.isNotEmpty()) appendLine("Не бывает: " + c.impossible.joinToString("; "))
        appendLine("Навыки (id): " + c.skills.joinToString("; ") { "${it.id}=${it.name}" + if (it.tags.isNotEmpty()) " [${it.tags.joinToString(",")}]" else "" })
        appendLine("Ресурсы (id): " + c.resources.joinToString("; ") { "${it.id}=${it.name}" })
        appendLine("Состояния (id): " + CanonValidator.conditionsOf(c).joinToString("; ") { "${it.id}=${it.name}" })
        if (c.factions.isNotEmpty()) appendLine("Фракции (id): " + c.factions.joinToString("; ") { "${it.id}=${it.name}" })
        if (c.rules.isNotEmpty()) appendLine("Правила мира: " + c.rules.joinToString("; ") { it.name })
        append("Валюта: ${c.currency.name}.")
    }

    /** Короткая сводка хода: сцена, герой, задания, последние реплики. */
    fun compact(state: GameState, master: Boolean, recentEntries: Int = 3): String = buildString {
        val loc = state.location
        val h = state.hero
        val c = state.canon
        appendLine("ВРЕМЯ: ${time(state)}")
        appendLine("МЕСТО [${loc.id}] ${loc.name}, опасность ${loc.danger}/10. ${loc.description.take(300)}")
        if (loc.features.isNotEmpty()) appendLine("Детали: " + loc.features.takeLast(3).joinToString("; "))
        val exits = loc.exits.filter { !it.hidden || master }
        if (exits.isNotEmpty()) appendLine("Выходы: " + exits.joinToString("; ") { "[${it.id}] ${it.name}" })
        if (loc.items.isNotEmpty()) appendLine("Предметы здесь: " + loc.items.joinToString("; ") { "[${it.id}] ${it.name}" })
        val npcs = state.npcsHere()
        if (npcs.isEmpty()) appendLine("Рядом никого.")
        npcs.forEach { n ->
            append("ПЕРСОНАЖ [${n.id}] ${n.name} — ${n.role}, ${TurnResolver.attitudeWord(n.attitude)}")
            if (n.hostile) append(", ВРАГ (${TurnResolver.woundWord(n)})")
            if (n.speech.isNotBlank()) append(". Речь: ${n.speech.take(80)}")
            if (master && n.knowledge.isNotEmpty()) append(". Знает: ${n.knowledge.take(2).joinToString(" | ") { it.take(120) }}")
            n.memories.lastOrNull()?.let { append(". Помнит: ${it.text.take(100)}") }
            appendLine()
        }
        state.combat?.let { appendLine("ИДЁТ БОЙ.") }
        appendLine("ГЕРОЙ: ${h.name} — ${h.concept}. " + c.resources.joinToString(", ") { r -> h.resources[r.id]?.let { "${r.name} ${it.current}/${it.max}" } ?: "" } +
            ". Деньги ${h.money}.")
        if (h.conditions.isNotEmpty()) appendLine("Состояния: " + h.conditions.joinToString(", ") { it.id })
        appendLine("Вещи: " + if (h.inventory.isEmpty()) "нет" else h.inventory.joinToString("; ") { "[${it.id}] ${it.name}" + if (it.equipped) "*" else "" })
        val active = state.quests.filter { it.status == QuestStatus.ACTIVE }
        if (active.isNotEmpty()) appendLine("Задания: " + active.joinToString("; ") { "[${it.id}] ${it.title}" })
        state.chronicle.lastOrNull()?.let { appendLine("Ранее: ${it.summary.take(400)}") }
        val recent = state.log.filter { it.kind == LogKind.PLAYER || it.kind == LogKind.STORY }.takeLast(recentEntries)
        if (recent.isNotEmpty()) {
            appendLine("НЕДАВНО:")
            recent.forEach { e -> appendLine(if (e.kind == LogKind.PLAYER) "> ${e.text.take(200)}" else e.text.take(350)) }
        }
    }

    private fun signed(v: Int) = if (v >= 0) "+$v" else "$v"

    private fun kindWord(k: String) = when (k) {
        "AREA" -> "местность"
        "SETTLEMENT" -> "поселение"
        "PLACE" -> "место"
        "DUNGEON" -> "опасное место"
        else -> "достопримечательность"
    }
}
