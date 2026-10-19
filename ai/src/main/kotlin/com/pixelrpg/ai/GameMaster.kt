package com.pixelrpg.ai

import com.pixelrpg.engine.Briefing
import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.Factory
import com.pixelrpg.engine.gen.HeroDraft
import com.pixelrpg.engine.gen.LocationDraft
import com.pixelrpg.engine.gen.WorldGen
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.Chapter
import com.pixelrpg.engine.model.GameSettings
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Hero
import com.pixelrpg.engine.model.Location
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.turn.Adjudication
import com.pixelrpg.engine.turn.Encounter
import com.pixelrpg.engine.turn.TurnReport
import com.pixelrpg.engine.turn.TurnResolver
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** События хода — для интерфейса, чтобы показывать прогресс и печатать текст по мере готовности. */
sealed interface TurnEvent {
    data class Stage(val text: String) : TurnEvent
    data class Resolved(val report: TurnReport) : TurnEvent
    data class Text(val chunk: String) : TurnEvent
    data class Done(val story: String, val suggestions: List<String>) : TurnEvent
}

/**
 * Ведущий игры: связывает движок и ИИ. Порядок хода:
 * мастер (ИИ) разбирает заявку → движок бросает кубики и применяет последствия →
 * при необходимости ИИ описывает новые места → рассказчик (ИИ) описывает случившееся.
 */
class GameMaster(private val llm: LlmClient) {

    @Serializable
    private data class Summary(val summary: String)

    @Serializable
    private data class EncounterDraft(
        val description: String,
        val npcs: List<com.pixelrpg.engine.gen.NpcDraft> = emptyList(),
        val items: List<com.pixelrpg.engine.gen.ItemDraft> = emptyList(),
    )

    @Serializable
    private data class ImagePrompt(val prompt: String)

    // ---------- Создание мира и героя ----------

    suspend fun createCanon(description: String, onProgress: ((Progress) -> Unit)? = null): Canon {
        val raw = ask(
            LlmTask.GENESIS, pick(Prompts.GENESIS, Prompts.GENESIS_COMPACT),
            "Описание мира от игрока:\n\n${description.trim()}",
            Schemas.canon, Canon.serializer(), maxTokens = tokens(32000, 12000),
            progress = JsonProgress.canon(compact), onProgress = onProgress,
        )
        return CanonValidator.normalize(raw)
    }

    suspend fun refineCanon(canon: Canon, instruction: String, onProgress: ((Progress) -> Unit)? = null): Canon {
        val raw = ask(
            LlmTask.GENESIS, Prompts.REFINE,
            "Текущий канон:\n${SaveCodec.json.encodeToString(Canon.serializer(), canon)}\n\nЧто изменить:\n${instruction.trim()}",
            Schemas.canon, Canon.serializer(), maxTokens = tokens(32000, 12000),
            progress = JsonProgress.canon(compact), onProgress = onProgress,
        )
        return CanonValidator.normalize(raw)
    }

    suspend fun createHero(canon: Canon, description: String, onProgress: ((Progress) -> Unit)? = null): Hero {
        val draft = ask(
            LlmTask.HERO, system(Prompts.HERO, Prompts.HERO, canon),
            "Стартовый сценарий: ${canon.startScenario}\n\nОписание героя от игрока:\n\n${description.trim().ifBlank { "Придумай героя сам, под стартовый сценарий." }}",
            Schemas.hero, HeroDraft.serializer(), maxTokens = tokens(8000, 4000),
            progress = JsonProgress.plain(tokens(2500, 1400), "герой"), onProgress = onProgress,
        )
        return Factory.hero(canon, draft)
    }

    /** Новая игра: каркас мира, описание стартового места. Вступление — через [intro]. */
    suspend fun startGame(
        id: String, seed: Long, canon: Canon, hero: Hero, settings: GameSettings, now: Long,
        onProgress: ((Progress) -> Unit)? = null,
    ): GameState {
        val state = Factory.newGame(id, seed, canon, hero, settings, now)
        generateLocation(state, state.location, onProgress)
        return state
    }

    fun intro(state: GameState): Flow<TurnEvent> = flow {
        emit(TurnEvent.Stage("Рассказчик начинает историю…"))
        val user = buildString {
            appendLine("## СТАРТОВЫЙ СЦЕНАРИЙ\n${state.canon.startScenario}")
            appendLine()
            if (compact) appendLine(Briefing.compact(state, master = false)) else {
                appendLine(Briefing.hero(state))
                appendLine(Briefing.scene(state, master = false))
            }
            appendLine("Предыстория героя: ${state.hero.background.take(if (compact) 400 else 2000)}")
        }
        narrate(
            state,
            LlmRequest(LlmTask.NARRATE, system(Prompts.INTRO, Prompts.INTRO_COMPACT, state.canon), user, tokens(4000, 900)),
            fallback = state.location.description,
        )
    }

