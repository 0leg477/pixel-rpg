package com.pixelrpg.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.pixelrpg.ai.AiSettings
import com.pixelrpg.ai.image.ImageSettings
import com.pixelrpg.ai.view.WorkshopDraft
import com.pixelrpg.app.ui.theme.UiPrefs
import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.model.Clock
import com.pixelrpg.engine.model.GameState
import kotlinx.serialization.Serializable
import java.io.File

@Serializable
data class WorldMeta(
    val id: String,
    val title: String,
    val heroName: String,
    val place: String,
    val turn: Int,
    val day: Int,
    val updatedAt: Long,
)

/** Сохранения миров: по папке на мир, внутри state.json и meta.json. */
class Storage(context: Context) {
    private val root = File(context.filesDir, "worlds").apply { mkdirs() }
    private val draftFile = File(context.filesDir, "workshop.json")
    private val json = SaveCodec.json

    fun listWorlds(): List<WorldMeta> = root.listFiles().orEmpty()
        .mapNotNull { dir -> runCatching { json.decodeFromString(WorldMeta.serializer(), File(dir, "meta.json").readText()) }.getOrNull() }
        .sortedByDescending { it.updatedAt }

    fun save(state: GameState) {
        val dir = File(root, state.id).apply { mkdirs() }
        writeAtomic(File(dir, "state.json"), SaveCodec.encode(state))
        val meta = WorldMeta(
            id = state.id,
            title = state.canon.title,
            heroName = state.hero.name,
            place = state.locations[state.currentLocationId]?.name ?: "",
            turn = state.turn,
            day = Clock.day(state.minute),
            updatedAt = System.currentTimeMillis(),
        )
        writeAtomic(File(dir, "meta.json"), json.encodeToString(WorldMeta.serializer(), meta))
    }

    fun load(id: String): GameState = SaveCodec.decode(File(File(root, id), "state.json").readText())

    /** Папка для картинок сцен этого мира. */
    fun imageDir(id: String): File = File(File(root, id), "images")

    fun delete(id: String) {
        File(root, id).deleteRecursively()
    }

    fun loadDraft(): WorkshopDraft = runCatching {
        json.decodeFromString(WorkshopDraft.serializer(), draftFile.readText())
    }.getOrDefault(WorkshopDraft())

    fun saveDraft(draft: WorkshopDraft) = writeAtomic(draftFile, json.encodeToString(WorkshopDraft.serializer(), draft))

    fun clearDraft() {
        draftFile.delete()
    }

    private fun writeAtomic(file: File, text: String) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(text)
        if (!tmp.renameTo(file)) {
            file.delete()
            tmp.renameTo(file)
        }
    }
}

/** Настройки: оформление и модели — обычные, API-ключ — в зашифрованном хранилище. */
class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val secrets: SharedPreferences = runCatching {
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context, "secrets", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }.getOrElse { context.getSharedPreferences("secrets_plain", Context.MODE_PRIVATE) }
    private val json = SaveCodec.json

    fun ui(): UiPrefs = prefs.getString("ui", null)
        ?.let { runCatching { json.decodeFromString(UiPrefs.serializer(), it) }.getOrNull() } ?: UiPrefs()

    fun saveUi(p: UiPrefs) = prefs.edit().putString("ui", json.encodeToString(UiPrefs.serializer(), p)).apply()

    fun ai(): AiSettings {
        val base = prefs.getString("ai", null)
            ?.let { runCatching { json.decodeFromString(AiSettings.serializer(), it) }.getOrNull() } ?: AiSettings()
        return base.copy(
            apiKey = secrets.getString("api_key", "") ?: "",
            server = base.server.copy(apiKey = secrets.getString("server_key", "") ?: ""),
        )
    }

    fun saveAi(s: AiSettings) {
        val public = s.copy(apiKey = "", server = s.server.copy(apiKey = ""))
        prefs.edit().putString("ai", json.encodeToString(AiSettings.serializer(), public)).apply()
        secrets.edit()
            .putString("api_key", s.apiKey.trim())
            .putString("server_key", s.server.apiKey.trim())
            .apply()
    }

    fun images(): ImageSettings {
        val base = prefs.getString("images", null)
            ?.let { runCatching { json.decodeFromString(ImageSettings.serializer(), it) }.getOrNull() } ?: ImageSettings()
        return base.copy(apiKey = secrets.getString("image_key", "") ?: "")
    }

    fun saveImages(s: ImageSettings) {
        prefs.edit().putString("images", json.encodeToString(ImageSettings.serializer(), s.copy(apiKey = ""))).apply()
        secrets.edit().putString("image_key", s.apiKey.trim()).apply()
    }

    var lastWorldId: String?
        get() = prefs.getString("last_world", null)
        set(v) = prefs.edit().putString("last_world", v).apply()
}
