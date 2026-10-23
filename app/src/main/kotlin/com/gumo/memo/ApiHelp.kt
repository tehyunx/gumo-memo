package com.gumo.memo

import android.content.Context
import org.json.JSONObject

/** One schema shared by Provider help and HTTP GET /help. No data operations. */
object ApiHelp {
    fun document(context: Context): JSONObject =
        JSONObject(context.assets.open("api-help.json").bufferedReader(Charsets.UTF_8).use { it.readText() })
            .put("version", context.packageManager.getPackageInfo(context.packageName, 0).versionName)
}