    // ---------- Ход ----------

    fun playTurn(state: GameState, input: String, onProgress: ((Progress) -> Unit)? = null): Flow<TurnEvent> = flow {
        emit(TurnEvent.Stage("Мастер обдумывает…"))
        val adjudication = ask(
            LlmTask.ADJUDICATE,
            system(Prompts.ADJUDICATE, Prompts.ADJUDICATE_COMPACT, state.canon),
            brief(state, master = true, recent = 8) + "\n\n## ЗАЯВКА ИГРОКА\n" + input.trim(),
            Schemas.adjudication, Adjudication.serializer(), maxTokens = tokens(8000, 2000),
            progress = JsonProgress.plain(tokens(1800, 900), "мастер"), onProgress = onProgress,
        )

        val report = TurnResolver(state).resolve(input.trim(), adjudication)
        emit(TurnEvent.Resolved(report))

        if (report.refused != null) {
            state.addLog(LogKind.STORY, report.refused!!)
            emit(TurnEvent.Done(report.refused!!, emptyList()))
            return@flow
        }

        val extraFacts = mutableListOf<String>()
        for (id in report.needsGeneration) {
            val loc = state.locations[id] ?: continue
            emit(TurnEvent.Stage("Мир обретает форму…"))
            runCatching { generateLocation(state, loc, onProgress) }
        }
        report.encounter?.let { enc ->
            emit(TurnEvent.Stage("Что-то происходит…"))
            runCatching { extraFacts += generateEncounter(state, enc) }
        }

        emit(TurnEvent.Stage("Рассказчик пишет…"))
        val firstVisit = report.moved && state.log.count { it.kind == LogKind.SYSTEM && it.text == "Место: ${state.location.name}" } <= 1
        val user = buildString {
            appendLine(brief(state, master = false, recent = 6))
            appendLine()
            appendLine("## ЗАЯВКА ИГРОКА\n${input.trim()}")
            if (adjudication.speech.isNotBlank()) appendLine("Герой говорит: «${adjudication.speech}»")
            appendLine()
            appendLine("## ЧТО ПРОИЗОШЛО (это уже решено, опиши это)")
            appendLine("- ${adjudication.summary}")
            report.check?.let { appendLine("- Исход попытки: ${it.outcome.label}") }
            (report.facts + extraFacts).forEach { appendLine("- $it") }
            if (firstVisit) appendLine("- Герой впервые здесь: опиши место.")
        }
        val fallback = (listOf(adjudication.summary) + report.facts + extraFacts).joinToString(" ")
        narrate(state, LlmRequest(LlmTask.NARRATE, system(Prompts.NARRATE, Prompts.NARRATE_COMPACT, state.canon), user, tokens(4000, 700)), fallback)

        if (state.turn - (state.chronicle.lastOrNull()?.toTurn ?: 0) >= CHAPTER_TURNS) {
            runCatching { writeChronicle(state) }
        }
    }

    /** Стримит текст рассказчика, отделяет варианты действий, пишет историю в журнал. */
    private suspend fun FlowCollector<TurnEvent>.narrate(state: GameState, request: LlmRequest, fallback: String) {
        val full = StringBuilder()
        var emitted = 0
        val story: String
        try {
            llm.stream(request).collect { chunk ->
                full.append(chunk)
                val marker = full.indexOf(MARKER)
                val safeEnd = if (marker >= 0) marker else maxOf(emitted, full.length - MARKER.length)
                if (safeEnd > emitted) {
                    emit(TurnEvent.Text(full.substring(emitted, safeEnd)))
                    emitted = safeEnd
                }
            }
            val marker = full.indexOf(MARKER)
            val end = if (marker >= 0) marker else full.length
            if (end > emitted) emit(TurnEvent.Text(full.substring(emitted, end)))
            story = full.substring(0, end).trim()
        } catch (e: LlmException) {
            // Ход уже применён к миру, поэтому показываем хотя бы сухие факты.
            if (emitted == 0) emit(TurnEvent.Text(fallback))
            val text = if (emitted == 0) fallback else full.substring(0, emitted)
            emit(TurnEvent.Stage("Рассказчик сбился: ${e.message}"))
            if (text.isNotBlank()) state.addLog(LogKind.STORY, text)
            emit(TurnEvent.Done(text, emptyList()))
            return
        }
        state.addLog(LogKind.STORY, story)
        emit(TurnEvent.Done(story, parseSuggestions(full.toString())))
    }

