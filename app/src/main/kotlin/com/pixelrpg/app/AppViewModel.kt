package com.pixelrpg.app

import android.app.Application
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pixelrpg.ai.AiSettings
import com.pixelrpg.ai.AnthropicLlm
import com.pixelrpg.ai.Backend
import com.pixelrpg.ai.LlmException
import com.pixelrpg.ai.OpenAiCompatLlm
import com.pixelrpg.ai.ServerSettings
import com.pixelrpg.ai.GameMaster
import com.pixelrpg.ai.image.ImageSettings
import com.pixelrpg.ai.image.ScenePainter
import com.pixelrpg.ai.view.GameSession
import com.pixelrpg.ai.view.WorkshopDraft
import com.pixelrpg.ai.view.WorldWorkshop
import com.pixelrpg.app.data.AndroidImageCodec
import com.pixelrpg.app.data.SettingsStore
import com.pixelrpg.app.data.Storage
import com.pixelrpg.app.data.WorldMeta
import com.pixelrpg.app.ui.theme.Palettes
import com.pixelrpg.app.ui.theme.UiPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class Screen { MENU, WORLDS, SETTINGS, WORKSHOP, GAME }

/** Результат проверки связи с сервером ИИ; [ok] = null — проверка ещё идёт. */
data class ServerCheck(val text: String, val models: List<String>, val ok: Boolean?)

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val storage = Storage(app)
    private val settings = SettingsStore(app)

    private val _screen = MutableStateFlow(Screen.MENU)
    val screen: StateFlow<Screen> = _screen

    private val _ui = MutableStateFlow(settings.ui())
    val uiPrefs: StateFlow<UiPrefs> = _ui

    private val _ai = MutableStateFlow(settings.ai())
    val ai: StateFlow<AiSettings> = _ai

    private val _images = MutableStateFlow(settings.images())
    val images: StateFlow<ImageSettings> = _images

    private val _worlds = MutableStateFlow(storage.listWorlds())
    val worlds: StateFlow<List<WorldMeta>> = _worlds

    private val _session = MutableStateFlow<GameSession?>(null)
    val session: StateFlow<GameSession?> = _session

    private val _workshop = MutableStateFlow<WorldWorkshop?>(null)
    val workshop: StateFlow<WorldWorkshop?> = _workshop

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    /** ИИ настроен: есть ключ Claude или адрес своего сервера. */
    val aiReady: Boolean get() = _ai.value.ready

    private val _serverCheck = MutableStateFlow<ServerCheck?>(null)
    val serverCheck: StateFlow<ServerCheck?> = _serverCheck
    val hasDraft: Boolean get() = storage.loadDraft().let { it.canon != null || it.worldText.isNotBlank() }

    private fun master() = GameMaster(
        when (_ai.value.backend) {
            Backend.CLAUDE -> AnthropicLlm(_ai.value)
            Backend.SERVER -> OpenAiCompatLlm(_ai.value.server)
        },
    )

    /** «Проверить связь»: спрашиваем у сервера список моделей. */
    fun checkServer(server: ServerSettings) {
        _serverCheck.value = ServerCheck("Проверяю…", emptyList(), ok = null)
        viewModelScope.launch {
            _serverCheck.value = try {
                val models = OpenAiCompatLlm(server).listModels()
                val hasModel = models.isEmpty() || models.any { it == server.model || it.startsWith(server.model + ":") }
                ServerCheck(
                    when {
                        models.isEmpty() -> "Связь есть."
                        hasModel -> "Связь есть, модель «${server.model}» на месте."
                        else -> "Связь есть, но модели «${server.model}» на сервере нет. Выбери из списка или скачай её."
                    },
                    models, ok = hasModel,
                )
            } catch (e: LlmException) {
                ServerCheck(e.message ?: "Нет связи", emptyList(), ok = false)
            }
        }
    }

    /** Художник сцен — только если выбран сервис картинок и задан ключ. */
    private fun painter(): ScenePainter? {
        val img = _images.value
        if (!img.enabled) return null
        return ScenePainter(master(), img, AndroidImageCodec, themeRamp = {
            val c = Palettes.byId(_ui.value.themeId)
            listOf(c.bg, c.light, c.dim, c.accent, c.text).map { it.toArgb() }
        })
    }

    fun go(screen: Screen) {
        if (screen == Screen.WORLDS || screen == Screen.MENU) _worlds.value = storage.listWorlds()
        _screen.value = screen
    }

    fun back(): Boolean {
        when (_screen.value) {
            Screen.MENU -> return false
            else -> go(Screen.MENU)
        }
        return true
    }

    fun dismissMessage() {
        _message.value = null
    }

    // ---------- Миры ----------

    fun continueLast() {
        val id = settings.lastWorldId ?: _worlds.value.firstOrNull()?.id ?: return
        openWorld(id)
    }

    fun openWorld(id: String, navigate: Boolean = true) {
        viewModelScope.launch {
            val state = runCatching { withContext(Dispatchers.IO) { storage.load(id) } }.getOrElse {
                _message.value = "Не удалось загрузить мир: ${it.message}"
                return@launch
            }
            settings.lastWorldId = id
            val s = GameSession(state, master(), viewModelScope, painter(), storage.imageDir(id)) { storage.save(it) }
            _session.value = s
            if (navigate) _screen.value = Screen.GAME
            s.startIfNew()
        }
    }

    fun deleteWorld(id: String) {
        storage.delete(id)
        if (settings.lastWorldId == id) settings.lastWorldId = null
        _worlds.value = storage.listWorlds()
    }

    // ---------- Мастерская ----------

    fun openWorkshop(fresh: Boolean) {
        if (fresh) storage.clearDraft()
        val draft = if (fresh) WorkshopDraft() else storage.loadDraft()
        _workshop.value = WorldWorkshop(master(), viewModelScope, draft) { storage.saveDraft(it) }
        _screen.value = Screen.WORKSHOP
    }

    fun startWorld() {
        val w = _workshop.value ?: return
        val id = "w" + UUID.randomUUID().toString().take(8)
        w.start(id, System.nanoTime() xor System.currentTimeMillis(), System.currentTimeMillis()) { state ->
            storage.save(state)
            storage.clearDraft()
            viewModelScope.launch {
                _workshop.value = null
                openWorld(state.id)
            }
        }
    }

    // ---------- Настройки ----------

    fun saveUi(p: UiPrefs) {
        _ui.value = p
        settings.saveUi(p)
    }

    fun saveImages(s: ImageSettings) {
        _images.value = s
        settings.saveImages(s)
        _session.value?.let { current -> openWorld(current.worldId, navigate = false) }
    }

    fun saveAi(s: AiSettings) {
        _ai.value = s
        settings.saveAi(s)
        // Открытый мир переподключаем к ИИ с новыми настройками.
        _session.value?.let { current -> openWorld(current.worldId, navigate = false) }
        _workshop.value?.let { _workshop.value = WorldWorkshop(master(), viewModelScope, it.ui.value.draft) { d -> storage.saveDraft(d) } }
    }
}
