import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';
import { formatTimeWithAmPmAndSeconds, formatDuration } from '../utils/utils.js';

console.log("DEBUG: useGcStore module loaded");

export const pinia = createPinia();

//
// Helper: convert a runtime string ("mm:ss" or "hh:mm:ss") into total seconds.
//
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

//
// Fallback formatting if formatDuration returns an empty string.
//
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
  getDisplayedPosition computes the displayed (adjusted) sample number from the raw run number
  and the control values for simple cases.
  
  NOTE: This function is no longer used for candidate selection since we now recalc the full
  run order for consistency with the run table.
*/
function getDisplayedPosition(raw, controls) {
  const control1 = Number(controls.control1);
  const control2 = Number(controls.control2);
  console.log(`getDisplayedPosition: raw = ${raw}, control1 = ${control1}, control2 = ${control2}`);
  if (raw < 4) return null;
  
  let sample;
  if (raw < 17) {
    sample = raw - 1;
    if (sample === control1 || sample === control2) {
      console.log(`Raw ${raw}: base sample ${sample} equals a control; adjusting downward.`);
      sample = sample - 1;
    }
  } else {
    sample = raw;
    if (sample === control1 || sample === control2) {
      console.log(`Raw ${raw}: base sample ${sample} equals a control; adjusting upward.`);
      sample = sample + 1;
    }
  }
  console.log(`Final displayed sample for raw ${raw} = ${sample}`);
  return sample;
}

//
// NEW helper: generate allowed sample numbers (mimicking run table’s "sampleAllowed")
// Samples are numbers from 3 to finalPos (or 32) excluding the control numbers and 16.
//
function generateSampleAllowed(finalPos, controls) {
  const arr = [];
  for (let num = 3; num <= finalPos; num++) {
    if (
      num === Number(controls.control1) ||
      num === Number(controls.control2) ||
      num === 16
    ) {
      continue;
    }
    arr.push(num);
  }
  return arr;
}

//
// NEW helper: generate the displayed sample order, similar to the run table's generatePositionOrder.
// This returns an array of objects representing sample rows only with their raw number and display label.
// (Control rows are omitted here because we only need to pick from sample positions.)
// For different ranges of finalPos the run table groups samples differently; here we simply
// maintain the grouping order (group1, then group2, then group3) so that the ordering matches the run table.
function generateDisplayedOrder(finalPos, gcType, controls) {
  const sampleAllowed = generateSampleAllowed(finalPos, controls);
  let displayedSamples = [];

  if (finalPos < 13) {
    // All allowed samples in order.
    displayedSamples = sampleAllowed.map(n => ({ raw: n, label: `Position ${n}` }));
  } else if (finalPos < 23) {
    // For positions 13-22, the run table splits into group1 (≤12) and group2 (>12).
    const group1 = sampleAllowed.filter(n => n <= 12);
    const group2 = sampleAllowed.filter(n => n > 12);
    displayedSamples = [
      ...group1.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group2.map(n => ({ raw: n, label: `Position ${n}` }))
    ];
  } else {
    // finalPos >= 23
    const group1 = sampleAllowed.filter(n => n <= 12);
    const group2 = sampleAllowed.filter(n => n >= 13 && n <= 22);
    const group3 = sampleAllowed.filter(n => n > 22);
    // In the run table, even though controls are inserted between groups,
    // the sample labels remain "Position {n}". So the displayed order for samples is:
    displayedSamples = [
      ...group1.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group2.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group3.map(n => ({ raw: n, label: `Position ${n}` }))
    ];
  }
  return displayedSamples;
}

