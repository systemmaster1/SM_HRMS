package `in`.systemmaster.hrms

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.concurrent.Executors

class LocationTrackingService : Service() {
    companion object {
        const val ACTION_START = "in.systemmaster.hrms.START_TRACKING"
        const val ACTION_STOP = "in.systemmaster.hrms.STOP_TRACKING"
        private const val CHANNEL = "duty_tracking"
        private const val NOTIFICATION_ID = 2401
    }

    private lateinit var fused: FusedLocationProviderClient
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var callback: LocationCallback? = null
    private var lastLocationEnabled: Boolean? = null
    private var updatesStarted = false

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopTracking()
            else -> startTracking()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?) = null

    private fun startTracking() {
        if (!hasPermission()) {
            NativePrefs.setError(this, "Location permission not granted")
            stopSelf(); return
        }
        try {
            startForeground(NOTIFICATION_ID, notification("Checking duty status…"))
        } catch (e: SecurityException) {
            NativePrefs.setError(this, "Android blocked duty tracking permission")
            stopSelf()
            return
        } catch (e: IllegalStateException) {
            NativePrefs.setError(this, "Android blocked background tracking start")
            stopSelf()
            return
        }
        NativePrefs.setRunning(this, true)
        checkDutyThenStart()
        handler.post(healthLoop)
    }

    private fun checkDutyThenStart() {
        executor.execute {
            val onDuty = rpcBoolean("is_employee_on_duty_v7", JSONObject().put("p_employee_id", NativePrefs.str(this,"userId")))
            if (onDuty == false) {
                handler.post { stopTracking() }
            } else if (onDuty == true) {
                handler.post { requestUpdates() }
            } else {
                // No network: keep recording on the phone; the server checks
                // duty for every point when it is uploaded.
                handler.post { requestUpdates() }
                updateNotification("No network • recording duty GPS on phone")
            }
        }
    }

    @Suppress("MissingPermission")
    private fun requestUpdates() {
        callback?.let { fused.removeLocationUpdates(it) }
        updatesStarted = true
        val ms = NativePrefs.interval(this) * 60_000L
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, ms)
            .setMinUpdateIntervalMillis((ms / 2).coerceAtLeast(30_000L))
            .setMaxUpdateDelayMillis(ms + 30_000L)
            .build()
        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                // 1) Store on the phone FIRST, so no point is lost without network.
                GpsQueue.get(this@LocationTrackingService).add(
                    loc.latitude, loc.longitude, loc.accuracy.toInt(),
                    if (loc.hasSpeed()) loc.speed.toDouble() else null,
                    if (loc.hasBearing()) loc.bearing.toDouble() else null,
                    Instant.ofEpochMilli(if (loc.time > 0) loc.time else System.currentTimeMillis()).toString()
                )
                // 2) Upload whatever is queued (the server decides what is on duty).
                executor.execute { flushQueue(force = true) }
            }
        }
        try {
            fused.requestLocationUpdates(req, callback!!, Looper.getMainLooper())
        } catch (e: SecurityException) {
            updatesStarted = false
            NativePrefs.setError(this, "Location permission changed while tracking")
            updateNotification("Location permission required")
            return
        }
        updateNotification("Duty tracking active • GPS every ${NativePrefs.interval(this)} min")
    }

    private val healthLoop = object : Runnable {
        override fun run() {
            val manager=getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val enabled = manager.isLocationEnabled
            if (lastLocationEnabled != enabled) {
                val wasEnabled = lastLocationEnabled
                lastLocationEnabled = enabled
                if (!enabled) executor.execute {
                    rpc("record_tracking_state_v7", JSONObject()
                        .put("p_state","unavailable")
                        .put("p_reason","Android device Location services are OFF")
                        .put("p_app_state","android_native"))
                    NativePrefs.setError(this@LocationTrackingService,"Location services OFF")
                    updateNotification("Location OFF • turn GPS on to resume")
                } else if (wasEnabled == false) executor.execute {
                    rpc("record_tracking_state_v7", JSONObject()
                        .put("p_state","available")
                        .put("p_reason","Android device Location services restored")
                        .put("p_app_state","android_native"))
                    NativePrefs.setError(this@LocationTrackingService,"")
                    updateNotification("Location restored • tracking active")
                }
            }
            if (enabled && !updatesStarted && hasPermission()) requestUpdates()
            executor.execute {
                flushQueue(force = false)
                val duty = rpcBoolean("is_employee_on_duty_v7", JSONObject().put("p_employee_id", NativePrefs.str(this@LocationTrackingService,"userId")))
                if (duty == false) {
                    flushQueue(force = true) // last on-duty points before stopping
                    handler.post { stopTracking() }
                }
            }
            handler.postDelayed(this, 60_000L)
        }
    }

    private fun hasPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED

    private fun rpcBoolean(name:String, body:JSONObject): Boolean? {
        val (code, response) = request("${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/$name", body, true)
        if (code !in 200..299 || response == null) return null
        return when(response.trim()) { "true" -> true; "false" -> false; else -> null }
    }

    private fun rpc(name:String, body:JSONObject):Boolean =
        request("${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/$name", body, true).first in 200..299

    /**
     * Uploads queued points oldest-first in batches of 100. Points are removed
     * only after the server acknowledges them. On failure, waits with
     * exponential backoff (30 s … 15 min) unless [force] (a new GPS fix).
     */
    @Synchronized
    private fun flushQueue(force: Boolean) {
        if (!force && System.currentTimeMillis() < NativePrefs.nextFlushAt(this)) return
        val queue = GpsQueue.get(this)
        val url = "${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/record_employee_locations_batch_v8"
        var rounds = 0
        while (rounds++ < 20) {
            val batch = queue.nextBatch()
            if (batch.length() == 0) break
            val (code, response) = request(url, JSONObject().put("p_points", batch), true)
            if (code == 404) { uploadLegacy(batch); continue }
            if (code !in 200..299 || response == null) {
                NativePrefs.flushFailed(this)
                updateNotification("Offline • ${queue.count()} GPS points saved on phone • will upload automatically")
                return
            }
            val result = try { JSONObject(response) } catch (_: Exception) { null }
            val acked = result?.optJSONArray("acked")
            val ids = ArrayList<String>()
            if (acked != null) for (i in 0 until acked.length()) ids.add(acked.optString(i))
            queue.acknowledge(ids)
            NativePrefs.flushSucceeded(this)
            NativePrefs.setLastUpload(this, Instant.now().toString())
            NativePrefs.setError(this, "")
            if (result?.optBoolean("stop") == true && queue.count() == 0) {
                handler.post { stopTracking() }
                return
            }
            if (ids.isEmpty()) break // nothing acknowledged: avoid a busy loop
        }
        val left = queue.count()
        updateNotification(
            if (left > 0) "Duty tracking active • $left points waiting to upload"
            else "Duty tracking active • GPS every ${NativePrefs.interval(this)} min • last sync now"
        )
    }

    /** Server without the v8 batch function yet: send points one by one through v7. */
    private fun uploadLegacy(batch: org.json.JSONArray) {
        val ids = ArrayList<String>()
        for (i in 0 until batch.length()) {
            val p = batch.getJSONObject(i)
            val body = JSONObject()
                .put("p_latitude", p.getDouble("lat")).put("p_longitude", p.getDouble("lng"))
                .put("p_accuracy_m", p.opt("accuracy") ?: JSONObject.NULL)
                .put("p_speed_mps", p.opt("speed") ?: JSONObject.NULL)
                .put("p_heading", p.opt("heading") ?: JSONObject.NULL)
                .put("p_app_state", "android_native")
            val (code, _) = request("${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/record_employee_location_v7", body, true)
            if (code in 200..299) ids.add(p.getString("client_id")) else break
        }
        GpsQueue.get(this).acknowledge(ids)
    }

    private fun request(url:String, body:JSONObject, retry:Boolean): Pair<Int, String?> {
        val tokenUsed = NativePrefs.str(this,"accessToken")
        try {
            val con=URL(url).openConnection() as HttpURLConnection
            con.requestMethod="POST"; con.doOutput=true
            con.connectTimeout=12000; con.readTimeout=15000
            con.setRequestProperty("Content-Type","application/json")
            con.setRequestProperty("apikey",NativePrefs.str(this,"anonKey"))
            con.setRequestProperty("Authorization","Bearer $tokenUsed")
            con.outputStream.use { it.write(body.toString().toByteArray()) }
            val code=con.responseCode
            if (code in 200..299) return code to con.inputStream.bufferedReader().readText()
            if (code==401 && retry && refreshToken(tokenUsed)) return request(url,body,false)
            NativePrefs.setError(this,"HTTP $code")
            return code to null
        } catch(e:Exception) {
            NativePrefs.setError(this,"No network")
            return -1 to null
        }
    }

    /**
     * One session, two users of it (web app + this service). Refresh tokens
     * rotate, so before refreshing we check whether the web app already
     * delivered a newer access token; only if not do we refresh, and the new
     * pair is stored for the web app to pick up (NativeBridge.getSessionTokens).
     */
    @Synchronized
    private fun refreshToken(failedToken: String):Boolean {
        val current = NativePrefs.str(this,"accessToken")
        if (current.isNotBlank() && current != failedToken) return true // web app refreshed meanwhile
        val refresh=NativePrefs.str(this,"refreshToken")
        if(refresh.isBlank()) return false
        return try {
            val con=URL("${NativePrefs.str(this,"supabaseUrl")}/auth/v1/token?grant_type=refresh_token").openConnection() as HttpURLConnection
            con.requestMethod="POST"; con.doOutput=true; con.connectTimeout=12000; con.readTimeout=12000
            con.setRequestProperty("Content-Type","application/json")
            con.setRequestProperty("apikey",NativePrefs.str(this,"anonKey"))
            con.outputStream.use { it.write(JSONObject().put("refresh_token",refresh).toString().toByteArray()) }
            if(con.responseCode !in 200..299) {
                // The web app may have rotated the token a moment ago.
                return NativePrefs.str(this,"accessToken").let { it.isNotBlank() && it != failedToken }
            }
            val j=JSONObject(con.inputStream.bufferedReader().readText())
            NativePrefs.updateTokens(this,j.getString("access_token"),j.optString("refresh_token",refresh))
            true
        } catch(_:Exception){ false }
    }

    private fun createChannel() {
        if(Build.VERSION.SDK_INT>=26) {
            val nm=getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CHANNEL,"Duty location tracking",NotificationManager.IMPORTANCE_LOW).apply {
                description="Shows while authorized duty-time field tracking is active"
                setShowBadge(false)
            })
        }
    }
    private fun notification(text:String):Notification {
        val launch=packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, MainActivity::class.java)
        val pending=PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this,CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("SM HRMS • Duty Tracking")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pending)
            .build()
    }
    private fun updateNotification(text:String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID,notification(text))
    }
    /**
     * Off duty is a normal state, not an alert. Remove the foreground
     * notification immediately so employees do not see a permanent
     * "Employee Off Duty" Duty Tracking message outside working time.
     *
     * When duty becomes active again, the web bridge starts this service and
     * Android shows the foreground notification only while GPS tracking is
     * actually running.
     */
    private fun stopTracking() {
        callback?.let { fused.removeLocationUpdates(it) }; callback=null
        updatesStarted=false
        handler.removeCallbacks(healthLoop)
        NativePrefs.setRunning(this,false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
        stopSelf()
    }
    override fun onDestroy() {
        callback?.let { fused.removeLocationUpdates(it) }
        updatesStarted=false
        handler.removeCallbacks(healthLoop)
        executor.shutdownNow()
        NativePrefs.setRunning(this,false)
        super.onDestroy()
    }
}
