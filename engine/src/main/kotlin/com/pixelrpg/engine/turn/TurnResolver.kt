package com.pixelrpg.engine.turn

import com.pixelrpg.engine.SaveCodec
import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.Factory
import com.pixelrpg.engine.gen.ItemDraft
import com.pixelrpg.engine.gen.NpcDraft
import com.pixelrpg.engine.gen.WorldGen
import com.pixelrpg.engine.model.ActiveCondition
import com.pixelrpg.engine.model.Clock
import com.pixelrpg.engine.model.CombatState
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.Item
import com.pixelrpg.engine.model.ItemSlot
import com.pixelrpg.engine.model.LocationKind
import com.pixelrpg.engine.model.LogKind
import com.pixelrpg.engine.model.Memory
import com.pixelrpg.engine.model.Npc
import com.pixelrpg.engine.model.Quest
import com.pixelrpg.engine.model.QuestStatus
import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.model.RuleDef
import com.pixelrpg.engine.model.RuleEffectKind
import com.pixelrpg.engine.model.RuleTrigger
import com.pixelrpg.engine.rules.CheckResult
import com.pixelrpg.engine.rules.Checks
import com.pixelrpg.engine.rules.Difficulty
import com.pixelrpg.engine.rules.Modifier
import com.pixelrpg.engine.rules.Outcome
import kotlin.math.ceil

/**
 * Разбирает один ход по правилам. ИИ только предлагает (через [Adjudication]),
 * а всё, что реально меняется в мире, проходит здесь — с проверками и пределами.
 */
class TurnResolver(private val state: GameState) {

    private enum class Mode { NEUTRAL, SUCCESS, PARTIAL, FAILURE }

    private val facts = mutableListOf<String>()
    private val changes = mutableListOf<Change>()
    private val needsGeneration = mutableListOf<String>()
    private var encounter: Encounter? = null
    private var moved = false
    private var itemsGained = 0
    private var npcsSpawned = 0
    private var placesFound = 0
    private var questsAdded = 0
    /** Противники, которые не бьют в ответ в этом раунде (герой их переиграл). */
    private val suppressed = mutableSetOf<String>()

    private val canon get() = state.canon
    private val hero get() = state.hero

    fun resolve(input: String, adj: Adjudication): TurnReport {
        state.turn++
        state.addLog(LogKind.PLAYER, input)
        val action = adj.actionType

        if (state.gameOver) return report(input, adj, refused = "История этого героя окончена.")
        if (!adj.feasible) {
            advance(1, resting = false)
            return report(input, adj, refused = adj.refusal.ifBlank { "Так сделать не выйдет." })
        }

        val target = adj.targetNpcId.takeIf { it.isNotBlank() }?.let { state.npcs[it] }
        if (target != null && (target.locationId != state.currentLocationId || !target.alive)) {
            return report(input, adj, refused = "${target.name} здесь нет.")
        }
        if (action == ActionType.ATTACK && target == null) {
            return report(input, adj, refused = "Не ясно, с кем сражаться.")
        }
        val exit = if (action == ActionType.MOVE) {
            state.location.exits.firstOrNull { it.id == adj.exitId && !it.hidden }
                ?: return report(input, adj, refused = "Такого пути отсюда нет.")
        } else null

        val tags = (adj.tags.map(CanonValidator::tag) + action.name.lowercase()).distinct()
        val inCombat = enemiesHere().isNotEmpty()
        val difficulty = Difficulty.parse(adj.difficulty)
        val mustRoll = action == ActionType.ATTACK || (action == ActionType.MOVE && inCombat)
        val roll = mustRoll || (adj.needsRoll && difficulty != Difficulty.TRIVIAL)

        // Правила мира, срабатывающие на само действие.
        val actionRules = rulesFor(RuleTrigger.ACTION, tags)

        var check: CheckResult? = null
        if (roll) {
            val skill = canon.skill(CanonValidator.slug(adj.skillId))
            val mods = modifiers(adj, skill?.id, skill?.attributeId, tags, target, actionRules)
            check = Checks.roll(state.dice, mods, if (mustRoll && !adj.needsRoll) Difficulty.NORMAL else difficulty, skill?.name ?: "")
            // Бросок хранится в журнале как JSON — интерфейс рисует по нему кубики.
            state.addLog(LogKind.ROLL, SaveCodec.json.encodeToString(CheckResult.serializer(), check))
        }
        val outcome = check?.outcome

        applyEffects(adj.always, Mode.NEUTRAL, difficulty, adj, crit = false)

        when (action) {
            ActionType.ATTACK -> attack(target!!, outcome!!, adj)
            ActionType.MOVE -> {
                val ok = outcome == null || !outcome.isFailure
                if (ok) {
                    if (inCombat && outcome == Outcome.PARTIAL) enemyAttacks(extraPressure = 0)
                    if (!heroDown()) travel(exit!!)
                } else {
                    facts += "Уйти не удалось — путь отрезан."
                }
            }
            ActionType.TAKE -> takeFromLocation(adj.itemIds)
            ActionType.DROP -> dropItems(adj.itemIds)
            ActionType.EQUIP -> equip(adj.itemIds)
            ActionType.REST -> rest(adj.minutes)
            else -> Unit
        }

        val branch = when (outcome) {
            null -> adj.success.takeIf { action != ActionType.MOVE || moved } ?: emptyList()
            else -> when (outcome.branch) {
                "success" -> adj.success
                "partial" -> adj.partial
                else -> adj.failure
            }
        }
        val mode = when (outcome) {
            null -> Mode.NEUTRAL
            Outcome.CRIT_SUCCESS, Outcome.SUCCESS -> Mode.SUCCESS
            Outcome.PARTIAL -> Mode.PARTIAL
            else -> Mode.FAILURE
        }
        if (outcome == Outcome.CRIT_SUCCESS) facts += "Блестящий успех: всё вышло даже лучше, чем рассчитывал герой."
        if (outcome == Outcome.CRIT_FAILURE) facts += "Катастрофа: всё пошло наперекосяк."
        applyEffects(branch, mode, difficulty, adj, crit = outcome == Outcome.CRIT_SUCCESS || outcome == Outcome.CRIT_FAILURE)

        // Цена действия по правилам мира и реакции на исход проверки.
        actionRules.forEach { applyRule(it, includeModifiers = false) }
        if (outcome != null) {
            rulesFor(RuleTrigger.CHECK, tags)
                .filter { it.outcome.isBlank() || it.outcome == outcome.branch }
                .forEach { applyRule(it, includeModifiers = false) }
        }

        if (check != null && outcome != null) gainExperience(adj.skillId, outcome)

        if (!moved && action != ActionType.REST) {
            advance(adj.minutes.coerceIn(1, 240), resting = false)
        }

        // Противники отвечают, если герой остался рядом с ними.
        if (!moved && action != ActionType.ATTACK && enemiesHere().isNotEmpty()) {
            enemyAttacks(extraPressure = if (outcome == Outcome.CRIT_FAILURE) 1 else 0)
        }
        updateCombat()

        val defeated = checkDefeat()
        return report(input, adj, check = check, defeated = defeated)
    }

