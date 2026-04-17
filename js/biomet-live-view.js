// Biomet Live View JavaScript

// PRODUCTION CONFIG: Set to false to disable test mode button in production
const ENABLE_TEST_MODE = false;

let isConnected = false;
let isPolling = false;
let reader = null;
let chart = null;
let map = null;
let gpsMarkers = [];
let currentPositionMarker = null;
let serialReadBuffer = "";
let serialDecoder = new TextDecoder();

// Update the global variables
let dataHistory = [];
let maxDataPoints = 3600; // 1 hour of data at 1-second intervals

// Add a global variable to track the current chart parameter
let currentChartParameter = null;

// Add a global variable to track test mode state
let isTestMode = false;

// Add a global variable to track auto-follow state for the map
let isAutoFollowEnabled = true;

// Browser persistence configuration
const MEASUREMENT_DB_NAME = "biomet-live-view";
const MEASUREMENT_DB_VERSION = 2;
const MEASUREMENT_STORE_NAME = "measurements";
const MEASUREMENT_META_STORE_NAME = "meta";
const MEASUREMENT_META_FIELDS_SIGNATURE_KEY = "fieldsSignature";
const MEASUREMENT_DATE_INDEX = "dateKey";
const DEFAULT_SCOPE_SUFFIX =
  "Missing values or gaps here do not mean the logger recorded nothing; the logger still keeps its own full record.";

let measurementDbPromise = null;
let measurementPersistBuffer = [];
let measurementPersistTimerId = null;
let persistenceEnabled = true;
let storageWarningShown = false;
let historyViewDateKey = null;

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

      // Get reader
      reader = window.selectedPort.readable.getReader();
      serialReadBuffer = "";
      serialDecoder = new TextDecoder();

      isConnected = true;
      showToast("Connected to serial device. Polling started.", "success");

      // Start polling automatically
      startPolling();
    } catch (error) {
      showToast(`Failed to connect: ${error.message}`, "danger", false);
    }
  } else {
    showToast("Web Serial API is not supported in this browser.", "danger", false);
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

    // Release reader
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }

    serialReadBuffer = "";

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
    showToast(
      "Disconnected from serial device. Polling stopped. Data cleared.",
      "success"
    );

    // Clear data display - reset all fields to NaN
    clearLiveDisplayValues();

    // Clear date/time displays
    document.getElementById("date-time-utc").innerHTML = "";
    document.getElementById("date-time-local").innerHTML = "";
  } catch (error) {
    showToast(`Failed to disconnect: ${error.message}`, "danger", false);
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

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB request failed"));
  });
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

function showStorageWarning(message) {
  console.warn(message);
  if (storageWarningShown) {
    return;
  }

  storageWarningShown = true;
  showToast(message, "warning", false);
}

function getFieldSignature() {
  return BIOMET_BIKE_FIELDS.join(",");
}

