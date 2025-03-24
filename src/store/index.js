import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';
import { formatTimeWithAmPmAndSeconds, formatDuration } from '../utils/utils.js';
import { selectCandidate } from '../utils/candidateSelection.js';

console.log("DEBUG: useGcStore module loaded");

export const pinia = createPinia();

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

// (The helper functions getDisplayedPosition, generateSampleAllowed, generateFullOrder,
// and extractSamplePositions remain here for compatibility with other parts of your app.)

function getDisplayedPosition(raw, controls) {
  const control1 = Number(controls.control1);
  const control2 = Number(controls.control2);
  console.log(`[${new Date().toLocaleTimeString()}] getDisplayedPosition: raw=${raw}, control1=${control1}, control2=${control2}`);
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
    if (raw === control1 || raw === control2) {
      if (raw < 23) {
        console.log(`Raw ${raw}: equals a control in lower block; adjusting upward.`);
        sample = raw + 1;
      } else {
        console.log(`Raw ${raw}: equals a control in higher block; adjusting downward.`);
        sample = raw - 1;
      }
    }
  }
  console.log(`Final displayed sample for raw ${raw} = ${sample}`);
  return sample;
}

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

function generateFullOrder(finalPos, gcType, controls) {
  const order = [];
  order.push("Blank");
  order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
  const c1 = Number(controls.control1);
  const c2 = Number(controls.control2);
  const biggerControl = Math.max(c1, c2);
  const smallerControl = Math.min(c1, c2);
  order.push(`1st Control - ${biggerControl}`);
  const allowed = generateSampleAllowed(finalPos, controls);
  if (finalPos < 13) {
    for (const s of allowed) {
      order.push(`Position ${s}`);
    }
    order.push(`2nd Control - ${smallerControl}`);
    return order;
  }
  if (finalPos < 23) {
    const group1 = allowed.filter(n => n <= 12);
    const group2 = allowed.filter(n => n > 12);
    for (const s of group1) {
      order.push(`Position ${s}`);
    }
    order.push(`2nd Control - ${smallerControl}`);
    for (const s of group2) {
      order.push(`Position ${s}`);
    }
    order.push(`3rd Control - ${biggerControl}`);
    return order;
  }
  const group1 = allowed.filter(n => n <= 12);
  const group2 = allowed.filter(n => n >= 13 && n <= 22);
  const group3 = allowed.filter(n => n > 22);
  for (const s of group1) {
    order.push(`Position ${s}`);
  }
  order.push(`2nd Control - ${smallerControl}`);
  for (const s of group2) {
    order.push(`Position ${s}`);
  }
  const thirdLabel = `3rd Control - ${biggerControl}`;
  const indexOf22 = order.indexOf("Position 22");
  if (indexOf22 !== -1) {
    order.splice(indexOf22 + 1, 0, thirdLabel);
  } else if (biggerControl === 22) {
    const indexOf21 = order.indexOf("Position 21");
    if (indexOf21 !== -1) {
      order.splice(indexOf21 + 1, 0, thirdLabel);
    } else {
      order.push(thirdLabel);
    }
  } else {
    order.push(thirdLabel);
  }
  for (const s of group3) {
    order.push(`Position ${s}`);
  }
  order.push(`4th Control - ${smallerControl}`);
  return order;
}

function extractSamplePositions(fullOrder) {
  return fullOrder.filter(item => item.startsWith("Position "));
}

