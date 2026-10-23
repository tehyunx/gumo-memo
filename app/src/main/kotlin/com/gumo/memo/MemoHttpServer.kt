package com.gumo.memo

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

class MemoHttpServer(
    private val db: DatabaseHelper,
    private val context: Context,
    port: Int = 8081
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri.trimEnd('/')
        val meth = session.method
        return try {
            when {
                uri == "/help" && meth == Method.GET ->
                    ok(ApiHelp.document(context).toString())

                uri == "/status" ->
                    ok("""{"status":"ok","app":"gumo-memo","port":8081}""")

                uri == "/notes" && meth == Method.GET ->
                    ok(db.getNotes().toString())

                Regex("""/notes/\d+""").matches(uri) && meth == Method.GET -> {
                    val id = uri.substringAfterLast("/").toLong()
                    db.getNote(id)?.let { ok(it.toString()) } ?: notFound()
                }

                uri == "/notes" && meth == Method.POST -> {
                    val body = mutableMapOf<String, String>()
                    session.parseBody(body)
                    val id = db.saveNote(JSONObject(body["postData"] ?: "{}"))
                    ok("""{"id":$id}""")
                }

                Regex("""/notes/\d+""").matches(uri) && meth == Method.PUT -> {
                    val id = uri.substringAfterLast("/").toLong()
                    val body = mutableMapOf<String, String>()
                    session.parseBody(body)
                    val json = JSONObject(body["postData"] ?: "{}").put("id", id)
                    db.saveNote(json)
                    ok("""{"result":"ok"}""")
                }

                Regex("""/notes/\d+""").matches(uri) && meth == Method.DELETE -> {
                    db.deleteNote(uri.substringAfterLast("/").toLong())
                    ok("""{"result":"ok"}""")
                }

                uri == "/tags" && meth == Method.GET ->
                    ok(db.getTags().toString())

                else -> notFound()
            }
        } catch (e: Exception) {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, "application/json",
                """{"error":"${e.message?.replace("\"", "'")}"}"""
            )
        }
    }

    private fun ok(json: String): Response =
        newFixedLengthResponse(Response.Status.OK, "application/json", json)

    private fun notFound(): Response =
        newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"not found"}""")
}
