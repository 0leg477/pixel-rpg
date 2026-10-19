package com.pixelrpg.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pixelrpg.ai.AiSettings
import com.pixelrpg.ai.AnthropicLlm
import com.pixelrpg.ai.GameMaster
import com.pixelrpg.ai.view.GameSession
import com.pixelrpg.ai.view.WorkshopDraft
import com.pixelrpg.ai.view.WorldWorkshop
import com.pixelrpg.app.data.SettingsStore
import com.pixelrpg.app.data.Storage
import com.pixelrpg.app.data.WorldMeta
import com.pixelrpg.app.ui.theme.UiPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class Screen { MENU, WORLDS, SETTINGS, WORKSHOP, GAME }

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val storage = Storage(app)
    private val settings = SettingsStore(app)

    private val _screen = MutableStateFlow(Screen.MENU)
    val screen: StateFlow<Screen> = _screen

    private val _ui = MutableStateFlow(settings.ui())
    val uiPrefs: StateFlow<UiPrefs> = _ui

    private val _ai = MutableStateFlow(settings.ai())
    val ai: StateFlow<AiSettings> = _ai

    private val _worlds = MutableStateFlow(storage.listWorlds())
    val worlds: StateFlow<List<WorldMeta>> = _worlds

    private val _session = MutableStateFlow<GameSession?>(null)
    val session: StateFlow<GameSession?> = _session

    private val _workshop = MutableStateFlow<WorldWorkshop?>(null)
    val workshop: StateFlow<WorldWorkshop?> = _workshop

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    val hasKey: Boolean get() = _ai.value.apiKey.isNotBlank()
    val hasDraft: Boolean get() = storage.loadDraft().let { it.canon != null || it.worldText.isNotBlank() }

    private fun master() = GameMaster(AnthropicLlm(_ai.value))

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
            val s = GameSession(state, master(), viewModelScope) { storage.save(it) }
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

    fun saveAi(s: AiSettings) {
        _ai.value = s
        settings.saveAi(s)
        // Открытый мир переподключаем к ИИ с новыми настройками.
        _session.value?.let { current -> openWorld(current.worldId, navigate = false) }
        _workshop.value?.let { _workshop.value = WorldWorkshop(master(), viewModelScope, it.ui.value.draft) { d -> storage.saveDraft(d) } }
    }
}
