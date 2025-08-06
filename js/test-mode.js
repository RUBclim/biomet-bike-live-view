// Test Mode Module for Biomet Live View
// This module handles test data generation and test mode functionality

// Test data generation variables
let testDataCounter = 0;
let testBaseLocation = { lat: 51.51448, lon: 7.46523 }; // Starting location

function generateTestData() {
  testDataCounter++;
  
  // Simulate movement at ~5 m/s (18 km/h)
  // At 1 second intervals, we move about 5 meters
  // 1 degree latitude ≈ 111,000 meters, so 5m ≈ 0.000045 degrees
  // 1 degree longitude ≈ 78,000 meters at Berlin latitude, so 5m ≈ 0.000064 degrees
  
  const time = Date.now() / 1000; // seconds since epoch
  const speed = 5; // m/s
  const secondsElapsed = testDataCounter; // each call is 1 second apart
  
  // Create a more realistic movement pattern (like following streets)
  const baseDirection = Math.sin(testDataCounter * 0.02) * Math.PI; // Slowly changing direction
  const randomDirection = (Math.random() - 0.5) * 0.3; // Small random variations
  const actualDirection = baseDirection + randomDirection;
  
  // Calculate movement in meters, then convert to degrees
  const deltaLat = (speed * Math.cos(actualDirection)) / 111000; // meters to degrees lat
  const deltaLon = (speed * Math.sin(actualDirection)) / (111000 * Math.cos(testBaseLocation.lat * Math.PI / 180)); // meters to degrees lon
  
  // Update base location for continuous movement
  testBaseLocation.lat += deltaLat;
  testBaseLocation.lon += deltaLon;
  
  // Add some small random noise to simulate GPS accuracy
  const gpsNoiseLat = (Math.random() - 0.5) * 0.00001; // ~1m accuracy noise
  const gpsNoiseLon = (Math.random() - 0.5) * 0.00001;
  
  const currentLat = testBaseLocation.lat + gpsNoiseLat;
  const currentLon = testBaseLocation.lon + gpsNoiseLon;
  
  // Generate realistic values for each field
  const testValues = [
    (12.5 + Math.random() * 0.5).toFixed(2), // BattV - Battery voltage around 12.5V
    (25 + Math.random() * 10).toFixed(2), // PTemp_C - Panel temperature
    (20 + 5 * Math.sin(time / 3600) + Math.random() * 2).toFixed(2), // AirTC - Air temperature with daily cycle
    (60 + 20 * Math.sin(time / 7200) + Math.random() * 5).toFixed(1), // RH - Relative humidity
    (22 + 3 * Math.sin(time / 3600) + Math.random()).toFixed(2), // Black_Globe_C
    (21 + 4 * Math.sin(time / 3600) + Math.random()).toFixed(2), // mrt_blg
    (Math.random() * 360).toFixed(1), // WindDir - Wind direction 0-360°
    (Math.random() * 360).toFixed(1), // TrueWindDir
    (2 + Math.random() * 8).toFixed(2), // WS_ms - Wind speed 2-10 m/s
    (2 + Math.random() * 8).toFixed(2), // TrueWS_ms
    "0", // WSDiag
    (300 + 400 * Math.sin(time / 3600) + Math.random() * 50).toFixed(1), // ShortWaveRadUp
    (200 + 600 * Math.sin(time / 3600) + Math.random() * 100).toFixed(1), // ShortWaveRadDown
    (400 + Math.random() * 50).toFixed(1), // LongWaveRadUp
    (300 + Math.random() * 50).toFixed(1), // LongWaveRadDown
    (25 + Math.random() * 5).toFixed(2), // NR01UpDownTempC
    (298 + Math.random() * 5).toFixed(2), // NR01UpDownTempK
    "100", // NetShortWaveRadUpDown
    "100", // NetLongWaveRadUpDown
    (0.15 + Math.random() * 0.1).toFixed(2), // AlbedoUpDown
    (500 + Math.random() * 100).toFixed(1), // TotalRadUp
    (800 + Math.random() * 200).toFixed(1), // TotalRadDown
    "300", // TotalNetRadUpDown
    (400 + Math.random() * 50).toFixed(1), // LongWaveRadUpTCorr
    (300 + Math.random() * 50).toFixed(1), // LongWaveRadDownTCorr
    (250 + 350 * Math.sin(time / 3600) + Math.random() * 50).toFixed(1), // ShortWaveRadFwd
    (250 + 350 * Math.sin(time / 3600) + Math.random() * 50).toFixed(1), // ShortWaveRadAft
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadFwd
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadAft
    (25 + Math.random() * 3).toFixed(2), // NR01FwdAftTempC
    (298 + Math.random() * 3).toFixed(2), // NR01FwdAftTempK
    "0", // NetShortWaveRadFwdAft
    "0", // NetLongWaveRadFwdAft
    (0.15 + Math.random() * 0.05).toFixed(2), // AlbedoFwdAft
    (630 + Math.random() * 100).toFixed(1), // TotalRadFwd
    (630 + Math.random() * 100).toFixed(1), // TotalRadAft
    "0", // TotalNetRadFwdAft
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadFwdTCorr
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadAftTCorr
    (250 + 350 * Math.sin(time / 3600) + Math.random() * 50).toFixed(1), // ShortWaveRadLeft
    (250 + 350 * Math.sin(time / 3600) + Math.random() * 50).toFixed(1), // ShortWaveRadRight
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadLeft
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadRight
    (25 + Math.random() * 3).toFixed(2), // NR01LeftRightTempC
    (298 + Math.random() * 3).toFixed(2), // NR01LeftRightTempK
    "0", // NetShortWaveRadLeftRight
    "0", // NetLongWaveRadLeftRight
    (0.15 + Math.random() * 0.05).toFixed(2), // AlbedoLeftRight
    (630 + Math.random() * 100).toFixed(1), // TotalRadLeft
    (630 + Math.random() * 100).toFixed(1), // TotalRadRight
    "0", // TotalNetRadLeftRight
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadLeftTCorr
    (380 + Math.random() * 40).toFixed(1), // LongWaveRadRightTCorr
    (21 + 3 * Math.sin(time / 3600) + Math.random()).toFixed(1), // mrt_nr01
    Math.floor(currentLat).toString(), // Latitude_Degrees
    ((currentLat - Math.floor(currentLat)) * 60).toFixed(3), // Latitude_Minutes
    currentLat.toFixed(6), // Latitude - 6 decimal places for precision
    Math.floor(currentLon).toString(), // Longitude_Degrees
    ((currentLon - Math.floor(currentLon)) * 60).toFixed(3), // Longitude_Minutes
    currentLon.toFixed(6), // Longitude - 6 decimal places for precision
    (4 + Math.random() * 2).toFixed(1), // Speed - around 5 km/h
    (speed + (Math.random() - 0.5) * 1).toFixed(2), // Speed_ms - around 5 m/s with some variation
    ((actualDirection * 180 / Math.PI + 360) % 360).toFixed(1), // Course - direction of movement
    "0", // MagVar
    Math.floor(Math.random() * 3).toString(), // FixQual (0-2)
    (8 + Math.floor(Math.random() * 5)).toString(), // NumSats (8-12)
    (100 + Math.random() * 50).toFixed(1), // Altitude
    "1", // PPS
    "0", // SecSinceGPRMC
    "1", // GPSReady
    "0", // MaxClockChange
    "0", // NumClockChange
    (2000 + Math.random() * 500).toFixed(0), // TS100SS_Fan_RPM
    (2.5 + Math.random() * 0.5).toFixed(2), // SatVapPress
    (1.8 + Math.random() * 0.4).toFixed(2), // VapPress
    (15 + 3 * Math.sin(time / 3600) + Math.random()).toFixed(1), // DewPointC
  ];
  
  return testValues.join(',');
}

