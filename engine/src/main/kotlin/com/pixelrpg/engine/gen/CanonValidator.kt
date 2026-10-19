package com.pixelrpg.engine.gen

import com.pixelrpg.engine.model.AttributeDef
import com.pixelrpg.engine.model.BiomeDef
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.ConditionDef
import com.pixelrpg.engine.model.CultureDef
import com.pixelrpg.engine.model.CurrencyDef
import com.pixelrpg.engine.model.ResourceDef
import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.model.RuleEffectKind
import com.pixelrpg.engine.model.RuleTrigger
import com.pixelrpg.engine.model.SkillDef

/** Базовые состояния, которые есть в любом мире. Канон может добавить свои. */
object BaseConditions {
    val all = listOf(
        ConditionDef("wounded", "Ранен", "Раны мешают двигаться и сосредоточиться.", checkModifier = -1, durationHours = 24),
        ConditionDef("exhausted", "Измотан", "Силы на исходе, нужен отдых.", checkModifier = -1, durationHours = 0),
        ConditionDef("stunned", "Оглушён", "В глазах темно, мысли путаются.", checkModifier = -2, durationHours = 1),
        ConditionDef("frightened", "Напуган", "Страх сковывает.", checkModifier = -1, durationHours = 2),
        ConditionDef("inspired", "Воодушевлён", "Всё получается.", checkModifier = 1, durationHours = 4, negative = false),
    )
}

/**
 * Приводит канон, написанный ИИ, в порядок: латинские id, без дублей, все ссылки валидны,
 * числа в разумных пределах, обязательные части на месте. Канон после неё всегда играбелен.
 */
object CanonValidator {

    fun normalize(raw: Canon): Canon {
        val attributes = raw.attributes
            .map { it.copy(id = slug(it.id.ifBlank { it.name })) }
            .distinctBy { it.id }
            .take(7)
            .ifEmpty { DEFAULT_ATTRIBUTES }
        val attrIds = attributes.map { it.id }.toSet()

        val skills = raw.skills
            .map { s ->
                s.copy(
                    id = slug(s.id.ifBlank { s.name }),
                    attributeId = slug(s.attributeId).takeIf { it in attrIds } ?: attributes.first().id,
                    tags = s.tags.map(::tag).distinct(),
                )
            }
            .distinctBy { it.id }
            .take(18)
            .ifEmpty { attributes.map { SkillDef(it.id + "_skill", it.name, it.id) } }

        var resources = raw.resources
            .map {
                it.copy(
                    id = slug(it.id.ifBlank { it.name }),
                    max = it.max.coerceIn(3, 100),
                    regenPerHour = it.regenPerHour.coerceIn(-10, 20),
                    zeroConditionId = slug(it.zeroConditionId),
                )
            }
            .distinctBy { it.id }
            .take(5)
        if (resources.none { it.role == ResourceRole.HEALTH }) {
            resources = listOf(ResourceDef("health", "Здоровье", 12, ResourceRole.HEALTH, 1, color = "#d04648")) + resources
        } else {
            // Ровно один ресурс отвечает за здоровье.
            var seen = false
            resources = resources.map {
                if (it.role == ResourceRole.HEALTH) {
                    if (seen) it.copy(role = ResourceRole.SPECIAL) else { seen = true; it }
                } else it
            }
        }
        val resourceIds = resources.map { it.id }.toSet()

        val conditions = (BaseConditions.all + raw.conditions.map {
            it.copy(
                id = slug(it.id.ifBlank { it.name }),
                checkModifier = it.checkModifier.coerceIn(-3, 3),
                resourceId = slug(it.resourceId).takeIf { r -> r in resourceIds } ?: "",
                resourcePerHour = it.resourcePerHour.coerceIn(-5, 5),
                durationHours = it.durationHours.coerceIn(0, 24 * 14),
                tags = it.tags.map(::tag),
            )
        }).distinctBy { it.id }.take(20)
        val conditionIds = conditions.map { it.id }.toSet()
        resources = resources.map { r -> if (r.zeroConditionId in conditionIds) r else r.copy(zeroConditionId = "") }

        val cultures = raw.cultures
            .map { it.copy(id = slug(it.id.ifBlank { it.name })) }
            .distinctBy { it.id }
            .take(8)
            .ifEmpty { listOf(CultureDef("locals", "Местные", "Обычные жители этих земель.")) }
        val cultureIds = cultures.map { it.id }.toSet()

        val factions = raw.factions
            .map {
                it.copy(
                    id = slug(it.id.ifBlank { it.name }),
                    cultureId = slug(it.cultureId).takeIf { c -> c in cultureIds } ?: cultures.first().id,
                    startAttitude = it.startAttitude.coerceIn(-100, 100),
                    power = it.power.coerceIn(1, 10),
                    tags = it.tags.map(::tag),
                )
            }
            .distinctBy { it.id }
            .take(8)
        val factionIds = factions.map { it.id }.toSet()

        val biomes = raw.biomes
            .map {
                it.copy(
                    id = slug(it.id.ifBlank { it.name }),
                    danger = it.danger.coerceIn(0, 10),
                    settlementChance = it.settlementChance.coerceIn(0, 90),
                    travelHours = it.travelHours.coerceIn(1, 12),
                    tags = it.tags.map(::tag),
                )
            }
            .distinctBy { it.id }
            .take(12)
            .let { if (it.size >= 2) it else it + DEFAULT_BIOMES.filter { d -> it.none { b -> b.id == d.id } } }

        val rules = raw.rules.mapNotNull { rule ->
            val effects = rule.effects.mapNotNull { e ->
                val target = slug(e.target)
                val ok = when (e.kind) {
                    RuleEffectKind.RESOURCE -> target in resourceIds
                    RuleEffectKind.CONDITION -> target in conditionIds
                    RuleEffectKind.FACTION -> target in factionIds
                    RuleEffectKind.MODIFIER, RuleEffectKind.MONEY, RuleEffectKind.NOTE -> true
                }
                if (!ok) return@mapNotNull null
                val amount = when (e.kind) {
                    RuleEffectKind.MODIFIER -> e.amount.coerceIn(-3, 3)
                    RuleEffectKind.FACTION -> e.amount.coerceIn(-30, 30)
                    RuleEffectKind.CONDITION -> e.amount.coerceIn(0, 24 * 7)
                    else -> e.amount.coerceIn(-50, 50)
                }
                e.copy(target = target, amount = amount)
            }
            if (effects.isEmpty()) null
            else rule.copy(
                id = slug(rule.id.ifBlank { rule.name }),
                tag = tag(rule.tag),
                witnessFactionId = slug(rule.witnessFactionId).takeIf { it in factionIds } ?: "",
                outcome = rule.outcome.lowercase().takeIf { it in setOf("success", "partial", "failure") } ?: "",
                effects = effects,
            )
        }.distinctBy { it.id }.take(16)

        return raw.copy(
            title = raw.title.ifBlank { "Безымянный мир" }.take(80),
            attributes = attributes,
            skills = skills,
            resources = resources,
            conditions = conditions,
            currency = raw.currency.let {
                CurrencyDef(it.name.ifBlank { "монеты" }, it.short, it.startAmount.coerceIn(0, 500))
            },
            // Ежечасные правила срабатывают постоянно, поэтому их урон ограничен сильнее.
            rules = rules.map { r ->
                if (r.trigger == RuleTrigger.HOURLY) r.copy(effects = r.effects.map { e ->
                    if (e.kind == RuleEffectKind.RESOURCE) e.copy(amount = e.amount.coerceIn(-2, 5)) else e
                }) else r
            },
            cultures = cultures,
            factions = factions,
            biomes = biomes,
            itemTags = raw.itemTags.map(::tag).distinct().take(40),
            palette = raw.palette.filter { HEX.matches(it) }.take(16),
        )
    }