    // ---------- Модификаторы ----------

    private fun modifiers(
        adj: Adjudication,
        skillId: String?,
        skillAttr: String?,
        tags: List<String>,
        target: Npc?,
        actionRules: List<RuleDef>,
    ): List<Modifier> {
        val mods = mutableListOf<Modifier>()
        val attrId = CanonValidator.slug(adj.attributeId).takeIf { canon.attribute(it) != null } ?: skillAttr
        attrId?.let { id -> canon.attribute(id)?.let { mods += Modifier(it.name, hero.attr(id)) } }
        skillId?.let { id -> canon.skill(id)?.let { mods += Modifier("навык «${it.name}»", hero.skillRank(id)) } }

        for (c in hero.conditions) {
            val def = CanonValidator.conditionsOf(canon).firstOrNull { it.id == c.id } ?: continue
            if (def.checkModifier != 0 && (def.tags.isEmpty() || def.tags.any { it in tags })) {
                mods += Modifier(def.name, def.checkModifier)
            }
        }
        for (t in hero.traits) {
            if (t.modifier != 0 && t.tags.any { it in tags }) mods += Modifier(t.name, t.modifier)
        }
        val usedItems = hero.inventory.filter { it.equipped || it.id in adj.itemIds }
        if (adj.actionType != ActionType.ATTACK && usedItems.any { item -> item.tags.any { it in tags } }) {
            mods += Modifier("подходящее снаряжение", 1)
        }
        if (target != null && (adj.actionType == ActionType.TALK || adj.actionType == ActionType.TRADE || "social" in tags)) {
            val m = when {
                target.attitude >= 80 -> 2
                target.attitude >= 50 -> 1
                target.attitude <= -70 -> -2
                target.attitude <= -30 -> -1
                else -> 0
            }
            if (m != 0) mods += Modifier("отношение: ${target.name}", m)
        }
        if (Clock.isDark(state.minute) && state.location.kind != LocationKind.PLACE) {
            if (adj.actionType == ActionType.SNEAK) mods += Modifier("темнота скрывает", 1)
            if (adj.actionType == ActionType.SEARCH || adj.actionType == ActionType.LOOK) mods += Modifier("темнота", -1)
        }
        if (enemiesHere().size >= 3) mods += Modifier("численный перевес врага", -1)
        for (rule in actionRules) {
            rule.effects.filter { it.kind == RuleEffectKind.MODIFIER }.forEach { mods += Modifier(rule.name, it.amount) }
        }
        return mods
    }

    // ---------- Последствия ----------

