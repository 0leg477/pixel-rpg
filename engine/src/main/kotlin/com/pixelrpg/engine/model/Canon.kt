package com.pixelrpg.engine.model

import kotlinx.serialization.Serializable

/**
 * Канон мира: всё, что делает конкретный сеттинг особенным.
 *
 * Жёсткие правила ([attributes], [skills], [resources], [conditions], [rules]) исполняет движок.
 * Мягкие правила ([laws], [impossible], [narratorStyle]) получает рассказчик как текст.
 * Остальное — заготовки для генератора мира и картинок.
 */
@Serializable
data class Canon(
    val title: String,
    val pitch: String,
    val genre: String,
    val tone: String,
    val narratorStyle: String,
    val laws: List<String> = emptyList(),
    val impossible: List<String> = emptyList(),
    val attributes: List<AttributeDef>,
    val skills: List<SkillDef>,
    val resources: List<ResourceDef>,
    val conditions: List<ConditionDef> = emptyList(),
    val currency: CurrencyDef,
    val rules: List<RuleDef> = emptyList(),
    val cultures: List<CultureDef> = emptyList(),
    val factions: List<FactionDef> = emptyList(),
    val biomes: List<BiomeDef>,
    val itemTags: List<String> = emptyList(),
    val artStyle: String = "",
    val palette: List<String> = emptyList(),
    val startScenario: String = "",
) {
    fun attribute(id: String) = attributes.firstOrNull { it.id == id }
    fun skill(id: String) = skills.firstOrNull { it.id == id }
    fun resource(id: String) = resources.firstOrNull { it.id == id }
    fun condition(id: String) = conditions.firstOrNull { it.id == id }
    fun faction(id: String) = factions.firstOrNull { it.id == id }
    fun culture(id: String) = cultures.firstOrNull { it.id == id }
    fun biome(id: String) = biomes.firstOrNull { it.id == id }

    /** Ресурс, обнуление которого выводит героя из строя. */
    val healthResource: ResourceDef
        get() = resources.firstOrNull { it.role == ResourceRole.HEALTH } ?: resources.first()
}

@Serializable
data class AttributeDef(
    val id: String,
    val name: String,
    val description: String = "",
)

@Serializable
data class SkillDef(
    val id: String,
    val name: String,
    val attributeId: String,
    val description: String = "",
    /** Теги действий, к которым навык подходит («магия», «скрытность»…). */
    val tags: List<String> = emptyList(),
)

@Serializable
enum class ResourceRole { HEALTH, ENERGY, SPECIAL }

@Serializable
data class ResourceDef(
    val id: String,
    val name: String,
    val max: Int,
    val role: ResourceRole = ResourceRole.SPECIAL,
    /** Сколько восстанавливается за час (отдых утраивает). Может быть отрицательным — например, голод. */
    val regenPerHour: Int = 0,
    /** Состояние, которое накладывается при падении до нуля (кроме здоровья — там своя логика). */
    val zeroConditionId: String = "",
    val description: String = "",
    val color: String = "",
)

@Serializable
data class ConditionDef(
    val id: String,
    val name: String,
    val description: String = "",
    /** Модификатор к проверкам, пока действует состояние. */
    val checkModifier: Int = 0,
    /** К каким тегам действий применяется модификатор; пусто — ко всем. */
    val tags: List<String> = emptyList(),
    val resourceId: String = "",
    val resourcePerHour: Int = 0,
    /** Длительность по умолчанию в часах; 0 — пока не снимут. */
    val durationHours: Int = 0,
    val negative: Boolean = true,
)

@Serializable
data class CurrencyDef(
    val name: String,
    val short: String = "",
    val startAmount: Int = 20,
)

@Serializable
enum class RuleTrigger {
    /** Герой совершает действие с тегом [RuleDef.tag]. */
    ACTION,
    /** После проверки с тегом [RuleDef.tag] и исходом [RuleDef.outcome]. */
    CHECK,
    /** Каждый игровой час. */
    HOURLY,
    /** Отдых. */
    REST,
    /** Вход в локацию с тегом [RuleDef.tag]. */
    ENTER,
}

/**
 * Жёсткое правило мира: «когда X — то Y».
 * Например, «каждое заклинание стоит крови»: ACTION, tag=magic, effects=[resource health -2].
 */
@Serializable
data class RuleDef(
    val id: String,
    val name: String,
    val description: String = "",
    val trigger: RuleTrigger,
    val tag: String = "",
    /** Срабатывает, только если рядом есть свидетель из этой фракции. */
    val witnessFactionId: String = "",
    /** Для CHECK: success / partial / failure; пусто — любой исход. */
    val outcome: String = "",
    val effects: List<RuleEffect>,
)

@Serializable
enum class RuleEffectKind { RESOURCE, CONDITION, MODIFIER, FACTION, MONEY, NOTE }

@Serializable
data class RuleEffect(
    val kind: RuleEffectKind,
    val target: String = "",
    val amount: Int = 0,
    val text: String = "",
)

@Serializable
data class CultureDef(
    val id: String,
    val name: String,
    val description: String = "",
    /** Как звучат имена: стиль и примеры. */
    val namingStyle: String = "",
)

@Serializable
data class FactionDef(
    val id: String,
    val name: String,
    val description: String = "",
    val goals: String = "",
    val cultureId: String = "",
    /** Отношение к герою на старте, -100..100. */
    val startAttitude: Int = 0,
    /** Сила фракции 1..10: сколько земель она держит. */
    val power: Int = 5,
    val tags: List<String> = emptyList(),
)

@Serializable
data class BiomeDef(
    val id: String,
    val name: String,
    val description: String = "",
    /** Базовая опасность 0..10. */
    val danger: Int = 2,
    /** Шанс поселения в клетке, 0..100. */
    val settlementChance: Int = 25,
    /** Сколько часов занимает переход через клетку. */
    val travelHours: Int = 3,
    val tags: List<String> = emptyList(),
)