export const useGcStore = defineStore('gc', {
  state: () => ({
    allGcData: {},
    selectedGc: null,
    results: null,
    isLoading: false,
    error: null,
    calculationAttempted: false,
    // Start‑time mode state:
    startTime: {
      batchStartTime: null,
      batchStartTimeAMPM: "",
      wait15: null,
      finalPosition: null,
      batchEndTime: null,
      controls: {
        control1: null,
        control2: null,
      },
    },
    lastStartTimeInputs: null,
    sequentialFinalPosition: null,
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
    miscRuns: 0,
    // New state: store the raw candidate run (before control adjustments)
    rawClosestCandidate: null,
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
        batchStartTimeAMPM: null,
        wait15: selectedGcType === "Energy",
        finalPosition: null,
        batchEndTime: null,
        controls: {
          control1: null,
          control2: null,
        },
      };
      this.lastStartTimeInputs = null;
      this.sequentialFinalPosition = null;
      this.startTimeResetCounter++;
      this.rawClosestCandidate = null;
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
      this.calculateStartTimeBatch();
    },
    setControl2(value) {
      this.startTime.controls.control2 = value;
      console.log("Control2 updated to:", value);
      this.calculateStartTimeBatch();
    },
    calculateStartTimeBatch() {
      console.log("Current controls in store:", JSON.stringify(this.startTime.controls));
      // Helper to compute the delayed runs start time.
      function computeDelayedRunsStartTime(baseTimeStr, timeDelayRequired) {
        if (!baseTimeStr) return "";
        const parsed = parseTimeString(baseTimeStr);
        if (!parsed) return "";
        const { hour, minute, second } = parsed;
        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
        let delayHours = 0;
        const delayParts = timeDelayRequired.split(" ");
        if (delayParts.length > 0) {
          delayHours = parseInt(delayParts[0], 10) || 0;
        }
        baseDate.setHours(baseDate.getHours() + delayHours);
        return formatTime(baseDate);
      }

      const { batchStartTime, batchStartTimeAMPM, finalPosition, wait15 } = this.startTime;
      let partialResults = { mode: "start-time" };

      if (this.selectedGc) {
        partialResults.selectedGc = this.allGcData[this.selectedGc]
          ? `${this.selectedGc} (Runtime: ${this.allGcData[this.selectedGc].runTime})`
          : this.selectedGc;
      }
      if (batchStartTime) {
        partialResults.batchStartTime = batchStartTime;
        partialResults.batchStartTimeAMPM = batchStartTimeAMPM;
      }
      if (finalPosition) {
        partialResults.startTimeFinalPosition = finalPosition;
      }
      if (wait15 !== null && wait15 !== undefined) {
        partialResults.wait15 = wait15;
      }
      if (!this.selectedGc || !batchStartTime || !finalPosition) {
        this.results = partialResults;
        console.log("Incomplete inputs:", partialResults);
        return;
      }

      this.calculationAttempted = true;
      const runtime = this.allGcData[this.selectedGc].runTime;
      const runtimeSec = convertRuntime(runtime);
      const calcResults = calculateStartTimeBatch(
        this.selectedGc,
        runtime,
        null,
        finalPosition,
        batchStartTime,
        batchStartTimeAMPM,
        wait15
      );
      this.startTime.batchEndTime = calcResults.batchEndTimeDate || new Date();

      // --- Candidate Selection using recalculated displayed order ---
      const todayStr = new Date().toDateString();
      const cutoff = new Date(`${todayStr} 4:00:00 PM`);
      console.log("Cutoff time:", cutoff);

      // Get gcType from the selected GC's data (trim and lower-case if needed)
      const gcType = (this.allGcData[this.selectedGc]?.type || "").trim().toLowerCase();
      const finalPos = Number(finalPosition);
      // Recalculate the displayed order for sample positions
      const displayedSamples = generateDisplayedOrder(finalPos, gcType, this.startTime.controls);
      console.log("Displayed Samples Order:", displayedSamples);

      // Filter candidate runs: each run must have an endTime,
      // its raw position must be in our displayedSamples (i.e. not a control),
      // and its endTime is before 4:00 PM.
      const candidateRuns = calcResults.runs.filter(r => {
        if (!r.endTime || r.position < 4) return false;
        if (!displayedSamples.some(s => s.raw === r.position)) return false;
        const endDate = new Date(`${todayStr} ${r.endTime}`);
        return endDate < cutoff;
      });
      console.log("Candidate runs after filtering by time and displayed order:", candidateRuns);

      // Sort candidate runs by their index in displayedSamples.
      candidateRuns.sort((a, b) => {
        const indexA = displayedSamples.findIndex(s => s.raw === a.position);
        const indexB = displayedSamples.findIndex(s => s.raw === b.position);
        return indexA - indexB;
      });
      console.log("Candidate runs sorted by displayed order:", candidateRuns);

      // Choose the candidate with the highest displayed order (i.e. last in the sorted array).
      const candidate = candidateRuns[candidateRuns.length - 1];
      this.rawClosestCandidate = candidate;
      let displayedLabel = candidate ? (displayedSamples.find(s => s.raw === candidate.position)?.label || candidate.position) : null;
      console.log("Final candidate:", candidate, "Displayed as:", displayedLabel);
      // --- End Candidate Selection ---

      this.results = {
        ...partialResults,
        totalRuns: calcResults.totalRuns,
        totalRunTime: calcResults.totalRunTime,
        batchEndTime: calcResults.batchEndTime,
        // Store candidate details including the displayed position label.
        closestPositionBefore4PM: candidate
          ? {
              rawPosition: candidate.position,
              displayedPosition: displayedLabel,
              startTime: candidate.startTime,
              endTime: candidate.endTime,
            }
          : "No Sample Position Ends Before 4:00 PM",
        timeGapTo730AM: calcResults.timeGapTo730AM,
        timeDelayRequired: calcResults.timeDelayRequired,
        runs: calcResults.runs,
      };

      this.lastStartTimeInputs = { ...this.startTime };

      // --- Additional Runs Duration Computation (unchanged) ---
      if (this.sequentialFinalPosition !== null) {
        const seqFinal = Number(this.sequentialFinalPosition);
        const miscAdditional = this.additionalRuns ? Number(this.additionalRuns) : 0;
        const totalRunsSequential = (seqFinal <= 15 ? seqFinal + 2 : seqFinal + 1) + miscAdditional;
        const initialBatchEndTime = calcResults.batchEndTimeDate;
        const runtimeSeconds = Math.round(runtimeSec);
        const sequentialBatchRunTimeMS = totalRunsSequential * runtimeSeconds * 1000;
        const sequentialBatchEndTimeDate = new Date(initialBatchEndTime.getTime() + sequentialBatchRunTimeMS);
        const sequentialBatchEndTime = formatTimeWithAmPmAndSeconds(sequentialBatchEndTimeDate);
        const overallTotalRuns = calcResults.totalRuns + totalRunsSequential;
        const target = new Date(initialBatchEndTime);
        target.setHours(7, 30, 0, 0);
        target.setDate(target.getDate() + 1);

        const diffMS = target.getTime() - sequentialBatchEndTimeDate.getTime();
        const absDiffMS = Math.abs(diffMS);
        const gapHours = Math.floor(absDiffMS / (1000 * 60 * 60));
        const gapMinutes = Math.floor((absDiffMS % (1000 * 60 * 60)) / (1000 * 60));
        const newTimeGap = diffMS >= 0 
          ? `${gapHours} hours, ${gapMinutes} minutes`
          : `This batch passes 7:30 AM by ${gapHours} hours, ${gapMinutes} minutes`;
        const newTimeDelayRequired = calcResults.timeDelayRequired;

        const additionalRunsDurationSeconds = totalRunsSequential * runtimeSeconds;
        let formatted = formatDuration(additionalRunsDurationSeconds * 1000);
        if (!formatted || formatted.trim() === "") {
          formatted = fallbackFormatDuration(additionalRunsDurationSeconds * 1000);
        }
        const additionalRunsDurationFormatted = formatted || "0 seconds";

        const delayedRunsStartTimeComputed = computeDelayedRunsStartTime(sequentialBatchEndTime, newTimeDelayRequired);

        this.timeDelayResults = {
          sequentialBatchActive: true,
          sequentialFinalPosition: seqFinal,
          totalRunsSequential: totalRunsSequential,
          sequentialBatchEndTime: sequentialBatchEndTime,
          overallTotalRuns: overallTotalRuns,
          timeDelayRequired: newTimeDelayRequired,
          timeGapTo730AM: newTimeGap,
          prerunsDescription: (function() {
            let desc = (calcResults.prerunsDescription || "None").trim();
            desc = desc.replace(/\s*\(\d+\)\s*$/, "");
            if (desc.toLowerCase().includes("prebatch")) return "Prebatch";
            if (desc.toLowerCase().includes("calibration")) return "Calibration";
            return desc;
          })(),
          delayedRunsStartTime: delayedRunsStartTimeComputed,
          additionalRunsDuration: additionalRunsDurationFormatted
        };
        this.results = { ...this.results, additionalRunsDuration: additionalRunsDurationFormatted };
      } else {
        const additionalRunsCount = Number(this.additionalRuns) || 0;
        const additionalRunsDurationSeconds = additionalRunsCount * runtimeSec;
        let formatted = formatDuration(additionalRunsDurationSeconds * 1000);
        if (!formatted || formatted.trim() === "") {
          formatted = fallbackFormatDuration(additionalRunsDurationSeconds * 1000);
        }
        const additionalRunsDurationFormatted = formatted || "0 seconds";
        const baseTimeStr = calcResults.batchEndTime;
        const delayedRunsStartTimeComputed = computeDelayedRunsStartTime(baseTimeStr, calcResults.timeDelayRequired);
        this.timeDelayResults = {
          sequentialBatchActive: false,
          sequentialFinalPosition: 0,
          sequentialBatchEndTime: '',
          prerunsDescription: calcResults.prerunsDescription || "None",
          timeDelayRequired: calcResults.timeDelayRequired,
          timeGapTo730AM: calcResults.timeGapTo730AM,
          totalDelayedRuns: calcResults.totalDelayedRuns || 0,
          delayedRunsEndTime: calcResults.delayedRunsEndTime || '',
          totalDelayedDurationFormatted: calcResults.totalDelayedDurationFormatted || '',
          delayedRunsStartTime: delayedRunsStartTimeComputed,
          additionalRunsDuration: additionalRunsDurationFormatted
        };
        this.results = { ...this.results, additionalRunsDuration: additionalRunsDurationFormatted };
      }
    },
  },
  getters: {
    selectedGcData: (state) =>
      state.selectedGc && state.allGcData
        ? state.allGcData[state.selectedGc]
        : null,
    delayedRunsStartTime: (state) => {
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
    finalPositions: (state) => {
      const { control1, control2 } = state.startTime.controls;
      let finalPosition = null;
      let sequentialFinalPosition = null;
      if (control1 !== null && control1 !== undefined && control1 !== "") {
        finalPosition = Number(control1);
      }
      if (
        control1 !== null &&
        control1 !== undefined &&
        control1 !== "" &&
        control2 !== null &&
        control2 !== undefined &&
        control2 !== ""
      ) {
        sequentialFinalPosition = Number(control1) + Number(control2);
      }
      return { finalPosition, sequentialFinalPosition };
    },
    // NEW computed getter: returns the displayed candidate based on the raw candidate and current controls.
    displayedClosestCandidate: (state) => {
      if (!state.rawClosestCandidate) return "No Sample Position Ends Before 4:00 PM";
      // We recalc the displayed order so we can return the correct label.
      const finalPos = Number(state.startTime.finalPosition);
      const gcType = (state.allGcData[state.selectedGc]?.type || "").trim().toLowerCase();
      const displayedSamples = generateDisplayedOrder(finalPos, gcType, state.startTime.controls);
      const candidateMapping = displayedSamples.find(s => s.raw === state.rawClosestCandidate.position);
      return {
        position: candidateMapping ? candidateMapping.label : state.rawClosestCandidate.position,
        startTime: state.rawClosestCandidate.startTime,
        endTime: state.rawClosestCandidate.endTime
      };
    }
  },
});
