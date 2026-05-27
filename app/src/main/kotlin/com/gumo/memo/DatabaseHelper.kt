package com.gumo.memo

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, "gumo_memo.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                paper_style TEXT DEFAULT 'lined',
                font_size INTEGER DEFAULT 16,
                is_folded INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        db.execSQL("""
            CREATE TABLE tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#888888'
            )
        """)
        db.execSQL("""
            CREATE TABLE note_tags (
                note_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)
        db.execSQL("""
            CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            )
        """)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS images")
        db.execSQL("DROP TABLE IF EXISTS note_tags")
        db.execSQL("DROP TABLE IF EXISTS tags")
        db.execSQL("DROP TABLE IF EXISTS notes")
        onCreate(db)
    }

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    // ── Notes ──

    fun saveNote(json: JSONObject): Long {
        val now = System.currentTimeMillis()
        val id = json.optLong("id", -1L)
        val cv = ContentValues().apply {
            put("title", json.optString("title", ""))
            put("content", json.optString("content", ""))
            put("paper_style", json.optString("paper_style", "lined"))
            put("font_size", json.optInt("font_size", 16))
            put("is_folded", json.optInt("is_folded", 0))
            put("updated_at", now)
        }
        return if (id > 0) {
            writableDatabase.update("notes", cv, "id=?", arrayOf(id.toString()))
            id
        } else {
            cv.put("created_at", now)
            writableDatabase.insert("notes", null, cv)
        }
    }

    fun getNotes(tagId: Long = -1L): JSONArray {
        val sql = if (tagId > 0)
            "SELECT n.* FROM notes n INNER JOIN note_tags nt ON n.id=nt.note_id WHERE nt.tag_id=? ORDER BY n.updated_at DESC"
        else
            "SELECT * FROM notes ORDER BY updated_at DESC"
        val args = if (tagId > 0) arrayOf(tagId.toString()) else null
        val result = JSONArray()
        val c = readableDatabase.rawQuery(sql, args)
        while (c.moveToNext()) {
            val obj = JSONObject().apply {
                put("id", c.getLong(c.getColumnIndexOrThrow("id")))
                put("title", c.getString(c.getColumnIndexOrThrow("title")) ?: "")
                put("content", c.getString(c.getColumnIndexOrThrow("content")) ?: "")
                put("paper_style", c.getString(c.getColumnIndexOrThrow("paper_style")))
                put("font_size", c.getInt(c.getColumnIndexOrThrow("font_size")))
                put("is_folded", c.getInt(c.getColumnIndexOrThrow("is_folded")))
                put("created_at", c.getLong(c.getColumnIndexOrThrow("created_at")))
                put("updated_at", c.getLong(c.getColumnIndexOrThrow("updated_at")))
            }
            obj.put("tags", getTagsForNote(c.getLong(c.getColumnIndexOrThrow("id"))))
            result.put(obj)
        }
        c.close()
        return result
    }

    fun getNote(id: Long): JSONObject? {
        val c = readableDatabase.rawQuery("SELECT * FROM notes WHERE id=?", arrayOf(id.toString()))
        if (!c.moveToFirst()) { c.close(); return null }
        val obj = JSONObject().apply {
            put("id", c.getLong(c.getColumnIndexOrThrow("id")))
            put("title", c.getString(c.getColumnIndexOrThrow("title")) ?: "")
            put("content", c.getString(c.getColumnIndexOrThrow("content")) ?: "")
            put("paper_style", c.getString(c.getColumnIndexOrThrow("paper_style")))
            put("font_size", c.getInt(c.getColumnIndexOrThrow("font_size")))
            put("is_folded", c.getInt(c.getColumnIndexOrThrow("is_folded")))
            put("created_at", c.getLong(c.getColumnIndexOrThrow("created_at")))
            put("updated_at", c.getLong(c.getColumnIndexOrThrow("updated_at")))
        }
        c.close()
        obj.put("tags", getTagsForNote(id))
        obj.put("images", getImagesForNote(id))
        return obj
    }

    fun deleteNote(id: Long) {
        writableDatabase.delete("notes", "id=?", arrayOf(id.toString()))
    }

    fun setFolded(id: Long, folded: Boolean) {
        val cv = ContentValues().apply { put("is_folded", if (folded) 1 else 0) }
        writableDatabase.update("notes", cv, "id=?", arrayOf(id.toString()))
    }

    // ── Tags ──

    fun saveTag(name: String, color: String = "#888888"): Long {
        val cv = ContentValues().apply {
            put("name", name.trim())
            put("color", color)
        }
        return try {
            writableDatabase.insertOrThrow("tags", null, cv)
        } catch (e: Exception) {
            val c = readableDatabase.rawQuery("SELECT id FROM tags WHERE name=?", arrayOf(name.trim()))
            val id = if (c.moveToFirst()) c.getLong(0) else -1L
            c.close(); id
        }
    }

    fun getTags(): JSONArray {
        val result = JSONArray()
        val c = readableDatabase.rawQuery("SELECT * FROM tags ORDER BY name ASC", null)
        while (c.moveToNext()) {
            result.put(JSONObject().apply {
                put("id", c.getLong(c.getColumnIndexOrThrow("id")))
                put("name", c.getString(c.getColumnIndexOrThrow("name")))
                put("color", c.getString(c.getColumnIndexOrThrow("color")))
            })
        }
        c.close()
        return result
    }

    fun deleteTag(id: Long) {
        writableDatabase.delete("tags", "id=?", arrayOf(id.toString()))
    }

    fun setNoteTags(noteId: Long, tagIds: List<Long>) {
        writableDatabase.delete("note_tags", "note_id=?", arrayOf(noteId.toString()))
        tagIds.forEach { tagId ->
            val cv = ContentValues().apply { put("note_id", noteId); put("tag_id", tagId) }
            writableDatabase.insert("note_tags", null, cv)
        }
    }

    private fun getTagsForNote(noteId: Long): JSONArray {
        val result = JSONArray()
        val c = readableDatabase.rawQuery(
            "SELECT t.* FROM tags t INNER JOIN note_tags nt ON t.id=nt.tag_id WHERE nt.note_id=?",
            arrayOf(noteId.toString())
        )
        while (c.moveToNext()) {
            result.put(JSONObject().apply {
                put("id", c.getLong(c.getColumnIndexOrThrow("id")))
                put("name", c.getString(c.getColumnIndexOrThrow("name")))
                put("color", c.getString(c.getColumnIndexOrThrow("color")))
            })
        }
        c.close()
        return result
    }

    // ── Images ──

    fun addImage(noteId: Long, filePath: String): Long {
        val cv = ContentValues().apply {
            put("note_id", noteId)
            put("file_path", filePath)
            put("created_at", System.currentTimeMillis())
        }
        return writableDatabase.insert("images", null, cv)
    }

    fun deleteImage(id: Long) {
        writableDatabase.delete("images", "id=?", arrayOf(id.toString()))
    }

    private fun getImagesForNote(noteId: Long): JSONArray {
        val result = JSONArray()
        val c = readableDatabase.rawQuery(
            "SELECT * FROM images WHERE note_id=? ORDER BY created_at ASC",
            arrayOf(noteId.toString())
        )
        while (c.moveToNext()) {
            result.put(JSONObject().apply {
                put("id", c.getLong(c.getColumnIndexOrThrow("id")))
                put("file_path", c.getString(c.getColumnIndexOrThrow("file_path")))
            })
        }
        c.close()
        return result
    }
}
