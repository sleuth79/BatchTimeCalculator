import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';

export const pinia = createPinia();

// Helper function: convert a runtime string ("mm:ss" or "hh:mm:ss") into total seconds.
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
      // Raw Date for batch end time.
      batchEndTime: null,
    },
    // (Optional) Save last start‑time inputs if needed.
    lastStartTimeInputs: null,
    // Sequential batch selection (only used in start‑time mode)
    sequentialFinalPosition: null,
    // Time Delay Results (will include sequential batch fields if applicable)
    timeDelayResults: {
      prerunsDescription: 'None',
      totalDelayedRuns: 0,
      delayedRunsEndTime: '',
      totalDelayedDurationFormatted: '',
      delayedRunsStartTime: '',
    },
    // A counter to trigger resets even if inputs haven't changed.
    startTimeResetCounter: 0,
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

    // Removed setSelectedMode action since we no longer support mode switching.
    // The app now always uses start‑time mode.

    resetStartTime() {
      const selectedGcType = this.selectedGc && this.allGcData[this.selectedGc]?.type;
      this.startTime = {
        batchStartTime: null,
        batchStartTimeAMPM: null,
        wait15: selectedGcType === "Energy",
        finalPosition: null,
        batchEndTime: null,
      };
      this.lastStartTimeInputs = null;
      this.sequentialFinalPosition = null;
      this.startTimeResetCounter++;
    },

    setSequentialFinalPosition(position) {
      if (this.sequentialFinalPosition === position) {
        this.sequentialFinalPosition = null;
      } else {
        this.sequentialFinalPosition = position;
      }
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

    calculateStartTimeBatch() {
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
      let partialResults = { mode: 'start-time' };

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

      if (this.sequentialFinalPosition !== null) {
        const seqFinal = Number(this.sequentialFinalPosition);
        const totalRunsSequential = seqFinal <= 15 ? seqFinal + 2 : seqFinal + 1;
        const initialBatchEndTime = calcResults.batchEndTimeDate;
        const runtimeSeconds = Math.round(runtimeSec);
        const sequentialBatchRunTimeMS = totalRunsSequential * runtimeSeconds * 1000;
        const sequentialBatchEndTimeDate = new Date(
          initialBatchEndTime.getTime() + sequentialBatchRunTimeMS
        );
        const sequentialBatchEndTime = formatTime(sequentialBatchEndTimeDate);
        const overallTotalRuns = calcResults.totalRuns + totalRunsSequential;
        const target = new Date(initialBatchEndTime);
        target.setHours(7, 30, 0, 0);
        target.setDate(target.getDate() + 1);

        const diffMS = target.getTime() - sequentialBatchEndTimeDate.getTime();
        const absDiffMS = Math.abs(diffMS);
        const gapHours = Math.floor(absDiffMS / (1000 * 60 * 60));
        const gapMinutes = Math.floor((absDiffMS % (1000 * 60 * 60)) / (1000 * 60));
        const newTimeGap =
          diffMS >= 0 
            ? `${gapHours} hours, ${gapMinutes} minutes`
            : `This batch passes 7:30 AM by ${gapHours} hours, ${gapMinutes} minutes`;
        const newTimeDelayRequired = calcResults.timeDelayRequired;

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
            let desc = (calcResults.prerunsDescription || 'None').trim();
            desc = desc.replace(/\s*\(\d+\)\s*$/, '');
            if (desc.toLowerCase().includes("prebatch")) {
              return "Prebatch";
            } else if (desc.toLowerCase().includes("calibration")) {
              return "Calibration";
            }
            return desc;
          })(),
          delayedRunsStartTime: delayedRunsStartTimeComputed,
        };
      } else {
        const baseTimeStr = calcResults.batchEndTime;
        const delayedRunsStartTimeComputed = computeDelayedRunsStartTime(baseTimeStr, calcResults.timeDelayRequired);
        this.timeDelayResults = {
          sequentialBatchActive: false,
          sequentialFinalPosition: 0,
          sequentialBatchEndTime: '',
          prerunsDescription: calcResults.prerunsDescription || 'None',
          timeDelayRequired: calcResults.timeDelayRequired,
          timeGapTo730AM: calcResults.timeGapTo730AM,
          totalDelayedRuns: calcResults.totalDelayedRuns || 0,
          delayedRunsEndTime: calcResults.delayedRunsEndTime || '',
          totalDelayedDurationFormatted: calcResults.totalDelayedDurationFormatted || '',
          delayedRunsStartTime: delayedRunsStartTimeComputed,
        };
      }
    },
  },
  getters: {
    selectedGcData: (state) => {
      return state.selectedGc && state.allGcData
        ? state.allGcData[state.selectedGc]
        : null;
    },
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
  },
});
