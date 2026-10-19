package com.pixelrpg.ai

import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.gen.HeroDraft
import com.pixelrpg.engine.gen.ItemDraft
import com.pixelrpg.engine.gen.LocationDraft
import com.pixelrpg.engine.gen.NpcDraft
import com.pixelrpg.engine.gen.PlaceDraft
import com.pixelrpg.engine.gen.StatValue
import com.pixelrpg.engine.model.AttributeDef
import com.pixelrpg.engine.model.BiomeDef
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.CurrencyDef
import com.pixelrpg.engine.model.FactionDef
import com.pixelrpg.engine.model.GameSettings
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.model.ResourceDef
import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.model.SkillDef
import com.pixelrpg.engine.turn.Adjudication
import com.pixelrpg.engine.turn.EffectSpec
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Подставной ИИ: отвечает заранее заготовленным JSON и текстом. */
class FakeLlm(override val compact: Boolean = false) : LlmClient {
    val requests = mutableListOf<LlmRequest>()
    val adjudications = ArrayDeque<Adjudication>()
    var narration = "Ветер треплет вывеску таверны. Ты стоишь у ворот.\n### ВАРИАНТЫ\n- Зайти в таверну\n- Расспросить стражника\n- Уйти на север"
    var brokenJsonOnce = false

    private fun <T> enc(s: KSerializer<T>, v: T) = SaveCodec.json.encodeToString(s, v)

    override suspend fun json(request: LlmRequest, schema: JsonObject): String {
        requests += request
        if (brokenJsonOnce) {
            brokenJsonOnce = false
            return "{ это не json"
        }
        return when (request.task) {
            LlmTask.GENESIS -> enc(Canon.serializer(), canon)
            LlmTask.HERO -> enc(HeroDraft.serializer(), HeroDraft(
                name = "Ирва", concept = "наёмница",
                attributes = listOf(StatValue("body", 2), StatValue("mind", 1)),
                skills = listOf(StatValue("sword", 2), StatValue("talk", 1)),
                items = listOf(ItemDraft("Меч", slot = "weapon", power = 2, value = 10)),
            ))
            LlmTask.LOCATION -> if ("Встреча:" in request.user) {
                """{"description":"Из кустов выскакивает волк.","npcs":[${enc(NpcDraft.serializer(), NpcDraft("Волк", "зверь", power = 2, hostile = true))}],"items":[]}"""
            } else enc(LocationDraft.serializer(), LocationDraft(
                name = "Сторожка", description = "Деревня у тракта.",
                places = listOf(PlaceDraft("Таверна «Кривой гусь»", "place", "шумно")),
                npcs = listOf(NpcDraft("Борута", "стражник", knowledge = listOf("На севере пропадают люди"))),
            ))
            LlmTask.ADJUDICATE -> enc(Adjudication.serializer(), adjudications.removeFirst())
            LlmTask.CHRONICLE -> """{"summary":"Герой пришёл в деревню."}"""
            LlmTask.NARRATE, LlmTask.IMAGE_PROMPT -> """{"prompt":"Pixel art, a village gate"}"""
        }
    }

    override fun stream(request: LlmRequest): Flow<String> {
        requests += request
        // Отдаём кусками, чтобы маркер вариантов разрезался между ними.
        return flowOf(*narration.chunked(7).toTypedArray())
    }

    companion object {
        val canon = Canon(
            title = "Тракт", pitch = "Земли вдоль старого тракта.", genre = "фэнтези", tone = "суровый", narratorStyle = "коротко",
            attributes = listOf(AttributeDef("body", "Тело"), AttributeDef("mind", "Разум")),
            skills = listOf(SkillDef("sword", "Меч", "body", tags = listOf("бой")), SkillDef("talk", "Речь", "mind", tags = listOf("social"))),
            resources = listOf(ResourceDef("hp", "Здоровье", 12, ResourceRole.HEALTH, 1)),
            currency = CurrencyDef("грошей", startAmount = 20),
            factions = listOf(FactionDef("guard", "Стража")),
            biomes = listOf(BiomeDef("plains", "Поля", danger = 1), BiomeDef("woods", "Чаща", danger = 4)),
            startScenario = "Герой приходит в деревню у тракта.",
        )
    }
}

class GameMasterTest {

    private suspend fun newGame(llm: FakeLlm): com.pixelrpg.engine.model.GameState {
        val gm = GameMaster(llm)
        val canon = gm.createCanon("мир у тракта")
        val hero = gm.createHero(canon, "наёмница с мечом")
        return gm.startGame("g1", 5, canon, hero, GameSettings(), 0)
    }

