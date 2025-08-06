// Biomet Live View JavaScript

// PRODUCTION CONFIG: Set to false to disable test mode button in production
const ENABLE_TEST_MODE = false;

let isConnected = false;
let isPolling = false;
let reader = null;
let writer = null;
let chart = null;
let map = null;
let gpsMarkers = [];
let currentPositionMarker = null;

// Update the global variables
let dataHistory = [];
let maxDataPoints = 3600; // 1 hour of data at 1-second intervals

// Add a global variable to track the current chart parameter
let currentChartParameter = null;

// Add a global variable to track test mode state
let isTestMode = false;

// Add a global variable to track auto-follow state for the map
let isAutoFollowEnabled = true;

async function ConnectToSerial() {
  // If in test mode, stop it first
  if (isTestMode) {
    stopTestMode();
  }

  if ("serial" in navigator) {
    try {
      /* request permission to access serial ports */
      const selectedPort = await navigator.serial.requestPort();
      /*store port in global variable for later use*/
      window.selectedPort = selectedPort;

      // Open the port immediately
      await window.selectedPort.open({ baudRate: 115200 });

      // Get reader and writer
      reader = window.selectedPort.readable.getReader();
      writer = window.selectedPort.writable.getWriter();

      isConnected = true;
      document.getElementById("status").innerHTML =
        '<div class="alert alert-success text-center" role="alert">Connected to Serial Device. Polling started...</div>';

      // Start polling automatically
      startPolling();
    } catch (error) {
      document.getElementById("status").innerHTML =
        '<div class="alert alert-danger text-center" role="alert">Failed to connect: ' +
        error.message +
        "</div>";
    }
  } else {
    document.getElementById("status").innerHTML =
      '<div class="alert alert-danger text-center" role="alert">Web Serial API is not supported in this browser.</div>';
  }
}

async function disconnect() {
  try {
    // Stop polling first
    stopPolling();

    // If in test mode, use the stop test mode function instead
    if (isTestMode) {
      stopTestMode();
      return;
    }

    // Release reader and writer
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }
    if (writer) {
      writer.releaseLock();
      writer = null;
    }

    // Close port
    if (window.selectedPort) {
      await window.selectedPort.close();
      window.selectedPort = null;
    }

    isConnected = false;

    // Clear all stored data
    dataHistory = [];

    // Destroy any open chart
    destroyChart();

    document.getElementById("status").innerHTML =
      '<div class="alert alert-success text-center" role="alert">Disconnected from Serial Device. Polling stopped. Data cleared.</div>';

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
  } catch (error) {
    document.getElementById("status").innerHTML =
      '<div class="alert alert-danger text-center" role="alert">Failed to disconnect: ' +
      error.message +
      "</div>";
  }
}

