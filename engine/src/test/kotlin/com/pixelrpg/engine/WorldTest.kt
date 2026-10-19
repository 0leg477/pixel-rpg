package com.pixelrpg.engine

import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.Factory
import com.pixelrpg.engine.gen.HeroDraft
import com.pixelrpg.engine.gen.ItemDraft
import com.pixelrpg.engine.gen.LocationDraft
import com.pixelrpg.engine.gen.NpcDraft
import com.pixelrpg.engine.gen.PlaceDraft
import com.pixelrpg.engine.gen.StatValue
import com.pixelrpg.engine.gen.WorldGen
import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.rules.Checks
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class WorldTest {

    @Test
    fun `same seed gives the same world`() {
        val a = Fixtures.game(7)
        val b = Fixtures.game(7)
        val c = Fixtures.game(8)
        val cells = (-6..6).flatMap { x -> (-6..6).map { y -> x to y } }
        val biomesA = cells.map { (x, y) -> WorldGen.cell(a, x, y).biome.id }
        val biomesB = cells.map { (x, y) -> WorldGen.cell(b, x, y).biome.id }
        val biomesC = cells.map { (x, y) -> WorldGen.cell(c, x, y).biome.id }
        assertEquals(biomesA, biomesB)
        assertNotEquals(biomesA, biomesC)
        assertTrue(biomesA.toSet().size >= 2, "world should not be a single biome")
    }

    @Test
    fun `start is a safe settlement`() {
        val state = Fixtures.game()
        val start = state.location
        assertEquals(com.pixelrpg.engine.model.LocationKind.SETTLEMENT, start.kind)
        assertTrue(start.danger <= 1)
        assertEquals(4, start.exits.count { it.direction.isNotEmpty() })
    }

    @Test
    fun `location draft keeps all its places and people but caps loot value`() {
        val state = Fixtures.game()
        val loc = state.location
        Factory.applyLocationDraft(
            state, loc,
            LocationDraft(
                name = "Серая Пристань",
                description = "Деревня у болот.",
                places = (1..10).map { PlaceDraft("Место $it") },
                npcs = (1..10).map { NpcDraft("Житель $it", "рыбак", power = 10) },
                items = listOf(ItemDraft("Меч королей", value = 100000, rarity = 4, slot = "weapon", power = 50)),
            ),
        )
        assertEquals("Серая Пристань", loc.name)
        // Количество не ограничено: сколько мест и людей придумано — столько и есть.
        assertEquals(10, WorldGen.childCount(state, loc))
        assertEquals(10, state.npcsHere().size)
        // А сила и ценность — по правилам баланса.
        assertTrue(state.npcsHere().all { it.power <= loc.danger + 3 })
        val sword = loc.items.single()
        assertTrue(sword.rarity <= Factory.rarityCap(loc.danger))
        assertTrue(sword.value <= Factory.lootCap(loc.danger))
        // В каждое новое место можно войти и выйти.
        val place = state.locations.values.first { it.parentId == loc.id }
        assertTrue(loc.exits.any { it.targetId == place.id })
        assertTrue(place.exits.any { it.targetId == loc.id })
    }

    @Test
    fun `hero draft is brought to the starting budget`() {
        val canon = Fixtures.canon()
        val hero = Factory.hero(
            canon,
            HeroDraft(
                name = "Читер", concept = "всемогущий",
                attributes = canon.attributes.map { StatValue(it.id, 99) },
                skills = canon.skills.map { StatValue(it.id, 99) },
                items = (1..20).map { ItemDraft("Артефакт $it", value = 9999, rarity = 4, slot = "weapon", power = 99) },
            ),
        )
        assertTrue(hero.attributes.values.all { it in -1..2 })
        assertTrue(hero.attributes.values.sum() <= (canon.attributes.size + 1) / 2 + 1)
        assertTrue(hero.skills.values.sumOf { it.rank } <= 5)
        assertEquals(20, hero.inventory.size)
        assertTrue(hero.inventory.all { it.rarity <= 1 && it.value <= 40 && it.power <= 4 })
        assertEquals(1, hero.inventory.count { it.equipped })
    }

    @Test
    fun `canon validator fixes ids and adds health`() {
        val raw = Fixtures.canon().copy(
            resources = listOf(com.pixelrpg.engine.model.ResourceDef("Мана", "Мана", 1000)),
            skills = listOf(com.pixelrpg.engine.model.SkillDef("Тёмная магия", "Тёмная магия", "нет такой")),
        )
        val canon = CanonValidator.normalize(raw)
        assertEquals("temnaya_magiya", canon.skills.single().id)
        assertEquals(canon.attributes.first().id, canon.skills.single().attributeId)
        assertEquals(1, canon.resources.count { it.role == ResourceRole.HEALTH })
        assertTrue(canon.resources.all { it.max <= 100 })
        assertTrue(canon.conditions.any { it.id == "wounded" })
    }

    @Test
    fun `save and load keep the whole state`() {
        val state = Fixtures.game()
        WorldGen.ensureArea(state, 3, 4)
        val text = SaveCodec.encode(state)
        val back = SaveCodec.decode(text)
        assertEquals(text, SaveCodec.encode(back))
        // Генератор продолжает ту же последовательность после загрузки.
        assertEquals(state.dice.nextLong(), back.dice.nextLong())
    }

    @Test
    fun `odds of the basic check`() {
        assertEquals(58, Checks.successChance(0))
        assertEquals(100, Checks.successChance(6))
    }

    @Test
    fun `briefing mentions ids the master can reference`() {
        val state = Fixtures.game()
        val text = Briefing.full(state, master = true)
        assertTrue("[go_n]" in text)
        assertTrue(state.hero.inventory.first().id in text)
        assertTrue("Магия крови" in Briefing.canon(state.canon))
    }
}