    // ---------- Наполнение мира ----------

    suspend fun generateLocation(state: GameState, loc: Location, onProgress: ((Progress) -> Unit)? = null) {
        if (loc.generated) return
        val parent = loc.parentId?.let { state.locations[it] }
        val biome = state.canon.biome(loc.biomeId)
        val culture = state.canon.culture(loc.cultureId)
        val user = buildString {
            appendLine("## КАРКАС МЕСТА")
            appendLine("Тип: ${loc.kind.name.lowercase()}${if (loc.size > 0 || loc.kind.name == "SETTLEMENT") ", размер поселения ${loc.size} из 3" else ""}")
            appendLine("Местность: ${biome?.name} — ${biome?.description}")
            appendLine("Опасность: ${loc.danger}/10")
            state.factions[loc.factionId]?.let { appendLine("Земли фракции: ${it.name} (${it.description})") }
            culture?.let { appendLine("Культура: ${it.name} — ${it.description}. Имена: ${it.namingStyle}") }
            if (loc.seedHint.isNotBlank()) appendLine("Подсказка: ${loc.seedHint}")
            parent?.let { appendLine("Это место внутри: ${it.name} — ${it.description}") }
            if (loc.x == 0 && loc.y == 0 && parent == null) appendLine("Это стартовое место истории. Стартовый сценарий: ${state.canon.startScenario}")
            val directions = loc.exits.filter { it.direction.isNotEmpty() }
            if (directions.isNotEmpty()) {
                appendLine("Выходы-направления:")
                directions.forEach { e ->
                    val known = state.locations[e.targetId]
                    val (dx, dy) = when (e.direction) { "N" -> 0 to -1; "E" -> 1 to 0; "S" -> 0 to 1; else -> -1 to 0 }
                    val neighbor = WorldGen.cell(state, loc.x + dx, loc.y + dy)
                    appendLine("- [${e.id}] к соседней местности: ${known?.takeIf { it.generated }?.name ?: neighbor.biome.name}" +
                        (neighbor.settlementSize?.let { " (там поселение)" } ?: ""))
                }
            }
            val present = state.npcs.values.filter { it.locationId == loc.id && it.alive }
            if (present.isNotEmpty()) appendLine("Здесь уже находятся: " + present.joinToString { "${it.name} (${it.role})" })
            appendLine(Briefing.time(state))
            appendLine()
            appendLine("## ГЕРОЙ: ${state.hero.name} — ${state.hero.concept}")
            appendLine(Briefing.quests(state))
            Briefing.chronicle(state).takeIf { it.isNotBlank() }?.let(::appendLine)
        }
        val draft = ask(
            LlmTask.LOCATION, system(Prompts.LOCATION, Prompts.LOCATION_COMPACT, state.canon), user,
            Schemas.location, LocationDraft.serializer(), maxTokens = tokens(12000, 5000),
            progress = JsonProgress.plain(tokens(3500, 1800), "место"), onProgress = onProgress,
        )
        Factory.applyLocationDraft(state, loc, draft)
    }

    private suspend fun generateEncounter(state: GameState, enc: Encounter): List<String> {
        val user = buildString {
            appendLine("Встреча: ${enc.kind}. Враждебная: ${if (enc.hostile) "да" else "нет"}. Опасность: ${enc.danger}/10.")
            appendLine(Briefing.scene(state, master = false))
            appendLine("## ГЕРОЙ: ${state.hero.name} — ${state.hero.concept}")
        }
        val draft = ask(
            LlmTask.LOCATION, system(Prompts.ENCOUNTER, Prompts.ENCOUNTER, state.canon), user,
            Schemas.encounter, EncounterDraft.serializer(), maxTokens = tokens(5000, 1500),
        )
        val loc = state.locations.getValue(enc.locationId)
        val facts = mutableListOf(draft.description)
        draft.npcs.take(2).forEach { d ->
            val npc = Factory.npc(state, d.copy(hostile = d.hostile && enc.hostile), loc.id, enc.danger)
            state.npcs[npc.id] = npc
            if (npc.hostile) {
                val combat = state.combat ?: com.pixelrpg.engine.model.CombatState().also { state.combat = it }
                combat.enemyIds += npc.id
                facts += "${npc.name} нападает!"
            } else facts += "Появляется: ${npc.name} — ${npc.role}."
        }
        draft.items.take(1).forEach {
            loc.items += Factory.item(state.newId("i"), it, Factory.lootCap(enc.danger), Factory.rarityCap(enc.danger))
            facts += "Рядом что-то есть: ${it.name}."
        }
        return facts
    }

