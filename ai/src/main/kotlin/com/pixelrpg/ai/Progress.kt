package com.pixelrpg.ai

/** Насколько готов ответ модели: доля 0..1 и что она пишет сейчас. */
data class Progress(val fraction: Float, val label: String)

/**
 * Оценивает прогресс по уже написанному JSON. Если известны разделы ответа (поля схемы по порядку),
 * считаем по ним — так видно, что именно сейчас придумывается; иначе — по объёму текста.
 */
class JsonProgress(
    private val expectedChars: Int,
    private val sections: List<Section> = emptyList(),
    private val defaultLabel: String = "",
) {
    data class Section(val key: String, val label: String, val weight: Float)

    private val total = sections.sumOf { it.weight.toDouble() }.toFloat()

    fun of(text: String): Progress {
        if (sections.isEmpty()) {
            return Progress((text.length.toFloat() / expectedChars).coerceIn(0f, 0.95f), defaultLabel)
        }
        // Последний начатый раздел: поля идут в порядке схемы.
        var current = -1
        var currentStart = 0
        for ((i, section) in sections.withIndex()) {
            val at = text.indexOf("\"${section.key}\"")
            if (at >= 0) {
                current = i
                currentStart = at
            }
        }
        if (current < 0) return Progress(0f, sections.first().label)
        val before = sections.take(current).sumOf { it.weight.toDouble() }.toFloat()
        val section = sections[current]
        val sectionChars = expectedChars * section.weight / total
        val inside = ((text.length - currentStart) / sectionChars).coerceIn(0f, 0.95f) * section.weight
        return Progress(((before + inside) / total).coerceIn(0f, 0.99f), section.label)
    }

    companion object {
        /** Разделы канона в порядке схемы; веса — примерный объём каждого. */
        fun canon(compact: Boolean) = JsonProgress(
            expectedChars = if (compact) 4500 else 9000,
            sections = listOf(
                Section("title", "название", 1f),
                Section("pitch", "суть мира", 2f),
                Section("genre", "жанр", 1f),
                Section("tone", "тон", 1f),
                Section("narratorStyle", "манера рассказа", 2f),
                Section("laws", "законы мира", 3f),
                Section("impossible", "чего не бывает", 2f),
                Section("attributes", "характеристики", 3f),
                Section("skills", "навыки", 7f),
                Section("resources", "ресурсы", 3f),
                Section("conditions", "состояния", 3f),
                Section("currency", "валюта", 1f),
                Section("rules", "правила мира", 5f),
                Section("cultures", "народы", 3f),
                Section("factions", "фракции", 5f),
                Section("biomes", "земли", 5f),
                Section("itemTags", "предметы", 2f),
                Section("artStyle", "стиль картинок", 2f),
                Section("palette", "палитра", 2f),
                Section("startScenario", "завязка истории", 3f),
            ),
        )

        fun plain(expectedChars: Int, label: String) = JsonProgress(expectedChars, defaultLabel = label)
    }
}
