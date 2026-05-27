package com.gumo.memo

import android.content.Context
import android.net.Uri
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class JsInterface(
    private val context: Context,
    private val db: DatabaseHelper,
    private val onPickImage: () -> Unit,
    private val onCaptureImage: () -> Unit
) {
    var pendingSharedText: String? = null
    var pendingSharedImagePath: String? = null

    // ── Notes ──

    @JavascriptInterface
    fun saveNote(jsonStr: String): String {
        return try {
            val id = db.saveNote(JSONObject(jsonStr))
            JSONObject().apply { put("id", id); put("ok", true) }.toString()
        } catch (e: Exception) {
            JSONObject().apply { put("ok", false); put("error", e.message) }.toString()
        }
    }

    @JavascriptInterface
    fun getNotes(tagIdStr: String): String {
        val tagId = tagIdStr.toLongOrNull() ?: -1L
        return db.getNotes(tagId).toString()
    }

    @JavascriptInterface
    fun getNote(idStr: String): String {
        return db.getNote(idStr.toLong())?.toString() ?: "null"
    }

    @JavascriptInterface
    fun deleteNote(idStr: String) {
        db.deleteNote(idStr.toLong())
    }

    @JavascriptInterface
    fun setFolded(idStr: String, folded: Boolean) {
        db.setFolded(idStr.toLong(), folded)
    }

    // ── Tags ──

    @JavascriptInterface
    fun saveTag(name: String, color: String): String {
        return db.saveTag(name, color).toString()
    }

    @JavascriptInterface
    fun getTags(): String {
        return db.getTags().toString()
    }

    @JavascriptInterface
    fun deleteTag(idStr: String) {
        db.deleteTag(idStr.toLong())
    }

    @JavascriptInterface
    fun setNoteTags(noteIdStr: String, tagIdsJson: String) {
        val arr = JSONArray(tagIdsJson)
        val ids = (0 until arr.length()).map { arr.getLong(it) }
        db.setNoteTags(noteIdStr.toLong(), ids)
    }

    // ── Images ──

    @JavascriptInterface
    fun pickImageFromGallery() { onPickImage() }

    @JavascriptInterface
    fun captureImageFromCamera() { onCaptureImage() }

    fun saveImageToStorage(sourceUri: Uri): String {
        val dir = File(context.filesDir, "images").apply { mkdirs() }
        val dest = File(dir, "${System.currentTimeMillis()}.jpg")
        context.contentResolver.openInputStream(sourceUri)?.use { input ->
            FileOutputStream(dest).use { output -> input.copyTo(output) }
        }
        return dest.absolutePath
    }

    @JavascriptInterface
    fun addImageToNote(noteIdStr: String, filePath: String): String {
        val id = db.addImage(noteIdStr.toLong(), filePath)
        return JSONObject().apply {
            put("id", id)
            put("file_path", filePath)
        }.toString()
    }

    @JavascriptInterface
    fun deleteImage(idStr: String) {
        db.deleteImage(idStr.toLong())
    }

    // ── Shared content ──

    @JavascriptInterface
    fun getSharedText(): String {
        val prefs = context.getSharedPreferences("memo_settings", Context.MODE_PRIVATE)
        val text = prefs.getString("shared_text_temp", null)
            ?: pendingSharedText
            ?: return "null"
        prefs.edit().remove("shared_text_temp").apply()
        pendingSharedText = null
        return JSONObject().apply { put("text", text) }.toString()
    }

    @JavascriptInterface
    fun getSharedImagePath(): String {
        val prefs = context.getSharedPreferences("memo_settings", Context.MODE_PRIVATE)
        val path = prefs.getString("shared_image_temp", null)
            ?: pendingSharedImagePath
            ?: return "null"
        prefs.edit().remove("shared_image_temp").apply()
        pendingSharedImagePath = null
        return path
    }

    // ── Settings ──

    @JavascriptInterface
    fun getSetting(key: String): String {
        return context.getSharedPreferences("memo_settings", Context.MODE_PRIVATE)
            .getString(key, "") ?: ""
    }

    @JavascriptInterface
    fun setSetting(key: String, value: String) {
        context.getSharedPreferences("memo_settings", Context.MODE_PRIVATE)
            .edit().putString(key, value).apply()
    }
}
