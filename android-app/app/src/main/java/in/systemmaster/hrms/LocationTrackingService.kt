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

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopTracking("Employee Off Duty")
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
        startForeground(NOTIFICATION_ID, notification("Checking duty status…"))
        NativePrefs.setRunning(this, true)
        checkDutyThenStart()
        handler.post(healthLoop)
    }

    private fun checkDutyThenStart() {
        executor.execute {
            val onDuty = rpcBoolean("is_employee_on_duty_v7", JSONObject().put("p_employee_id", NativePrefs.str(this,"userId")))
            if (onDuty == false) {
                handler.post { stopTracking("Employee Off Duty") }
            } else if (onDuty == true) {
                handler.post { requestUpdates() }
            } else {
                updateNotification("Waiting for network / duty verification")
            }
        }
    }

    @Suppress("MissingPermission")
    private fun requestUpdates() {
        callback?.let { fused.removeLocationUpdates(it) }
        val ms = NativePrefs.interval(this) * 60_000L
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, ms)
            .setMinUpdateIntervalMillis((ms / 2).coerceAtLeast(30_000L))
            .setMaxUpdateDelayMillis(ms + 30_000L)
            .build()
        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                executor.execute {
                    val onDuty = rpcBoolean("is_employee_on_duty_v7", JSONObject().put("p_employee_id", NativePrefs.str(this@LocationTrackingService,"userId")))
                    if (onDuty == false) {
                        handler.post { stopTracking("Employee Off Duty") }; return@execute
                    }
                    if (onDuty != true) return@execute
                    val body = JSONObject()
                        .put("p_latitude", loc.latitude)
                        .put("p_longitude", loc.longitude)
                        .put("p_accuracy_m", loc.accuracy.toInt())
                        .put("p_speed_mps", if (loc.hasSpeed()) loc.speed.toDouble() else JSONObject.NULL)
                        .put("p_heading", if (loc.hasBearing()) loc.bearing.toDouble() else JSONObject.NULL)
                        .put("p_app_state", "android_native")
                    val ok = rpc("record_employee_location_v7", body)
                    if (ok) {
                        val now=Instant.now().toString()
                        NativePrefs.setLastUpload(this@LocationTrackingService, now)
                        NativePrefs.setError(this@LocationTrackingService, "")
                        updateNotification("Live tracking • last sync now • every ${NativePrefs.interval(this@LocationTrackingService)} min")
                    }
                }
            }
        }
        fused.requestLocationUpdates(req, callback!!, Looper.getMainLooper())
        updateNotification("Duty tracking active • GPS every ${NativePrefs.interval(this)} min")
    }

    private val healthLoop = object : Runnable {
        override fun run() {
            val manager=getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val enabled = manager.isLocationEnabled
            if (lastLocationEnabled != enabled) {
                lastLocationEnabled = enabled
                if (!enabled) executor.execute {
                    rpc("record_tracking_state_v7", JSONObject()
                        .put("p_state","unavailable")
                        .put("p_reason","Android device Location services are OFF")
                        .put("p_app_state","android_native"))
                    NativePrefs.setError(this@LocationTrackingService,"Location services OFF")
                    updateNotification("Location OFF • turn GPS on to resume")
                }
            }
            executor.execute {
                val duty = rpcBoolean("is_employee_on_duty_v7", JSONObject().put("p_employee_id", NativePrefs.str(this@LocationTrackingService,"userId")))
                if (duty == false) handler.post { stopTracking("Employee Off Duty") }
            }
            handler.postDelayed(this, 60_000L)
        }
    }

    private fun hasPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED

    private fun rpcBoolean(name:String, body:JSONObject): Boolean? {
        val response=request("${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/$name", body, true) ?: return null
        return when(response.trim()) { "true" -> true; "false" -> false; else -> null }
    }
    private fun rpc(name:String, body:JSONObject):Boolean = request("${NativePrefs.str(this,"supabaseUrl")}/rest/v1/rpc/$name", body, true) != null

    private fun request(url:String, body:JSONObject, retry:Boolean):String? {
        try {
            val con=URL(url).openConnection() as HttpURLConnection
            con.requestMethod="POST"; con.doOutput=true
            con.connectTimeout=12000; con.readTimeout=12000
            con.setRequestProperty("Content-Type","application/json")
            con.setRequestProperty("apikey",NativePrefs.str(this,"anonKey"))
            con.setRequestProperty("Authorization","Bearer ${NativePrefs.str(this,"accessToken")}")
            con.outputStream.use { it.write(body.toString().toByteArray()) }
            val code=con.responseCode
            if (code in 200..299) return con.inputStream.bufferedReader().readText()
            if (code==401 && retry && refreshToken()) return request(url,body,false)
            NativePrefs.setError(this,"HTTP $code")
        } catch(e:Exception) { NativePrefs.setError(this,e.message ?: "Network error") }
        return null
    }

    private fun refreshToken():Boolean {
        val refresh=NativePrefs.str(this,"refreshToken")
        if(refresh.isBlank()) return false
        return try {
            val con=URL("${NativePrefs.str(this,"supabaseUrl")}/auth/v1/token?grant_type=refresh_token").openConnection() as HttpURLConnection
            con.requestMethod="POST"; con.doOutput=true; con.connectTimeout=12000; con.readTimeout=12000
            con.setRequestProperty("Content-Type","application/json")
            con.setRequestProperty("apikey",NativePrefs.str(this,"anonKey"))
            con.outputStream.use { it.write(JSONObject().put("refresh_token",refresh).toString().toByteArray()) }
            if(con.responseCode !in 200..299) return false
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
    private fun stopTracking(reason:String) {
        callback?.let { fused.removeLocationUpdates(it) }; callback=null
        handler.removeCallbacks(healthLoop)
        NativePrefs.setRunning(this,false)
        updateNotification(reason)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
    override fun onDestroy() {
        callback?.let { fused.removeLocationUpdates(it) }
        handler.removeCallbacks(healthLoop)
        executor.shutdownNow()
        NativePrefs.setRunning(this,false)
        super.onDestroy()
    }
}
