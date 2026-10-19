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

@Serializable
data class AiSettings(
    val apiKey: String = "",
    val tasks: Map<LlmTask, TaskConfig> = DEFAULTS,
) {
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
    /** Ответ строго по JSON-схеме; возвращает текст JSON. */
    suspend fun json(request: LlmRequest, schema: JsonObject): String

    /** Потоковый текст — для рассказчика, чтобы текст «печатался» сразу. */
    fun stream(request: LlmRequest): Flow<String>
}

/** Ошибка, понятная игроку. */
class LlmException(message: String, val retryable: Boolean, cause: Throwable? = null) : Exception(message, cause)
