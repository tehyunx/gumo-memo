package com.gumo.memo

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var db: DatabaseHelper
    private lateinit var jsInterface: JsInterface

    private val REQ_PICK_IMAGE = 1001
    private val REQ_CAPTURE_IMAGE = 1002
    private var cameraImageFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        db = DatabaseHelper(this)
        jsInterface = JsInterface(
            context = this,
            db = db,
            onPickImage = { launchImagePicker() },
            onCaptureImage = { launchCamera() }
        )

        // ShareActivity에서 전달된 데이터
        intent?.getStringExtra("shared_text")?.let { jsInterface.pendingSharedText = it }
        intent?.getStringExtra("shared_image_path")?.let { jsInterface.pendingSharedImagePath = it }

        webView = findViewById(R.id.webview)
        setupWebView()
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = true
            setSupportZoom(false)
            textZoom = 100  // 시스템 폰트 크기 설정이 CSS를 덮어쓰지 않도록
        }
        webView.addJavascriptInterface(jsInterface, "Android")
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (!url.startsWith("file://")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
                return false
            }
        }
    }

    private fun launchImagePicker() {
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        startActivityForResult(intent, REQ_PICK_IMAGE)
    }

    private fun launchCamera() {
        val dir = File(cacheDir, "camera").apply { mkdirs() }
        cameraImageFile = File(dir, "${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "com.gumo.memo.fileprovider", cameraImageFile!!)
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
        }
        startActivityForResult(intent, REQ_CAPTURE_IMAGE)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != Activity.RESULT_OK) return
        when (requestCode) {
            REQ_PICK_IMAGE -> {
                val uri = data?.data ?: return
                val path = jsInterface.saveImageToStorage(uri)
                webView.evaluateJavascript("window.onImagePicked('$path')", null)
            }
            REQ_CAPTURE_IMAGE -> {
                val file = cameraImageFile ?: return
                if (file.exists()) {
                    webView.evaluateJavascript("window.onImagePicked('${file.absolutePath}')", null)
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.onAndroidBack && window.onAndroidBack()") { result ->
            if (result == "null" || result == "false") super.onBackPressed()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.getStringExtra("shared_text")?.let {
            jsInterface.pendingSharedText = it
            webView.evaluateJavascript("window.checkShared && window.checkShared()", null)
        }
        intent?.getStringExtra("shared_image_path")?.let {
            jsInterface.pendingSharedImagePath = it
            webView.evaluateJavascript("window.checkShared && window.checkShared()", null)
        }
    }
}