    @Test
    fun `world creation fills the starting place`() = runTest {
        val llm = FakeLlm()
        val state = newGame(llm)
        assertEquals("Сторожка", state.location.name)
        assertTrue(state.location.generated)
        assertTrue(state.npcsHere().any { it.name == "Борута" })
        assertTrue(state.location.exits.any { it.name.startsWith("Таверна") })
        assertTrue(state.hero.inventory.single().equipped)
        // Канон мира попадает в системный промпт, а значит кэшируется.
        assertTrue(llm.requests.last().system.contains("Тракт"))
    }

    @Test
    fun `a turn goes master then engine then narrator`() = runTest {
        val llm = FakeLlm()
        val state = newGame(llm)
        val guard = state.npcsHere().single()
        llm.adjudications += Adjudication(
            action = "talk", summary = "расспрашивает стражника", targetNpcId = guard.id, minutes = 10,
            always = listOf(
                EffectSpec("npc_reveal", npcId = guard.id, text = "На севере пропадают люди"),
                EffectSpec("npc_memory", npcId = guard.id, text = "Наёмница спрашивала про север"),
            ),
        )
        val events = GameMaster(llm).playTurn(state, "Спрашиваю стражника, что нового").toList()

        val resolved = events.filterIsInstance<TurnEvent.Resolved>().single()
        assertTrue(resolved.report.facts.any { "пропадают" in it })
        val text = events.filterIsInstance<TurnEvent.Text>().joinToString("") { it.chunk }
        assertFalse("###" in text, "marker must not leak into the story: $text")
        val done = events.last() as TurnEvent.Done
        assertEquals(listOf("Зайти в таверну", "Расспросить стражника", "Уйти на север"), done.suggestions)
        assertEquals(text.trim(), done.story)
        assertTrue(guard.memories.isNotEmpty())
        assertTrue(state.log.any { it.kind == LogKind.STORY && "Ветер" in it.text })
        // Рассказчик не видит секретов и знаний персонажей — только мастер.
        val narratorRequest = llm.requests.last()
        assertFalse("Знает:" in narratorRequest.user)
    }

    @Test
    fun `travel generates the new area and may bring an encounter`() = runTest {
        val llm = FakeLlm()
        val state = newGame(llm)
        repeat(6) { llm.adjudications += Adjudication(action = "move", summary = "идёт", exitId = "go_n") }
        val gm = GameMaster(llm)
        repeat(6) { gm.playTurn(state, "иду на север").toList() }
        assertTrue(state.location.y <= -1)
        assertTrue(state.locations.values.filter { it.visited }.all { it.generated })
    }

    @Test
    fun `broken json is retried once`() = runTest {
        val llm = FakeLlm()
        llm.brokenJsonOnce = true
        val canon = GameMaster(llm).createCanon("мир")
        assertEquals("Тракт", canon.title)
    }

    @Test
    fun `refused turn skips the narrator`() = runTest {
        val llm = FakeLlm()
        val state = newGame(llm)
        llm.adjudications += Adjudication(action = "other", summary = "", feasible = false, refusal = "Здесь нет пороха.")
        val before = llm.requests.size
        val events = GameMaster(llm).playTurn(state, "стреляю из пистолета").toList()
        assertEquals("Здесь нет пороха.", (events.last() as TurnEvent.Done).story)
        assertEquals(before + 1, llm.requests.size)
    }

    @Test
    fun `suggestions parser tolerates formatting`() {
        val s = GameMaster.parseSuggestions("текст\n### ВАРИАНТЫ\n- **Бежать**\n• Драться\n\n- Ждать")
        assertEquals(listOf("Бежать", "Драться", "Ждать"), s)
    }

    @Test
    fun `compact mode sends much shorter prompts`() = runTest {
        suspend fun turnSizes(compact: Boolean): Pair<Int, Int> {
            val llm = FakeLlm(compact)
            val state = newGame(llm)
            llm.adjudications += Adjudication(action = "look", summary = "осматривается")
            GameMaster(llm).playTurn(state, "осматриваюсь").toList()
            val adj = llm.requests.first { it.task == LlmTask.ADJUDICATE }
            val nar = llm.requests.last { it.task == LlmTask.NARRATE }
            return (adj.system.length + adj.user.length) to (nar.system.length + nar.user.length)
        }
        val (fullAdj, fullNar) = turnSizes(false)
        val (shortAdj, shortNar) = turnSizes(true)
        assertTrue(shortAdj * 2 < fullAdj, "adjudication $shortAdj vs $fullAdj")
        assertTrue(shortNar * 2 < fullNar, "narration $shortNar vs $fullNar")
    }
}
