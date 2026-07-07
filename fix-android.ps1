$ErrorActionPreference = "Stop"
$pluginBuildGradle = "android\capacitor-cordova-android-plugins\build.gradle"
$capacitorBuildGradle = "android\app\capacitor.build.gradle"

Write-Host "1/3 Building for Android..." -ForegroundColor Cyan
npm run build:android
if (-not $?) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }

Write-Host "2/3 Syncing Capacitor..." -ForegroundColor Cyan
npx cap sync android
if (-not $?) { Write-Host "Cap sync failed." -ForegroundColor Red; exit 1 }

Write-Host "3/3 Applying Gradle fixes..." -ForegroundColor Cyan

# --- Fix 1: capacitor-cordova-android-plugins/build.gradle ---
$content = Get-Content $pluginBuildGradle -Raw
# Fix AGP version
$content = $content -replace "classpath 'com\.android\.tools\.build:gradle:8\.13\.0'", "classpath 'com.android.tools.build:gradle:8.9.1'"
# Fix Java version 21 -> 17
$content = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
$content | Set-Content $pluginBuildGradle -NoNewline

# --- Fix 2: app/capacitor.build.gradle — Java 21 -> 17, add kotlinOptions if missing ---
if (Test-Path $capacitorBuildGradle) {
    $capContent = (Get-Content $capacitorBuildGradle -Raw) -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
    if ($capContent -notmatch "kotlinOptions") {
        $capContent = $capContent -replace '(compileOptions \{[^}]+\})', '$1
  kotlinOptions {
      jvmTarget = "17"
  }'
    }
    $capContent | Set-Content $capacitorBuildGradle -NoNewline
}

# --- Fix 3: node_modules capacitor-android Java 21 -> 17 ---
$nodeCapacitorGradle = "node_modules\@capacitor\android\capacitor\build.gradle"
if (Test-Path $nodeCapacitorGradle) {
    (Get-Content $nodeCapacitorGradle -Raw) -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17' |
        Set-Content $nodeCapacitorGradle -NoNewline
}

$nodeFirebaseGradle = "node_modules\@capacitor-firebase\authentication\android\build.gradle"
if (Test-Path $nodeFirebaseGradle) {
    (Get-Content $nodeFirebaseGradle -Raw) -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17' |
        Set-Content $nodeFirebaseGradle -NoNewline
}

# --- Fix 4: rimuovi MainActivity.java se cap sync lo ricrea (conflitto con .kt) ---
$mainActivityJava = "android\app\src\main\java\com\flavio\glp\MainActivity.java"
if (Test-Path $mainActivityJava) {
    Remove-Item $mainActivityJava -Force
    Write-Host "Removed duplicate MainActivity.java" -ForegroundColor Yellow
}

Write-Host "Done. Open Android Studio and press Run." -ForegroundColor Green