const BIOMET_BIKE_PARAMS = {
  BattV: {
    unit: "V",
    alias: "Battery Voltage",
    ndigits: 2,
  },
  AirTC: {
    unit: "°C",
    alias: "Air Temperature",
    ndigits: 2,
  },
  RH: {
    unit: "%",
    alias: "Relative Humidity",
    ndigits: 1,
  },
  SatVapPress: {
    unit: "kPa",
    alias: "Saturation Vapour Pressure",
    ndigits: 2,
  },
  VapPress: {
    unit: "kPa",
    alias: "Vapour Pressure",
    ndigits: 2,
  },
  DewPointC: {
    unit: "°C",
    alias: "Dew Point",
    ndigits: 1,
  },
  Black_Globe_C: {
    unit: "°C",
    alias: "Black Globe Temperature",
    ndigits: 2,
  },
  mrt_blg: {
    unit: "°C",
    alias: "BLG Tmrt",
    ndigits: 2,
  },
  WindDir: {
    unit: "°",
    alias: "Wind Direction",
    ndigits: 1,
  },
  WS_ms: {
    unit: "m/s",
    alias: "Wind Speed",
    ndigits: 2,
  },
  TrueWindDir: {
    unit: "°",
    alias: "True Wind Direction",
    ndigits: 1,
  },
  TrueWS_ms: {
    unit: "m/s",
    alias: "True Wind Speed",
    ndigits: 2,
  },
  ShortWaveRadUp: {
    unit: "W/m²",
    alias: "SW Radiation Up",
    ndigits: 1,
  },
  ShortWaveRadDown: {
    unit: "W/m²",
    alias: "SW Radiation Down",
    ndigits: 1,
  },
  LongWaveRadUpTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Up",
    ndigits: 1,
  },
  LongWaveRadDownTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Down",
    ndigits: 1,
  },
  AlbedoUpDown: {
    unit: "",
    alias: "Albedo (Up/Down)",
    ndigits: 2,
  },
  ShortWaveRadFwd: {
    unit: "W/m²",
    alias: "SW Radiation Forward",
    ndigits: 1,
  },
  ShortWaveRadAft: {
    unit: "W/m²",
    alias: "SW Radiation Aft",
    ndigits: 1,
  },
  LongWaveRadFwdTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Forward",
    ndigits: 1,
  },
  LongWaveRadAftTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Aft",
    ndigits: 1,
  },
  ShortWaveRadLeft: {
    unit: "W/m²",
    alias: "SW Radiation Left",
    ndigits: 1,
  },
  ShortWaveRadRight: {
    unit: "W/m²",
    alias: "SW Radiation Right",
    ndigits: 1,
  },
  LongWaveRadLeft: {
    unit: "W/m²",
    alias: "LW Radiation Left",
    ndigits: 1,
  },
  LongWaveRadRight: {
    unit: "W/m²",
    alias: "LW Radiation Right",
    ndigits: 1,
  },
  LongWaveRadLeftTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Left",
    ndigits: 1,
  },
  LongWaveRadRightTCorr: {
    unit: "W/m²",
    alias: "LW Radiation Right",
    ndigits: 1,
  },
  mrt_nr01: {
    unit: "°C",
    alias: "NR01 Tmrt",
    ndigits: 1,
  },
  Latitude: {
    unit: "°",
    ndigits: 5,
  },
  Longitude: {
    unit: "°",
    ndigits: 5,
  },
  Speed_ms: {
    unit: "m/s",
    alias: "Speed",
    ndigits: 2,
  },
  Course: {
    unit: "°",
    ndigits: 1,
  },
  FixQual: {
    unit: "",
    alias: "Fix Quality",
    ndigits: 0,
  },
  NumSats: {
    unit: "",
    alias: "Number of Satellites",
    ndigits: 0,
  },
  Altitude: {
    unit: "m",
    ndigits: 1,
  },
};

// Helper function to format values with proper precision
function formatValue(fieldName, value) {
  const param = BIOMET_BIKE_PARAMS[fieldName];
  if (!param) return value;

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;

  return numValue.toFixed(param.ndigits);
}

// Field names corresponding to the comma-separated values
const BIOMET_BIKE_FIELDS = [
  "BattV",
  "PTemp_C",
  "AirTC",
  "RH",
  "Black_Globe_C",
  "mrt_blg",
  "WindDir",
  "TrueWindDir",
  "WS_ms",
  "TrueWS_ms",
  "WSDiag",
  "ShortWaveRadUp",
  "ShortWaveRadDown",
  "LongWaveRadUp",
  "LongWaveRadDown",
  "NR01UpDownTempC",
  "NR01UpDownTempK",
  "NetShortWaveRadUpDown",
  "NetLongWaveRadUpDown",
  "AlbedoUpDown",
  "TotalRadUp",
  "TotalRadDown",
  "TotalNetRadUpDown",
  "LongWaveRadUpTCorr",
  "LongWaveRadDownTCorr",
  "ShortWaveRadFwd",
  "ShortWaveRadAft",
  "LongWaveRadFwd",
  "LongWaveRadAft",
  "NR01FwdAftTempC",
  "NR01FwdAftTempK",
  "NetShortWaveRadFwdAft",
  "NetLongWaveRadFwdAft",
  "AlbedoFwdAft",
  "TotalRadFwd",
  "TotalRadAft",
  "TotalNetRadFwdAft",
  "LongWaveRadFwdTCorr",
  "LongWaveRadAftTCorr",
  "ShortWaveRadLeft",
  "ShortWaveRadRight",
  "LongWaveRadLeft",
  "LongWaveRadRight",
  "NR01LeftRightTempC",
  "NR01LeftRightTempK",
  "NetShortWaveRadLeftRight",
  "NetLongWaveRadLeftRight",
  "AlbedoLeftRight",
  "TotalRadLeft",
  "TotalRadRight",
  "TotalNetRadLeftRight",
  "LongWaveRadLeftTCorr",
  "LongWaveRadRightTCorr",
  "mrt_nr01",
  "Latitude_Degrees",
  "Latitude_Minutes",
  "Latitude",
  "Longitude_Degrees",
  "Longitude_Minutes",
  "Longitude",
  "Speed",
  "Speed_ms",
  "Course",
  "MagVar",
  "FixQual",
  "NumSats",
  "Altitude",
  "PPS",
  "SecSinceGPRMC",
  "GPSReady",
  "MaxClockChange",
  "NumClockChange",
  "TS100SS_Fan_RPM",
  "SatVapPress",
  "VapPress",
  "DewPointC",
];

