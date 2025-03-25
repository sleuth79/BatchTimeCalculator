import { createPinia, defineStore } from 'pinia';
import { calculateStartTimeBatch } from '../utils/startTimeCalculations.js';
import { parseTimeString, formatTime } from '../utils/timeUtils.js';
import { formatTimeWithAmPmAndSeconds, formatDuration } from '../utils/utils.js';
import { selectCandidate } from '../utils/candidateSelection.js';

console.log("DEBUG: useGcStore module loaded");

export const pinia = createPinia();

/*
  Helper: convert a runtime string ("mm:ss" or "hh:mm:ss") into total seconds.
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
  Helper: fallback formatting for a duration in ms.
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
  Helper: parse a 24‑hour time string ("hh:mm") into a Date object.
  (We assume the time refers to today.)
*/
function parse24HourTimeToDate(timeStr) {
  const [hourStr, minuteStr] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return date;
}

/*
  getDisplayedPosition computes the adjusted sample number based on the raw run number and control values.
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

/*
  generateSampleAllowed creates allowed sample numbers (from 3 up to finalPos)
  excluding the control values and the number 16.
*/
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

/*
  generateFullOrder creates the full run order (with control rows)
  similar to your run table.
*/
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

/*
  extractSamplePositions returns only the sample positions from the full order.
*/
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
    // Start‑time state
    startTime: {
      // User enters 24‑hour string (e.g. "10:00")
      batchStartTime: null,
      // We now also store the computed AM/PM value for display.
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
    // raw candidate run (before control adjustments)
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
        batchStartTimeAMPM: "",
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
      
      // Guard: check that required inputs are provided.
      if (!this.startTime.batchStartTime) {
        console.log("Guard: Missing batchStartTime");
        this.results = { mode: "start-time" };
        return;
      }
      // For AM/PM, if the user did not enter a value, derive it from the 24‑hour input.
      let ampmValue = this.startTime.batchStartTimeAMPM;
      if (!ampmValue) {
        const dt = parse24HourTimeToDate(this.startTime.batchStartTime);
        ampmValue = dt.getHours() >= 12 ? "PM" : "AM";
        console.log(`Derived AM/PM from 24‑hour input: ${ampmValue}`);
      }
      // Additional guards: ensure finalPosition and controls are set.
      if (!this.startTime.finalPosition) {
        console.log("Guard: Missing finalPosition");
        this.results = { mode: "start-time" };
        return;
      }
      const { control1, control2 } = this.startTime.controls;
      if (control1 === null || control1 === "" || control2 === null || control2 === "") {
        console.log("Guard: Missing control1 or control2");
        this.results = { mode: "start-time" };
        return;
      }
      
      this.calculationAttempted = true;
      const runtime = this.allGcData[this.selectedGc].runTime;
      const runtimeSec = convertRuntime(runtime);
      // Call your calculation utility; note that we pass the derived ampmValue.
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
      
      const todayStr = new Date().toDateString();
      const cutoff = new Date(`${todayStr} 4:00:00 PM`);
      console.log("Cutoff time:", cutoff);
      
      const gcType = (this.allGcData[this.selectedGc]?.type || "").trim().toLowerCase();
      const finalPosNum = Number(this.startTime.finalPosition);
      const fullOrder = generateFullOrder(finalPosNum, gcType, this.startTime.controls);
      console.log("Full Order from run table:", fullOrder);
      const sampleOrder = extractSamplePositions(fullOrder);
      console.log("Sample Order:", sampleOrder);
      
      const candidateRuns = calcResults.runs.filter(r => {
        if (!r.endTime || r.position < 4) return false;
        if (isNaN(Number(r.position))) return false;
        if (
          r.position === Number(this.startTime.controls.control1) ||
          r.position === Number(this.startTime.controls.control2)
        ) {
          console.log(`Excluding run with raw position ${r.position} because it equals a control.`);
          return false;
        }
        const adjusted = getDisplayedPosition(r.position, this.startTime.controls);
        console.log(`Run raw position ${r.position} adjusted to ${adjusted}`);
        if (!sampleOrder.some(label => label === `Position ${adjusted}`)) {
          console.log(`Excluding run with adjusted sample Position ${adjusted} not in sample order.`);
          return false;
        }
        const endDate = new Date(`${todayStr} ${r.endTime}`);
        return endDate < cutoff;
      });
      console.log("Candidate runs after filtering:", candidateRuns);
      
      candidateRuns.sort((a, b) => {
        const adjustedA = getDisplayedPosition(a.position, this.startTime.controls);
        const adjustedB = getDisplayedPosition(b.position, this.startTime.controls);
        const indexA = sampleOrder.findIndex(label => label === `Position ${adjustedA}`);
        const indexB = sampleOrder.findIndex(label => label === `Position ${adjustedB}`);
        return indexA - indexB;
      });
      console.log("Candidate runs sorted:", candidateRuns);
      
      const candidate = candidateRuns[candidateRuns.length - 1];
      this.rawClosestCandidate = candidate;
      const adjustedCandidate = candidate ? getDisplayedPosition(candidate.position, this.startTime.controls) : null;
      const displayedLabel = candidate ? `Position ${adjustedCandidate}` : null;
      console.log("Final candidate:", candidate, "Adjusted as:", adjustedCandidate, "Displayed as:", displayedLabel);
      
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
      
      console.log("Calculation complete. Current startTime state:", JSON.stringify(this.startTime, null, 2));
      this.lastStartTimeInputs = { ...this.startTime };
      
      // (Additional Runs Duration Computation remains unchanged.)
      // ... (omitted for brevity)
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
