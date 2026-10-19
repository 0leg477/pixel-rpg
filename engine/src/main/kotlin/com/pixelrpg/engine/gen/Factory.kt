package com.pixelrpg.engine.gen

import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.CodexEntry
import com.pixelrpg.engine.model.GameSettings
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Hero
import com.pixelrpg.engine.model.Item
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.Location
import com.pixelrpg.engine.model.LocationKind
import com.pixelrpg.engine.model.Npc
import com.pixelrpg.engine.model.Pool
import com.pixelrpg.engine.model.SkillProgress
import com.pixelrpg.engine.model.Trait
import com.pixelrpg.engine.rules.Dice

/** Превращает черновики ИИ в сущности, по пути проверяя и ограничивая всё, что можно. */
object Factory {

    fun newGame(id: String, seed: Long, canon: Canon, hero: Hero, settings: GameSettings, now: Long): GameState {
        val state = GameState(
            id = id, seed = seed, createdAt = now, canon = canon, hero = hero,
            settings = settings, dice = Dice(seed xor 0x5DEECE66DL),
        )
        WorldGen.initWorld(state)
        return state
    }

    /** Герой из черновика: распределение характеристик и навыков приводится к стартовому бюджету. */
    fun hero(canon: Canon, d: HeroDraft): Hero {
        val attrs = canon.attributes.associate { a ->
            a.id to (d.attributes.firstOrNull { CanonValidator.slug(it.id) == a.id }?.value ?: 0).coerceIn(-1, 2)
        }.toMutableMap()
        val budget = (canon.attributes.size + 1) / 2 + 1
        while (attrs.values.sum() > budget) {
            val top = attrs.maxBy { it.value }.key
            attrs[top] = attrs.getValue(top) - 1
        }

        var skillPoints = 5
        val skills = mutableMapOf<String, SkillProgress>()
        d.skills
            .mapNotNull { s -> canon.skill(CanonValidator.slug(s.id))?.let { it.id to s.value.coerceIn(0, 2) } }
            .sortedByDescending { it.second }
            .forEach { (id, rank) ->
                val r = minOf(rank, skillPoints)
                if (r > 0 && id !in skills) {
                    skills[id] = SkillProgress(rank = r)
                    skillPoints -= r
                }
            }

        val hero = Hero(
            name = d.name.ifBlank { "Безымянный" }.take(40),
            concept = d.concept.take(120),
            background = d.background.take(1200),
            appearance = d.appearance.take(600),
            attributes = attrs,
            skills = skills,
            money = canon.currency.startAmount,
        )
        canon.resources.forEach { r -> hero.resources[r.id] = Pool(r.max, r.max) }
        var counter = 1
        d.items.forEach { draft ->
            hero.inventory += item("h${counter++}", draft, maxValue = 40, maxRarity = 1)
        }
        // Лучшее оружие и броня сразу в руках.
        hero.inventory.filter { it.slot == ItemSlot.WEAPON }.maxByOrNull { it.power }?.equipped = true
        hero.inventory.filter { it.slot == ItemSlot.ARMOR }.maxByOrNull { it.power }?.equipped = true
        d.traits.forEach { t ->
            hero.traits += Trait(t.name.take(40), t.description.take(300), t.modifier.coerceIn(-1, 1), t.tags.map(CanonValidator::tag))
        }
        return hero
    }