function toLocalDateKey(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToHumanLabel(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString(navigator.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function updateDataScopeBanner(prefixText, level = "info") {
  const fullMessage = `${prefixText} ${DEFAULT_SCOPE_SUFFIX}`;
  showToast(fullMessage, level);
}

function showToast(message, level = "info", autohide = true, delay = 7000) {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    console.warn(message);
    return;
  }

  const levelToClass = {
    info: "text-bg-info",
    warning: "text-bg-warning",
    danger: "text-bg-danger",
    success: "text-bg-success",
    secondary: "text-bg-secondary",
  };

  const colorClass = levelToClass[level] || "text-bg-info";
  const toastElement = document.createElement("div");
  toastElement.className = `toast align-items-center border-0 ${colorClass}`;
  toastElement.setAttribute("role", "status");
  toastElement.setAttribute("aria-live", "polite");
  toastElement.setAttribute("aria-atomic", "true");
  toastElement.innerHTML = `<div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;

  toastContainer.appendChild(toastElement);

  if (window.bootstrap && bootstrap.Toast) {
    const toast = new bootstrap.Toast(toastElement, { autohide, delay });
    toastElement.addEventListener("hidden.bs.toast", function () {
      toastElement.remove();
    });
    toast.show();
  } else {
    window.setTimeout(() => {
      toastElement.remove();
    }, delay);
  }
}

function updateHistoryInfoText(message) {
  const infoElement = document.getElementById("history-info");
  if (infoElement) {
    infoElement.textContent = message;
  }
}

function clearLiveDisplayValues() {
  for (let variable of BIOMET_BIKE_FIELDS_SELECTION) {
    const element = document.getElementById(variable);
    if (element) {
      const unit = BIOMET_BIKE_PARAMS[variable]?.unit || "";
      element.innerHTML = `NaN&nbsp;<span class="text-secondary">${unit}</span>`;
    }
  }
}

function openMeasurementDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available in this browser"));
  }

  if (measurementDbPromise) {
    return measurementDbPromise;
  }

  measurementDbPromise = new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(MEASUREMENT_DB_NAME, MEASUREMENT_DB_VERSION);

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      const tx = openRequest.transaction;

      if (!db.objectStoreNames.contains(MEASUREMENT_STORE_NAME)) {
        const measurementStore = db.createObjectStore(MEASUREMENT_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        measurementStore.createIndex("ts", "ts", { unique: false });
        measurementStore.createIndex(MEASUREMENT_DATE_INDEX, MEASUREMENT_DATE_INDEX, {
          unique: false,
        });
      } else {
        const measurementStore = tx.objectStore(MEASUREMENT_STORE_NAME);
        if (!measurementStore.indexNames.contains(MEASUREMENT_DATE_INDEX)) {
          measurementStore.createIndex(MEASUREMENT_DATE_INDEX, MEASUREMENT_DATE_INDEX, {
            unique: false,
          });

          measurementStore.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
              return;
            }

            const value = cursor.value;
            if (!value[MEASUREMENT_DATE_INDEX] && typeof value.ts === "number") {
              value[MEASUREMENT_DATE_INDEX] = toLocalDateKey(new Date(value.ts));
              cursor.update(value);
            }

            cursor.continue();
          };
        }
      }

      if (!db.objectStoreNames.contains(MEASUREMENT_META_STORE_NAME)) {
        db.createObjectStore(MEASUREMENT_META_STORE_NAME, { keyPath: "key" });
      }
    };

    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () =>
      reject(openRequest.error || new Error("Failed to open IndexedDB"));
  });

  return measurementDbPromise;
}

async function getMetaValue(db, key) {
  const tx = db.transaction([MEASUREMENT_META_STORE_NAME], "readonly");
  const store = tx.objectStore(MEASUREMENT_META_STORE_NAME);
  const result = await requestToPromise(store.get(key));
  await waitForTransaction(tx);
  return result ? result.value : null;
}

async function setMetaValue(db, key, value) {
  const tx = db.transaction([MEASUREMENT_META_STORE_NAME], "readwrite");
  tx.objectStore(MEASUREMENT_META_STORE_NAME).put({ key, value });
  await waitForTransaction(tx);
}

async function clearPersistedMeasurements(db) {
  const tx = db.transaction([MEASUREMENT_STORE_NAME], "readwrite");
  tx.objectStore(MEASUREMENT_STORE_NAME).clear();
  await waitForTransaction(tx);
}

function serializeDataPoint(dataPoint) {
  return {
    ts: dataPoint.timestamp.getTime(),
    dateKey: toLocalDateKey(dataPoint.timestamp),
    v: BIOMET_BIKE_FIELDS.map((field) => {
      const value = dataPoint.data[field];
      return Number.isFinite(value) ? value : null;
    }),
  };
}

function deserializeDataPoint(serializedPoint) {
  const reconstructedData = {};
  BIOMET_BIKE_FIELDS.forEach((field, index) => {
    const value = serializedPoint.v[index];
    reconstructedData[field] = value === null || value === undefined ? NaN : value;
  });

  return {
    timestamp: new Date(serializedPoint.ts),
    data: reconstructedData,
  };
}

async function initializePersistence() {
  if (!persistenceEnabled) {
    return false;
  }

  try {
    const db = await openMeasurementDatabase();
    const storedSignature = await getMetaValue(
      db,
      MEASUREMENT_META_FIELDS_SIGNATURE_KEY
    );
    const currentSignature = getFieldSignature();

    if (!storedSignature) {
      await setMetaValue(
        db,
        MEASUREMENT_META_FIELDS_SIGNATURE_KEY,
        currentSignature
      );
      return true;
    }

    if (storedSignature !== currentSignature) {
      await clearPersistedMeasurements(db);
      await setMetaValue(
        db,
        MEASUREMENT_META_FIELDS_SIGNATURE_KEY,
        currentSignature
      );
      showStorageWarning(
        "Stored measurement history was reset because the parameter schema changed."
      );
    }

    return true;
  } catch (error) {
    persistenceEnabled = false;
    showStorageWarning(
      "Local storage is unavailable. Live measurements will work, but reload restore is disabled."
    );
    console.error("Persistence initialization failed:", error);
    return false;
  }
}

async function loadLatestPersistedData(limit) {
  if (!persistenceEnabled) {
    return [];
  }

  const ready = await initializePersistence();
  if (!ready) {
    return [];
  }

  try {
    const db = await openMeasurementDatabase();
    const tx = db.transaction([MEASUREMENT_STORE_NAME], "readonly");
    const index = tx.objectStore(MEASUREMENT_STORE_NAME).index("ts");

    const records = [];
    await new Promise((resolve, reject) => {
      const cursorRequest = index.openCursor(null, "prev");
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor || records.length >= limit) {
          resolve();
          return;
        }

        records.push(cursor.value);
        cursor.continue();
      };
      cursorRequest.onerror = () =>
        reject(cursorRequest.error || new Error("Failed to read persisted data"));
    });

    await waitForTransaction(tx);
    return records.reverse();
  } catch (error) {
    console.error("Failed to load persisted data:", error);
    return [];
  }
}

async function loadPersistedDataByDate(dateKey) {
  if (!persistenceEnabled) {
    return [];
  }

  const ready = await initializePersistence();
  if (!ready) {
    return [];
  }

  try {
    const db = await openMeasurementDatabase();
    const tx = db.transaction([MEASUREMENT_STORE_NAME], "readonly");
    const index = tx.objectStore(MEASUREMENT_STORE_NAME).index(MEASUREMENT_DATE_INDEX);
    const range = IDBKeyRange.only(dateKey);
    const records = await requestToPromise(index.getAll(range));
    await waitForTransaction(tx);

    records.sort((a, b) => a.ts - b.ts);
    return records;
  } catch (error) {
    console.error("Failed to load date-filtered data:", error);
    return [];
  }
}

async function listPersistedDateKeys() {
  if (!persistenceEnabled) {
    return [];
  }

  const ready = await initializePersistence();
  if (!ready) {
    return [];
  }

  try {
    const db = await openMeasurementDatabase();
    const tx = db.transaction([MEASUREMENT_STORE_NAME], "readonly");
    const index = tx.objectStore(MEASUREMENT_STORE_NAME).index(MEASUREMENT_DATE_INDEX);
    const keys = [];

    await new Promise((resolve, reject) => {
      const keyCursorRequest = index.openKeyCursor(null, "prevunique");
      keyCursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve();
          return;
        }

        keys.push(cursor.key);
        cursor.continue();
      };
      keyCursorRequest.onerror = () =>
        reject(keyCursorRequest.error || new Error("Failed to list stored days"));
    });

    await waitForTransaction(tx);
    return keys;
  } catch (error) {
    console.error("Failed to list available history days:", error);
    return [];
  }
}

function applyLoadedHistory(restoredRecords, scopeLabel, scopeLevel = "info") {
  if (restoredRecords.length === 0) {
    dataHistory = [];
    clearLiveDisplayValues();
    document.getElementById("date-time-utc").innerHTML = "";
    document.getElementById("date-time-local").innerHTML = "";
    updateDataScopeBanner(`${scopeLabel}: no data found in browser storage.`, "warning");
    return;
  }

  dataHistory = restoredRecords.map((record) => deserializeDataPoint(record));
  const latestDataPoint = dataHistory[dataHistory.length - 1];
  renderSelectedValues(latestDataPoint.data);

  document.getElementById("date-time-utc").innerHTML =
    latestDataPoint.timestamp.toLocaleString(navigator.language, {
      timeZone: "UTC",
    });
  document.getElementById("date-time-local").innerHTML =
    latestDataPoint.timestamp.toLocaleString(navigator.language);

  updateDataScopeBanner(
    `${scopeLabel}: showing ${restoredRecords.length} samples from browser storage.`,
    scopeLevel
  );
}

async function flushPersistedData() {
  if (!persistenceEnabled || measurementPersistBuffer.length === 0) {
    return;
  }

  const batch = measurementPersistBuffer;
  measurementPersistBuffer = [];

  const ready = await initializePersistence();
  if (!ready) {
    return;
  }

  try {
    const db = await openMeasurementDatabase();
    const writeTx = db.transaction([MEASUREMENT_STORE_NAME], "readwrite");
    const store = writeTx.objectStore(MEASUREMENT_STORE_NAME);

    batch.forEach((item) => store.add(item));
    await waitForTransaction(writeTx);
  } catch (error) {
    persistenceEnabled = false;
    showStorageWarning(
      "Unable to store measurements locally. Reload restore has been disabled for this session."
    );
    console.error("Persisting data failed:", error);
  }
}

function queuePersistedDataPoint(dataPoint) {
  if (!persistenceEnabled || isTestMode) {
    return;
  }

  measurementPersistBuffer.push(serializeDataPoint(dataPoint));

  if (measurementPersistTimerId !== null) {
    return;
  }

  measurementPersistTimerId = window.setTimeout(async () => {
    measurementPersistTimerId = null;
    await flushPersistedData();
  }, 1000);
}

function renderSelectedValues(parsedData) {
  for (let variable of BIOMET_BIKE_FIELDS_SELECTION) {
    const element = document.getElementById(variable);
    if (element && BIOMET_BIKE_PARAMS[variable]) {
      let new_content = `${formatValue(
        variable,
        parsedData[variable]
      )} <span class="text-secondary">${
        BIOMET_BIKE_PARAMS[variable].unit
      }</span>`;
      element.innerHTML = new_content;
    }
  }
}

async function restorePersistedData() {
  const restoredRecords = await loadLatestPersistedData(maxDataPoints);
  historyViewDateKey = null;
  applyLoadedHistory(restoredRecords, "Latest window", "info");
  updateHistoryInfoText(
    restoredRecords.length > 0
      ? `Loaded latest ${restoredRecords.length} samples from browser storage.`
      : "No stored samples were found in browser storage."
  );
}

async function loadStoredHistoryForDate(dateKey) {
  const restoredRecords = await loadPersistedDataByDate(dateKey);
  historyViewDateKey = dateKey;
  applyLoadedHistory(
    restoredRecords,
    `Stored day ${dateKeyToHumanLabel(dateKey)}`,
    "secondary"
  );
  updateHistoryInfoText(
    restoredRecords.length > 0
      ? `Loaded ${restoredRecords.length} samples for ${dateKeyToHumanLabel(dateKey)}.`
      : `No samples found for ${dateKeyToHumanLabel(dateKey)}.`
  );
}

async function refreshHistoryDateList(showNotice = false) {
  const selectElement = document.getElementById("history-date-select");
  if (!selectElement) {
    return;
  }

  if (showNotice) {
    updateDataScopeBanner("History view opened.", "warning");
  }

  const dateKeys = await listPersistedDateKeys();
  selectElement.innerHTML = "";

  if (dateKeys.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No stored days";
    selectElement.appendChild(option);
    return;
  }

  dateKeys.forEach((dateKey) => {
    const option = document.createElement("option");
    option.value = dateKey;
    option.textContent = dateKeyToHumanLabel(dateKey);
    selectElement.appendChild(option);
  });
}

async function loadHistoryFromPicker() {
  const picker = document.getElementById("history-date-picker");
  if (!picker || !picker.value) {
    updateHistoryInfoText("Please choose a date first.");
    return;
  }

  await loadStoredHistoryForDate(picker.value);
}

async function loadHistoryFromSelect() {
  const select = document.getElementById("history-date-select");
  if (!select || !select.value) {
    updateHistoryInfoText("No stored day selected.");
    return;
  }

  const picker = document.getElementById("history-date-picker");
  if (picker) {
    picker.value = select.value;
  }

  await loadStoredHistoryForDate(select.value);
}

async function loadLatestStoredHistory() {
  await restorePersistedData();
}

async function clearStoredHistory() {
  if (!window.confirm("Clear all browser-stored measurements for this application?")) {
    return;
  }

  if (measurementPersistTimerId !== null) {
    window.clearTimeout(measurementPersistTimerId);
    measurementPersistTimerId = null;
  }
  measurementPersistBuffer = [];

  const ready = await initializePersistence();
  if (!ready) {
    updateHistoryInfoText("Storage is unavailable in this browser session.");
    return;
  }

  try {
    const db = await openMeasurementDatabase();
    await clearPersistedMeasurements(db);
    historyViewDateKey = null;
    dataHistory = [];
    clearLiveDisplayValues();
    document.getElementById("date-time-utc").innerHTML = "";
    document.getElementById("date-time-local").innerHTML = "";
    updateDataScopeBanner("Stored browser history cleared.", "warning");
    updateHistoryInfoText("All browser-stored measurements were cleared.");
    await refreshHistoryDateList();
  } catch (error) {
    console.error("Failed to clear stored history:", error);
    updateHistoryInfoText("Failed to clear stored history.");
  }
}

function flushPersistedDataSoon() {
  if (measurementPersistTimerId !== null) {
    window.clearTimeout(measurementPersistTimerId);
    measurementPersistTimerId = null;
  }

  flushPersistedData();
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    flushPersistedDataSoon();
  }
});

window.addEventListener("beforeunload", function () {
  flushPersistedDataSoon();
});

function parseDataFromString(dataString) {
  // Strip whitespace and remove control characters
  let s = dataString
    .trim()
    .replace(/^\x03/, "")
    .replace(/[\r\n]/g, "");

  const values = s.split(",");

  if (values.length !== BIOMET_BIKE_FIELDS.length) {
    return null;
  }

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

  return parsed;
}

function extractNextSerialFrame() {
  if (!serialReadBuffer) {
    return null;
  }

  const match = serialReadBuffer.match(/\r\n|\n|\r/);
  if (!match || match.index === undefined) {
    return null;
  }

  const endIndex = match.index;
  const eolLength = match[0].length;
  const frame = serialReadBuffer.slice(0, endIndex).replace(/\x03/g, "").trim();
  serialReadBuffer = serialReadBuffer.slice(endIndex + eolLength);

  return frame || null;
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
  document.getElementById(
    "plot-modal-titel"
  ).textContent = `${label} Time Series`;

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
  if (historyViewDateKey !== null) {
    historyViewDateKey = null;
    dataHistory = [];
    updateDataScopeBanner("Live stream resumed.", "info");
  }

  const dataPoint = {
    timestamp: new Date(),
    data: { ...parsedData },
  };

  dataHistory.push(dataPoint);

  if (dataHistory.length > maxDataPoints) {
    dataHistory = dataHistory.slice(-maxDataPoints);
  }

  queuePersistedDataPoint(dataPoint);

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
    if (!window.selectedPort || !window.selectedPort.readable || !reader) {
      throw new Error("No serial device connected");
    }

    let response = extractNextSerialFrame();
    while (isPolling && isConnected && response === null) {
      const { value, done } = await reader.read();

      if (done) {
        throw new Error("Serial stream ended");
      }

      if (!value || value.length === 0) {
        continue;
      }

      serialReadBuffer += serialDecoder.decode(value, { stream: true });
      response = extractNextSerialFrame();
    }

    if (response === null) {
      return;
    }

    const parsed_response = parseDataFromString(response);
    if (!parsed_response) {
      showToast(
        `Invalid frame: expected ${BIOMET_BIKE_FIELDS.length} values.`,
        "warning"
      );
      return;
    }

    // Store data for charting
    storeDataPoint(parsed_response);

    // Update UI
    renderSelectedValues(parsed_response);
  } catch (error) {
    console.error("Polling error:", error);

    if (error.name === "AbortError") {
      return;
    }

    stopPolling();
    isConnected = false;

    if (reader) {
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.warn("Error releasing reader:", releaseError);
      }
      reader = null;
    }

    showToast(`Polling error: ${error.message}`, "warning", false);
  }
}

async function startPolling() {
  if (!isConnected || !reader) {
    return;
  }

  if (isPolling) {
    return;
  }

  isPolling = true;

  // Start continuous polling loop
  while (isPolling && isConnected) {
    await pollDevice();

    // set the date and time in UTC/local after each received frame
    let dateTimeUTC = new Date().toLocaleString(navigator.language, {
      timeZone: "UTC",
    });
    document.getElementById("date-time-utc").innerHTML = dateTimeUTC;
    let dateTimeLocal = new Date().toLocaleString(navigator.language);
    document.getElementById("date-time-local").innerHTML = dateTimeLocal;
  }
}

function stopPolling() {
  isPolling = false;
}

// Map functionality
function showMap() {
  if (!map) {
    // Initialize map centered over Dortmund, Germany
    map = L.map("map").setView([51.5136, 7.4653], 13);

    if (window.location.protocol === "file:") {
      showToast(
        "Map tiles may be blocked when opened as a local file. Start the app via HTTP (for example: localhost) so the browser can send a valid referer.",
        "warning",
        false
      );
    }

    // Add OpenStreetMap tiles
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      // Ensure tile requests include an origin referer when the browser allows it.
      referrerPolicy: "origin",
      crossOrigin: "anonymous",
    });

    tileLayer.on("tileerror", function () {
      document.getElementById("map-stats").textContent =
        "Map tiles failed to load. If running locally, use http://localhost instead of file://.";
    });

    tileLayer.addTo(map);
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
    .filter((point) => {
      const lat = point.data.Latitude;
      const lon = point.data.Longitude;
      return lat && lon && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
    })
    .map((point, index) => ({
      lat: point.data.Latitude,
      lon: point.data.Longitude,
      timestamp: point.timestamp,
      index: index,
    }));

  // Clear existing markers
  gpsMarkers.forEach((marker) => map.removeLayer(marker));
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

      let color = "#3388ff"; // Default blue
      let popupText = `Point ${index + 1}`;

      if (isFirst) {
        color = "#22c55e"; // Green for start
        popupText = `Start - ${popupText}`;
      } else if (isLast) {
        color = "#ef4444"; // Red for current/latest
        popupText = `Current - ${popupText}`;
      }

      const marker = L.circleMarker([coord.lat, coord.lon], {
        radius: 8,
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
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
    document.getElementById("map-stats").textContent = "No GPS data available";
  }
}

function updateMapStats(coordinates) {
  if (coordinates.length === 0) {
    document.getElementById("map-stats").textContent = "No GPS data";
    return;
  }

  const statsText = `GPS Points: ${coordinates.length}`;
  document.getElementById("map-stats").textContent = statsText;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const mapModal = document.getElementById("MapModal");
  if (mapModal && mapModal.classList.contains("show") && map) {
    updateMapRoute();
  }
}

function toggleAutoFollow() {
  isAutoFollowEnabled = !isAutoFollowEnabled;
  const button = document.getElementById("auto-follow-toggle");
  if (isAutoFollowEnabled) {
    button.textContent = "Auto Follow: ON";
    button.className = "btn btn-success";
  } else {
    button.textContent = "Auto Follow: OFF";
    button.className = "btn btn-outline-secondary";
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Hide test mode button if disabled in production config
  if (!ENABLE_TEST_MODE) {
    const testModeButton = document.querySelector(
      'button[onclick="toggleTestMode()"]'
    );
    if (testModeButton) {
      testModeButton.style.display = "none";
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

  const historyDatePicker = document.getElementById("history-date-picker");
  if (historyDatePicker) {
    historyDatePicker.value = toLocalDateKey(new Date());
  }

  updateDataScopeBanner("Latest window.", "info");

  restorePersistedData();
  refreshHistoryDateList(false);
});
