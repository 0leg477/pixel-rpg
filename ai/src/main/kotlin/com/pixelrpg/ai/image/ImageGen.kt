package com.pixelrpg.ai.image

import com.pixelrpg.ai.LlmException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

@Serializable
enum class ImageProvider(val title: String, val defaultModel: String) {
    OFF("Выключены", ""),
    GEMINI("Google Gemini", "gemini-2.5-flash-image"),
    OPENAI("OpenAI", "gpt-image-2"),
}

/** Как сводить картинку к пиксель-арту. */
@Serializable
enum class PaletteMode(val title: String) {
    AUTO("Свои цвета картинки"),
    WORLD("Тон палитры мира"),
    THEME("Тон темы интерфейса"),
}

@Serializable
data class ImageSettings(
    val provider: ImageProvider = ImageProvider.OFF,
    val apiKey: String = "",
    val model: String = "",
    val palette: PaletteMode = PaletteMode.AUTO,
    /** Ширина картинки в «больших пикселях». */
    val pixels: Int = 160,
) {
    val enabled: Boolean get() = provider != ImageProvider.OFF && apiKey.isNotBlank()
    val modelOrDefault: String get() = model.ifBlank { provider.defaultModel }
}

/** Генератор картинки по текстовому описанию; возвращает байты PNG/JPEG. */
fun interface ImageGenerator {
    suspend fun generate(prompt: String): ByteArray
}

object ImageGenerators {

    fun create(settings: ImageSettings): ImageGenerator = when (settings.provider) {
        ImageProvider.GEMINI -> ImageGenerator { gemini(settings.apiKey.trim(), settings.modelOrDefault, it) }
        ImageProvider.OPENAI -> ImageGenerator { openAi(settings.apiKey.trim(), settings.modelOrDefault, it) }
        ImageProvider.OFF -> ImageGenerator { throw LlmException("Генерация картинок выключена. Включи её в настройках.", retryable = false) }
    }

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun gemini(key: String, model: String, prompt: String): ByteArray {
        val body = buildJsonObject {
            putJsonArray("contents") {
                add(buildJsonObject { putJsonArray("parts") { add(buildJsonObject { put("text", prompt) }) } })
            }
            putJsonObject("generationConfig") {
                putJsonArray("responseModalities") { add("IMAGE") }
                putJsonObject("imageConfig") { put("aspectRatio", "16:9") }
            }
        }
        val response = post(
            "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent",
            mapOf("x-goog-api-key" to key),
            body, model,
        )
        val parts = response["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("content")?.jsonObject?.get("parts")?.jsonArray.orEmpty()
        val data = parts.firstNotNullOfOrNull { p ->
            val inline = p.jsonObject["inlineData"] ?: p.jsonObject["inline_data"]
            inline?.jsonObject?.get("data")?.jsonPrimitive?.contentOrNull
        } ?: throw LlmException("Gemini не вернул картинку (возможно, сработал фильтр). Попробуй ещё раз.", retryable = true)
        return Base64.getDecoder().decode(data)
    }

    private suspend fun openAi(key: String, model: String, prompt: String): ByteArray {
        val body = buildJsonObject {
            put("model", model)
            put("prompt", prompt)
            put("size", "1536x1024")
            put("quality", "low")
            put("n", 1)
        }
        val response = post("https://api.openai.com/v1/images/generations", mapOf("Authorization" to "Bearer $key"), body, model)
        val data = response["data"]?.jsonArray?.firstOrNull()?.jsonObject?.get("b64_json")?.jsonPrimitive?.contentOrNull
            ?: throw LlmException("OpenAI не вернул картинку. Попробуй ещё раз.", retryable = true)
        return Base64.getDecoder().decode(data)
    }

    private suspend fun post(url: String, headers: Map<String, String>, body: JsonObject, model: String): JsonObject = withContext(Dispatchers.IO) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20_000
            readTimeout = 180_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                val message = runCatching {
                    json.parseToJsonElement(text).jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull
                }.getOrNull()
                throw LlmException(
                    when (code) {
                        401, 403 -> "Ключ сервиса картинок не подходит."
                        404 -> "Модель картинок «$model» не найдена. Проверь название в настройках."
                        429 -> "Сервис картинок просит подождать."
                        else -> "Сервис картинок ответил ошибкой $code${message?.let { ": ${it.take(200)}" } ?: ""}"
                    },
                    retryable = code == 429 || code >= 500,
                )
            }
            json.parseToJsonElement(text).jsonObject
        } catch (e: IOException) {
            throw LlmException("Нет связи с сервисом картинок.", retryable = true, e)
        } finally {
            conn.disconnect()
        }
    }
}
