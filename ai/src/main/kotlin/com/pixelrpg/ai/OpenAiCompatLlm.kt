package com.pixelrpg.ai

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.IOException
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL

/**
 * Клиент для любого OpenAI-совместимого сервера: Ollama, llama.cpp, LM Studio, облачные сервисы.
 * Строгий JSON просим через `response_format` со схемой; если сервер такого не умеет —
 * откатываемся на `json_object`, а затем на схему в тексте подсказки.
 */
class OpenAiCompatLlm(private val server: ServerSettings) : LlmClient {

    override val compact: Boolean get() = server.compact

    private enum class JsonMode { SCHEMA, OBJECT, PROMPT }

    @Volatile
    private var jsonMode = JsonMode.SCHEMA

    private val json = Json { ignoreUnknownKeys = true }

    private class HttpError(val code: Int, val body: String) : IOException("HTTP $code")

    override suspend fun json(request: LlmRequest, schema: JsonObject, onText: ((String) -> Unit)?): String = withContext(Dispatchers.IO) {
        val inlined = inlineRefs(schema, schema)
        while (true) {
            val mode = jsonMode
            val user = if (mode == JsonMode.SCHEMA) request.user
            else request.user + "\n\nОтветь ТОЛЬКО одним JSON-объектом без пояснений, строго по этой JSON-схеме:\n$inlined"
            val body = buildJsonObject {
                put("model", server.model)
                putMessages(request.system, user)
                put("max_tokens", request.maxTokens)
                put("temperature", 0.5)
                // Потоком: длинный ответ маленькой модели не упрётся в таймаут, а игрок видит прогресс.
                put("stream", true)
                when (mode) {
                    JsonMode.SCHEMA -> putJsonObject("response_format") {
                        put("type", "json_schema")
                        putJsonObject("json_schema") {
                            put("name", "answer")
                            put("strict", true)
                            put("schema", inlined)
                        }
                    }
                    JsonMode.OBJECT -> putJsonObject("response_format") { put("type", "json_object") }
                    JsonMode.PROMPT -> Unit
                }
            }
            try {
                val text = StringBuilder()
                val thinking = ThinkFilter()
                val finish = streamChat(body.toString()) { delta ->
                    val visible = thinking.feed(delta)
                    if (visible.isNotEmpty()) {
                        text.append(visible)
                        onText?.invoke(text.toString())
                    }
                }
                if (finish == "length") {
                    throw LlmException("Ответ модели оборвался. Попробуй ещё раз или увеличь контекст модели.", retryable = true)
                }
                if (text.isBlank()) throw LlmException("Сервер ИИ вернул пустой ответ.", retryable = true)
                return@withContext stripThinking(text.toString())
            } catch (e: HttpError) {
                // Сервер не понял response_format (4xx) или упал на сложной грамматике схемы (5xx) — пробуем попроще.
                val formatProblem = e.code in 400..422 && e.code != 401 && e.code != 403 && e.code != 404
                val crashedOnSchema = e.code >= 500 && mode == JsonMode.SCHEMA
                if ((formatProblem || crashedOnSchema) && mode != JsonMode.PROMPT) {
                    jsonMode = if (mode == JsonMode.SCHEMA) JsonMode.OBJECT else JsonMode.PROMPT
                    continue
                }
                throw mapError(e)
            } catch (e: IOException) {
                throw mapError(e)
            }
        }
        @Suppress("UNREACHABLE_CODE")
        error("unreachable")
    }

