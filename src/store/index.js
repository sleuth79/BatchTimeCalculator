import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';
import { formatTimeWithAmPmAndSeconds, formatDuration } from '../utils/utils.js';

export const pinia = createPinia();

// Helper: convert a runtime string ("mm:ss" or "hh:mm:ss") into total seconds.
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

// Fallback formatting if formatDuration returns an empty string.
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
      // Controls for storing C1 and C2:
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
    },
    setSequentialFinalPosition(position) {
      this.sequentialFinalPosition =
        this.sequentialFinalPosition === position ? null : position;
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
    },
    setControl2(value) {
      this.startTime.controls.control2 = value;
    },
    calculateStartTimeBatch() {
      function computeDelayedRunsStartTime(baseTimeStr, timeDelayRequired) {
        if (!baseTimeStr) return "";
        const parsed = parseTimeString(baseTimeStr);
        if (!parsed) return "";
        const { hour, minute, second } = parsed;
        const now = new Date();
        const baseDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          minute,
          second
        );
        let delayHours = 0;
        const delayParts = timeDelayRequired.split(" ");
        if (delayParts.length > 0) {
          delayHours = parseInt(delayParts[0], 10) || 0;
        }
        baseDate.setHours(baseDate.getHours() + delayHours);
        return formatTime(baseDate);
      }

      const { batchStartTime, batchStartTimeAMPM, finalPosition, wait15 } =
        this.startTime;
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

      // --- Compute Allowed Sample Positions (mirroring run table logic) ---
      const c1 = Number(this.startTime.controls.control1) || 0;
      const c2 = Number(this.startTime.controls.control2) || 0;
      const bigger = Math.max(c1, c2);
      const smaller = Math.min(c1, c2);
      const allowedPositions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === bigger || num === smaller || num === 16) continue;
        allowedPositions.push(num);
      }
      // --- End Allowed Positions ---

      // --- Candidate Selection ---
      // Build array of control values.
      const controlValues = [];
      if (this.startTime.controls.control1) {
        controlValues.push(Number(this.startTime.controls.control1));
      }
      if (this.startTime.controls.control2) {
        controlValues.push(Number(this.startTime.controls.control2));
      }

      const todayStr = new Date().toDateString();
      const cutoff = new Date(`${todayStr} 4:00:00 PM`);

      // Filter runs that end before 4:00 PM and that are sample runs (position >= 4).
      const candidateRuns = calcResults.runs.filter(r => {
        if (!r.endTime || r.position < 4) return false;
        const endDate = new Date(`${todayStr} ${r.endTime}`);
        return endDate < cutoff;
      });

      // Sort candidate runs in descending order by end time.
      candidateRuns.sort(
        (a, b) =>
          new Date(`${todayStr} ${b.endTime}`) - new Date(`${todayStr} ${a.endTime}`)
      );

      // Now, for each candidate run, determine its mapped sample position from the allowedPositions.
      // The mapping: for a candidate run, the sample index = run.position - 4.
      let candidate = null;
      for (const r of candidateRuns) {
        const index = r.position - 4;
        const mappedSample = allowedPositions[index];
        if (mappedSample !== undefined) {
          // We want the candidate that gives the highest mapped sample value.
          candidate = r;
          break;
        }
      }

      // Set the closest position result using the mapped sample position.
      calcResults.closestPositionBefore4PM = candidate
        ? {
            position: allowedPositions[candidate.position - 4],
            startTime: candidate.startTime,
            endTime: candidate.endTime,
          }
        : "No Sample Position Ends Before 4:00 PM";
      // --- End Candidate Selection ---

      // Build base results.
      this.results = {
        ...partialResults,
        totalRuns: calcResults.totalRuns,
        totalRunTime: calcResults.totalRunTime,
        batchEndTime: calcResults.batchEndTime,
        closestPositionBefore4PM: calcResults.closestPositionBefore4PM,
        timeGapTo730AM: calcResults.timeGapTo730AM,
        timeDelayRequired: calcResults.timeDelayRequired,
        runs: calcResults.runs,
      };

      this.lastStartTimeInputs = { ...this.startTime };

      // (Additional runs duration computation remains unchanged.)
      if (this.sequentialFinalPosition !== null) {
        const seqFinal = Number(this.sequentialFinalPosition);
        const miscAdditional = this.additionalRuns ? Number(this.additionalRuns) : 0;
        const totalRunsSequential =
          (seqFinal <= 15 ? seqFinal + 2 : seqFinal + 1) + miscAdditional;
        const initialBatchEndTime = calcResults.batchEndTimeDate;
        const runtimeSeconds = Math.round(runtimeSec);
        const sequentialBatchRunTimeMS = totalRunsSequential * runtimeSeconds * 1000;
        const sequentialBatchEndTimeDate = new Date(
          initialBatchEndTime.getTime() + sequentialBatchRunTimeMS
        );
        const sequentialBatchEndTime = formatTimeWithAmPmAndSeconds(
          sequentialBatchEndTimeDate
        );
        const overallTotalRuns = calcResults.totalRuns + totalRunsSequential;
        const target = new Date(initialBatchEndTime);
        target.setHours(7, 30, 0, 0);
        target.setDate(target.getDate() + 1);

        const diffMS =
          target.getTime() - sequentialBatchEndTimeDate.getTime();
        const absDiffMS = Math.abs(diffMS);
        const gapHours = Math.floor(absDiffMS / (1000 * 60 * 60));
        const gapMinutes = Math.floor(
          (absDiffMS % (1000 * 60 * 60)) / (1000 * 60)
        );
        const newTimeGap =
          diffMS >= 0
            ? `${gapHours} hours, ${gapMinutes} minutes`
            : `This batch passes 7:30 AM by ${gapHours} hours, ${gapMinutes} minutes`;
        const newTimeDelayRequired = calcResults.timeDelayRequired;

        const additionalRunsDurationSeconds =
          totalRunsSequential * runtimeSeconds;
        let formatted = formatDuration(additionalRunsDurationSeconds * 1000);
        if (!formatted || formatted.trim() === "") {
          formatted = fallbackFormatDuration(additionalRunsDurationSeconds * 1000);
        }
        const additionalRunsDurationFormatted = formatted || "0 seconds";

        const delayedRunsStartTimeComputed = computeDelayedRunsStartTime(
          sequentialBatchEndTime,
          newTimeDelayRequired
        );

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
          additionalRunsDuration: additionalRunsDurationFormatted,
        };
        this.results = {
          ...this.results,
          additionalRunsDuration: additionalRunsDurationFormatted,
        };
      } else {
        const additionalRunsCount = Number(this.additionalRuns) || 0;
        const additionalRunsDurationSeconds = additionalRunsCount * runtimeSec;
        let formatted = formatDuration(additionalRunsDurationSeconds * 1000);
        if (!formatted || formatted.trim() === "") {
          formatted = fallbackFormatDuration(additionalRunsDurationSeconds * 1000);
        }
        const additionalRunsDurationFormatted = formatted || "0 seconds";
        const baseTimeStr = calcResults.batchEndTime;
        const delayedRunsStartTimeComputed = computeDelayedRunsStartTime(
          baseTimeStr,
          calcResults.timeDelayRequired
        );
        this.timeDelayResults = {
          sequentialBatchActive: false,
          sequentialFinalPosition: 0,
          sequentialBatchEndTime: "",
          prerunsDescription: calcResults.prerunsDescription || "None",
          timeDelayRequired: calcResults.timeDelayRequired,
          timeGapTo730AM: calcResults.timeGapTo730AM,
          totalDelayedRuns: calcResults.totalDelayedRuns || 0,
          delayedRunsEndTime: calcResults.delayedRunsEndTime || "",
          totalDelayedDurationFormatted:
            calcResults.totalDelayedDurationFormatted || "",
          delayedRunsStartTime: delayedRunsStartTimeComputed,
          additionalRunsDuration: additionalRunsDurationFormatted,
        };
        this.results = {
          ...this.results,
          additionalRunsDuration: additionalRunsDurationFormatted,
        };
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
      const baseDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        minute,
        second
      );
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
  },
});