    /** Все состояния мира (база + канон) — канон уже содержит базу после [normalize]. */
    fun conditionsOf(canon: Canon): List<ConditionDef> =
        (canon.conditions + BaseConditions.all).distinctBy { it.id }

    private val HEX = Regex("^#[0-9a-fA-F]{6}$")

    private val TRANSLIT = mapOf(
        'а' to "a", 'б' to "b", 'в' to "v", 'г' to "g", 'д' to "d", 'е' to "e", 'ё' to "e", 'ж' to "zh",
        'з' to "z", 'и' to "i", 'й' to "y", 'к' to "k", 'л' to "l", 'м' to "m", 'н' to "n", 'о' to "o",
        'п' to "p", 'р' to "r", 'с' to "s", 'т' to "t", 'у' to "u", 'ф' to "f", 'х' to "h", 'ц' to "c",
        'ч' to "ch", 'ш' to "sh", 'щ' to "sch", 'ъ' to "", 'ы' to "y", 'ь' to "", 'э' to "e", 'ю' to "yu",
        'я' to "ya",
    )

    /** Латинский идентификатор из любой строки: «Тёмная магия» → «temnaya_magiya». */
    fun slug(s: String): String {
        val sb = StringBuilder()
        for (c in s.trim().lowercase()) {
            when {
                c in 'a'..'z' || c in '0'..'9' -> sb.append(c)
                TRANSLIT.containsKey(c) -> sb.append(TRANSLIT.getValue(c))
                else -> if (sb.isNotEmpty() && sb.last() != '_') sb.append('_')
            }
        }
        return sb.toString().trim('_').take(40)
    }

    /** Теги — короткие слова в нижнем регистре, кириллица допустима. */
    fun tag(s: String): String = s.trim().lowercase().replace(Regex("\\s+"), "_").take(30)

    private val DEFAULT_ATTRIBUTES = listOf(
        AttributeDef("body", "Тело", "Сила, выносливость, ловкость рук."),
        AttributeDef("mind", "Разум", "Знания, внимательность, хитрость."),
        AttributeDef("spirit", "Дух", "Воля, обаяние, чутьё."),
    )

    private val DEFAULT_BIOMES = listOf(
        BiomeDef("plains", "Равнины", "Открытые просторы.", danger = 1, settlementChance = 35, travelHours = 2),
        BiomeDef("forest", "Лес", "Густой тёмный лес.", danger = 3, settlementChance = 15, travelHours = 4),
        BiomeDef("hills", "Холмы", "Каменистые холмы.", danger = 3, settlementChance = 15, travelHours = 4),
    )
}