    fun item(id: String, d: ItemDraft, maxValue: Int, maxRarity: Int): Item {
        val slot = when (d.slot.lowercase()) {
            "weapon" -> ItemSlot.WEAPON
            "armor" -> ItemSlot.ARMOR
            "trinket" -> ItemSlot.TRINKET
            else -> ItemSlot.NONE
        }
        val rarity = d.rarity.coerceIn(0, maxRarity)
        val maxPower = when (slot) {
            ItemSlot.WEAPON -> 2 + rarity * 2
            ItemSlot.ARMOR -> 1 + rarity
            else -> 0
        }
        return Item(
            id = id,
            name = d.name.ifBlank { "Вещица" }.take(60),
            description = d.description.take(300),
            tags = d.tags.map(CanonValidator::tag).distinct(),
            quantity = d.quantity.coerceIn(1, 20),
            value = d.value.coerceIn(0, maxValue),
            rarity = rarity,
            slot = slot,
            power = d.power.coerceIn(0, maxPower).let { if (slot == ItemSlot.WEAPON) maxOf(it, 1) else it },
        )
    }

    /** Предел ценности находок в зависимости от опасности места. */
    fun lootCap(danger: Int) = 15 + danger * 12

    fun rarityCap(danger: Int) = when {
        danger >= 8 -> 3
        danger >= 5 -> 2
        danger >= 2 -> 1
        else -> 0
    }

    fun npc(state: GameState, d: NpcDraft, locationId: String, danger: Int): Npc {
        val id = state.newId("n")
        val power = d.power.coerceIn(1, (danger + 3).coerceAtMost(10))
        val hp = 4 + power * 4
        val npc = Npc(
            id = id,
            name = d.name.ifBlank { "Незнакомец" }.take(50),
            role = d.role.take(80),
            appearance = d.appearance.take(400),
            personality = d.personality.take(300),
            goals = d.goals.take(300),
            secret = d.secret.take(300),
            speech = d.speech.take(200),
            factionId = CanonValidator.slug(d.factionId).takeIf { it in state.factions } ?: "",
            locationId = locationId,
            attitude = d.attitude.coerceIn(-100, 100),
            hostile = d.hostile,
            power = power,
            hp = hp,
            maxHp = hp,
            money = d.money.coerceIn(0, 20 + danger * 15),
        )
        npc.knowledge += d.knowledge.map { it.take(300) }
        npc.tags += d.tags.map(CanonValidator::tag).take(6)
        val factionAttitude = state.factions[npc.factionId]?.attitude
        if (factionAttitude != null && d.attitude == 0) npc.attitude = factionAttitude / 2
        d.items.forEach { npc.inventory += item(state.newId("i"), it, lootCap(danger), rarityCap(danger)) }
        return npc
    }

    /** Наполняет каркас локации описанием от ИИ. Повторный вызов ничего не ломает. */
    fun applyLocationDraft(state: GameState, loc: Location, d: LocationDraft) {
        loc.name = d.name.ifBlank { loc.name }.take(60)
        loc.description = d.description.take(1500)
        loc.visual = d.visual.take(600)
        loc.tags += d.tags.map(CanonValidator::tag).filter { it !in loc.tags }.take(8)
        loc.features += d.features.map { it.take(200) }
        d.exitNames.forEach { en ->
            loc.exits.firstOrNull { it.id == en.exitId && it.direction.isNotEmpty() }?.name = en.name.take(60)
        }
        d.places.forEach { p ->
            val kind = when (p.kind.lowercase()) {
                "dungeon" -> LocationKind.DUNGEON
                "landmark" -> LocationKind.LANDMARK
                else -> LocationKind.PLACE
            }
            WorldGen.addPlace(state, loc, p.name.take(60), kind, p.hint.take(300))
        }
        d.npcs.forEach {
            val npc = npc(state, it, loc.id, loc.danger)
            state.npcs[npc.id] = npc
        }
        d.items.forEach {
            loc.items += item(state.newId("i"), it, lootCap(loc.danger), rarityCap(loc.danger))
        }
        d.lore.forEach { addLore(state, loc.name, it) }
        loc.generated = true
    }

    fun addLore(state: GameState, title: String, text: String, category: String = "лор") {
        if (text.isBlank()) return
        if (state.codex.any { it.text == text }) return
        state.codex += CodexEntry(state.newId("c"), title.take(80), text.take(800), category, state.minute)
    }
}