const BIOMET_BIKE_FIELDS_SELECTION = [
  "Latitude",
  "Longitude",
  "Altitude",
  "Speed_ms",
  "Course",
  "FixQual",
  "ShortWaveRadUp",
  "LongWaveRadUpTCorr",
  "ShortWaveRadDown",
  "LongWaveRadDownTCorr",
  "ShortWaveRadFwd",
  "LongWaveRadFwdTCorr",
  "ShortWaveRadAft",
  "LongWaveRadAftTCorr",
  "ShortWaveRadLeft",
  "ShortWaveRadRight",
  "LongWaveRadLeftTCorr",
  "LongWaveRadRightTCorr",
  "WS_ms",
  "TrueWS_ms",
  "WindDir",
  "TrueWindDir",
  "mrt_blg",
  "mrt_nr01",
  "AlbedoUpDown",
  "DewPointC",
  "AirTC",
  "RH",
  "SatVapPress",
  "VapPress",
];

function parseDataFromString(dataString) {
  // Strip whitespace and remove control characters
  let s = dataString
    .trim()
    .replace(/^\x03/, "")
    .replace(/[\r\n]/g, "");

  const values = s.split(",");
  const parsed = {};

  // Parse each value and assign to corresponding field
  BIOMET_BIKE_FIELDS.forEach((field, index) => {
    try {
      const value = parseFloat(values[index]);
      parsed[field] = isNaN(value) ? NaN : value;
    } catch (error) {
      parsed[field] = NaN;
    }
  });

  // If we don't have enough values, fill with NaN
  if (values.length !== BIOMET_BIKE_FIELDS.length) {
    BIOMET_BIKE_FIELDS.forEach((field) => {
      if (!(field in parsed)) {
        parsed[field] = NaN;
      }
    });
  }

  return parsed;
}

// Update createChart to show all available data
function createChart(parameter = "AirTC") {
  const ctx = document.getElementById("myChart");

  // Destroy existing chart
  if (chart) {
    chart.destroy();
    chart = null;
  }

  // Store current parameter for live updates
  currentChartParameter = parameter;

  // Prepare chart data from existing history (all data)
  const chartData = dataHistory
    .map((point) => ({
      x: point.timestamp,
      y: point.data[parameter],
    }))
    .filter((point) => point.y !== null && !isNaN(point.y));

  const paramInfo = BIOMET_BIKE_PARAMS[parameter];
  const label = paramInfo?.alias || parameter;
  const unit = paramInfo?.unit || "";

  // Update modal title
  document.getElementById("plot-modal-titel").textContent = `${label} Time Series`;

  chart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: `${label} (${unit})`,
          data: chartData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Disabled for better real-time performance
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          type: "time",
          title: { display: true, text: "Time" },
          time: {
            displayFormats: {
              second: "HH:mm:ss",
              minute: "HH:mm:ss",
              hour: "HH:mm",
            },
          },
        },
        y: {
          title: { display: true, text: `${label} (${unit})` },
        },
      },
      plugins: {
        legend: {
          display: true,
        },
        zoom: {
          limits: {
            x: { min: "original", max: "original" },
            y: { min: "original", max: "original" },
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: "x",
          },
          pan: {
            enabled: true,
            mode: "x",
          },
        },
      },
    },
  });
}

// Add this function after your existing chart functions
function resetChartZoom() {
  if (chart) {
    chart.resetZoom();
  }
}

