package com.pixelrpg.ai

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.InetSocketAddress
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Поддельный OpenAI-совместимый сервер — как Ollama или LM Studio, только предсказуемый. */
class OpenAiCompatLlmTest {

    private val requests = mutableListOf<JsonObject>()
    private var acceptsSchema = true
    private var reply = """{"summary":"ok"}"""
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/v1/chat/completions") { ex ->
            val body = Json.parseToJsonElement(ex.requestBody.readBytes().decodeToString()).jsonObject
            requests += body
            val format = body["response_format"]?.jsonObject?.get("type")?.jsonPrimitive?.content
            if (format == "json_schema" && !acceptsSchema) {
                val err = """{"error":{"message":"response_format json_schema not supported"}}""".toByteArray()
                ex.sendResponseHeaders(400, err.size.toLong())
                ex.responseBody.use { it.write(err) }
                return@createContext
            }
            val stream = body["stream"]?.jsonPrimitive?.content == "true"
            val out = if (stream) {
                listOf("<thi", "nk>долго думаю</think>", "Ветер ", "воет.\n### ВАРИАНТЫ\n- Идти")
                    .joinToString("") { chunk ->
                        "data: " + Json.encodeToString(JsonObject.serializer(), chunkJson(chunk)) + "\n\n"
                    } + "data: [DONE]\n\n"
            } else {
                """{"choices":[{"message":{"role":"assistant","content":${Json.encodeToString(kotlinx.serialization.json.JsonPrimitive.serializer(), kotlinx.serialization.json.JsonPrimitive(reply))}},"finish_reason":"stop"}]}"""
            }
            val bytes = out.toByteArray()
            ex.responseHeaders.add("Content-Type", if (stream) "text/event-stream" else "application/json")
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        createContext("/v1/models") { ex ->
            val bytes = """{"data":[{"id":"qwen2.5:3b"},{"id":"gemma3:4b"}]}""".toByteArray()
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        start()
    }

    private fun chunkJson(text: String) = Json.parseToJsonElement(
        """{"choices":[{"delta":{"content":${Json.encodeToString(kotlinx.serialization.json.JsonPrimitive.serializer(), kotlinx.serialization.json.JsonPrimitive(text))}}}]}""",
    ).jsonObject

    private val llm = OpenAiCompatLlm(ServerSettings(baseUrl = "http://127.0.0.1:${server.address.port}/v1", model = "qwen2.5:3b"))

    @AfterTest
    fun stop() = server.stop(0)

    private val request = LlmRequest(LlmTask.CHRONICLE, "система", "вопрос", 500)

    @Test
    fun `strict schema is sent with refs inlined`() = runBlocking<Unit> {
        assertEquals("""{"summary":"ok"}""", llm.json(request, Schemas.location))
        val schema = requests.single()["response_format"]!!.jsonObject["json_schema"]!!.jsonObject["schema"].toString()
        assertFalse("\$ref" in schema)
        assertFalse("\$defs" in schema)
        assertTrue("\"npcs\"" in schema)
    }

    @Test
    fun `falls back when the server does not know json_schema`() = runBlocking<Unit> {
        acceptsSchema = false
        assertEquals("""{"summary":"ok"}""", llm.json(request, Schemas.chronicle))
        assertEquals("json_object", requests.last()["response_format"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        // Второй запрос сразу идёт в рабочем режиме, без лишней ошибки.
        llm.json(request, Schemas.chronicle)
        assertEquals(3, requests.size)
    }

    @Test
    fun `thinking is stripped from answers and streams`() = runBlocking<Unit> {
        reply = "<think>хм</think>\n{\"summary\":\"ok\"}"
        assertEquals("""{"summary":"ok"}""", llm.json(request, Schemas.chronicle))
        val text = llm.stream(request).toList().joinToString("")
        assertEquals("Ветер воет.\n### ВАРИАНТЫ\n- Идти", text)
    }

    @Test
    fun `lists models for the connection check`() = runBlocking<Unit> {
        assertEquals(listOf("qwen2.5:3b", "gemma3:4b"), llm.listModels())
    }

    @Test
    fun `dead server gives a clear message`() = runBlocking<Unit> {
        val dead = OpenAiCompatLlm(ServerSettings(baseUrl = "http://127.0.0.1:1/v1"))
        val e = assertFailsWith<LlmException> { dead.json(request, Schemas.chronicle) }
        assertTrue("не отвечает" in e.message!!, e.message)
    }
}