    override fun stream(request: LlmRequest): Flow<String> = flow {
        val body = buildJsonObject {
            put("model", server.model)
            putMessages(request.system, request.user)
            put("max_tokens", request.maxTokens)
            put("temperature", 0.8)
            put("stream", true)
        }
        val thinking = ThinkFilter()
        try {
            streamChat(body.toString()) { delta ->
                val visible = thinking.feed(delta)
                if (visible.isNotEmpty()) emit(visible)
            }
        } catch (e: IOException) {
            throw mapError(e)
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Читает ответ сервера потоком (SSE) и отдаёт каждый кусочек текста в [onDelta].
     * Возвращает finish_reason. Ждём до 5 минут тишины — столько маленькая модель может читать подсказку.
     */
    private suspend fun streamChat(body: String, onDelta: suspend (String) -> Unit): String? {
        val conn = open("chat/completions", body)
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw HttpError(code, conn.errorStream?.bufferedReader()?.use { it.readText() } ?: "")
            var finish: String? = null
            conn.inputStream.bufferedReader().use { reader ->
                while (true) {
                    currentCoroutineContext().ensureActive()
                    val line = reader.readLine() ?: break
                    if (!line.startsWith("data:")) continue
                    val data = line.removePrefix("data:").trim()
                    if (data == "[DONE]") break
                    val choice = runCatching {
                        json.parseToJsonElement(data).jsonObject["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                    }.getOrNull() ?: continue
                    choice["finish_reason"]?.jsonPrimitive?.contentOrNull?.let { finish = it }
                    val delta = choice["delta"]?.jsonObject?.get("content")?.jsonPrimitive?.contentOrNull ?: continue
                    if (delta.isNotEmpty()) onDelta(delta)
                }
            }
            return finish
        } finally {
            conn.disconnect()
        }
    }

    /** Список моделей на сервере — для кнопки «Проверить связь». */
    suspend fun listModels(): List<String> = withContext(Dispatchers.IO) {
        try {
            val conn = (URL(url("models")).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8_000
                readTimeout = 15_000
                if (server.apiKey.isNotBlank()) setRequestProperty("Authorization", "Bearer ${server.apiKey.trim()}")
            }
            try {
                val code = conn.responseCode
                val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
                if (code !in 200..299) throw HttpError(code, text)
                json.parseToJsonElement(text).jsonObject["data"]?.jsonArray
                    ?.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull }.orEmpty()
            } finally {
                conn.disconnect()
            }
        } catch (e: IOException) {
            throw mapError(e)
        }
    }

    private fun kotlinx.serialization.json.JsonObjectBuilder.putMessages(system: String, user: String) {
        putJsonArray("messages") {
            addJsonObject {
                put("role", "system")
                put("content", system)
            }
            addJsonObject {
                put("role", "user")
                put("content", user)
            }
        }
    }

    private fun url(path: String) = server.baseUrl.trim().trimEnd('/') + "/" + path

    private fun open(path: String, body: String): HttpURLConnection {
        val conn = (URL(url(path)).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            // Тишина между кусочками ответа: столько маленькая модель может читать длинную подсказку.
            readTimeout = 300_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            if (server.apiKey.isNotBlank()) setRequestProperty("Authorization", "Bearer ${server.apiKey.trim()}")
        }
        conn.outputStream.use { it.write(body.toByteArray()) }
        return conn
    }

    private fun mapError(e: IOException): LlmException {
        val detail = (e as? HttpError)?.body?.let { body ->
            runCatching {
                val err = json.parseToJsonElement(body).jsonObject["error"]
                (err as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull ?: err?.jsonPrimitive?.contentOrNull
            }.getOrNull() ?: body.take(200)
        }
        return when {
            e is ConnectException -> LlmException(
                "Сервер ИИ не отвечает (${server.baseUrl}). Запущен ли он? Для Termux: команда «ollama serve».",
                retryable = true, e,
            )
            e is SocketTimeoutException -> LlmException("Модель слишком долго думает. Попробуй модель поменьше или включи компактный режим.", retryable = true, e)
            e is HttpError && e.code == 404 -> LlmException(
                "Сервер не нашёл модель «${server.model}». Скачай её (например: ollama pull ${server.model}) или проверь название.",
                retryable = false, e,
            )
            e is HttpError && (e.code == 401 || e.code == 403) -> LlmException("Сервер ИИ не принял ключ.", retryable = false, e)
            e is HttpError && e.code == 429 -> LlmException("Сервер ИИ просит подождать (лимит запросов).", retryable = true, e)
            e is HttpError && e.code >= 500 && detail?.contains("terminated") == true -> LlmException(
                "Модель упала на сервере ($detail). Обычно не хватает памяти или модель не запускается на этом устройстве: " +
                    "посмотри ошибку в окне Termux с «ollama serve» и попробуй модель поменьше (например qwen2.5:1.5b).",
                retryable = true, e,
            )
            e is HttpError -> LlmException("Сервер ИИ ответил ошибкой ${e.code}${detail?.let { ": $it" } ?: ""}", retryable = e.code >= 500, e)
            else -> LlmException("Нет связи с сервером ИИ: ${e.message}", retryable = true, e)
        }
    }

    companion object {
        /** Убирает рассуждения «думающих» моделей: <think>…</think>. */
        fun stripThinking(text: String): String {
            val closed = Regex("(?s)<think>.*?</think>").replace(text, "")
            val open = closed.indexOf("<think>")
            return (if (open >= 0) closed.substring(0, open) else closed).trim()
        }

        /**
         * Подставляет `$defs` вместо ссылок `$ref`: не все локальные серверы понимают ссылки.
         * Наши схемы не рекурсивны, так что это безопасно.
         */
        fun inlineRefs(node: JsonElement, root: JsonObject): JsonElement = when (node) {
            is JsonObject -> {
                val ref = node["\$ref"]?.jsonPrimitive?.contentOrNull
                if (ref != null) {
                    val target = root["\$defs"]?.jsonObject?.get(ref.substringAfterLast('/'))
                        ?: error("unknown ref $ref")
                    inlineRefs(target, root)
                } else JsonObject(node.filterKeys { it != "\$defs" }.mapValues { inlineRefs(it.value, root) })
            }
            is JsonArray -> JsonArray(node.map { inlineRefs(it, root) })
            else -> node
        }

        fun inlineRefs(schema: JsonObject, root: JsonObject): JsonObject = inlineRefs(schema as JsonElement, root) as JsonObject
    }

    /** Фильтр потока: прячет блок <think>…</think>, если модель начала с него. */
    private class ThinkFilter {
        private val buffer = StringBuilder()
        private var state = 0 // 0 — ещё не ясно, 1 — внутри размышлений, 2 — обычный текст

        fun feed(delta: String): String {
            if (state == 2) return delta
            buffer.append(delta)
            if (state == 0) {
                val trimmed = buffer.trimStart()
                if (trimmed.length < 7 && "<think>".startsWith(trimmed.toString())) return ""
                if (!trimmed.startsWith("<think>")) {
                    state = 2
                    return buffer.toString().also { buffer.clear() }
                }
                state = 1
            }
            val end = buffer.indexOf("</think>")
            if (end < 0) return ""
            state = 2
            val rest = buffer.substring(end + "</think>".length).trimStart()
            buffer.clear()
            return rest
        }
    }
}
