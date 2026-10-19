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

    @Test
    fun `painting a scene adds it to the feed and the album`() = runBlocking<Unit> {
        val llm = FakeLlm()
        val state = newState(llm)
        val codec = object : com.pixelrpg.ai.image.ImageCodec {
            override fun decode(bytes: ByteArray): com.pixelrpg.ai.image.Pixels {
                val img = javax.imageio.ImageIO.read(java.io.ByteArrayInputStream(bytes))
                val px = IntArray(img.width * img.height)
                img.getRGB(0, 0, img.width, img.height, px, 0, img.width)
                return com.pixelrpg.ai.image.Pixels(img.width, img.height, px)
            }
            override fun writePng(pixels: com.pixelrpg.ai.image.Pixels, file: java.io.File) {
                val img = java.awt.image.BufferedImage(pixels.width, pixels.height, java.awt.image.BufferedImage.TYPE_INT_RGB)
                img.setRGB(0, 0, pixels.width, pixels.height, pixels.argb, 0, pixels.width)
                javax.imageio.ImageIO.write(img, "png", file)
            }
        }
        val fakePng = java.io.ByteArrayOutputStream().also { out ->
            val img = java.awt.image.BufferedImage(320, 180, java.awt.image.BufferedImage.TYPE_INT_RGB)
            for (x in 0 until 320) for (y in 0 until 180) img.setRGB(x, y, (x * 255 / 320 shl 16) or (y * 255 / 180 shl 8) or 90)
            javax.imageio.ImageIO.write(img, "png", out)
        }.toByteArray()
        val prompts = mutableListOf<String>()
        val painter = com.pixelrpg.ai.image.ScenePainter(
            GameMaster(llm), com.pixelrpg.ai.image.ImageSettings(pixels = 64), codec,
            generator = { prompts += it; fakePng },
        )
        val dir = kotlin.io.path.createTempDirectory("scenes").toFile()
        val session = GameSession(state, GameMaster(llm), this, painter, dir) {}
        session.paint()
        val ui = withTimeout(5000) { session.ui.first { !it.busy && it.entries.any { e -> e is Entry.Image } } }
        assertNull(ui.error)
        assertEquals(1, ui.hud.album.size)
        val file = java.io.File(ui.hud.album.single().first)
        assertTrue(file.exists())
        assertEquals(64, javax.imageio.ImageIO.read(file).width)
        assertTrue(prompts.single().startsWith("Pixel art"))
    }
}
