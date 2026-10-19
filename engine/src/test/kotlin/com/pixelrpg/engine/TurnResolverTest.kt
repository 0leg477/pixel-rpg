package com.pixelrpg.engine

import com.pixelrpg.engine.gen.Factory
import com.pixelrpg.engine.gen.NpcDraft
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Npc
import com.pixelrpg.engine.turn.Adjudication
import com.pixelrpg.engine.turn.EffectSpec
import com.pixelrpg.engine.turn.TurnResolver
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TurnResolverTest {

    private fun hp(state: GameState) = state.hero.resources.getValue("hp").current

    private fun spawn(state: GameState, draft: NpcDraft): Npc {
        val npc = Factory.npc(state, draft, state.currentLocationId, state.location.danger)
        state.npcs[npc.id] = npc
        return npc
    }

    @Test
    fun `moving along an exit creates the next area and takes time`() {
        val state = Fixtures.game()
        val before = state.minute
        val report = TurnResolver(state).resolve("иду на север", Adjudication(action = "move", summary = "идёт на север", exitId = "go_n"))
        assertNull(report.refused)
        assertEquals("a_0_-1", state.currentLocationId)
        assertTrue(report.moved)
        assertTrue("a_0_-1" in report.needsGeneration)
        assertTrue(state.minute > before)
        // Обратный путь существует.
        assertTrue(state.location.exits.any { it.targetId == "a_0_0" })
    }

    @Test
    fun `unknown exit is refused without changing anything`() {
        val state = Fixtures.game()
        val report = TurnResolver(state).resolve("лечу на луну", Adjudication(action = "move", summary = "", exitId = "moon"))
        assertNotNull(report.refused)
        assertEquals("a_0_0", state.currentLocationId)
    }

    @Test
    fun `failure damage is capped no matter what the master asks`() {
        repeat(40) { seed ->
            val state = Fixtures.game(seed.toLong())
            val ouch = listOf(EffectSpec("hero_resource", target = "hp", amount = -100))
            TurnResolver(state).resolve(
                "прыгаю через пропасть",
                Adjudication(action = "other", summary = "прыжок", needsRoll = true, skillId = "blade", difficulty = "normal",
                    success = ouch, partial = ouch, failure = ouch),
            )
            assertTrue(hp(state) >= 12 - 6, "seed $seed: hp=${hp(state)}")
        }
    }

    @Test
    fun `success cannot hand out a legendary treasure in a safe village`() {
        repeat(30) { seed ->
            val state = Fixtures.game(seed.toLong())
            val loot = listOf(EffectSpec("gain_item", name = "Корона богов", amount = 99999, tags = listOf("редкий"), slot = "weapon", power = 99))
            TurnResolver(state).resolve(
                "обыскиваю сундук",
                Adjudication(action = "search", summary = "обыск", needsRoll = true, skillId = "stealth",
                    success = loot, partial = loot, failure = loot),
            )
            state.hero.inventory.filter { it.name == "Корона богов" }.forEach {
                assertTrue(it.value <= Factory.lootCap(state.location.danger) * 3, "value ${it.value}")
                assertTrue(it.rarity <= 2)
                assertTrue(it.power <= 2 + it.rarity * 2)
            }
        }
    }

    @Test
    fun `blood magic costs health and angers an imperial witness`() {
        val state = Fixtures.game()
        spawn(state, NpcDraft(name = "Легионер", role = "страж", factionId = "empire"))
        val empireBefore = state.factions.getValue("empire").attitude
        val report = TurnResolver(state).resolve(
            "зажигаю свечу кровью",
            Adjudication(action = "use", summary = "магия", tags = listOf("магия"), needsRoll = false),
        )
        assertEquals(10, hp(state))
        assertEquals(empireBefore - 20, state.factions.getValue("empire").attitude)
        assertTrue(report.facts.any { "Цена крови" in it })
    }

    @Test
    fun `fighting ends with a corpse and dropped loot`() {
        val state = Fixtures.game()
        val rat = spawn(state, NpcDraft(name = "Крыса", role = "зверь", power = 1, items = listOf(com.pixelrpg.engine.gen.ItemDraft("Хвост", value = 1))))
        var turns = 0
        while (rat.alive && turns < 30) {
            TurnResolver(state).resolve("бью крысу", Adjudication(action = "attack", summary = "атака", targetNpcId = rat.id, skillId = "blade"))
            if (hp(state) < 6) state.hero.resources.getValue("hp").current = 12
            turns++
        }
        assertFalse(rat.alive)
        assertNull(state.combat)
        assertTrue(state.location.items.any { it.name == "Хвост" })
    }

    @Test
    fun `defeat without permadeath leaves the hero alive but robbed`() {
        val state = Fixtures.game()
        state.hero.resources.getValue("hp").current = 1
        spawn(state, NpcDraft(name = "Огр", role = "чудовище", power = 6, hostile = true))
        state.location.danger = 6
        var defeated = false
        repeat(20) {
            if (!defeated) defeated = TurnResolver(state).resolve("жду", Adjudication(action = "wait", summary = "ждёт")).defeated
        }
        assertTrue(defeated)
        assertFalse(state.gameOver)
        assertTrue(hp(state) > 0)
        assertTrue(state.hero.hasCondition("wounded"))
        assertNull(state.combat)
    }

    @Test
    fun `voluntary payment needs enough money`() {
        val state = Fixtures.game()
        val money = state.hero.money
        TurnResolver(state).resolve(
            "покупаю дом",
            Adjudication(action = "trade", summary = "покупка", always = listOf(EffectSpec("money", amount = -10_000))),
        )
        assertEquals(money, state.hero.money)
    }

    @Test
    fun `buying an item spends money and adds it`() {
        val state = Fixtures.game()
        val trader = spawn(state, NpcDraft(name = "Торговка", role = "торговка"))
        TurnResolver(state).resolve(
            "покупаю фонарь",
            Adjudication(action = "trade", summary = "покупка", always = listOf(EffectSpec("buy", npcId = trader.id, name = "Фонарь", amount = 12))),
        )
        assertEquals(30 - 12, state.hero.money)
        assertTrue(state.hero.inventory.any { it.name == "Фонарь" && it.value == 12 })
    }

    @Test
    fun `infeasible actions are refused`() {
        val state = Fixtures.game()
        val report = TurnResolver(state).resolve(
            "достаю автомат",
            Adjudication(action = "other", summary = "", feasible = false, refusal = "Здесь не знают пороха."),
        )
        assertEquals("Здесь не знают пороха.", report.refused)
    }

    @Test
    fun `skills grow with use`() {
        val state = Fixtures.game()
        repeat(30) {
            TurnResolver(state).resolve("крадусь", Adjudication(action = "sneak", summary = "", needsRoll = true, skillId = "stealth", minutes = 1))
        }
        assertTrue(state.hero.skillRank("stealth") >= 2)
    }
}