    private suspend fun writeChronicle(state: GameState) {
        val from = (state.chronicle.lastOrNull()?.toTurn ?: 0) + 1
        val events = state.log.filter { it.turn >= from && (it.kind == LogKind.PLAYER || it.kind == LogKind.STORY) }
        if (events.isEmpty()) return
        val text = events.joinToString("\n") { if (it.kind == LogKind.PLAYER) "> ${it.text}" else it.text }
        val result = ask(
            LlmTask.CHRONICLE, Prompts.CHRONICLE, "Герой: ${state.hero.name}.\n\n$text",
            Schemas.chronicle, Summary.serializer(), maxTokens = tokens(3000, 800),
        )
        state.chronicle += Chapter(from, state.turn, result.summary.take(1500))
    }

    /** Описание текущей сцены для генератора картинок (на английском). */
    suspend fun imagePrompt(state: GameState): String {
        val user = buildString {
            appendLine("World art style: ${state.canon.artStyle}")
            appendLine("Palette: ${state.canon.palette.joinToString(" ")}")
            appendLine(Briefing.scene(state, master = false))
            appendLine("Last moment: " + (state.log.lastOrNull { it.kind == LogKind.STORY }?.text?.take(800) ?: ""))
        }
        return ask(LlmTask.IMAGE_PROMPT, Prompts.IMAGE, user, Schemas.imagePrompt, ImagePrompt.serializer(), maxTokens = 2000).prompt
    }

    // ---------- Общее ----------

    /** Маленькой модели — короткие подсказки, сжатые сводки и меньше текста в ответ. */
    private val compact: Boolean get() = llm.compact

    private fun pick(full: String, short: String) = if (compact) short else full

    private fun tokens(full: Int, short: Int) = if (compact) short else full

    private fun canonText(canon: Canon) = if (compact) Briefing.canonCompact(canon) else Briefing.canon(canon)

    /**
     * Системная подсказка. Маленьким моделям канон ставим ПЕРВЫМ: у мастера и рассказчика
     * он одинаковый, и локальный сервер не пересчитывает общее начало заново — это заметно быстрее.
     */
    private fun system(full: String, short: String, canon: Canon) =
        if (compact) canonText(canon) + "\n\n" + short else full + "\n\n" + canonText(canon)

    private fun brief(state: GameState, master: Boolean, recent: Int) =
        if (compact) Briefing.compact(state, master) else Briefing.full(state, master, recent)

    /** Запрос со схемой; при испорченном JSON — одна повторная попытка. */
    private suspend fun <T> ask(
        task: LlmTask,
        system: String,
        user: String,
        schema: JsonObject,
        serializer: KSerializer<T>,
        maxTokens: Int,
        progress: JsonProgress? = null,
        onProgress: ((Progress) -> Unit)? = null,
    ): T {
        var lastError: Exception? = null
        // Маленьким моделям ограничиваем длину списков прямо в схеме.
        val effectiveSchema = if (compact) Schemas.bounded(schema) else schema
        val onText: ((String) -> Unit)? = if (progress != null && onProgress != null) { text -> onProgress(progress.of(text)) } else null
        repeat(2) {
            val text = llm.json(LlmRequest(task, system, user, maxTokens), effectiveSchema, onText)
            try {
                return JsonText.decode(text, serializer)
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw LlmException("ИИ вернул непонятный ответ. Попробуй ещё раз.", retryable = true, lastError)
    }

    companion object {
        const val MARKER = "### ВАРИАНТЫ"
        const val CHAPTER_TURNS = 20

        fun parseSuggestions(text: String): List<String> {
            val i = text.indexOf(MARKER)
            if (i < 0) return emptyList()
            return text.substring(i + MARKER.length).lines()
                .map { it.trim().removePrefix("-").removePrefix("•").trim().trim('*').trim() }
                .filter { it.isNotBlank() }
                .take(4)
        }
    }
}

/** Достаёт JSON-объект из ответа модели и разбирает его без лишней строгости. */
object JsonText {
    fun <T> decode(text: String, serializer: KSerializer<T>): T {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        require(start >= 0 && end > start) { "no JSON object" }
        return SaveCodec.json.decodeFromString(serializer, text.substring(start, end + 1))
    }
}
