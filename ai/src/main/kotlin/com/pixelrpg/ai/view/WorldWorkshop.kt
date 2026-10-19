package com.pixelrpg.ai.view

import com.pixelrpg.ai.GameMaster
import com.pixelrpg.ai.LlmException
import com.pixelrpg.ai.Progress
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.GameSettings
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Hero
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/** Черновик мастерской — переживает закрытие приложения. */
@Serializable
data class WorkshopDraft(
    val worldText: String = "",
    val canon: Canon? = null,
    val heroText: String = "",
    val hero: Hero? = null,
    val permadeath: Boolean = false,
)

enum class WorkshopStep { WORLD, CANON, HERO, HERO_REVIEW }

data class WorkshopUi(
    val draft: WorkshopDraft,
    val step: WorkshopStep,
    val busy: Boolean = false,
    val stage: String? = null,
    val error: String? = null,
    /** Насколько готов ответ модели — для полоски прогресса. */
    val progress: Progress? = null,
)

/** Мастерская мира: описание → канон (с правками) → герой → старт. */
class WorldWorkshop(
    private val master: GameMaster,
    private val scope: CoroutineScope,
    initial: WorkshopDraft,
    private val saveDraft: (WorkshopDraft) -> Unit,
) {
    private val _ui = MutableStateFlow(
        WorkshopUi(
            initial,
            when {
                initial.hero != null -> WorkshopStep.HERO_REVIEW
                initial.canon != null -> WorkshopStep.CANON
                else -> WorkshopStep.WORLD
            },
        ),
    )
    val ui: StateFlow<WorkshopUi> = _ui

    private fun edit(block: (WorkshopDraft) -> WorkshopDraft) {
        _ui.update { it.copy(draft = block(it.draft)) }
        saveDraft(_ui.value.draft)
    }

    fun setWorldText(t: String) = edit { it.copy(worldText = t) }
    fun setHeroText(t: String) = edit { it.copy(heroText = t) }
    fun setPermadeath(v: Boolean) = edit { it.copy(permadeath = v) }

    fun goTo(step: WorkshopStep) = _ui.update { it.copy(step = step, error = null) }

    fun createCanon() = work("Мир обретает форму…") {
        val canon = master.createCanon(_ui.value.draft.worldText, ::report)
        edit { it.copy(canon = canon, hero = null) }
        goTo(WorkshopStep.CANON)
    }

    fun refineCanon(instruction: String) = work("Мир меняется…") {
        val current = _ui.value.draft.canon ?: return@work
        val canon = master.refineCanon(current, instruction, ::report)
        edit { it.copy(canon = canon, hero = null) }
    }

    fun createHero() = work("Герой выходит из тумана…") {
        val canon = _ui.value.draft.canon ?: return@work
        val hero = master.createHero(canon, _ui.value.draft.heroText, ::report)
        edit { it.copy(hero = hero) }
        goTo(WorkshopStep.HERO_REVIEW)
    }

    fun start(newId: String, seed: Long, now: Long, onReady: (GameState) -> Unit) = work("Создаётся первая сцена…") {
        val d = _ui.value.draft
        val canon = d.canon ?: return@work
        val hero = d.hero ?: return@work
        val state = master.startGame(newId, seed, canon, hero, GameSettings(permadeath = d.permadeath), now, ::report)
        onReady(state)
    }

    fun dismissError() = _ui.update { it.copy(error = null) }

    /** Остановить долгую генерацию. Модель на сервере тоже остановится: соединение закроется. */
    fun cancel() {
        job?.cancel()
    }

    private fun report(p: Progress) = _ui.update { it.copy(progress = p) }

    private var job: Job? = null

    private fun work(stage: String, block: suspend () -> Unit) {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, stage = stage, error = null, progress = null) }
        job = scope.launch(Dispatchers.Default) {
            try {
                block()
            } catch (e: LlmException) {
                _ui.update { it.copy(error = e.message) }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(error = "Что-то сломалось: ${e::class.simpleName}: ${e.message?.take(300)}") }
            } finally {
                _ui.update { it.copy(busy = false, stage = null, progress = null) }
            }
        }
    }
}
