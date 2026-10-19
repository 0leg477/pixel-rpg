package com.pixelrpg.ai.view

import com.pixelrpg.ai.GameMaster
import com.pixelrpg.ai.LlmException
import com.pixelrpg.ai.TurnEvent
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.rules.CheckResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class SessionUi(
    val entries: List<Entry>,
    val hud: Hud,
    val streaming: String = "",
    val stage: String? = null,
    val busy: Boolean = false,
    val suggestions: List<String> = emptyList(),
    val error: String? = null,
    /** Последний бросок этого хода — для анимации кубиков. */
    val freshRoll: CheckResult? = null,
    /** Что игрок отправил последним — чтобы можно было повторить после ошибки. */
    val lastInput: String? = null,
)

/**
 * Игровая сессия: один мир, очередь ходов, сохранение после каждого изменения.
 * Всё состояние мира меняется только внутри [mutex], а интерфейс получает готовые снимки.
 */
class GameSession(
    private val state: GameState,
    private val master: GameMaster,
    private val scope: CoroutineScope,
    private val persist: (GameState) -> Unit,
) {
    private val mutex = Mutex()
    private var job: Job? = null

    private val _ui = MutableStateFlow(SessionUi(HudBuilder.entries(state), HudBuilder.build(state)))
    val ui: StateFlow<SessionUi> = _ui

    val worldId: String get() = state.id

    /** Вступление для нового мира: если в журнале ещё нет ни строчки истории. */
    fun startIfNew() {
        if (state.log.none { it.kind == LogKind.STORY }) run(null) { master.intro(state) }
        else _ui.update { it.copy(suggestions = defaultSuggestions()) }
    }

    fun send(input: String) {
        val text = input.trim()
        if (text.isEmpty() || _ui.value.busy || state.gameOver) return
        run(text) { master.playTurn(state, text) }
    }

    fun retry() {
        val last = _ui.value.lastInput
        if (last != null) send(last) else startIfNew()
    }

    fun dismissError() = _ui.update { it.copy(error = null) }

    private fun run(input: String?, events: () -> Flow<TurnEvent>) {
        if (job?.isActive == true) return
        _ui.update { it.copy(busy = true, error = null, streaming = "", suggestions = emptyList(), freshRoll = null, lastInput = input, stage = "…") }
        job = scope.launch(Dispatchers.Default) {
            mutex.withLock {
                var applied = false
                try {
                    events().collect { e ->
                        when (e) {
                            is TurnEvent.Stage -> _ui.update { it.copy(stage = e.text) }
                            is TurnEvent.Resolved -> {
                                applied = true
                                persistSafely()
                                val snapshot = HudBuilder.build(state)
                                val entries = HudBuilder.entries(state)
                                _ui.update { it.copy(entries = entries, hud = snapshot, freshRoll = e.report.check) }
                            }
                            is TurnEvent.Text -> _ui.update { it.copy(streaming = it.streaming + e.chunk) }
                            is TurnEvent.Done -> {
                                persistSafely()
                                val entries = HudBuilder.entries(state)
                                val hud = HudBuilder.build(state)
                                _ui.update {
                                    it.copy(
                                        entries = entries, hud = hud, streaming = "", stage = null,
                                        suggestions = e.suggestions.ifEmpty { defaultSuggestions() },
                                        lastInput = null,
                                    )
                                }
                            }
                        }
                    }
                } catch (e: LlmException) {
                    fail(e.message ?: "Ошибка ИИ", keepInput = !applied)
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    fail("Что-то сломалось: ${e::class.simpleName}: ${e.message?.take(300)}", keepInput = !applied)
                } finally {
                    if (applied) persistSafely()
                    _ui.update { it.copy(busy = false, stage = null) }
                }
            }
        }
    }

    private fun fail(message: String, keepInput: Boolean) {
        _ui.update {
            it.copy(
                error = message,
                streaming = "",
                entries = HudBuilder.entries(state),
                hud = HudBuilder.build(state),
                lastInput = if (keepInput) it.lastInput else null,
                suggestions = defaultSuggestions(),
            )
        }
    }

    private fun persistSafely() {
        runCatching { persist(state) }
    }

    private fun defaultSuggestions(): List<String> = buildList {
        add("Осмотреться")
        state.npcsHere().firstOrNull { !it.hostile }?.let { add("Поговорить: ${it.name}") }
        state.npcsHere().firstOrNull { it.hostile }?.let { add("Атаковать: ${it.name}") }
        if (size < 3) add("Отдохнуть")
    }
}