    private fun applyEffects(list: List<EffectSpec>, mode: Mode, difficulty: Difficulty, adj: Adjudication, crit: Boolean) {
        val s = difficulty.stakes
        val danger = state.location.danger
        for (e in list.take(8)) {
            val type = EffectType.parse(e.type) ?: continue
            when (type) {
                EffectType.HERO_RESOURCE -> heroResource(e, mode, s, danger, crit, adj)
                EffectType.HERO_CONDITION -> {
                    val def = CanonValidator.conditionsOf(canon).firstOrNull { it.id == CanonValidator.slug(e.target) } ?: continue
                    if (def.negative && mode == Mode.SUCCESS) continue
                    if (!def.negative && mode == Mode.FAILURE) continue
                    addCondition(def.id, e.amount.coerceIn(0, 72))
                }
                EffectType.REMOVE_CONDITION -> {
                    if (mode == Mode.FAILURE) continue
                    val id = CanonValidator.slug(e.target)
                    if (hero.conditions.removeAll { it.id == id }) {
                        val name = CanonValidator.conditionsOf(canon).firstOrNull { it.id == id }?.name ?: id
                        fact("Состояние «$name» прошло.", "− $name", Tone.GOOD)
                    }
                }
                EffectType.GAIN_ITEM -> {
                    if (mode == Mode.FAILURE || itemsGained >= 2) continue
                    val base = Factory.lootCap(danger)
                    val cap = when (mode) {
                        Mode.NEUTRAL -> 5 + danger * 2
                        Mode.PARTIAL -> (base * (1 + s / 2.0) * 0.6).toInt()
                        else -> (base * (1 + s / 2.0) * if (crit) 1.5 else 1.0).toInt()
                    }
                    val rarity = Factory.rarityCap(danger) + if (crit && s >= 3) 1 else 0
                    val item = Factory.item(state.newId("i"), e.toItemDraft(), cap, if (mode == Mode.NEUTRAL) 0 else rarity)
                    addToInventory(item)
                    itemsGained++
                }
                EffectType.LOSE_ITEM -> {
                    val item = hero.item(e.target) ?: continue
                    val consumed = item.id in adj.itemIds
                    if ((mode == Mode.NEUTRAL || mode == Mode.SUCCESS) && !consumed) continue
                    removeFromInventory(item, e.amount.coerceAtLeast(1), "Герой лишается: «${item.name}».")
                }
                EffectType.TAKE_ITEM -> {
                    if (mode == Mode.FAILURE) continue
                    if (e.npcId.isNotBlank()) {
                        val npc = presentNpc(e.npcId) ?: continue
                        val item = npc.inventory.firstOrNull { it.id == e.target } ?: continue
                        npc.inventory.remove(item)
                        addToInventory(item.copy(equipped = false), from = npc.name)
                    } else takeFromLocation(listOf(e.target))
                }
                EffectType.GIVE_ITEM -> {
                    val npc = presentNpc(e.npcId) ?: continue
                    val item = hero.item(e.target) ?: continue
                    hero.inventory.remove(item)
                    npc.inventory += item.copy(equipped = false)
                    fact("Герой отдаёт «${item.name}» — теперь это у ${npc.name}.", "− ${item.name}", Tone.NEUTRAL)
                }
                EffectType.BUY -> {
                    if (mode == Mode.FAILURE) continue
                    val price = e.amount.coerceAtLeast(0)
                    if (price > hero.money) {
                        facts += "Денег не хватает: нужно $price ${canon.currency.name}, а у героя ${hero.money}."
                        continue
                    }
                    val rarity = Factory.rarityCap(danger) + 1 + state.location.size / 2
                    val item = Factory.item(state.newId("i"), e.toItemDraft().copy(value = price), maxOf(price, 1), rarity)
                    hero.money -= price
                    changes += Change("−$price ${canon.currency.name}", Tone.NEUTRAL)
                    addToInventory(item, from = presentNpc(e.npcId)?.name)
                }
                EffectType.SELL -> {
                    if (mode == Mode.FAILURE) continue
                    val item = hero.item(e.target) ?: continue
                    val maxPrice = (item.value * if (mode == Mode.SUCCESS) 1.2 else 1.0).toInt().coerceAtLeast(1)
                    val price = e.amount.coerceIn(0, maxPrice)
                    removeFromInventory(item, 1, "Герой продаёт «${item.name}» за $price ${canon.currency.name}.")
                    presentNpc(e.npcId)?.inventory?.add(item.copy(quantity = 1, equipped = false, id = state.newId("i")))
                    money(price)
                }
                EffectType.MONEY -> {
                    val cap = (Factory.lootCap(danger) * (1 + s / 2.0)).toInt()
                    val amount = when {
                        e.amount > 0 -> when (mode) {
                            Mode.FAILURE -> 0
                            Mode.NEUTRAL -> minOf(e.amount, 3 + danger)
                            Mode.PARTIAL -> minOf(e.amount, (cap * 0.6).toInt())
                            Mode.SUCCESS -> minOf(e.amount, cap)
                        }
                        mode == Mode.PARTIAL -> maxOf(e.amount, -maxOf(1, hero.money / 3))
                        mode == Mode.FAILURE -> maxOf(e.amount, -hero.money)
                        // Добровольная плата: возможна, только если денег хватает.
                        -e.amount > hero.money -> {
                            facts += "Денег не хватает: у героя всего ${hero.money} ${canon.currency.name}."
                            0
                        }
                        else -> e.amount
                    }
                    money(amount)
                }
                EffectType.NPC_ATTITUDE -> {
                    val npc = presentNpc(e.npcId.ifBlank { e.target }) ?: continue
                    val cap = 10 + 5 * s
                    var delta = e.amount.coerceIn(-cap, cap)
                    if (mode == Mode.FAILURE) delta = minOf(delta, 5)
                    if (delta == 0) continue
                    npc.attitude = (npc.attitude + delta).coerceIn(-100, 100)
                    fact(
                        "${npc.name}: отношение к герою ${if (delta > 0) "улучшилось" else "ухудшилось"} (${attitudeWord(npc.attitude)}).",
                        "${npc.name} ${if (delta > 0) "+" else ""}$delta",
                        if (delta > 0) Tone.GOOD else Tone.BAD,
                    )
                }
                EffectType.NPC_MEMORY -> {
                    val npc = state.npcs[e.npcId.ifBlank { e.target }] ?: continue
                    if (e.text.isBlank()) continue
                    npc.memories += Memory(state.minute, e.text.take(300))
                    if (npc.memories.size > 30) npc.memories.removeAt(0)
                }
                EffectType.NPC_HOSTILE -> {
                    val npc = presentNpc(e.npcId.ifBlank { e.target }) ?: continue
                    makeHostile(npc)
                }
                EffectType.NPC_CALM -> {
                    if (mode == Mode.FAILURE) continue
                    val npc = presentNpc(e.npcId.ifBlank { e.target }) ?: continue
                    if (npc.hostile) {
                        npc.hostile = false
                        state.combat?.enemyIds?.remove(npc.id)
                        fact("${npc.name} больше не нападает.", "${npc.name}: мир", Tone.GOOD)
                    }
                }
                EffectType.NPC_LEAVE -> {
                    val npc = presentNpc(e.npcId.ifBlank { e.target }) ?: continue
                    sendAway(npc)
                }
                EffectType.NPC_REVEAL -> {
                    if (mode == Mode.FAILURE) continue
                    val npc = state.npcs[e.npcId.ifBlank { e.target }] ?: continue
                    Factory.addLore(state, "Со слов: ${npc.name}", e.text, "сведения")
                    fact("${npc.name} делится сведениями: ${e.text}", "Новые сведения", Tone.GOOD)
                }
                EffectType.SPAWN_NPC -> {
                    if (npcsSpawned >= 1 || state.npcsHere().size >= Factory.MAX_NPCS_PER_LOCATION) continue
                    val hostile = e.tags.any { CanonValidator.tag(it) in HOSTILE_TAGS }
                    val npc = Factory.npc(
                        state,
                        NpcDraft(
                            name = e.name, role = e.text.take(80), appearance = e.text,
                            power = if (e.power > 0) e.power else 2, attitude = e.amount, hostile = hostile, tags = e.tags,
                        ),
                        state.currentLocationId, danger,
                    )
                    state.npcs[npc.id] = npc
                    npcsSpawned++
                    fact("Появляется: ${npc.name} — ${npc.role}.", "Новое лицо: ${npc.name}", if (hostile) Tone.BAD else Tone.NEUTRAL)
                    if (hostile) makeHostile(npc)
                }
                EffectType.DISCOVER_PLACE -> {
                    if (mode == Mode.FAILURE || placesFound >= 1) continue
                    val here = state.location
                    if (WorldGen.childCount(state, here) >= Factory.MAX_PLACES_PER_LOCATION || e.name.isBlank()) continue
                    val kind = if (e.tags.any { CanonValidator.tag(it) in DUNGEON_TAGS }) LocationKind.DUNGEON else LocationKind.PLACE
                    WorldGen.addPlace(state, here, e.name.take(60), kind, e.text.take(300))
                    placesFound++
                    fact("Найден путь: «${e.name}».", "Новое место: ${e.name}", Tone.GOOD)
                }
                EffectType.REVEAL_EXIT -> {
                    if (mode == Mode.FAILURE) continue
                    val ex = state.location.exits.firstOrNull { it.id == e.target && it.hidden } ?: continue
                    ex.hidden = false
                    fact("Открылся скрытый путь: «${ex.name}».", "Тайный путь", Tone.GOOD)
                }
                EffectType.LORE -> {
                    Factory.addLore(state, e.name.ifBlank { "Заметка" }, e.text)
                    if (e.text.isNotBlank()) changes += Change("Кодекс: ${e.name.ifBlank { "новая запись" }}", Tone.GOOD)
                }
                EffectType.QUEST_ADD -> {
                    if (questsAdded >= 1 || state.quests.count { it.status == QuestStatus.ACTIVE } >= 10 || e.name.isBlank()) continue
                    if (state.quests.any { it.title.equals(e.name, ignoreCase = true) && it.status == QuestStatus.ACTIVE }) continue
                    val q = Quest(state.newId("q"), e.name.take(80), e.text.take(600), giverNpcId = e.npcId, startedAt = state.minute)
                    state.quests += q
                    questsAdded++
                    fact("Новое задание: «${q.title}».", "Задание: ${q.title}", Tone.NEUTRAL)
                }
                EffectType.QUEST_UPDATE -> {
                    val q = state.quests.firstOrNull { it.id == e.target && it.status == QuestStatus.ACTIVE } ?: continue
                    if (e.text.isNotBlank()) q.notes += e.text.take(300)
                    when {
                        e.amount > 0 -> {
                            q.status = QuestStatus.DONE
                            hero.fame += 1
                            fact("Задание «${q.title}» выполнено.", "✓ ${q.title}", Tone.GOOD)
                        }
                        e.amount < 0 -> {
                            q.status = QuestStatus.FAILED
                            fact("Задание «${q.title}» провалено.", "✗ ${q.title}", Tone.BAD)
                        }
                        else -> changes += Change("Задание обновлено: ${q.title}", Tone.NEUTRAL)
                    }
                }
                EffectType.FACTION -> {
                    val f = state.factions[CanonValidator.slug(e.target)] ?: continue
                    val cap = 5 + 3 * s
                    val delta = e.amount.coerceIn(-cap, cap)
                    if (delta == 0) continue
                    f.attitude = (f.attitude + delta).coerceIn(-100, 100)
                    fact(
                        "Репутация у «${f.name}» ${if (delta > 0) "растёт" else "падает"} (${attitudeWord(f.attitude)}).",
                        "${f.name} ${if (delta > 0) "+" else ""}$delta",
                        if (delta > 0) Tone.GOOD else Tone.BAD,
                    )
                }
                EffectType.FAME -> {
                    val cap = 1 + s / 2
                    var delta = e.amount.coerceIn(-cap, cap)
                    if (mode == Mode.FAILURE) delta = minOf(delta, 0)
                    if (delta == 0) continue
                    hero.fame += delta
                    fact(if (delta > 0) "О герое начинают говорить." else "Слава героя меркнет.", "Слава ${if (delta > 0) "+" else ""}$delta", if (delta > 0) Tone.GOOD else Tone.BAD)
                }
                EffectType.TIME -> advance(e.amount.coerceIn(0, 720), resting = false)
                EffectType.FEATURE -> {
                    if (e.text.isBlank()) continue
                    state.location.features += e.text.take(200)
                    if (state.location.features.size > 10) state.location.features.removeAt(0)
                }
            }
        }
    }