// Simplified updateLiveChart - just adds new data without limiting chart points
function updateLiveChart(newDataPoint) {
  if (chart && currentChartParameter) {
    const value = newDataPoint.data[currentChartParameter];

    if (value !== null && !isNaN(value)) {
      // Add new data point
      chart.data.datasets[0].data.push({
        x: newDataPoint.timestamp,
        y: value,
      });

      // Update the chart without animation for smooth real-time updates
      chart.update("none");
    }
  }
}

// Update storeDataPoint to trigger live chart updates
function storeDataPoint(parsedData) {
  const dataPoint = {
    timestamp: new Date(),
    data: { ...parsedData },
  };

  dataHistory.push(dataPoint);

  if (dataHistory.length > maxDataPoints) {
    dataHistory = dataHistory.slice(-maxDataPoints);
  }

  // Update live chart if it's open
  updateLiveChart(dataPoint);
  
  // Update live map if it's open
  updateLiveMap();
}

// Update destroyChart to clear the current parameter
function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  currentChartParameter = null;
}

async function pollDevice() {
  if (!isConnected) {
    return;
  }

  try {
    let response;
    
    // Check if we're actually connected to a serial device or use test data
    if (window.selectedPort && window.selectedPort.readable && reader && writer) {
      // Real serial device polling
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Read timeout")), 1000)
      );

      const readPromise = reader.read();
      const { value, done } = await Promise.race([readPromise, timeoutPromise]);

      if (done || !value) {
        throw new Error("No data received");
      }

      const decoder = new TextDecoder();
      response = decoder.decode(value);
    } else {
      // Generate test data if no real device or in test mode
      response = generateTestData();
    }

    // Clear any previous error alerts
    document.getElementById("alert").innerHTML = "";

    const parsed_response = parseDataFromString(response);

    // Store data for charting
    storeDataPoint(parsed_response);

    // Update UI
    for (let variable of BIOMET_BIKE_FIELDS_SELECTION) {
      const element = document.getElementById(variable);
      if (element && BIOMET_BIKE_PARAMS[variable]) {
        let new_content = `${formatValue(
          variable,
          parsed_response[variable]
        )} <span class="text-secondary">${
          BIOMET_BIKE_PARAMS[variable].unit
        }</span>`;
        element.innerHTML = new_content;
      }
    }
  } catch (error) {
    console.error("Polling error:", error);
    // Show all polling errors in the alert box
    document.getElementById(
      "alert"
    ).innerHTML = `<div class="alert alert-warning alert-dismissible fade show text-center" role="alert">
            Polling error: ${error.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>`;
  }
}

async function startPolling() {
  if (!isConnected) {
    return;
  }

  isPolling = true;

  // Start continuous polling loop
  while (isPolling && isConnected) {
    // set the date and time in UTC
    let dateTimeUTC = new Date().toLocaleString(navigator.language, {
      timeZone: "UTC",
    });
    document.getElementById("date-time-utc").innerHTML = dateTimeUTC;
    /* local datetime */
    let dateTimeLocal = new Date().toLocaleString(navigator.language);
    document.getElementById("date-time-local").innerHTML = dateTimeLocal;
    await pollDevice();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between polls
  }
}

function stopPolling() {
  isPolling = false;
}

