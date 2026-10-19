package com.pixelrpg.ai

import com.pixelrpg.ai.view.Entry
import com.pixelrpg.ai.view.GameSession
import com.pixelrpg.ai.view.WorkshopStep
import com.pixelrpg.ai.view.WorldWorkshop
import com.pixelrpg.ai.view.WorkshopDraft
import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.turn.Adjudication
import com.pixelrpg.engine.turn.EffectSpec
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SessionTest {

    private fun newState(llm: FakeLlm): GameState = runBlocking {
        val gm = GameMaster(llm)
        val canon = gm.createCanon("мир")
        gm.startGame("s1", 3, canon, gm.createHero(canon, ""), com.pixelrpg.engine.model.GameSettings(), 0)
    }

    @Test
    fun `workshop goes from description to a started game`() = runBlocking<Unit> {
        val llm = FakeLlm()
        val drafts = mutableListOf<WorkshopDraft>()
        val w = WorldWorkshop(GameMaster(llm), this, WorkshopDraft(), drafts::add)
        w.setWorldText("мир у тракта")
        w.createCanon()
        withTimeout(5000) { w.ui.first { !it.busy && it.step == WorkshopStep.CANON } }
        w.goTo(WorkshopStep.HERO)
        w.createHero()
        withTimeout(5000) { w.ui.first { !it.busy && it.step == WorkshopStep.HERO_REVIEW } }
        var started: GameState? = null
        w.start("g", 1, 0) { started = it }
        withTimeout(5000) { w.ui.first { !it.busy && started != null } }
        assertEquals("Сторожка", started!!.location.name)
        assertNotNull(drafts.last().hero)
    }

    @Test
    fun `session plays intro then a turn and saves`() = runBlocking<Unit> {
        val llm = FakeLlm()
        val state = newState(llm)
        val saves = mutableListOf<String>()
        val session = GameSession(state, GameMaster(llm), this) { saves += SaveCodec.encode(it) }

        session.startIfNew()
        val afterIntro = withTimeout(5000) { session.ui.first { !it.busy && it.entries.any { e -> e is Entry.Story } } }
        assertEquals(3, afterIntro.suggestions.size)
        assertTrue(saves.isNotEmpty())

        val guard = state.npcsHere().first()
        llm.adjudications += Adjudication(
            action = "talk", summary = "говорит", targetNpcId = guard.id, needsRoll = true, skillId = "talk",
            success = listOf(EffectSpec("npc_attitude", npcId = guard.id, amount = 10)),
            partial = listOf(EffectSpec("npc_attitude", npcId = guard.id, amount = 5)),
            failure = listOf(EffectSpec("npc_attitude", npcId = guard.id, amount = -10)),
        )
        session.send("Привет, страж")
        val done = withTimeout(5000) { session.ui.first { !it.busy && it.entries.count { e -> e is Entry.Story } == 2 } }
        assertNull(done.error)
        assertTrue(done.entries.any { it is Entry.Roll })
        assertTrue(done.entries.any { it is Entry.Player && it.text == "Привет, страж" })
        // Порядок внутри хода: заявка → бросок → изменения → рассказ.
        val turn = done.entries.dropWhile { !(it is Entry.Player && it.text == "Привет, страж") }
        assertTrue(turn.first() is Entry.Player)
        assertTrue(turn.last() is Entry.Story)
        assertEquals(SaveCodec.encode(state), saves.last())
    }

    @Test
    fun `an AI failure keeps the input for retry and does not touch the world`() = runBlocking<Unit> {
        val llm = FakeLlm()
        val state = newState(llm)
        val turnBefore = state.turn
        val session = GameSession(state, GameMaster(llm), this) {}
        // Очередь решений мастера пуста — подставной ИИ упадёт, как упал бы настоящий.
        val failing = object : LlmClient by llm {
            override suspend fun json(request: LlmRequest, schema: kotlinx.serialization.json.JsonObject): String =
                throw LlmException("Нет связи с сервером.", retryable = true)
        }
        val s2 = GameSession(state, GameMaster(failing), this) {}
        s2.send("иду")
        val ui = withTimeout(5000) { s2.ui.first { !it.busy && it.error != null } }
        assertEquals("Нет связи с сервером.", ui.error)
        assertEquals("иду", ui.lastInput)
        assertEquals(turnBefore, state.turn)
        session.dismissError()
    }
}