    private fun heroResource(e: EffectSpec, mode: Mode, s: Int, danger: Int, crit: Boolean, adj: Adjudication) {
        val def = canon.resource(CanonValidator.slug(e.target)) ?: canon.healthResource.takeIf { e.target.isBlank() } ?: return
        val pool = hero.resources[def.id] ?: return
        val isHealth = def.role == ResourceRole.HEALTH
        val delta = if (e.amount < 0) {
            val fraction = when (mode) {
                Mode.FAILURE -> if (isHealth) 0.12 + 0.07 * s else 0.4
                Mode.PARTIAL -> if (isHealth) (0.12 + 0.07 * s) / 2 else 0.2
                else -> if (isHealth) 0.10 else 0.15
            }
            var cap = ceil(pool.max * fraction).toInt() + if (isHealth && mode == Mode.FAILURE) danger / 3 else 0
            if (crit && mode == Mode.FAILURE) cap = (cap * 1.5).toInt()
            -minOf(-e.amount, maxOf(1, cap))
        } else {
            if (mode == Mode.FAILURE) return
            val medicine = hero.inventory.any { it.id in adj.itemIds && it.tags.any { t -> HEAL_HINTS.any { h -> h in t } } }
            var fraction = if (isHealth) (if (medicine) 0.6 else 0.2) else 0.5
            if (mode == Mode.PARTIAL) fraction *= 0.6
            minOf(e.amount, maxOf(1, ceil(pool.max * fraction).toInt()))
        }
        changeResource(def.id, delta)
    }

