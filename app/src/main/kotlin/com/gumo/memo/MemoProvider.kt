package com.gumo.memo

import android.content.ContentProvider
import android.content.ContentUris
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Bundle
import android.os.Binder
import android.os.Process
import org.json.JSONObject
import java.io.File

/**
 * ADB/AI가 앱 UI 없이 메모를 CRUD할 수 있게 하는 ContentProvider.
 *   content://com.gumo.memo.provider/notes
 *   content://com.gumo.memo.provider/notes/<id>
 *   content://com.gumo.memo.provider/tags
 */
class MemoProvider : ContentProvider() {

    private lateinit var db: DatabaseHelper

    companion object {
        const val AUTHORITY = "com.gumo.memo.provider"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY")

        private const val NOTES = 1
        private const val NOTE_ID = 2
        private const val TAGS = 3

        private val matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "notes", NOTES)
            addURI(AUTHORITY, "notes/#", NOTE_ID)
            addURI(AUTHORITY, "tags", TAGS)
        }

        private val NOTE_COLS = arrayOf(
            "id", "title", "content", "paper_style",
            "font_size", "is_folded", "created_at", "updated_at"
        )
    }

    override fun onCreate(): Boolean {
        db = DatabaseHelper(context!!)
        return true
    }

    private fun guard() {
        val uid = Binder.getCallingUid()
        if (uid != Process.SHELL_UID && uid != Process.myUid())
            throw SecurityException("구모메모: 허용되지 않은 호출 uid=$uid")
    }

    override fun getType(uri: Uri): String {
        guard()
        return when (matcher.match(uri)) {
            NOTES   -> "vnd.android.cursor.dir/vnd.$AUTHORITY.notes"
            NOTE_ID -> "vnd.android.cursor.item/vnd.$AUTHORITY.notes"
            TAGS    -> "vnd.android.cursor.dir/vnd.$AUTHORITY.tags"
            else    -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }

    private fun MatrixCursor.addNote(n: JSONObject) {
        addRow(
            arrayOf(
                n.getLong("id"), n.getString("title"), n.getString("content"),
                n.getString("paper_style"), n.getInt("font_size"), n.getInt("is_folded"),
                n.getLong("created_at"), n.getLong("updated_at")
            )
        )
    }

    override fun query(
        uri: Uri, projection: Array<String>?, selection: String?,
        selectionArgs: Array<String>?, sortOrder: String?
    ): Cursor {
        guard()
        return when (matcher.match(uri)) {
            NOTES -> {
                val json = db.getNotes()
                MatrixCursor(NOTE_COLS).apply {
                    for (i in 0 until json.length()) addNote(json.getJSONObject(i))
                }
            }
            NOTE_ID -> {
                val id = uri.lastPathSegment!!.toLong()
                val n = db.getNote(id) ?: return MatrixCursor(arrayOf("id"))
                MatrixCursor(NOTE_COLS).apply { addNote(n) }
            }
            TAGS -> {
                val json = db.getTags()
                MatrixCursor(arrayOf("id", "name", "color")).apply {
                    for (i in 0 until json.length()) {
                        val t = json.getJSONObject(i)
                        addRow(arrayOf(t.getLong("id"), t.getString("name"), t.getString("color")))
                    }
                }
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri {
        guard()
        if (matcher.match(uri) != NOTES) throw IllegalArgumentException("Unknown URI: $uri")
        val v = values ?: ContentValues()
        val json = JSONObject().apply {
            put("title", v.getAsString("title") ?: "")
            put("content", v.getAsString("content") ?: "")
            v.getAsString("paper_style")?.let { put("paper_style", it) }
            v.getAsInteger("font_size")?.let { put("font_size", it) }
        }
        val id = db.saveNote(json)
        context!!.contentResolver.notifyChange(uri, null)
        return ContentUris.withAppendedId(CONTENT_URI.buildUpon().appendPath("notes").build(), id)
    }

    override fun update(
        uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?
    ): Int {
        guard()
        if (matcher.match(uri) != NOTE_ID) throw IllegalArgumentException("Unknown URI: $uri")
        val id = uri.lastPathSegment!!.toLong()
        val v = values ?: ContentValues()
        val existing = db.getNote(id) ?: return 0
        val json = JSONObject().apply {
            put("id", id)
            put("title", v.getAsString("title") ?: existing.getString("title"))
            put("content", v.getAsString("content") ?: existing.getString("content"))
            put("paper_style", v.getAsString("paper_style") ?: existing.getString("paper_style"))
            put("font_size", v.getAsInteger("font_size") ?: existing.getInt("font_size"))
        }
        db.saveNote(json)
        context!!.contentResolver.notifyChange(uri, null)
        return 1
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int {
        guard()
        if (matcher.match(uri) != NOTE_ID) throw IllegalArgumentException("Unknown URI: $uri")
        db.deleteNote(uri.lastPathSegment!!.toLong())
        context!!.contentResolver.notifyChange(uri, null)
        return 1
    }

    /** adb로 백업 DB를 밀어넣고 통째로 복구하는 유틸. */
    override fun call(method: String, arg: String?, extras: Bundle?): Bundle? {
        guard()
        if (method == "help") return Bundle().apply {
            putString("json", ApiHelp.document(context!!).toString())
        }
        if (method != "restore_from_file") return null
        val result = Bundle()
        try {
            val src = File(arg ?: return null)
            db.writableDatabase.close()
            val dest = context!!.getDatabasePath("gumo_memo.db")!!
            src.copyTo(dest, overwrite = true)
            db = DatabaseHelper(context!!)
            result.putString("result", "OK:${dest.length()}")
        } catch (e: Exception) {
            result.putString("error", e.message ?: "unknown")
        }
        return result
    }
}
