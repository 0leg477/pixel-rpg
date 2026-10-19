package com.pixelrpg.engine

import com.pixelrpg.engine.model.GameState
import kotlinx.serialization.json.Json

/** Сохранения — обычный JSON: легко читать, легко переносить. */
object SaveCodec {
    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        coerceInputValues = true
        explicitNulls = false
    }

    fun encode(state: GameState): String = json.encodeToString(GameState.serializer(), state)

    fun decode(text: String): GameState = json.decodeFromString(GameState.serializer(), text)
}