    // ---------- Действия с особой механикой ----------

    private fun attack(target: Npc, outcome: Outcome, adj: Adjudication) {
        if (!target.hostile) {
            makeHostile(target)
            target.attitude = (target.attitude - 30).coerceAtLeast(-100)
            state.factions[target.factionId]?.let { f ->
                f.attitude = (f.attitude - 10).coerceAtLeast(-100)
                fact("Нападение на члена «${f.name}» не останется незамеченным.", "${f.name} −10", Tone.BAD)
            }
        }
        val weapon = hero.inventory.filter { it.slot == ItemSlot.WEAPON && (it.equipped || it.id in adj.itemIds) }.maxByOrNull { it.power }
        val skillAttr = canon.skill(CanonValidator.slug(adj.skillId))?.attributeId
        val attrBonus = maxOf(0, skillAttr?.let { hero.attr(it) } ?: 0)
        val base = (weapon?.power ?: 1) + attrBonus + state.dice.d(3)
        val damage = when (outcome) {
            Outcome.CRIT_SUCCESS -> base * 2
            Outcome.SUCCESS, Outcome.PARTIAL -> base
            else -> 0
        }
        if (outcome.isSuccess) suppressed += target.id
        if (damage > 0) {
            target.hp -= damage
            if (target.hp <= 0) kill(target)
            else fact(
                "Удар ${weapon?.let { "(${it.name}) " } ?: ""}достигает цели: ${target.name} получает $damage урона (${woundWord(target)}).",
                "${target.name} −$damage",
                Tone.GOOD,
            )
        } else {
            facts += "Атака на ${target.name} не удалась."
        }
        if (enemiesHere().isNotEmpty()) enemyAttacks(extraPressure = if (outcome == Outcome.CRIT_FAILURE) 1 else 0)
    }

    private fun kill(npc: Npc) {
        npc.alive = false
        npc.hostile = false
        state.combat?.enemyIds?.remove(npc.id)
        val loc = state.location
        loc.items += npc.inventory.map { it.copy(equipped = false) }
        npc.inventory.clear()
        if (npc.money > 0) {
            loc.items += Item(state.newId("i"), "${npc.money} ${canon.currency.name}", "Деньги, оставшиеся после ${npc.name}.", listOf("деньги"), value = npc.money)
            npc.money = 0
        }
        loc.features += "Тело: ${npc.name}"
        if (npc.power >= 4) hero.fame += 1
        fact("${npc.name} повержен.", "${npc.name} повержен", Tone.GOOD)
    }

    private fun enemyAttacks(extraPressure: Int) {
        val armor = hero.inventory.filter { it.slot == ItemSlot.ARMOR && it.equipped }.sumOf { it.power }
        for (enemy in enemiesHere()) {
            if (enemy.id in suppressed) continue
            if (heroDown()) return
            val roll = state.dice.d(6) + state.dice.d(6) + enemy.power / 2 + extraPressure
            if (roll >= 8) {
                val dmg = maxOf(1, 1 + enemy.power / 2 + state.dice.d(3) - armor)
                changeResource(canon.healthResource.id, -dmg, who = enemy.name)
            } else {
                facts += "${enemy.name} атакует, но промахивается."
            }
        }
    }

    private fun makeHostile(npc: Npc) {
        if (!npc.alive) return
        npc.hostile = true
        val combat = state.combat ?: CombatState().also { state.combat = it }
        if (npc.id !in combat.enemyIds) {
            combat.enemyIds += npc.id
            fact("${npc.name} вступает в бой!", "Бой: ${npc.name}", Tone.BAD)
        }
    }

    private fun updateCombat() {
        val combat = state.combat ?: return
        combat.enemyIds.retainAll { id -> state.npcs[id]?.let { it.alive && it.hostile && it.locationId == state.currentLocationId } == true }
        if (combat.enemyIds.isEmpty()) {
            state.combat = null
            facts += "Бой окончен."
        } else combat.round++
    }

