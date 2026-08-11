package `in`.systemmaster.hrms

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loadingView: View
    private lateinit var pageProgress: ProgressBar
    private lateinit var loadingText: TextView

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* WebView/native tracker re-checks permissions */ }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        loadingView = findViewById(R.id.loadingView)
        pageProgress = findViewById(R.id.pageProgress)
        loadingText = findViewById(R.id.loadingText)

        requestRuntimePermissions()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.setSupportZoom(false)
        webView.settings.userAgentString =
            webView.settings.userAgentString + " SMHRMS-Android/2.0"

        webView.addJavascriptInterface(NativeBridge(this), "SMHRMSNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return openExternalIfNeeded(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url?.let { openExternalIfNeeded(it) } ?: false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                loadingView.visibility = View.VISIBLE
                webView.visibility = View.INVISIBLE
                loadingText.text = "Opening secure workspace…"
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pageProgress.progress = 100
                view?.evaluateJavascript(
                    "window.__SM_HRMS_NATIVE__=true;window.dispatchEvent(new Event('smhrms-native-ready'));",
                    null
                )
                loadingView.animate().alpha(0f).setDuration(220).withEndAction {
                    loadingView.visibility = View.GONE
                    loadingView.alpha = 1f
                    webView.visibility = View.VISIBLE
                }.start()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    loadingView.visibility = View.VISIBLE
                    webView.visibility = View.INVISIBLE
                    loadingText.text = "Internet unavailable. Reconnect and reopen SM HRMS."
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                pageProgress.progress = newProgress.coerceIn(5, 100)
                loadingText.text = when {
                    newProgress < 35 -> "Connecting securely…"
                    newProgress < 75 -> "Loading your workspace…"
                    else -> "Almost ready…"
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread { request?.grant(request.resources) }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, hasLocationPermission(), false)
            }
        }

        val initial = intent?.dataString?.takeIf { it.startsWith(BuildConfig.WEB_APP_URL) }
            ?: BuildConfig.WEB_APP_URL
        webView.loadUrl(initial)
    }

    private fun openExternalIfNeeded(url: String): Boolean {
        return if (url.startsWith(BuildConfig.WEB_APP_URL)) {
            false
        } else {
            startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url)))
            true
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun requestRuntimePermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
