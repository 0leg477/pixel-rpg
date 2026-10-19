package com.pixelrpg.app.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.pixelrpg.ai.image.ImageCodec
import com.pixelrpg.ai.image.Pixels
import java.io.File
import java.io.IOException

/** Декодирование и запись PNG средствами Android. */
object AndroidImageCodec : ImageCodec {

    override fun decode(bytes: ByteArray): Pixels {
        // Сразу уменьшаем крупные картинки при декодировании — экономим память телефона.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= 512) sample *= 2
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: throw IOException("Не удалось прочитать картинку")
        val px = IntArray(bmp.width * bmp.height)
        bmp.getPixels(px, 0, bmp.width, 0, 0, bmp.width, bmp.height)
        val result = Pixels(bmp.width, bmp.height, px)
        bmp.recycle()
        return result
    }

    override fun writePng(pixels: Pixels, file: File) {
        val bmp = Bitmap.createBitmap(pixels.argb, pixels.width, pixels.height, Bitmap.Config.ARGB_8888)
        file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bmp.recycle()
    }
}
