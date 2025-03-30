<template>
  <div class="run-table">
    <!-- Initial Batch Table (always rendered on mount, without a heading) -->
    <table v-if="initialPositionOrder.length">
      <thead>
        <tr class="header-row">
          <th>Run Name</th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Run #</th>
        </tr>
      </thead>
      <tbody>
        <!-- Render wait row if present -->
        <tr v-if="runsHasWait">
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
          <td>Wait</td>
        </tr>
        <!-- Render initial batch rows -->
        <tr
          v-for="(title, idx) in initialPositionOrder"
          :key="'initial-' + idx"
          :class="{ highlight: idx === runtableClosestCandidateIndex }"
        >
          <td>{{ title }}</td>
          <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].startTime) || "" }}</td>
          <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].endTime) || "" }}</td>
          <td>{{ idx + 1 }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Sequential Batch Section (displayed only if sequentialFinalPosition is set) -->
    <div v-if="hasSequentialBatch">
      <h3>Sequential Batch</h3>
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
          <tr
            v-for="(title, idx) in sequentialPositionOrder"
            :key="'sequential-' + idx"
          >
            <td>{{ title }}</td>
            <td>{{ (sequentialBaseRuns[idx] && sequentialBaseRuns[idx].startTime) || "" }}</td>
            <td>{{ (sequentialBaseRuns[idx] && sequentialBaseRuns[idx].endTime) || "" }}</td>
            <td>{{ idx + 1 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Additional Runs Section -->
    <div v-if="additionalRows.length">
      <h3>Additional Runs</h3>
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
            <td>{{ row.position }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.position }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Time Delay Row -->
    <div v-if="delayedRunSelected">
      <h3 class="time-delay-header">
        Time Delay: {{ timeDelayRequired }}
      </h3>
    </div>

    <!-- Delayed Runs Section -->
    <div v-if="prebatchRows.length">
      <h3>Delayed Runs</h3>
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
            <td>{{ row.position }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.position }}</td>
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
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";

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

    // 3. Initial batch final position from store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));

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

    // 7. Compute initial and sequential position orders.
    const initialPositionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, gcType);
    });
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

    // 10. Compute the index of the initial batch run closest to 4:00 PM.
    const runtableClosestCandidateIndex = computed(() => {
      const base = initialBaseRuns.value;
      if (!base || base.length === 0) return -1;
      const cutoff = new Date();
      cutoff.setHours(16, 0, 0, 0);
      let candidateIndex = -1;
      let candidateTime = null;
      base.forEach((run, idx) => {
        if (!run.endTime) return;
        const parsed = parseTimeString(run.endTime);
        if (!parsed) return;
        const runDate = new Date();
        runDate.setHours(parsed.hour, parsed.minute, parsed.second, 0);
        if (runDate < cutoff) {
          if (!candidateTime || runDate > candidateTime) {
            candidateTime = runDate;
            candidateIndex = idx;
          }
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

    // Additional computed properties for Additional and Delayed Runs

    // The last main run number is the total number of runs from the initial and sequential batches.
    const lastMainRunNumber = computed(() => {
      return initialPositionOrder.value.length + sequentialPositionOrder.value.length;
    });

    // Additional Runs computed from timeDelayResults.additionalRuns.
    const additionalRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns ? timeDelayResults.additionalRuns : 0;
      if (!additionalCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (sequentialBaseRuns.value && sequentialBaseRuns.value.length > 0) {
        baseTime = new Date(sequentialBaseRuns.value[sequentialBaseRuns.value.length - 1].endTime);
      } else {
        baseTime = new Date(startTime.batchEndTime);
      }
      const base = lastMainRunNumber.value;
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = base + i + 1;
        const computedTitle = `Add Run ${i + 1}`;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: runNumber,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // Delayed Runs computed from timeDelayResults.totalDelayedRuns.
    const prebatchRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns ? timeDelayResults.totalDelayedRuns : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (additionalRows.value.length) {
        baseTime = additionalRows.value[additionalRows.value.length - 1].endDate;
      } else if (sequentialBaseRuns.value && sequentialBaseRuns.value.length > 0) {
        baseTime = new Date(sequentialBaseRuns.value[sequentialBaseRuns.value.length - 1].endTime);
      } else if (startTime.batchEndTime) {
        baseTime = new Date(startTime.batchEndTime);
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
        rows.push({
          position: lastMainRunNumber.value + (additionalRows.value.length || 0) + i + 1,
          computedTitle: `Delayed Run ${i + 1}`,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // Computed for the delay time string.
    const timeDelayRequired = computed(() => {
      const { timeDelayResults } = gcStore;
      return timeDelayResults && timeDelayResults.timeDelayRequired ? timeDelayResults.timeDelayRequired : "";
    });

    // Flag to indicate if delayed runs should be shown.
    const delayedRunSelected = computed(() => {
      const { timeDelayResults } = gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== 'None' ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    });

    // Emit the computed closest position.
    watch(runtableClosestPositionFull, (newVal) => {
      emit("update:runtableClosestPositionFull", newVal);
    }, { immediate: true });

    return {
      gcStore,
      initialPositionOrder,
      sequentialPositionOrder,
      hasSequentialBatch,
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
</style>
