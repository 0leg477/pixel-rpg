package com.pixelrpg.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.InternalServerException
import com.anthropic.errors.NotFoundException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.CacheControlEphemeral
import com.anthropic.models.messages.JsonOutputFormat
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.TextBlockParam
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull
import java.time.Duration

/** Клиент Claude API на официальном Java SDK. */
class AnthropicLlm(private val settings: AiSettings) : LlmClient {

    private val client: AnthropicClient by lazy {
        if (settings.apiKey.isBlank()) throw LlmException("Не задан API-ключ Claude. Добавь его в настройках.", retryable = false)
        AnthropicOkHttpClient.builder()
            .apiKey(settings.apiKey.trim())
            .timeout(Duration.ofMinutes(3))
            .maxRetries(2)
            .build()
    }

    override suspend fun json(request: LlmRequest, schema: JsonObject): String = withContext(Dispatchers.IO) {
        val format = JsonOutputFormat.builder()
            .schema(JsonOutputFormat.Schema.builder().additionalProperties(schema.mapValues { JsonValue.from(toJava(it.value)) }).build())
            .build()
        val message = try {
            client.messages().create(params(request, format))
        } catch (e: BadRequestException) {
            // Если схема API не по нраву (слишком сложная), просим JSON словами — парсер справится.
            if (e.message?.contains("schema", ignoreCase = true) != true) call { throw e }
            val fallback = request.copy(user = request.user + "\n\nОтветь ТОЛЬКО одним JSON-объектом без пояснений, строго по схеме:\n$schema")
            call { client.messages().create(params(fallback, null)) }
        } catch (e: Exception) {
            call { throw e }
        }
        checkStop(message)
        message.content().mapNotNull { block -> block.text().orElse(null)?.text() }.joinToString("")
    }

    override fun stream(request: LlmRequest): Flow<String> = flow {
        val response = call { client.messages().createStreaming(params(request, null)) }
        response.use { stream ->
            val events = stream.stream().iterator()
            while (true) {
                val next = call { if (events.hasNext()) events.next() else null } ?: break
                val text = next.contentBlockDelta().flatMap { it.delta().text() }.map { it.text() }.orElse(null)
                if (!text.isNullOrEmpty()) emit(text)
                val stop = next.messageDelta().flatMap { it.delta().stopReason() }.orElse(null)
                if (stop == StopReason.REFUSAL) throw LlmException("Модель отказалась продолжать эту сцену. Попробуй сформулировать иначе.", retryable = false)
            }
        }
    }.flowOn(Dispatchers.IO)

    private fun params(request: LlmRequest, format: JsonOutputFormat?): MessageCreateParams {
        val config = settings.config(request.task)
        val output = OutputConfig.builder().effort(
            when (config.effort) {
                Effort.LOW -> OutputConfig.Effort.LOW
                Effort.MEDIUM -> OutputConfig.Effort.MEDIUM
                Effort.HIGH -> OutputConfig.Effort.HIGH
            },
        )
        if (format != null) output.format(format)
        return MessageCreateParams.builder()
            .model(config.model)
            .maxTokens(request.maxTokens.toLong())
            .systemOfTextBlockParams(
                listOf(
                    TextBlockParam.builder()
                        .text(request.system)
                        .cacheControl(CacheControlEphemeral.builder().build())
                        .build(),
                ),
            )
            .addUserMessage(request.user)
            .outputConfig(output.build())
            .build()
    }

    private fun checkStop(message: Message) {
        when (message.stopReason().orElse(null)) {
            StopReason.REFUSAL -> throw LlmException("Модель отказалась отвечать на этот запрос. Попробуй сформулировать иначе.", retryable = false)
            StopReason.MAX_TOKENS -> throw LlmException("Ответ модели оборвался на полуслове. Попробуй ещё раз.", retryable = true)
            else -> Unit
        }
    }

    /** Переводит ошибки SDK в понятные игроку сообщения. */
    private inline fun <T> call(block: () -> T): T = try {
        block()
    } catch (e: LlmException) {
        throw e
    } catch (e: UnauthorizedException) {
        throw LlmException("API-ключ не подходит. Проверь его в настройках.", retryable = false, e)
    } catch (e: PermissionDeniedException) {
        throw LlmException("У ключа нет доступа к этой модели.", retryable = false, e)
    } catch (e: NotFoundException) {
        throw LlmException("Модель не найдена. Выбери другую в настройках.", retryable = false, e)
    } catch (e: RateLimitException) {
        throw LlmException("Слишком много запросов подряд. Подожди минуту.", retryable = true, e)
    } catch (e: BadRequestException) {
        throw LlmException("Запрос отклонён: ${e.message?.take(200)}", retryable = false, e)
    } catch (e: InternalServerException) {
        throw LlmException("Сервер Claude перегружен. Попробуй ещё раз.", retryable = true, e)
    } catch (e: AnthropicServiceException) {
        throw LlmException("Ошибка Claude API (${e.statusCode()}). Попробуй ещё раз.", retryable = true, e)
    } catch (e: AnthropicIoException) {
        throw LlmException("Нет связи с сервером. Проверь интернет.", retryable = true, e)
    }

    private fun toJava(e: JsonElement): Any? = when (e) {
        is JsonNull -> null
        is JsonObject -> e.mapValues { toJava(it.value) }
        is JsonArray -> e.map { toJava(it) }
        is JsonPrimitive -> when {
            e.isString -> e.content
            e.booleanOrNull != null -> e.booleanOrNull
            e.longOrNull != null -> e.longOrNull
            else -> e.doubleOrNull
        }
    }
}
