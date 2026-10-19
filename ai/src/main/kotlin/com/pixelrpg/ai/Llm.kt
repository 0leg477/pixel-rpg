package com.pixelrpg.ai

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Задачи, которые игра поручает ИИ. Для каждой можно выбрать свою модель и усилие. */
@Serializable
enum class LlmTask(val title: String) {
    GENESIS("Создание мира"),
    HERO("Создание героя"),
    LOCATION("Описание мест"),
    ADJUDICATE("Мастер (разбор хода)"),
    NARRATE("Рассказчик"),
    CHRONICLE("Летописец"),
    IMAGE_PROMPT("Описание картинки"),
}

@Serializable
enum class Effort { LOW, MEDIUM, HIGH }

@Serializable
data class TaskConfig(val model: String, val effort: Effort)

/** Где работает ИИ. */
@Serializable
enum class Backend(val title: String) {
    CLAUDE("Claude (API-ключ)"),
    SERVER("Свой сервер (бесплатно)"),
}

/**
 * Любой сервер с OpenAI-совместимым API: Ollama или llama.cpp на телефоне (Termux),
 * LM Studio или Ollama на компьютере, бесплатные облачные сервисы.
 */
@Serializable
data class ServerSettings(
    val baseUrl: String = "http://127.0.0.1:11434/v1",
    val model: String = "qwen2.5:3b",
    val apiKey: String = "",
    /** Короткие подсказки и ответы — для маленьких моделей на телефоне. */
    val compact: Boolean = true,
)

@Serializable
data class AiSettings(
    val apiKey: String = "",
    val tasks: Map<LlmTask, TaskConfig> = DEFAULTS,
    val backend: Backend = Backend.CLAUDE,
    val server: ServerSettings = ServerSettings(),
) {
    /** Готов ли ИИ к игре: для Claude нужен ключ, для своего сервера — адрес и модель. */
    val ready: Boolean
        get() = when (backend) {
            Backend.CLAUDE -> apiKey.isNotBlank()
            Backend.SERVER -> server.baseUrl.isNotBlank() && server.model.isNotBlank()
        }

    fun config(task: LlmTask): TaskConfig = tasks[task] ?: DEFAULTS.getValue(task)

    companion object {
        const val HAIKU = "claude-haiku-5-5"
        const val SONNET = "claude-sonnet-5-5"
        const val OPUS = "claude-opus-5-5"

        val MODELS = listOf(HAIKU to "Haiku 5.5 — быстро и дёшево", SONNET to "Sonnet 5.5 — умнее", OPUS to "Opus 5.5 — лучший")

        val DEFAULTS: Map<LlmTask, TaskConfig> = mapOf(
            LlmTask.GENESIS to TaskConfig(HAIKU, Effort.HIGH),
            LlmTask.HERO to TaskConfig(HAIKU, Effort.MEDIUM),
            LlmTask.LOCATION to TaskConfig(HAIKU, Effort.MEDIUM),
            LlmTask.ADJUDICATE to TaskConfig(HAIKU, Effort.LOW),
            LlmTask.NARRATE to TaskConfig(HAIKU, Effort.LOW),
            LlmTask.CHRONICLE to TaskConfig(HAIKU, Effort.LOW),
            LlmTask.IMAGE_PROMPT to TaskConfig(HAIKU, Effort.LOW),
        )
    }
}

/**
 * Один запрос к модели. [system] — неизменная часть (инструкции + канон мира),
 * она кэшируется между ходами; всё, что меняется, идёт в [user].
 */
data class LlmRequest(
    val task: LlmTask,
    val system: String,
    val user: String,
    val maxTokens: Int,
)

interface LlmClient {
    /** Маленькая модель: игре нужно писать ей короче и просить меньше. */
    val compact: Boolean get() = false

    /**
     * Ответ строго по JSON-схеме; возвращает текст JSON.
     * [onText] получает весь текст, написанный к этому моменту, — для индикатора прогресса.
     */
    suspend fun json(request: LlmRequest, schema: JsonObject, onText: ((String) -> Unit)? = null): String

    /** Потоковый текст — для рассказчика, чтобы текст «печатался» сразу. */
    fun stream(request: LlmRequest): Flow<String>
}

/** Ошибка, понятная игроку. */
class LlmException(message: String, val retryable: Boolean, cause: Throwable? = null) : Exception(message, cause)
