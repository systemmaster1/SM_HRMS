package `in`.systemmaster.hrms

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loadingView: View
    private lateinit var pageProgress: ProgressBar
    private lateinit var loadingText: TextView

    /**
     * True while the WebView shows our own web app. The JavaScript bridge
     * (SMHRMSNative) refuses to work for any other page, so a link to a
     * look-alike site can never read push tokens or redirect GPS uploads.
     */
    @Volatile var trustedPageLoaded: Boolean = false
        private set

    // Web page asked for location (navigator.geolocation) — answered after
    // the disclosure dialog and the Android permission prompt.
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var locationDisclosureShowing = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        val granted = hasLocationPermission()
        pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('smhrms-location-permission',{detail:${granted}}));", null
            )
        }
    }

    private var backgroundDisclosureShowing = false

    private val backgroundLocationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('smhrms-background-location',{detail:${granted}}));", null
            )
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('smhrms-push-token'));", null)
        }
    }

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

        // Permissions are requested contextually when a feature needs them.
        // Do not show camera/location permission dialogs on first launch.
        PushNotifications.createChannel(this)
        refreshPushToken()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.setSupportZoom(false)
        // Respect the phone's larger-text setting, but cap it so screens keep
        // their professional layout (very large system fonts break tables).
        webView.settings.textZoom = (resources.configuration.fontScale * 100).toInt().coerceIn(85, 115)
        webView.settings.userAgentString =
            webView.settings.userAgentString + " SMHRMS-Android/2.0"

        webView.addJavascriptInterface(NativeBridge(this) { trustedPageLoaded }, "SMHRMSNative")

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
                trustedPageLoaded = isAppUrl(url)
                loadingView.visibility = View.VISIBLE
                webView.visibility = View.INVISIBLE
                loadingText.text = "Opening secure workspace…"
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                trustedPageLoaded = isAppUrl(url)
                pageProgress.progress = 100
                maybeAskNotificationPermission(url)
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
                    // Friendly offline screen that retries by itself when the
                    // connection returns (instead of the browser's error page).
                    val failed = request.url?.toString() ?: BuildConfig.WEB_APP_URL
                    if (!failed.startsWith("file:")) {
                        view?.loadUrl("file:///android_asset/offline.html?u=" + Uri.encode(failed))
                    }
                    loadingView.visibility = View.GONE
                    webView.visibility = View.VISIBLE
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
                // Only our own web app may use location.
                if (!isAppUrl(origin)) {
                    callback?.invoke(origin, false, false)
                    return
                }
                if (hasLocationPermission()) {
                    callback?.invoke(origin, true, false)
                    return
                }
                // First time: explain, then ask Android for permission.
                pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
                pendingGeoOrigin = origin
                pendingGeoCallback = callback
                showLocationDisclosure()
            }
        }

        // Native app must open directly to authentication, never the marketing landing page.
        // Existing web session is preserved, so an already signed-in user is redirected to dashboard.
        val initial = linkFrom(intent)
            ?: intent?.dataString?.takeIf { isAppUrl(it) }
            ?: (BuildConfig.WEB_APP_URL.trimEnd('/') + "/login")
        webView.loadUrl(initial)
    }

    /** A notification was tapped while the app was already open. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = linkFrom(intent)
            ?: intent.dataString?.takeIf { isAppUrl(it) }
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

    /**
     * Exact origin check. A prefix check would also accept look-alike hosts
     * such as "https://hrms.systemmaster.in.example.com".
     */
    private fun isAppUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        return try {
            val u = Uri.parse(url)
            val app = Uri.parse(BuildConfig.WEB_APP_URL)
            u.scheme.equals("https", ignoreCase = true) &&
                u.host.equals(app.host, ignoreCase = true) &&
                (u.port == -1 || u.port == 443)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Prominent disclosure shown before Android's location prompt (Google
     * Play User Data policy). Text must match the Privacy Policy and Data
     * Safety form.
     */
    private fun showLocationDisclosure() {
        if (locationDisclosureShowing || isFinishing) return
        locationDisclosureShowing = true
        AlertDialog.Builder(this)
            .setTitle("Allow location for attendance and field work")
            .setMessage(
                "SM HRMS uses your phone's location to:\n\n" +
                "• record where you mark Attendance IN / OUT, when your organization requires it\n" +
                "• check in and out of customer visits\n" +
                "• if your organization has turned on Field Tracking for you: record your duty route and KM, also in the background with the screen off, ONLY between Attendance IN and Attendance OUT\n\n" +
                "Tracking stops when you mark Attendance OUT. Your location is visible only to authorized people in your organization (Owner/Admin and your reporting manager). " +
                "You can turn this off anytime in Android Settings."
            )
            .setCancelable(false)
            .setPositiveButton("Continue") { _, _ ->
                locationDisclosureShowing = false
                permissionLauncher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ))
            }
            .setNegativeButton("Not now") { _, _ ->
                locationDisclosureShowing = false
                pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
                pendingGeoCallback = null
                pendingGeoOrigin = null
            }
            .show()
    }

    /**
     * Second, separate disclosure for "Allow all the time" (background
     * location). Shown only to employees whose organization has Field
     * Tracking ON and who are individually enabled for it, after foreground
     * location is granted. Asked at most once a day if the person declines.
     */
    fun requestBackgroundLocationFromBridge() {
        runOnUiThread {
            if (Build.VERSION.SDK_INT < 29 || backgroundDisclosureShowing || isFinishing) return@runOnUiThread
            if (!hasLocationPermission()) return@runOnUiThread
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
                PackageManager.PERMISSION_GRANTED) return@runOnUiThread
            val prefs = getSharedPreferences("sm_hrms_ui", MODE_PRIVATE)
            val last = prefs.getLong("bg_location_asked_at", 0L)
            if (System.currentTimeMillis() - last < 24L * 60 * 60 * 1000) return@runOnUiThread
            prefs.edit().putLong("bg_location_asked_at", System.currentTimeMillis()).apply()
            backgroundDisclosureShowing = true
            AlertDialog.Builder(this)
                .setTitle("Allow duty tracking in the background")
                .setMessage(
                    "Your organization has turned on Field Tracking for you.\n\n" +
                    "To record your duty route and distance (KM) even when the screen is off or you are using another app, " +
                    "SM HRMS needs location access \"Allow all the time\".\n\n" +
                    "• Location is collected ONLY between your Attendance IN and Attendance OUT.\n" +
                    "• A \"Duty Tracking\" notification is always visible while tracking is on.\n" +
                    "• Tracking stops automatically at Attendance OUT.\n" +
                    "• Only your organization's Owner/Admin and your reporting manager can see it.\n" +
                    "• Your organization can switch Field Tracking off; you can change this permission anytime in Android Settings.\n\n" +
                    "On the next screen choose \"Allow all the time\"."
                )
                .setCancelable(false)
                .setPositiveButton("Continue") { _, _ ->
                    backgroundDisclosureShowing = false
                    backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                }
                .setNegativeButton("Not now") { _, _ -> backgroundDisclosureShowing = false }
                .show()
        }
    }

    /** Called by the bridge when the web app needs location for duty tracking. */
    fun requestLocationFromBridge() {
        runOnUiThread { if (!hasLocationPermission()) showLocationDisclosure() }
    }

    /**
     * Android 13+ blocks notifications until the user allows them. Ask once,
     * after sign-in (never on the login/sign-up screens).
     */
    private fun maybeAskNotificationPermission(url: String?) {
        if (Build.VERSION.SDK_INT < 33 || !isAppUrl(url)) return
        val path = try { Uri.parse(url).path ?: "" } catch (_: Exception) { "" }
        if (path == "/" || path.startsWith("/login") || path.startsWith("/signup") ||
            path.startsWith("/forgot-password") || path.startsWith("/onboarding")) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED) return
        val prefs = getSharedPreferences("sm_hrms_ui", MODE_PRIVATE)
        if (prefs.getBoolean("notif_permission_asked", false)) return
        prefs.edit().putBoolean("notif_permission_asked", true).apply()
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun openExternalIfNeeded(url: String): Boolean {
        return if (isAppUrl(url)) {
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
        if (!isAppUrl(origin) || !wantsCamera) {
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


    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
