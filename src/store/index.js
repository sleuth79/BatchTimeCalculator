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
  const [hourStr, minuteStr] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return date;
}

export const useGcStore = defineStore('gc', {
  state: () => ({
    allGcData: {},
    selectedGc: null,
    results: null,
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
    miscRuns: 0,
    timeDelayResults: {
      prerunsDescription: 'None',
      totalDelayedRuns: 0,
      delayedRunsEndTime: '',
      totalDelayedDurationFormatted: '',
      delayedRunsStartTime: '',
      additionalRunsDuration: '',
    },
    startTimeResetCounter: 0,
    additionalRuns: null,
    // Removed candidate selection state (e.g. rawClosestCandidate) and any run order properties.
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
      this.startTime = {
        batchStartTime: null,
        batchStartTimeAMPM: "",
        wait15: selectedGcType === "Energy",
        finalPosition: null,
        batchEndTime: null,
        controls: { control1: 3, control2: 18 }
      };
      this.lastStartTimeInputs = null;
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
      
      // Ensure the batchStartTime is provided.
      if (!this.startTime.batchStartTime) {
        console.log("Guard: Missing batchStartTime");
        this.results = { mode: "start-time" };
        return;
      }
      
      let ampmValue = this.startTime.batchStartTimeAMPM;
      if (!ampmValue) {
        const dt = parse24HourTimeToDate(this.startTime.batchStartTime);
        ampmValue = dt.getHours() >= 12 ? "PM" : "AM";
        console.log(`Derived AM/PM from 24‑hour input: ${ampmValue}`);
      }
      
      // Update results with the batch start time info.
      this.results = {
        mode: "start-time",
        batchStartTime: this.startTime.batchStartTime,
        batchStartTimeAMPM: ampmValue,
      };
      
      // If finalPosition is missing, exit early.
      if (!this.startTime.finalPosition) {
        console.log("Guard: Missing finalPosition");
        return;
      }
      
      const { control1, control2 } = this.startTime.controls;
      if (control1 === null || control1 === "" || control2 === null || control2 === "") {
        console.log("Guard: Missing control1 or control2");
        return;
      }
      
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
      
      // Candidate selection and full run order logic have been removed.
      
      this.results = {
        mode: "start-time",
        selectedGc: this.allGcData[this.selectedGc]
          ? `${this.selectedGc} (Runtime: ${this.allGcData[this.selectedGc].runTime})`
          : this.selectedGc,
        batchStartTime: this.startTime.batchStartTime,
        batchStartTimeAMPM: ampmValue,
        startTimeFinalPosition: this.startTime.finalPosition,
        wait15: this.startTime.wait15,
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
    // Removed getters related to candidate selection and full run order.
  },
});
