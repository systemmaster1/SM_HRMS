package `in`.systemmaster.hrms

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
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
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loadingView: View
    private lateinit var pageProgress: ProgressBar
    private lateinit var loadingText: TextView

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* WebView/native tracker re-checks permissions */ }

    // ---- <input type="file"> support (photo, logo, documents, CSV import) ----
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        callback?.onReceiveValue(parseChosenFiles(result.resultCode, result.data))
    }

    // ---- Camera for the web selfie screen (getUserMedia) ----
    private var pendingWebPermission: PermissionRequest? = null

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val req = pendingWebPermission
        pendingWebPermission = null
        if (req != null) {
            if (granted) req.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else req.deny()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        loadingView = findViewById(R.id.loadingView)
        pageProgress = findViewById(R.id.pageProgress)
        loadingText = findViewById(R.id.loadingText)

        requestRuntimePermissions()
        PushNotifications.createChannel(this)
        refreshPushToken()

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
                runOnUiThread { handleWebPermission(request) }
            }

            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                // Cancel any chooser that is still open.
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    val pick = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                    if (params?.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    fileChooserLauncher.launch(Intent.createChooser(pick, "Choose file"))
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    false
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, hasLocationPermission(), false)
            }
        }

        val initial = linkFrom(intent)
            ?: intent?.dataString?.takeIf { it.startsWith(BuildConfig.WEB_APP_URL) }
            ?: BuildConfig.WEB_APP_URL
        webView.loadUrl(initial)
    }

    /** A notification was tapped while the app was already open. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = linkFrom(intent)
            ?: intent.dataString?.takeIf { it.startsWith(BuildConfig.WEB_APP_URL) }
        if (url != null && ::webView.isInitialized) webView.loadUrl(url)
    }

    /** "/tasks" from a push notification -> full app URL. Only in-app paths are accepted. */
    private fun linkFrom(intent: Intent?): String? {
        val link = intent?.getStringExtra(PushNotifications.EXTRA_LINK) ?: return null
        return if (link.startsWith("/") && !link.startsWith("//")) BuildConfig.WEB_APP_URL + link else null
    }

    /** Gets this phone's Firebase token and tells the web page it is available. */
    private fun refreshPushToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) {
                    NativePrefs.setPushToken(this, token)
                    if (::webView.isInitialized) {
                        webView.post {
                            webView.evaluateJavascript(
                                "window.dispatchEvent(new Event('smhrms-push-token'));", null
                            )
                        }
                    }
                }
            }
        } catch (_: Exception) {
            // Firebase not configured in this build - the app still works without push.
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check after the user returns from notification settings.
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('smhrms-push-token'));", null)
        }
    }

    private fun openExternalIfNeeded(url: String): Boolean {
        return if (url.startsWith(BuildConfig.WEB_APP_URL)) {
            false
        } else {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: ActivityNotFoundException) {
                // No app can open this link (e.g. unknown scheme) - stay in the app.
            }
            true
        }
    }

    /** Returns the file(s) the user picked, or null if they cancelled. */
    private fun parseChosenFiles(resultCode: Int, data: Intent?): Array<Uri>? {
        if (resultCode != Activity.RESULT_OK || data == null) return null
        val clip = data.clipData
        if (clip != null && clip.itemCount > 0) {
            return Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
        }
        return data.data?.let { arrayOf(it) }
    }

    /**
     * Web pages may use the camera only on our own domain, and only the
     * camera (no microphone, no other resources).
     */
    private fun handleWebPermission(request: PermissionRequest?) {
        if (request == null) return
        val origin = request.origin?.toString() ?: ""
        val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (!origin.startsWith(BuildConfig.WEB_APP_URL) || !wantsCamera) {
            request.deny()
            return
        }
        val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (hasCamera) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } else {
            pendingWebPermission?.deny()
            pendingWebPermission = request
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
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
