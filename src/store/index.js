import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';
import { formatTimeWithAmPmAndSeconds, formatDuration } from '../utils/utils.js';

console.log("DEBUG: useGcStore module loaded");

export const pinia = createPinia();

/*
  Helper: Convert a runtime string ("mm:ss" or "hh:mm:ss") into total seconds.
*/
function convertRuntime(runtimeStr) {
  if (!runtimeStr) return 0;
  const parts = runtimeStr.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/*
  Helper: Fallback formatting for a duration in milliseconds.
*/
function fallbackFormatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let str = "";
  if (hours > 0) str += `${hours}h `;
  if (minutes > 0 || hours > 0) str += `${minutes}m `;
  str += `${seconds}s`;
  return str.trim();
}

/*
  Helper: Parse a 24‑hour time string (e.g. "10:00") into a Date object.
  We assume the time is for "today."
*/
function parse24HourTimeToDate(timeStr) {
  // If the time string doesn't include a colon, assume minutes are "00"
  if (!timeStr.includes(":")) {
    // Pad hour to two digits if necessary and add ":00"
    timeStr = timeStr.length === 1 ? "0" + timeStr + ":00" : timeStr.padStart(2, "0") + ":00";
  }
  const [hourStr, minuteStr] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return date;
}

export const useGcStore = defineStore('gc', {
  state: () => ({
    allGcData: {},
    selectedGc: null,
    results: {},  // results will be cleared when inputs are reset
    isLoading: false,
    error: null,
    calculationAttempted: false,
    // Start‑time state: User enters batchStartTime as a 24‑hour string.
    startTime: {
      batchStartTime: null, // e.g. "10:00"
      batchStartTimeAMPM: "", // This will be derived for display
      wait15: null,
      finalPosition: null,
      batchEndTime: null,
      controls: {
        control1: null,
        control2: null,
      },
    },
    lastStartTimeInputs: null,
    sequentialFinalPosition: null, // preserved as requested
    miscDelayedRuns: 0,           // used for delayed runs
    timeDelayResults: {
      prerunsDescription: 'None',
      totalDelayedRuns: 0,
      delayedRunsEndTime: '',
      totalDelayedDurationFormatted: '',
      delayedRunsStartTime: '',
      additionalRunsDuration: '',
    },
    startTimeResetCounter: 0,
    // Renamed property for additional runs to avoid confusion:
    miscAdditionalRuns: null,     // used for additional runs (formerly additionalRuns)
  }),
  actions: {
    async fetchGcData() {
      this.isLoading = true;
      try {
        const response = await fetch(`/.netlify/functions/update-config?v=${Date.now()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.allGcData = data;
        this.error = null;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.isLoading = false;
      }
    },
    setSelectedGc(gcId) {
      this.selectedGc = gcId;
    },
    resetStartTime() {
      const selectedGcType = this.selectedGc && this.allGcData[this.selectedGc]?.type;
      // Clear all input fields individually so that reactivity is maintained.
      this.startTime.batchStartTime = null;
      this.startTime.batchStartTimeAMPM = "";
      this.startTime.wait15 = selectedGcType === "Energy";
      this.startTime.finalPosition = null;
      this.startTime.batchEndTime = null;
      this.startTime.controls.control1 = null;
      this.startTime.controls.control2 = null;
      this.lastStartTimeInputs = null;
      // Also clear the results so that the UI shows no results when inputs are null.
      this.results = {};
      // Reset the additional runs property
      this.miscAdditionalRuns = null;
      // Increment counter to force component re-render if keyed on it.
      this.startTimeResetCounter++;
      console.log(`[${new Date().toLocaleTimeString()}] resetStartTime() called. New startTime:`, this.startTime);
    },
    setSequentialFinalPosition(position) {
      this.sequentialFinalPosition = this.sequentialFinalPosition === position ? null : position;
      this.calculateStartTimeBatch();
    },
    setBatchStartTime(time) {
      this.startTime.batchStartTime = time;
      this.calculateStartTimeBatch();
    },
    setBatchStartTimeAMPM(ampm) {
      this.startTime.batchStartTimeAMPM = ampm;
      this.calculateStartTimeBatch();
    },
    setWait15(value) {
      this.startTime.wait15 = value;
    },
    setStartTimeFinalPosition(position) {
      this.startTime.finalPosition = position;
      // Check if other required fields are provided.
      if (
        this.startTime.batchStartTime &&
        this.startTime.controls.control1 !== null &&
        this.startTime.controls.control1 !== "" &&
        this.startTime.controls.control2 !== null &&
        this.startTime.controls.control2 !== ""
      ) {
        this.calculateStartTimeBatch();
      } else {
        // Otherwise, update partial results.
        this.results = {
          mode: "start-time",
          startTimeFinalPosition: this.startTime.finalPosition,
        };
      }
    },
    setControl1(value) {
      this.startTime.controls.control1 = value;
      console.log("Control1 updated to:", value);
      setTimeout(() => {
        this.calculateStartTimeBatch();
      }, 0);
    },
    setControl2(value) {
      this.startTime.controls.control2 = value;
      console.log("Control2 updated to:", value);
      setTimeout(() => {
        this.calculateStartTimeBatch();
      }, 0);
    },
    calculateStartTimeBatch() {
      console.log("Calculating Start Time Batch with controls:", JSON.stringify(this.startTime.controls));
      console.log("Batch Start Time:", this.startTime.batchStartTime);
      
      // If batchStartTime is not provided, update partial results and exit.
      if (!this.startTime.batchStartTime) {
        console.log("Guard: Missing batchStartTime");
        this.results = { mode: "start-time" };
        return;
      }
      
      // Convert the 24‑hour string to a Date object and derive a formatted 12‑hour time.
      const dt = parse24HourTimeToDate(this.startTime.batchStartTime);
      let ampmValue = this.startTime.batchStartTimeAMPM;
      if (!ampmValue) {
        ampmValue = dt.getHours() >= 12 ? "PM" : "AM";
        console.log(`Derived AM/PM from 24‑hour input: ${ampmValue}`);
      }
      
      // Format the batch start time to a 12‑hour display string (e.g. "10:00:00 AM")
      const formattedBatchStartTime = formatTime(dt);
      
      // Build partial results using what is available.
      const partialResults = {
        mode: "start-time",
        batchStartTime: formattedBatchStartTime,
        batchStartTimeAMPM: ampmValue,
        startTimeFinalPosition: this.startTime.finalPosition,
        wait15: this.startTime.wait15,
      };
      
      // Update results with partial data.
      this.results = { ...partialResults };
      
      // Only perform full calculation if all required inputs are provided.
      if (!this.startTime.finalPosition) {
        console.log("Guard: Missing finalPosition");
        return;
      }
      
      const { control1, control2 } = this.startTime.controls;
      if (control1 === null || control1 === "" || control2 === null || control2 === "") {
        console.log("Guard: Missing control1 or control2");
        return;
      }
      
      // All required inputs are provided—perform full calculation.
      this.calculationAttempted = true;
      const runtime = this.allGcData[this.selectedGc].runTime;
      const runtimeSec = convertRuntime(runtime);
      const calcResults = calculateStartTimeBatch(
        this.selectedGc,
        runtime,
        null,
        this.startTime.finalPosition,
        this.startTime.batchStartTime,
        ampmValue,
        this.startTime.wait15
      );
      this.startTime.batchEndTime = calcResults.batchEndTimeDate || new Date();
      
      // Update results with full calculated values.
      this.results = {
        ...partialResults,
        selectedGc: this.allGcData[this.selectedGc]
          ? `${this.selectedGc} (Runtime: ${this.allGcData[this.selectedGc].runTime})`
          : this.selectedGc,
        totalRuns: calcResults.totalRuns,
        totalRunTime: calcResults.totalRunTime,
        batchEndTime: calcResults.batchEndTime,
        timeGapTo730AM: calcResults.timeGapTo730AM,
        timeDelayRequired: calcResults.timeDelayRequired,
        runs: calcResults.runs,
      };
      
      console.log("Calculation complete. Current startTime state:", JSON.stringify(this.startTime, null, 2));
      this.lastStartTimeInputs = { ...this.startTime };
    },
  },
  getters: {
    selectedGcData: (state) =>
      state.selectedGc && state.allGcData
        ? state.allGcData[state.selectedGc]
        : null,
    delayedRunsStartTime: (state) => {
      if (!state.startTime || !state.startTime.batchStartTime) return "";
      const baseTimeStr = state.timeDelayResults.sequentialBatchActive
        ? state.timeDelayResults.sequentialBatchEndTime
        : state.results && state.results.batchEndTime;
      if (!baseTimeStr) return "";
      const parsed = parseTimeString(baseTimeStr);
      if (!parsed) return "";
      const { hour, minute, second } = parsed;
      const now = new Date();
      const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
      const delayStr = (state.results && state.results.timeDelayRequired) || "";
      let delayHours = 0;
      const delayParts = delayStr.split(" ");
      if (delayParts.length > 0) {
        delayHours = parseInt(delayParts[0], 10) || 0;
      }
      baseDate.setHours(baseDate.getHours() + delayHours);
      return formatTime(baseDate);
    },
  },
});