export const useGcStore = defineStore('gc', {
  state: () => ({
    allGcData: {},
    selectedGc: null,
    results: null,
    isLoading: false,
    error: null,
    calculationAttempted: false,
    startTime: {
      batchStartTime: null,
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
        wait15: selectedGcType === "Energy",
        finalPosition: null,
        batchEndTime: null,
        controls: { control1: 3, control2: 18 }
      };
      this.lastStartTimeInputs = null;
      this.sequentialFinalPosition = null;
      this.startTimeResetCounter++;
      this.rawClosestCandidate = null;
      console.log(`[${new Date().toLocaleTimeString()}] resetStartTime() called. New startTime:`, this.startTime);
    },
    setSequentialFinalPosition(position) {
      this.sequentialFinalPosition = this.sequentialFinalPosition === position ? null : position;
      this.calculateStartTimeBatch();
    },
    setBatchStartTime(time) {
      this.startTime.batchStartTime = time;
      console.log(`[${new Date().toLocaleTimeString()}] Batch Start Time updated to:`, time);
      this.calculateStartTimeBatch();
    },
    setWait15(value) {
      this.startTime.wait15 = value;
      console.log(`[${new Date().toLocaleTimeString()}] Wait15 updated to:`, value);
    },
    setStartTimeFinalPosition(position) {
      this.startTime.finalPosition = position;
      console.log(`[${new Date().toLocaleTimeString()}] Final Position updated to:`, position);
    },
    setControl1(value) {
      this.startTime.controls.control1 = value;
      console.log(`[${new Date().toLocaleTimeString()}] Control1 updated to:`, value);
      setTimeout(() => {
        this.calculateStartTimeBatch();
      }, 300);
    },
    setControl2(value) {
      this.startTime.controls.control2 = value;
      console.log(`[${new Date().toLocaleTimeString()}] Control2 updated to:`, value);
      setTimeout(() => {
        this.calculateStartTimeBatch();
      }, 300);
    },
    calculateStartTimeBatch() {
      console.log(`[${new Date().toLocaleTimeString()}] Calculating Start Time Batch with controls:`, JSON.stringify(this.startTime.controls));
      console.log("Batch Start Time:", this.startTime.batchStartTime);
      
      let partialResults = { mode: "start-time" };
      if (this.selectedGc) {
        partialResults.selectedGc = this.allGcData[this.selectedGc]
          ? `${this.selectedGc} (Runtime: ${this.allGcData[this.selectedGc].runTime})`
          : this.selectedGc;
      }
      if (this.startTime.batchStartTime) {
        partialResults.batchStartTime = this.startTime.batchStartTime;
      }
      if (this.startTime.finalPosition) {
        partialResults.startTimeFinalPosition = this.startTime.finalPosition;
      }
      if (this.startTime.wait15 !== null && this.startTime.wait15 !== undefined) {
        partialResults.wait15 = this.startTime.wait15;
      }
      
      const { control1, control2 } = this.startTime.controls;
      if (control1 === null || control1 === "" || control2 === null || control2 === "") {
        console.log(`[${new Date().toLocaleTimeString()}] Incomplete controls. Aborting candidate selection.`, this.startTime.controls);
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
        this.startTime.finalPosition,
        this.startTime.batchStartTime,
        "",
        this.startTime.wait15
      );
      this.startTime.batchEndTime = calcResults.batchEndTimeDate || new Date();
      
      // Derive the batch date from the batch start time.
      const batchDate = new Date();
      if (this.startTime.batchStartTime) {
        const parts = this.startTime.batchStartTime.split(":");
        batchDate.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
      }
      
      const gcType = (this.allGcData[this.selectedGc]?.type || "").trim().toLowerCase();
      const finalPosNum = Number(this.startTime.finalPosition);
      
      // Use the candidate selection utility, passing in the batch date.
      const selection = selectCandidate(calcResults.runs, this.startTime.controls, finalPosNum, gcType, batchDate);
      const candidate = selection.candidate;
      const adjustedCandidate = selection.adjustedCandidate;
      const displayedLabel = selection.displayedLabel;
      
      console.log(`[${new Date().toLocaleTimeString()}] Final candidate:`, candidate, "Adjusted as:", adjustedCandidate, "Displayed as:", displayedLabel);
      
      this.results = {
        ...partialResults,
        totalRuns: calcResults.totalRuns,
        totalRunTime: calcResults.totalRunTime,
        batchEndTime: calcResults.batchEndTime,
        closestPositionBefore4PM: candidate
          ? {
              rawPosition: adjustedCandidate,
              displayedPosition: displayedLabel,
              startTime: candidate.startTime,
              endTime: candidate.endTime,
            }
          : "No Sample Position Ends Before 4:00 PM",
        timeGapTo730AM: calcResults.timeGapTo730AM,
        timeDelayRequired: calcResults.timeDelayRequired,
        runs: calcResults.runs,
      };
      
      console.log(`[${new Date().toLocaleTimeString()}] Calculation complete. Current startTime state:`, JSON.stringify(this.startTime, null, 2));
      this.lastStartTimeInputs = { ...this.startTime };
      
      // Additional Runs Duration Computation remains unchanged...
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
        const delayedRunsStartTimeComputed = (function() {
          if (!baseTimeStr) return "";
          const parsed = parseTimeString(baseTimeStr);
          if (!parsed) return "";
          const { hour, minute, second } = parsed;
          const now = new Date();
          const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
          const delayStr = (calcResults.timeDelayRequired) || "";
          let delayHours = 0;
          const delayParts = delayStr.split(" ");
          if (delayParts.length > 0) {
            delayHours = parseInt(delayParts[0], 10) || 0;
          }
          baseDate.setHours(baseDate.getHours() + delayHours);
          return formatTime(baseDate);
        })();
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
    displayedClosestCandidate: (state) => {
      if (!state.rawClosestCandidate || !state.startTime || 
          !state.startTime.finalPosition || !state.startTime.controls ||
          state.startTime.controls.control1 === null || state.startTime.controls.control1 === "" ||
          state.startTime.controls.control2 === null || state.startTime.controls.control2 === "") {
        return "No Sample Position Ends Before 4:00 PM";
      }
      const finalPos = Number(state.startTime.finalPosition);
      const gcType = (state.allGcData[state.selectedGc]?.type || "").trim().toLowerCase();
      const fullOrder = generateFullOrder(finalPos, gcType, state.startTime.controls);
      const sampleOrder = extractSamplePositions(fullOrder);
      const adjustedCandidate = getDisplayedPosition(state.rawClosestCandidate.position, state.startTime.controls);
      const candidateIndex = sampleOrder.findIndex(label => label === `Position ${adjustedCandidate}`);
      
      return candidateIndex !== -1
        ? {
            displayedPosition: `Position ${adjustedCandidate}`,
            startTime: state.rawClosestCandidate.startTime,
            endTime: state.rawClosestCandidate.endTime
          }
        : state.rawClosestCandidate.position;
    }
  },
});
