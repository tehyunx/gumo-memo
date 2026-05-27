package com.gumo.memo

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class ShareActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        when {
            intent?.action == Intent.ACTION_SEND && intent.type == "text/plain" -> {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
                val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: ""
                val combined = if (subject.isNotBlank()) "$subject\n\n$text" else text
                mainIntent.putExtra("shared_text", combined)
            }
            intent?.action == Intent.ACTION_SEND && intent.type?.startsWith("image/") == true -> {
                @Suppress("DEPRECATION")
                val imageUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                if (imageUri != null) {
                    val path = JsInterface(this, DatabaseHelper(this), {}, {})
                        .saveImageToStorage(imageUri)
                    mainIntent.putExtra("shared_image_path", path)
                }
            }
        }

        startActivity(mainIntent)
        finish()
    }
}
