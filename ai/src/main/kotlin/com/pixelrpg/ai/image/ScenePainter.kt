package com.pixelrpg.ai.image

import com.pixelrpg.ai.GameMaster
import com.pixelrpg.engine.model.GameState
import java.io.File

/** Декодирование и запись картинок — у Android и у JVM они свои. */
interface ImageCodec {
    fun decode(bytes: ByteArray): Pixels
    fun writePng(pixels: Pixels, file: File)
}

/**
 * «Что видит герой»: Claude описывает сцену по состоянию игры, сервис картинок рисует,
 * а [Pixelator] превращает результат в пиксель-арт в выбранной палитре.
 */
class ScenePainter(
    private val master: GameMaster,
    private val settings: ImageSettings,
    private val codec: ImageCodec,
    private val generator: ImageGenerator = ImageGenerators.create(settings),
    private val themeRamp: () -> List<Int> = { emptyList() },
) {
    suspend fun paint(state: GameState, dir: File): File {
        val prompt = master.imagePrompt(state)
        val bytes = generator.generate(prompt)
        val src = codec.decode(bytes)
        val pixels = when (settings.palette) {
            PaletteMode.AUTO -> Pixelator.pixelate(src, settings.pixels)
            PaletteMode.WORLD -> Pixelator.parsePalette(state.canon.palette).let {
                if (it.size >= 3) Pixelator.pixelateRamp(src, settings.pixels, it) else Pixelator.pixelate(src, settings.pixels)
            }
            PaletteMode.THEME -> Pixelator.pixelateRamp(src, settings.pixels, themeRamp())
        }
        dir.mkdirs()
        val file = File(dir, "scene-${state.turn}-${System.currentTimeMillis() % 100000}.png")
        codec.writePng(pixels, file)
        return file
    }
}
