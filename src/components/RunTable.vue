<template>
  <div class="run-table">
    <!-- Initial Batch Table -->
    <table v-if="initialPositionOrder.length">
      <thead>
        <tr class="header-row">
          <th>Run</th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Run #</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="runsHasWait">
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
          <td>Wait</td>
        </tr>
        <tr
          v-for="(title, idx) in initialPositionOrder"
          :key="'initial-' + idx"
          :class="{ highlight: highlightCandidate && runtableClosestCandidateIndex === idx }"
        >
          <td>{{ title }}</td>
          <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].startTime) || "" }}</td>
          <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].endTime) || "" }}</td>
          <td>{{ idx + 1 }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Sequential Batch Section -->
    <div v-if="hasSequentialBatch">
      <h4>Sequential Batch</h4>
      <table>
        <thead>
          <tr class="header-row">
            <th>Run Name</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Run #</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in sequentialRows" :key="'sequential-' + idx">
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.positionDisplay }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Additional Runs Section -->
    <div v-if="additionalRows.length">
      <h4>Additional Runs</h4>
      <table>
        <thead>
          <tr class="header-row">
            <th>Run Name</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Run #</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in additionalRows" :key="'additional-' + idx">
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.positionDisplay }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Time Delay Row -->
    <div v-if="delayedRunSelected">
      <h4 class="time-delay-header">
        Time Delay: {{ timeDelayRequired }}
      </h4>
    </div>

    <!-- Delayed Runs Section -->
    <div v-if="prebatchRows.length">
      <h4>Delayed Runs</h4>
      <table>
        <thead>
          <tr class="header-row">
            <th>Run Name</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Run #</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in prebatchRows" :key="'prebatch-' + idx">
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.positionDisplay }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { computed, watch } from "vue";
import { useGcStore } from "../store";
import { parseTimeString } from "../utils/timeUtils.js";
import { formatTimeWithAmPmAndSeconds, formatDuration } from "../utils/utils.js";

// Helper: Convert a runtime string ("mm:ss" or "hh:mm:ss") into milliseconds.
function parseRunTime(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === "number") return timeStr * 60000;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
  return 0;
}

/**
 * Given a time string (e.g., "1:06:32 AM") and a reference Date,
 * returns a Date object set to that time.
 * If the computed time is earlier than the reference (indicating a rollover past midnight),
 * one day is added.
 */