    private fun enemiesHere(): List<Npc> = state.npcsHere().filter { it.hostile }

    private fun travel(exit: com.pixelrpg.engine.model.Exit) {
        val from = state.location
        val dest = state.locations[exit.targetId] ?: run {
            val parts = exit.targetId.split("_")
            if (parts.size == 3 && parts[0] == "a") WorldGen.ensureArea(state, parts[1].toInt(), parts[2].toInt()) else null
        } ?: run {
            facts += "Путь никуда не ведёт."
            return
        }
        // Уходя из боя, враги остаются позади.
        state.combat = null
        advance(exit.minutes, resting = false)
        state.currentLocationId = dest.id
        moved = true
        val first = !dest.visited
        dest.visited = true
        if (!dest.generated) needsGeneration += dest.id
        fact(
            "Герой ${if (exit.direction.isNotEmpty()) "добирается" else "переходит"} в «${dest.name}» (${minutesWord(exit.minutes)} в пути).",
            "→ ${dest.name}",
            Tone.NEUTRAL,
        )
        if (first) changes += Change("Новое место", Tone.GOOD)

        // Случайная встреча в дороге между местностями.
        if (exit.direction.isNotEmpty()) {
            val chance = dest.danger * 5 + if (Clock.isDark(state.minute)) 10 else 0
            if (state.dice.chance(chance)) {
                val kinds = listOf("засада" to true, "дикий зверь" to true, "путник" to false, "странная находка" to false, "знамение" to false)
                val (kind, hostile) = kinds[state.dice.nextInt(kinds.size)].let { (k, h) -> k to (h && dest.danger >= 2) }
                encounter = Encounter(dest.id, kind, dest.danger, hostile)
                facts += "В пути случается встреча: $kind."
            }
        }
        for (rule in rulesFor(RuleTrigger.ENTER, dest.tags)) applyRule(rule, includeModifiers = false)
        val hostiles = enemiesHere()
        if (hostiles.isNotEmpty()) hostiles.forEach { makeHostile(it) }
        if (from.id != dest.id) state.addLog(LogKind.SYSTEM, "Место: ${dest.name}")
    }

    private fun rest(minutes: Int) {
        if (enemiesHere().isNotEmpty()) {
            facts += "Отдохнуть не выйдет: рядом враги."
            advance(5, resting = false)
            return
        }
        val hours = (minutes / 60).coerceIn(1, 12)
        val loc = state.location
        val wild = loc.kind != LocationKind.SETTLEMENT && loc.kind != LocationKind.PLACE
        var slept = 0
        for (h in 1..hours) {
            advance(60, resting = true)
            slept = h
            if (wild && loc.danger > 2 && state.dice.chance(loc.danger * 3)) {
                encounter = Encounter(loc.id, "ночной гость", loc.danger, hostile = state.dice.chance(60))
                facts += "Отдых прерван: кто-то приближается."
                break
            }
        }
        if (slept >= 6) hero.conditions.removeAll { it.id == "exhausted" }
        rulesFor(RuleTrigger.REST, loc.tags).forEach { applyRule(it, includeModifiers = false) }
        facts += "Герой отдыхает ${minutesWord(slept * 60)}."
    }

    private fun takeFromLocation(ids: List<String>) {
        val loc = state.location
        for (id in ids) {
            val item = loc.items.firstOrNull { it.id == id } ?: continue
            loc.items.remove(item)
            if ("деньги" in item.tags) {
                money(item.value)
            } else addToInventory(item)
        }
    }

    private fun dropItems(ids: List<String>) {
        for (id in ids) {
            val item = hero.item(id) ?: continue
            hero.inventory.remove(item)
            state.location.items += item.copy(equipped = false)
            fact("Герой оставляет «${item.name}» здесь.", "− ${item.name}", Tone.NEUTRAL)
        }
    }

    private fun equip(ids: List<String>) {
        for (id in ids) {
            val item = hero.item(id) ?: continue
            if (item.slot == ItemSlot.WEAPON || item.slot == ItemSlot.ARMOR) {
                hero.inventory.filter { it.slot == item.slot }.forEach { it.equipped = false }
            }
            item.equipped = !item.equipped || item.slot == ItemSlot.WEAPON || item.slot == ItemSlot.ARMOR
            facts += "Герой ${if (item.equipped) "берёт в дело" else "убирает"} «${item.name}»."
        }
    }

    // ---------- Время ----------

    /** Продвигает часы; на каждом целом часе — восстановление, состояния и ежечасные правила. */
    private fun advance(minutes: Int, resting: Boolean) {
        if (minutes <= 0) return
        val start = state.minute
        val end = start + minutes
        var nextHour = (start / 60 + 1) * 60
        while (nextHour <= end) {
            state.minute = nextHour
            hourTick(resting)
            nextHour += 60
        }
        state.minute = end
    }

    private fun hourTick(resting: Boolean) {
        for (def in canon.resources) {
            val pool = hero.resources[def.id] ?: continue
            val regen = def.regenPerHour
            if (regen == 0) continue
            val inCombat = state.combat != null
            val amount = when {
                regen > 0 && inCombat -> 0
                regen > 0 && resting -> regen * 3
                else -> regen
            }
            if (amount != 0) {
                val before = pool.current
                pool.change(amount)
                if (before > 0 && pool.current == 0) onResourceZero(def.id)
            }
        }
        val defs = CanonValidator.conditionsOf(canon)
        for (c in hero.conditions.toList()) {
            val def = defs.firstOrNull { it.id == c.id } ?: continue
            if (def.resourceId.isNotBlank() && def.resourcePerHour != 0) {
                hero.resources[def.resourceId]?.change(def.resourcePerHour)
            }
        }
        hero.conditions.filter { it.until != null && it.until!! <= state.minute }.forEach { c ->
            hero.conditions.remove(c)
            val name = defs.firstOrNull { it.id == c.id }?.name ?: c.id
            changes += Change("$name прошло", Tone.GOOD)
        }
        rulesFor(RuleTrigger.HOURLY, state.location.tags).forEach { applyRule(it, includeModifiers = false, quiet = true) }
    }

