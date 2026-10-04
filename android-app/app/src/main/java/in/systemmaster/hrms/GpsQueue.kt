package `in`.systemmaster.hrms

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Persistent on-phone queue of duty GPS points.
 *
 * Every point is written here FIRST and deleted only after the server
 * acknowledges it (record_employee_locations_batch_v8 returns its client_id).
 * Survives app process death, screen off and network loss. Bounded to
 * [MAX_POINTS]; when full, the oldest points are dropped first.
 */
class GpsQueue private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "sm_hrms_gps_queue.db", null, 1) {

    companion object {
        const val MAX_POINTS = 5000
        const val BATCH_SIZE = 100

        @Volatile private var instance: GpsQueue? = null
        fun get(context: Context): GpsQueue =
            instance ?: synchronized(this) { instance ?: GpsQueue(context).also { instance = it } }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE points(
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 client_id TEXT NOT NULL UNIQUE,
                 lat REAL NOT NULL, lng REAL NOT NULL,
                 accuracy INTEGER, speed REAL, heading REAL,
                 captured_at TEXT NOT NULL,
                 attempts INTEGER NOT NULL DEFAULT 0)"""
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { /* v1 */ }

    @Synchronized
    fun add(lat: Double, lng: Double, accuracy: Int?, speed: Double?, heading: Double?, capturedAtIso: String) {
        val db = writableDatabase
        db.insert("points", null, ContentValues().apply {
            put("client_id", UUID.randomUUID().toString())
            put("lat", lat); put("lng", lng)
            if (accuracy != null) put("accuracy", accuracy) else putNull("accuracy")
            if (speed != null) put("speed", speed) else putNull("speed")
            if (heading != null) put("heading", heading) else putNull("heading")
            put("captured_at", capturedAtIso)
        })
        // Bounded storage: keep only the newest MAX_POINTS.
        db.execSQL(
            "DELETE FROM points WHERE id NOT IN (SELECT id FROM points ORDER BY id DESC LIMIT $MAX_POINTS)"
        )
    }

    @Synchronized
    fun count(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM points", null).use {
        if (it.moveToFirst()) it.getInt(0) else 0
    }

    /** Oldest points first, as the JSON array the server expects. */
    @Synchronized
    fun nextBatch(limit: Int = BATCH_SIZE): JSONArray {
        val out = JSONArray()
        readableDatabase.rawQuery(
            "SELECT client_id, lat, lng, accuracy, speed, heading, captured_at FROM points ORDER BY id ASC LIMIT ?",
            arrayOf(limit.toString())
        ).use { c ->
            while (c.moveToNext()) {
                out.put(JSONObject().apply {
                    put("client_id", c.getString(0))
                    put("lat", c.getDouble(1)); put("lng", c.getDouble(2))
                    put("accuracy", if (c.isNull(3)) JSONObject.NULL else c.getInt(3))
                    put("speed", if (c.isNull(4)) JSONObject.NULL else c.getDouble(4))
                    put("heading", if (c.isNull(5)) JSONObject.NULL else c.getDouble(5))
                    put("captured_at", c.getString(6))
                })
            }
        }
        return out
    }

    @Synchronized
    fun acknowledge(clientIds: List<String>) {
        if (clientIds.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            clientIds.forEach { db.delete("points", "client_id = ?", arrayOf(it)) }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /** Sign-out on this phone: queued points must never upload under another account. */
    @Synchronized
    fun clear() { writableDatabase.delete("points", null, null) }
}
