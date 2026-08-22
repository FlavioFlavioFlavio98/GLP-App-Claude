package com.flavio.glp

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class GoogleFitManager(private val context: Context) {

    companion object {
        const val TAG = "FitSync"

        val PERMISSIONS = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class)
        )
    }

    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    // Mantenuto per compatibilità con FitSyncService (chiamato in modo sync nel check)
    fun isAuthorized(): Boolean = false  // usare isAuthorizedSuspend() nelle coroutine

    suspend fun isAuthorizedSuspend(): Boolean {
        if (!isAvailable()) return false
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        return granted.containsAll(PERMISSIONS)
    }

    suspend fun readTodaySteps(): Int {
        val client = HealthConnectClient.getOrCreate(context)
        val today = LocalDate.now()
        val startTime = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
        val endTime = Instant.now()

        Log.d(TAG, "Reading steps from Health Connect: $startTime to $endTime")

        val response = client.readRecords(
            ReadRecordsRequest(
                recordType = StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
            )
        )

        val total = response.records.sumOf { it.count }.toInt()
        Log.d(TAG, "Health Connect steps: $total (from ${response.records.size} records)")
        return total
    }

    suspend fun readLastNightSleepHours(): Float {
        val client = HealthConnectClient.getOrCreate(context)
        val yesterday = LocalDate.now().minusDays(1)
        val startTime = yesterday.atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant()
        val endTime = Instant.now()

        Log.d(TAG, "Reading sleep from Health Connect: $startTime to $endTime")

        val response = client.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
            )
        )

        var totalMinutes = 0L
        for (session in response.records) {
            val durationMs = session.endTime.toEpochMilli() - session.startTime.toEpochMilli()
            totalMinutes += durationMs / 60000
            Log.d(TAG, "Sleep session: ${durationMs / 60000} min")
        }

        val hours = totalMinutes / 60f
        Log.d(TAG, "Total sleep: ${hours}h")
        return hours
    }
}