    private fun onResourceZero(resourceId: String) {
        val def = canon.resource(resourceId) ?: return
        if (def.role == ResourceRole.HEALTH) return
        when {
            def.zeroConditionId.isNotBlank() -> addCondition(def.zeroConditionId, 0)
            def.role == ResourceRole.ENERGY -> addCondition("exhausted", 0)
        }
    }

    // ---------- Правила мира ----------

    private fun rulesFor(trigger: RuleTrigger, tags: List<String>): List<RuleDef> {
        val present = state.npcsHere().map { it.factionId }.toSet()
        return canon.rules.filter { r ->
            r.trigger == trigger &&
                (r.tag.isBlank() || r.tag in tags) &&
                (r.witnessFactionId.isBlank() || r.witnessFactionId in present)
        }
    }

    private fun applyRule(rule: RuleDef, includeModifiers: Boolean, quiet: Boolean = false) {
        var applied = false
        for (e in rule.effects) {
            when (e.kind) {
                RuleEffectKind.MODIFIER -> if (!includeModifiers) continue
                RuleEffectKind.RESOURCE -> { changeResource(e.target, e.amount, silent = quiet); applied = true }
                RuleEffectKind.CONDITION -> { addCondition(e.target, e.amount); applied = true }
                RuleEffectKind.FACTION -> state.factions[e.target]?.let { f ->
                    f.attitude = (f.attitude + e.amount).coerceIn(-100, 100)
                    changes += Change("${f.name} ${if (e.amount > 0) "+" else ""}${e.amount}", if (e.amount > 0) Tone.GOOD else Tone.BAD)
                    applied = true
                }
                RuleEffectKind.MONEY -> { money(e.amount.coerceAtLeast(-hero.money)); applied = true }
                RuleEffectKind.NOTE -> { if (e.text.isNotBlank()) facts += "Закон мира: ${e.text}"; applied = true }
            }
        }
        if (applied && !quiet) facts += "Сработало правило мира «${rule.name}»."
    }

    // ---------- Опыт ----------

    private fun gainExperience(skillIdRaw: String, outcome: Outcome) {
        val skill = canon.skill(CanonValidator.slug(skillIdRaw)) ?: return
        val progress = hero.skills.getOrPut(skill.id) { com.pixelrpg.engine.model.SkillProgress() }
        if (progress.rank >= MAX_SKILL_RANK) return
        progress.xp += if (outcome.isFailure) 2 else 1
        val need = (progress.rank + 1) * 4
        if (progress.xp >= need) {
            progress.xp -= need
            progress.rank++
            fact("Навык «${skill.name}» вырос до ${progress.rank}.", "${skill.name} → ${progress.rank}", Tone.GOOD)
            val ranks = canon.skills.filter { it.attributeId == skill.attributeId }.sumOf { hero.skillRank(it.id) }
            val attr = canon.attribute(skill.attributeId) ?: return
            val current = hero.attr(attr.id)
            if (ranks % 3 == 0 && current < 3) {
                hero.attributes[attr.id] = current + 1
                fact("Характеристика «${attr.name}» выросла до ${current + 1}.", "${attr.name} → ${current + 1}", Tone.GOOD)
            }
        }
    }

    // ---------- Поражение ----------

    private fun heroDown() = (hero.resources[canon.healthResource.id]?.current ?: 1) <= 0

    private fun checkDefeat(): Boolean {
        if (!heroDown()) return false
        hero.defeats++
        if (state.settings.permadeath) {
            state.gameOver = true
            facts += "Герой погибает. Его история окончена."
            return true
        }
        val pool = hero.resources.getValue(canon.healthResource.id)
        state.npcsHere().filter { it.hostile }.forEach { enemy ->
            enemy.hostile = false
            sendAway(enemy, silent = true)
        }
        state.combat = null
        val lost = hero.money / 2
        hero.money -= lost
        advance(6 * 60, resting = false)
        pool.current = maxOf(1, pool.max / 4)
        addCondition("wounded", 24)
        facts += "Герой теряет сознание. Он приходит в себя спустя несколько часов — враги ушли" +
            (if (lost > 0) ", прихватив $lost ${canon.currency.name}." else ".")
        changes += Change("Поражение", Tone.BAD)
        if (lost > 0) changes += Change("−$lost ${canon.currency.name}", Tone.BAD)
        return true
    }

    // ---------- Мелкие помощники ----------

    private fun changeResource(id: String, delta: Int, who: String? = null, silent: Boolean = false) {
        val def = canon.resource(id) ?: return
        val pool = hero.resources[def.id] ?: return
        val before = pool.current
        val actual = pool.change(delta)
        if (actual == 0) return
        val sign = if (actual > 0) "+" else "−"
        changes += Change("$sign${kotlin.math.abs(actual)} ${def.name}", if (actual > 0) Tone.GOOD else Tone.BAD)
        if (!silent) {
            facts += when {
                who != null -> "$who наносит удар: герой теряет ${-actual} «${def.name}» (осталось ${pool.current}/${pool.max})."
                actual > 0 -> "Герой восстанавливает ${actual} «${def.name}» (${pool.current}/${pool.max})."
                else -> "Герой теряет ${-actual} «${def.name}» (осталось ${pool.current}/${pool.max})."
            }
        }
        if (before > 0 && pool.current == 0) onResourceZero(def.id)
    }