function getDateFromTimeString(timeStr, referenceDate) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return new Date();
  let date = new Date(referenceDate);
  date.setHours(parsed.hour, parsed.minute, parsed.second, 0);
  if (date < referenceDate) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export default {
  name: "RunTable",
  props: {
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props, { emit }) {
    const gcStore = useGcStore();

    // 1. Check for "Wait" row.
    const runsHasWait = computed(() =>
      props.runs.length > 0 &&
      String(props.runs[0].position).toLowerCase() === "wait"
    );
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));

    // 2. Base runs: all runs except the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // 3. Generate initial batch order if finalPosition is provided.
    const initialPositionOrder = computed(() => {
      if (!gcStore.startTime.finalPosition) return [];
      const fp = Number(gcStore.startTime.finalPosition);
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, gcType);
    });

    // 4. Controls from store.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const biggerControl = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const smallerControl = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // 5. Allowed sample positions.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === biggerControl.value || num === smallerControl.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr;
    });

    // 6. Helper to generate run order.
    function generatePositionOrder(finalPos, gcType) {
      const order = [];
      order.push("Blank");
      order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
      order.push(`1st Control : ${biggerControl.value}`);
      const samples = sampleAllowed.value.filter(n => n <= finalPos);
      if (finalPos < 13) {
        for (const s of samples) {
          order.push(`Position ${s}`);
        }
        order.push(`2nd Control : ${smallerControl.value}`);
        return order;
      }
      if (finalPos < 23) {
        const group1 = samples.filter(n => n <= 12);
        const group2 = samples.filter(n => n > 12);
        for (const s of group1) {
          order.push(`Position ${s}`);
        }
        order.push(`2nd Control : ${smallerControl.value}`);
        for (const s of group2) {
          order.push(`Position ${s}`);
        }
        order.push(`3rd Control : ${biggerControl.value}`);
        return order;
      }
      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n >= 13 && n <= 22);
      const group3 = samples.filter(n => n > 22);
      for (const s of group1) {
        order.push(`Position ${s}`);
      }
      order.push(`2nd Control : ${smallerControl.value}`);
      for (const s of group2) {
        order.push(`Position ${s}`);
      }
      const thirdLabel = `3rd Control : ${biggerControl.value}`;
      const indexOf22 = order.indexOf("Position 22");
      if (indexOf22 !== -1) {
        order.splice(indexOf22 + 1, 0, thirdLabel);
      } else if (biggerControl.value === 22) {
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
      order.push(`4th Control : ${smallerControl.value}`);
      return order;
    }

    // 7. Sequential batch order (using sequentialFinalPosition).
    const sequentialPositionOrder = computed(() => {
      if (!gcStore.sequentialFinalPosition) return [];
      const seqFP = Number(gcStore.sequentialFinalPosition);
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(seqFP, gcType);
    });

    // 8. Split baseRuns into initial and sequential groups.
    const initialBaseRuns = computed(() =>
      baseRuns.value.slice(0, initialPositionOrder.value.length)
    );
    const sequentialBaseRuns = computed(() => {
      const startIndex = initialPositionOrder.value.length;
      return baseRuns.value.slice(startIndex);
    });

    // 9. Flag for sequential batch.
    const hasSequentialBatch = computed(() => !!gcStore.sequentialFinalPosition);

    // 10. Compute candidate index – only consider runs whose end time,
    // when placed on the batch start’s date, falls between the batch start and 4:00 PM.
    const runtableClosestCandidateIndex = computed(() => {
      const base = initialBaseRuns.value;
      if (!base || base.length === 0) return -1;
      
      // Use the first run's start time (from props) to set the batch start.
      const batchStartParsed = parseTimeString(props.runs[0].startTime);
      if (!batchStartParsed) return -1;
      let batchStart = new Date();
      batchStart.setHours(batchStartParsed.hour, batchStartParsed.minute, batchStartParsed.second, 0);
      
      // Define the cutoff as 4:00 PM on the same day.
      let cutoff = new Date(batchStart);
      cutoff.setHours(16, 0, 0, 0);
      
      let candidateIndex = -1;
      let candidateTime = null;
      
      base.forEach((run, idx) => {
        if (!run.endTime) return;
        const endParsed = parseTimeString(run.endTime);
        if (!endParsed) return;
        // Construct the run's end time anchored to the batch start's date.
        let candidateDate = new Date(batchStart);
        candidateDate.setHours(endParsed.hour, endParsed.minute, endParsed.second, 0);
        // Skip if this time is before the batch start or after 4:00 PM.
        if (candidateDate < batchStart || candidateDate > cutoff) return;
        // Choose the latest candidate within the allowed window.
        if (!candidateTime || candidateDate > candidateTime) {
          candidateTime = candidateDate;
          candidateIndex = idx;
        }
      });
      
      return candidateIndex;
    });

    // 11. Selected candidate and label.
    const selectedCandidate = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0) return null;
      return initialBaseRuns.value[idx];
    });
    const selectedPositionLabel = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0 || !initialPositionOrder.value || idx >= initialPositionOrder.value.length) {
        return "No candidate found";
      }
      return initialPositionOrder.value[idx];
    });
    const runtableClosestPositionFull = computed(() => {
      if (!selectedCandidate.value) return "No candidate found";
      return `${selectedPositionLabel.value} : ${selectedCandidate.value.startTime} to ${selectedCandidate.value.endTime}`;
    });

    // NEW: Compute the batch start time from the first run.
    const computedBatchStartTime = computed(() => {
      if (!props.runs.length) return null;
      const firstRun = props.runs[0];
      const parsed = parseTimeString(firstRun.startTime);
      if (!parsed) return null;
      let batchStart = new Date();
      batchStart.setHours(parsed.hour, parsed.minute, parsed.second, 0);
      return batchStart;
    });

    // NEW: Compute the overall batch end time from the last run,
    // with an adjustment for the case where the end time indicates a rollover (i.e. after midnight).
    const computedBatchEndTime = computed(() => {
      if (!props.runs.length) return null;
      const lastRun = props.runs[props.runs.length - 1];
      const parsed = parseTimeString(lastRun.endTime);
      if (!parsed) return null;
      const batchStartParsed = parseTimeString(props.runs[0].startTime);
      if (!batchStartParsed) return null;
      let batchStart = new Date();
      batchStart.setHours(batchStartParsed.hour, batchStartParsed.minute, batchStartParsed.second, 0);
      let batchEnd = new Date(batchStart);
      batchEnd.setHours(parsed.hour, parsed.minute, parsed.second, 0);
      // Adjust if the computed end time is before (or equal to) the start time.
      if (batchEnd <= batchStart) {
        batchEnd.setDate(batchEnd.getDate() + 1);
      }
      return batchEnd;
    });

    // NEW: Compute a flag to decide whether to highlight the candidate.
    // Highlight only if the batch starts before 4:00 PM and ends after 4:00 PM.
    const highlightCandidate = computed(() => {
      const batchStart = computedBatchStartTime.value;
      const batchEnd = computedBatchEndTime.value;
      if (!batchStart || !batchEnd) return false;
      let fourPM = new Date(batchStart);
      fourPM.setHours(16, 0, 0, 0);
      return (batchStart < fourPM && batchEnd > fourPM);
    });

    // 12. Compute the last main run number (initial + sequential).
    const lastMainRunNumber = computed(() => {
      return initialPositionOrder.value.length + sequentialRows.value.length;
    });

    // 13. Generate sequential batch rows.
    const sequentialRows = computed(() => {
      if (!gcStore.sequentialFinalPosition) return [];
      const runtime = Math.round(parseRunTime(gcStore.allGcData[gcStore.selectedGc].runTime));
      const initialCount = initialPositionOrder.value.length;
      const isEnergy = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase() === "energy";
      let rows = [];
      let baseTime;
      if (sequentialBaseRuns.value && sequentialBaseRuns.value.length > 0) {
        const ref = new Date(`${new Date().toDateString()} ${initialBatchEndTime.value}`);
        baseTime = getDateFromTimeString(sequentialBaseRuns.value[0].startTime, ref);
      } else if (initialBatchEndTime.value) {
        baseTime = getDateFromTimeString(initialBatchEndTime.value, new Date());
      } else {
        baseTime = new Date();
      }
      if (isEnergy) {
        const waitRowStart = baseTime;
        const waitRowEnd = new Date(baseTime.getTime() + 15 * 60000);
        rows.push({
          computedTitle: "15-Min Wait",
          startTime: formatTimeWithAmPmAndSeconds(waitRowStart),
          endTime: formatTimeWithAmPmAndSeconds(waitRowEnd),
          positionDisplay: initialCount + 1
        });
        const newBase = waitRowEnd;
        sequentialPositionOrder.value.forEach((title, idx) => {
          const rowStart = new Date(newBase.getTime() + idx * runtime);
          const rowEnd = new Date(newBase.getTime() + (idx + 1) * runtime);
          rows.push({
            computedTitle: title,
            startTime: formatTimeWithAmPmAndSeconds(rowStart),
            endTime: formatTimeWithAmPmAndSeconds(rowEnd),
            positionDisplay: initialCount + 2 + idx
          });
        });
      } else {
        sequentialPositionOrder.value.forEach((title, idx) => {
          const rowStart = new Date(baseTime.getTime() + idx * runtime);
          const rowEnd = new Date(baseTime.getTime() + (idx + 1) * runtime);
          rows.push({
            computedTitle: title,
            startTime: formatTimeWithAmPmAndSeconds(rowStart),
            endTime: formatTimeWithAmPmAndSeconds(rowEnd),
            positionDisplay: initialCount + idx + 1
          });
        });
      }
      return rows;
    });

    // 14. Additional Runs computed from timeDelayResults.additionalRuns.
    const additionalRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns ? timeDelayResults.additionalRuns : 0;
      if (!additionalCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (sequentialRows.value.length > 0) {
        baseTime = getDateFromTimeString(sequentialRows.value[sequentialRows.value.length - 1].endTime, new Date());
      } else if (initialBatchEndTime.value) {
        baseTime = getDateFromTimeString(initialBatchEndTime.value, new Date());
      } else if (startTime.batchEndTime) {
        baseTime = getDateFromTimeString(startTime.batchEndTime, new Date());
      } else {
        baseTime = new Date();
      }
      const base = lastMainRunNumber.value || 0;
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = base + i + 1;
        const computedTitle = `Add Run ${i + 1}`;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: runNumber,
          positionDisplay: runNumber,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // 15. Delayed Runs computed from timeDelayResults.totalDelayedRuns.
    const prebatchRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns ? timeDelayResults.totalDelayedRuns : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (additionalRows.value && additionalRows.value.length > 0) {
        baseTime = getDateFromTimeString(additionalRows.value[additionalRows.value.length - 1].endTime, new Date());
      } else if (hasSequentialBatch.value && sequentialRows.value.length > 0) {
        baseTime = getDateFromTimeString(sequentialRows.value[sequentialRows.value.length - 1].endTime, new Date());
      } else if (initialBatchEndTime.value) {
        baseTime = getDateFromTimeString(initialBatchEndTime.value, new Date());
      } else if (startTime.batchEndTime) {
        baseTime = getDateFromTimeString(startTime.batchEndTime, new Date());
      } else {
        baseTime = timeDelayResults.delayedRunsStartTimeDate ? new Date(timeDelayResults.delayedRunsStartTimeDate) : new Date();
      }
      let delayedStart;
      if (timeDelayResults.delayedRunsStartTimeDate) {
        delayedStart = new Date(timeDelayResults.delayedRunsStartTimeDate);
      } else {
        const delayHours = parseInt(timeDelayRequired.value, 10) || 0;
        delayedStart = new Date(baseTime.getTime() + delayHours * 3600000);
      }
      const rows = [];
      for (let i = 0; i < prebatchCount; i++) {
        const rowStart = new Date(delayedStart.getTime() + i * runtime);
        const rowEnd = new Date(delayedStart.getTime() + (i + 1) * runtime);
        const runNumber = (lastMainRunNumber.value || 0) + (additionalRows.value.length || 0) + i + 1;
        rows.push({
          position: runNumber,
          positionDisplay: runNumber,
          computedTitle: `Delayed Run ${i + 1}`,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // 16. Computed for the delay time string.
    const timeDelayRequired = computed(() => {
      const { timeDelayResults } = gcStore;
      const val = timeDelayResults && timeDelayResults.timeDelayRequired ? timeDelayResults.timeDelayRequired : "";
      return val;
    });

    // 17. Flag to indicate if delayed runs should be shown.
    const delayedRunSelected = computed(() => {
      const { timeDelayResults } = gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== 'None' ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    });

    // 18. Compute the end time of the last run in the initial batch.
    const initialBatchEndTime = computed(() => {
      if (initialBaseRuns.value && initialBaseRuns.value.length) {
        return initialBaseRuns.value[initialBaseRuns.value.length - 1].endTime;
      }
      return "";
    });
    watch(initialBatchEndTime, (newVal) => {
      emit("update:initialBatchEndTime", newVal);
    }, { immediate: true });
    watch(runtableClosestPositionFull, (newVal) => {
      emit("update:runtableClosestPositionFull", newVal);
    }, { immediate: true });

    // 19. Compute the final batch end time which includes sequential and additional runs.
    const finalBatchEndTime = computed(() => {
      if (additionalRows.value && additionalRows.value.length) {
        return additionalRows.value[additionalRows.value.length - 1].endTime;
      } else if (sequentialRows.value && sequentialRows.value.length) {
        return sequentialRows.value[sequentialRows.value.length - 1].endTime;
      } else {
        return initialBatchEndTime.value;
      }
    });
    watch(finalBatchEndTime, (newVal) => {
      emit("update:finalBatchEndTime", newVal);
    }, { immediate: true });

    // 20. Compute the delayed runs start time (from the first delayed run row).
    const delayedRunsStartTime = computed(() => {
      if (prebatchRows.value && prebatchRows.value.length > 0) {
        return prebatchRows.value[0].startTime;
      }
      return "";
    });
    watch(delayedRunsStartTime, (newVal) => {
      emit("update:delayedRunsStartTime", newVal);
    }, { immediate: true });

    // 21. Compute the delayed runs end time (from the last delayed run row).
    const delayedRunsEndTime = computed(() => {
      if (prebatchRows.value && prebatchRows.value.length > 0) {
        return prebatchRows.value[prebatchRows.value.length - 1].endTime;
      }
      return "";
    });
    watch(delayedRunsEndTime, (newVal) => {
      emit("update:delayedRunsEndTime", newVal);
    }, { immediate: true });

    // 22. Compute sequential batch duration including additional runs.
    const sequentialBatchDuration = computed(() => {
      if (!hasSequentialBatch.value) return "";
      let sequentialStartTime = "";
      if (sequentialRows.value.length > 0) {
        sequentialStartTime = sequentialRows.value[0].startTime;
      } else {
        sequentialStartTime = initialBatchEndTime.value;
      }
      const finalEndTime = finalBatchEndTime.value;
      const startObj = parseTimeString(sequentialStartTime);
      const endObj = parseTimeString(finalEndTime);
      if (!startObj || !endObj) return "";
      const startMs = startObj.hour * 3600000 + startObj.minute * 60000 + startObj.second * 1000;
      let endMs = endObj.hour * 3600000 + endObj.minute * 60000 + endObj.second * 1000;
      if (endMs <= startMs) {
        endMs += 24 * 3600000;
      }
      const durationMs = endMs - startMs;
      return formatDuration(durationMs);
    });
    watch(sequentialBatchDuration, (newVal) => {
      emit("update:sequentialBatchDuration", newVal);
    }, { immediate: true });

    // 23. Compute overall batch duration (for the initial batch only).
    const runTableTotalDuration = computed(() => {
      if (!props.runs.length) return "";
      const firstRun = props.runs[0];
      const lastRun = props.runs[props.runs.length - 1];
      const startTimeObj = parseTimeString(firstRun.startTime);
      const endTimeObj = parseTimeString(lastRun.endTime);
      if (!startTimeObj || !endTimeObj) return "";
      const startMs = startTimeObj.hour * 3600000 + startTimeObj.minute * 60000 + startTimeObj.second * 1000;
      let endMs = endTimeObj.hour * 3600000 + endTimeObj.minute * 60000 + endTimeObj.second * 1000;
      if (endMs <= startMs) {
        endMs += 24 * 3600000;
      }
      const durationMs = endMs - startMs;
      return formatDuration(durationMs);
    });
    watch(runTableTotalDuration, (newVal) => {
      emit("update:runTableInitialBatchDuration", newVal);
    }, { immediate: true });

    return {
      gcStore,
      initialPositionOrder,
      sequentialPositionOrder,
      hasSequentialBatch,
      sequentialRows,
      runsHasWait,
      waitRow,
      initialBaseRuns,
      sequentialBaseRuns,
      runtableClosestCandidateIndex,
      selectedCandidate,
      selectedPositionLabel,
      runtableClosestPositionFull,
      additionalRows,
      prebatchRows,
      timeDelayRequired,
      delayedRunSelected,
      lastMainRunNumber,
      initialBatchEndTime,
      finalBatchEndTime,
      delayedRunsStartTime,
      delayedRunsEndTime,
      highlightCandidate,
      runTableTotalDuration,
      sequentialBatchDuration
    };
  }
};
</script>

<style scoped>
.run-table {
  margin-top: 20px;
  padding: 0;
  background-color: #ffffff;
  font-family: "Aptos", sans-serif;
}
.run-table table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 0.9rem;
}
.run-table th,
.run-table td {
  padding: 4px 10px;
  border: none;
  text-align: center;
}
.header-row {
  background-color: #f5f5f5;
  color: #333;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.run-table tbody tr {
  border-bottom: 1px solid #eee;
}
.run-table tbody tr:last-child {
  border-bottom: none;
}
.highlight {
  background-color: yellow;
}
.closest-position-heading {
  font-weight: bold;
  margin-bottom: 10px;
  text-align: center;
}
.run-table h4 {
  text-align: center;
  margin-bottom: 4px;
}
</style>