function toggleTestMode() {
  // Check if test mode is enabled in production config
  if (typeof ENABLE_TEST_MODE !== 'undefined' && !ENABLE_TEST_MODE) {
    console.warn('Test mode is disabled in production configuration');
    return;
  }
  
  if (isTestMode) {
    // Stop test mode
    stopTestMode();
  } else {
    // Start test mode
    startTestMode();
  }
}

function startTestMode() {
  if (isTestMode) {
    return; // Already in test mode
  }
  
  // Disconnect any existing serial connection first
  if (isConnected && !isTestMode) {
    disconnect();
  }
  
  // Simulate connection without actual serial port
  isConnected = true;
  isTestMode = true;
  reader = null; // This will trigger test data generation
  writer = null;
  
  document.getElementById("status").innerHTML =
    '<div class="alert alert-info text-center" role="alert">Test Mode Active - Generating simulated biomet data...</div>';
  
  // Update button appearance
  const testButton = document.querySelector('button[onclick="toggleTestMode()"]');
  if (testButton) {
    testButton.textContent = 'Stop Test';
    testButton.className = 'btn btn-danger mx-2';
  }
  
  // Start polling with test data
  startPolling();
}

function stopTestMode() {
  if (!isTestMode) {
    return; // Not in test mode
  }
  
  // Stop polling
  stopPolling();
  
  // Reset state
  isConnected = false;
  isTestMode = false;
  reader = null;
  writer = null;
  
  // Clear all stored data
  dataHistory = [];
  
  // Destroy any open chart
  destroyChart();
  
  document.getElementById("status").innerHTML =
    '<div class="alert alert-success text-center" role="alert">Test Mode stopped. All data cleared.</div>';
  
  // Update button appearance
  const testButton = document.querySelector('button[onclick="toggleTestMode()"]');
  if (testButton) {
    testButton.textContent = 'Test Mode';
    testButton.className = 'btn btn-warning mx-2';
  }
  
  // Clear data display - reset all fields to NaN
  for (let variable of BIOMET_BIKE_FIELDS_SELECTION) {
    const element = document.getElementById(variable);
    if (element) {
      const unit = BIOMET_BIKE_PARAMS[variable]?.unit || "";
      element.innerHTML = `NaN&nbsp;<span class="text-secondary">${unit}</span>`;
    }
  }
  
  // Clear date/time displays
  document.getElementById("date-time-utc").innerHTML = "";
  document.getElementById("date-time-local").innerHTML = "";
  
  // Reset test data counter and location
  resetTestData();
}

function resetTestData() {
  testDataCounter = 0;
  testBaseLocation = { lat: 51.51448, lon: 7.46523 }; // Reset to starting coordinates
}