    private fun addCondition(idRaw: String, hours: Int) {
        val id = CanonValidator.slug(idRaw)
        val def = CanonValidator.conditionsOf(canon).firstOrNull { it.id == id } ?: return
        val duration = if (hours > 0) hours else def.durationHours
        val until = if (duration > 0) state.minute + duration * 60L else null
        val existing = hero.conditions.firstOrNull { it.id == id }
        if (existing != null) {
            existing.until = if (existing.until == null || until == null) null else maxOf(existing.until!!, until)
            return
        }
        hero.conditions += ActiveCondition(id, until)
        fact("Герой получает состояние «${def.name}»: ${def.description}", "+ ${def.name}", if (def.negative) Tone.BAD else Tone.GOOD)
    }

    private fun addToInventory(item: Item, from: String? = null) {
        val same = hero.inventory.firstOrNull { it.name == item.name && it.slot == ItemSlot.NONE && item.slot == ItemSlot.NONE }
        if (same != null) same.quantity += item.quantity else hero.inventory += item
        val qty = if (item.quantity > 1) " ×${item.quantity}" else ""
        fact(
            "Герой получает «${item.name}»$qty${from?.let { " (от: $it)" } ?: ""}${if (item.description.isNotBlank()) " — ${item.description}" else ""}.",
            "+ ${item.name}$qty",
            Tone.GOOD,
        )
    }

    private fun removeFromInventory(item: Item, qty: Int, text: String) {
        if (item.quantity > qty) item.quantity -= qty else hero.inventory.remove(item)
        fact(text, "− ${item.name}", Tone.BAD)
    }

    private fun money(amount: Int) {
        if (amount == 0) return
        hero.money = (hero.money + amount).coerceAtLeast(0)
        val sign = if (amount > 0) "+" else "−"
        fact(
            "Герой ${if (amount > 0) "получает" else "тратит"} ${kotlin.math.abs(amount)} ${canon.currency.name} (теперь ${hero.money}).",
            "$sign${kotlin.math.abs(amount)} ${canon.currency.name}",
            if (amount > 0) Tone.GOOD else Tone.BAD,
        )
    }

    private fun sendAway(npc: Npc, silent: Boolean = false) {
        val loc = state.location
        npc.locationId = loc.parentId ?: loc.exits.filter { it.direction.isNotEmpty() }
            .let { if (it.isEmpty()) loc.id else it[state.dice.nextInt(it.size)].targetId }
        state.combat?.enemyIds?.remove(npc.id)
        if (!silent) fact("${npc.name} уходит.", "${npc.name} ушёл", Tone.NEUTRAL)
    }

    private fun presentNpc(id: String): Npc? =
        state.npcs[id]?.takeIf { it.alive && it.locationId == state.currentLocationId }

    private fun fact(text: String, change: String, tone: Tone) {
        facts += text
        changes += Change(change, tone)
    }

    private fun report(input: String, adj: Adjudication, refused: String? = null, check: CheckResult? = null, defeated: Boolean = false): TurnReport {
        if (refused != null) state.addLog(LogKind.SYSTEM, refused)
        // Изменения пишутся в журнал строками «ТОН|текст», чтобы интерфейс мог показать их после загрузки.
        if (changes.isNotEmpty()) state.addLog(LogKind.CHANGE, changes.joinToString("\n") { "${it.tone}|${it.text}" })
        return TurnReport(
            input = input,
            summary = adj.summary,
            action = adj.actionType,
            refused = refused,
            check = check,
            facts = facts.toList(),
            changes = changes.toList(),
            moved = moved,
            needsGeneration = needsGeneration.toList(),
            encounter = encounter,
            defeated = defeated,
            gameOver = state.gameOver,
        )
    }

    private fun EffectSpec.toItemDraft() = ItemDraft(
        name = name, description = text, tags = tags, value = amount.coerceAtLeast(0),
        rarity = if (tags.any { it.contains("редк") || it == "rare" }) 2 else 0,
        slot = slot, power = power, quantity = 1,
    )

    companion object {
        const val MAX_SKILL_RANK = 4
        private val HOSTILE_TAGS = setOf("hostile", "враг", "враждебный", "агрессивный")
        private val DUNGEON_TAGS = setOf("dungeon", "подземелье", "логово", "пещера", "руины")
        private val HEAL_HINTS = listOf("леч", "heal", "зель", "potion", "медиц", "бинт", "аптеч", "снадоб")

        fun attitudeWord(a: Int) = when {
            a >= 70 -> "предан"
            a >= 35 -> "дружелюбен"
            a >= 10 -> "расположен"
            a > -10 -> "нейтрален"
            a > -35 -> "насторожен"
            a > -70 -> "враждебен"
            else -> "ненавидит"
        }

        fun woundWord(n: Npc): String {
            val r = n.hp.toDouble() / n.maxHp
            return when {
                r > 0.75 -> "почти невредим"
                r > 0.4 -> "ранен"
                r > 0.15 -> "тяжело ранен"
                else -> "едва стоит на ногах"
            }
        }

        fun minutesWord(m: Int): String = when {
            m < 60 -> "$m мин"
            m % 60 == 0 -> "${m / 60} ч"
            else -> "${m / 60} ч ${m % 60} мин"
        }
    }
}