// Map functionality
function showMap() {
  if (!map) {
    // Initialize map centered over Dortmund, Germany
    map = L.map('map').setView([51.5136, 7.4653], 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }
  
  // Update map with current route data
  updateMapRoute();
  
  // Force map to resize after modal is shown
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function updateMapRoute() {
  if (!map) return;
  
  // Get GPS coordinates from data history
  const coordinates = dataHistory
    .filter(point => {
      const lat = point.data.Latitude;
      const lon = point.data.Longitude;
      return lat && lon && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
    })
    .map((point, index) => ({
      lat: point.data.Latitude,
      lon: point.data.Longitude,
      timestamp: point.timestamp,
      index: index
    }));
  
  // Clear existing markers
  gpsMarkers.forEach(marker => map.removeLayer(marker));
  gpsMarkers = [];
  
  // Remove existing current position marker
  if (currentPositionMarker) {
    map.removeLayer(currentPositionMarker);
  }
  
  if (coordinates.length > 0) {
    // Add GPS point markers as circles
    coordinates.forEach((coord, index) => {
      const isFirst = index === 0;
      const isLast = index === coordinates.length - 1;
      
      let color = '#3388ff'; // Default blue
      let popupText = `Point ${index + 1}`;
      
      if (isFirst) {
        color = '#22c55e'; // Green for start
        popupText = `Start - ${popupText}`;
      } else if (isLast) {
        color = '#ef4444'; // Red for current/latest
        popupText = `Current - ${popupText}`;
      }
      
      const marker = L.circleMarker([coord.lat, coord.lon], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);
      
      // Add popup with coordinates and timestamp
      marker.bindPopup(`
        <b>${popupText}</b><br>
        Lat: ${coord.lat.toFixed(6)}<br>
        Lon: ${coord.lon.toFixed(6)}<br>
        Time: ${coord.timestamp.toLocaleTimeString()}
      `);
      
      gpsMarkers.push(marker);
    });
    
    // Update map stats
    updateMapStats(coordinates);
    
    // Only auto-center the map if auto-follow is enabled
    if (isAutoFollowEnabled) {
      // Fit map to all points if this is the first time showing data
      if (coordinates.length > 1) {
        fitMapToPoints();
      } else {
        map.setView([coordinates[0].lat, coordinates[0].lon], 15);
      }
    }
  } else {
    // No GPS data available
    document.getElementById('map-stats').textContent = 'No GPS data available';
  }
}

function updateMapStats(coordinates) {
  if (coordinates.length === 0) {
    document.getElementById('map-stats').textContent = 'No GPS data';
    return;
  }
  
  const statsText = `GPS Points: ${coordinates.length}`;
  document.getElementById('map-stats').textContent = statsText;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function fitMapToRoute() {
  if (!map || gpsMarkers.length === 0) return;
  
  if (gpsMarkers.length === 1) {
    // Single point - center on it
    const marker = gpsMarkers[0];
    map.setView(marker.getLatLng(), 15);
  } else {
    // Multiple points - fit bounds to include all markers
    const group = new L.featureGroup(gpsMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function fitMapToPoints() {
  fitMapToRoute(); // Alias for backward compatibility
}

function destroyMap() {
  // Don't actually destroy the map, just clean up
  // The map will be reused when opened again
}

function updateLiveMap() {
  // Update map with new GPS data if map modal is open
  const mapModal = document.getElementById('MapModal');
  if (mapModal && mapModal.classList.contains('show') && map) {
    updateMapRoute();
  }
}

function toggleAutoFollow() {
  isAutoFollowEnabled = !isAutoFollowEnabled;
  const button = document.getElementById('auto-follow-toggle');
  if (isAutoFollowEnabled) {
    button.textContent = 'Auto Follow: ON';
    button.className = 'btn btn-success';
  } else {
    button.textContent = 'Auto Follow: OFF';
    button.className = 'btn btn-outline-secondary';
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Hide test mode button if disabled in production config
  if (!ENABLE_TEST_MODE) {
    const testModeButton = document.querySelector('button[onclick="toggleTestMode()"]');
    if (testModeButton) {
      testModeButton.style.display = 'none';
    }
  }

  /* prepare the html to display the cards */
  const data_element = document.getElementById("data");
  BIOMET_BIKE_FIELDS_SELECTION.forEach((field) => {
    const card = document.createElement("div");
    card.className =
      "col-xxl-2 col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-3 border rounded p-2 m-1";
    card.innerHTML = `<h4 class="text-center" style="cursor: pointer;" onclick="createChart('${field}')" data-bs-toggle="modal" data-bs-target="#PlotModal">${
      BIOMET_BIKE_PARAMS[field] && BIOMET_BIKE_PARAMS[field].alias
        ? BIOMET_BIKE_PARAMS[field].alias
        : field
    }</h4><hr class="mt-1"><p id="${field}" class="text-center display-5">NaN&nbsp;<span class="text-secondary">${
      BIOMET_BIKE_PARAMS[field]?.unit || ""
    }</span></p>`;
    data_element.appendChild(card);
  });

  // Add event listener to clear chart when modal is closed
  document
    .getElementById("PlotModal")
    .addEventListener("hidden.bs.modal", function () {
      destroyChart();
    });
    
  // Add event listener for map modal
  document
    .getElementById("MapModal")
    .addEventListener("shown.bs.modal", function () {
      // Ensure map is properly sized when modal is fully shown
      if (map) {
        setTimeout(() => {
          map.invalidateSize();
          updateMapRoute();
        }, 100);
      }
    });
});
