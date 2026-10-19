package com.pixelrpg.engine

import com.pixelrpg.engine.gen.CanonValidator
import com.pixelrpg.engine.gen.Factory
import com.pixelrpg.engine.gen.HeroDraft
import com.pixelrpg.engine.gen.ItemDraft
import com.pixelrpg.engine.gen.StatValue
import com.pixelrpg.engine.gen.TraitDraft
import com.pixelrpg.engine.model.AttributeDef
import com.pixelrpg.engine.model.BiomeDef
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.model.ConditionDef
import com.pixelrpg.engine.model.CultureDef
import com.pixelrpg.engine.model.CurrencyDef
import com.pixelrpg.engine.model.FactionDef
import com.pixelrpg.engine.model.GameSettings
import com.pixelrpg.engine.model.GameState
import com.pixelrpg.engine.model.ResourceDef
import com.pixelrpg.engine.model.ResourceRole
import com.pixelrpg.engine.model.RuleDef
import com.pixelrpg.engine.model.RuleEffect
import com.pixelrpg.engine.model.RuleEffectKind
import com.pixelrpg.engine.model.RuleTrigger
import com.pixelrpg.engine.model.SkillDef

object Fixtures {
    fun canon(): Canon = CanonValidator.normalize(
        Canon(
            title = "Кровавая Империя",
            pitch = "Империя, где магия питается кровью.",
            genre = "тёмное фэнтези",
            tone = "мрачный",
            narratorStyle = "сухо и образно",
            laws = listOf("Магия требует крови"),
            impossible = listOf("огнестрельное оружие"),
            attributes = listOf(
                AttributeDef("telo", "Тело"),
                AttributeDef("um", "Ум"),
                AttributeDef("volya", "Воля"),
            ),
            skills = listOf(
                SkillDef("blade", "Клинок", "telo", tags = listOf("бой")),
                SkillDef("lie", "Обман", "um", tags = listOf("social")),
                SkillDef("blood_magic", "Магия крови", "volya", tags = listOf("магия")),
                SkillDef("stealth", "Скрытность", "telo"),
            ),
            resources = listOf(
                ResourceDef("hp", "Здоровье", 12, ResourceRole.HEALTH, regenPerHour = 1),
                ResourceDef("mana", "Сила крови", 6, ResourceRole.SPECIAL, regenPerHour = 1),
            ),
            conditions = listOf(ConditionDef("bleeding", "Кровотечение", "Кровь не останавливается.", -1, resourceId = "hp", resourcePerHour = -1, durationHours = 3)),
            currency = CurrencyDef("крон", startAmount = 30),
            rules = listOf(
                RuleDef(
                    "blood_price", "Цена крови", trigger = RuleTrigger.ACTION, tag = "магия",
                    effects = listOf(RuleEffect(RuleEffectKind.RESOURCE, "hp", -2)),
                ),
                RuleDef(
                    "empire_hates_mages", "Империя против магов", trigger = RuleTrigger.ACTION, tag = "магия",
                    witnessFactionId = "empire",
                    effects = listOf(RuleEffect(RuleEffectKind.FACTION, "empire", -20)),
                ),
            ),
            cultures = listOf(CultureDef("imperial", "Имперцы")),
            factions = listOf(FactionDef("empire", "Империя", power = 8), FactionDef("rebels", "Повстанцы", power = 3, startAttitude = 10)),
            biomes = listOf(
                BiomeDef("plains", "Равнины", danger = 1, settlementChance = 40, travelHours = 2),
                BiomeDef("swamp", "Топи", danger = 5, settlementChance = 5, travelHours = 5),
                BiomeDef("forest", "Лес", danger = 3, settlementChance = 15, travelHours = 3),
            ),
        ),
    )

    fun heroDraft() = HeroDraft(
        name = "Ирва",
        concept = "беглая магесса",
        attributes = listOf(StatValue("telo", 1), StatValue("um", 2), StatValue("volya", 2)),
        skills = listOf(StatValue("blood_magic", 2), StatValue("lie", 1), StatValue("blade", 1)),
        items = listOf(
            ItemDraft("Кинжал", "Тонкий и острый.", listOf("оружие"), value = 10, slot = "weapon", power = 3),
            ItemDraft("Кожаная куртка", tags = listOf("броня"), value = 15, slot = "armor", power = 1),
            ItemDraft("Лечебная мазь", tags = listOf("лечение"), value = 8),
        ),
        traits = listOf(TraitDraft("Лживый язык", "Врёт не моргнув.", 1, listOf("social"))),
    )

    fun game(seed: Long = 42L): GameState {
        val canon = canon()
        return Factory.newGame("test", seed, canon, Factory.hero(canon, heroDraft()), GameSettings(), 0L)
    }
}
