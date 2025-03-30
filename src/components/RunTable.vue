<template>
  <div class="run-table">
    <table v-if="hasAnyRows">
      <thead>
        <!-- Initial Batch Header -->
        <template v-if="initialBatchRows.length">
          <tr class="title-row">
            <th colspan="4" class="batch-header">Initial Batch</th>
          </tr>
          <tr class="header-row">
            <th class="run-column">Run</th>
            <th>Run Title</th>
            <th>Start Time</th>
            <th>End Time</th>
          </tr>
        </template>
      </thead>
      <tbody>
        <!-- Initial Batch Rows -->
        <tr
          v-for="(row, index) in initialBatchRows"
          :key="'initial-' + index"
        >
          <td class="run-column">{{ row.position }}</td>
          <td>{{ row.computedTitle }}</td>
          <td>{{ row.startTime }}</td>
          <td>{{ row.endTime }}</td>
        </tr>

        <!-- Sequential Batch Rows -->
        <template v-if="sequentialRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Sequential Batch</td>
          </tr>
          <tr
            v-for="(row, index) in sequentialRows"
            :key="'seq-' + index"
          >
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
        </template>

        <!-- Additional Runs Rows -->
        <template v-if="additionalRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Additional Runs</td>
          </tr>
          <tr
            v-for="(row, index) in additionalRows"
            :key="'add-' + index"
          >
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
          <!-- Total Duration of Additional Runs Row -->
          <tr class="title-row">
            <td colspan="4" class="batch-header">
              Total Duration of Additional Runs: {{ additionalDurationFormatted }}
            </td>
          </tr>
        </template>

        <!-- Time Delay Row -->
        <tr v-if="delayedRunSelected" class="title-row">
          <td colspan="4" class="batch-header time-delay-header">
            Time Delay: {{ timeDelayRequired }}
          </td>
        </tr>

        <!-- Delayed Runs Rows -->
        <template v-if="prebatchRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Delayed Runs</td>
          </tr>
          <tr
            v-for="(row, index) in prebatchRows"
            :key="'prebatch-' + index"
          >
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed } from "vue";
import { useGcStore } from "../store";
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";
import { parseTimeString } from "../utils/timeUtils.js";

// Helper to convert a runtime string (e.g., "mm:ss" or "hh:mm:ss") to milliseconds
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
    // In the new integrated version, we do not need an external runs prop.
    // Instead we use the store results and our computed batches.
  },
  setup() {
    const gcStore = useGcStore();

    // ***********************
    // SECTION 1: INITIAL BATCH
    // ***********************
    // For initial batch rows, we use gcStore.results.runs (if available)
    const initialBatchRows = computed(() => {
      if (!gcStore.results || !gcStore.results.runs) return [];
      // Assume that initial batch runs are the first set before sequentialBatchActive flag becomes true.
      // You may adjust this logic if needed.
      // Here we filter runs with positions < starting sequential batch position.
      return gcStore.results.runs.filter(run => {
        return run.position && typeof run.position === "number" && run.position < 3; // adjust as appropriate
      });
    });

    // ***********************
    // SECTION 2: SEQUENTIAL BATCH
    // ***********************
    const sequentialRows = computed(() => {
      if (!gcStore.timeDelayResults || !gcStore.timeDelayResults.sequentialBatchActive) return [];
      // For sequential batch rows, use a similar logic as in your old code.
      const { sequentialFinalPosition, startTime, allGcData, selectedGc } = gcStore;
      if (!sequentialFinalPosition) return [];
      const gcType = String(allGcData[selectedGc]?.type || "").trim().toLowerCase();
      // Calculate total non-wait rows based on final position
      const totalNonWaitRows = sequentialFinalPosition <= 15 ? sequentialFinalPosition + 2 : sequentialFinalPosition + 1;
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime = new Date(startTime.batchEndTime);
      if (startTime.wait15) {
        // Insert a wait row if needed (we handle wait separately below)
        baseTime = new Date(baseTime.getTime() + 15 * 60000);
      }
      const rows = [];
      // Use last initial run number as offset – here we assume initial batch rows exist
      const offset = initialBatchRows.value.length ? initialBatchRows.value[initialBatchRows.value.length - 1].position : 2;
      for (let i = 0; i < totalNonWaitRows; i++) {
        let computedTitle = "";
        if (i === 0) {
          computedTitle = "Blank";
        } else if (i === 1) {
          computedTitle = gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
        } else if (i === 2) {
          computedTitle = "Initial Control";
        } else if (i === totalNonWaitRows - 1) {
          computedTitle = "Final Control";
        } else {
          computedTitle = "Position " + i;
        }
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: offset + i + 1,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // ***********************
    // SECTION 3: ADDITIONAL RUNS
    // ***********************
    const additionalRows = computed(() => {
      const { timeDelayResults, startTime, allGcData, selectedGc } = gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns
        ? Number(timeDelayResults.additionalRuns)
        : 0;
      if (!additionalCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (sequentialRows.value.length) {
        // Use the end time of the sequential batch (excluding wait row) as base.
        baseTime = sequentialRows.value[sequentialRows.value.length - 1].endDate;
      } else {
        baseTime = new Date(startTime.batchEndTime);
      }
      // Use last main run number from initial + sequential rows as offset.
      let lastRunNumber = 0;
      if (initialBatchRows.value.length) {
        lastRunNumber = initialBatchRows.value[initialBatchRows.value.length - 1].position;
      }
      if (sequentialRows.value.length) {
        lastRunNumber = sequentialRows.value[sequentialRows.value.length - 1].position;
      }
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = lastRunNumber + i + 1;
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

    // ***********************
    // SECTION 4: DELAYED RUNS (Prebatch Rows)
    // ***********************
    const prebatchRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns
        ? Number(timeDelayResults.totalDelayedRuns)
        : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (additionalRows.value.length) {
        baseTime = additionalRows.value[additionalRows.value.length - 1].endDate;
      } else if (sequentialRows.value.length) {
        baseTime = sequentialRows.value[sequentialRows.value.length - 1].endDate;
      } else if (startTime.batchEndTime) {
        baseTime = new Date(startTime.batchEndTime);
      } else {
        baseTime = new Date();
      }
      let delayedStart;
      if (timeDelayResults.delayedRunsStartTimeDate) {
        delayedStart = new Date(timeDelayResults.delayedRunsStartTimeDate);
      } else {
        const delayHours = parseInt(timeDelayResults.timeDelayRequired, 10) || 0;
        delayedStart = new Date(baseTime.getTime() + delayHours * 3600000);
      }
      let rows = [];
      // Use last main run number from previous sections as offset.
      let lastRunNumber = 0;
      if (initialBatchRows.value.length) {
        lastRunNumber = initialBatchRows.value[initialBatchRows.value.length - 1].position;
      }
      if (sequentialRows.value.length) {
        lastRunNumber = sequentialRows.value[sequentialRows.value.length - 1].position;
      }
      if (additionalRows.value.length) {
        lastRunNumber = additionalRows.value[additionalRows.value.length - 1].position;
      }
      for (let i = 0; i < prebatchCount; i++) {
        const runNumber = lastRunNumber + i + 1;
        const computedTitle = `Delayed Run ${i + 1}`;
        const rowStart = new Date(delayedStart.getTime() + i * runtime);
        const rowEnd = new Date(delayedStart.getTime() + (i + 1) * runtime);
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

    // ***********************
    // SECTION 5: TIME DELAY INFO
    // ***********************
    const timeDelayRequired = computed(() => {
      return gcStore.timeDelayResults && gcStore.timeDelayResults.timeDelayRequired
        ? gcStore.timeDelayResults.timeDelayRequired
        : "";
    });

    const delayedRunSelected = computed(() => {
      const { timeDelayResults } = gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== "None" ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    });

    // ***********************
    // SECTION 6: TOTAL DURATION OF ADDITIONAL RUNS
    // ***********************
    const additionalDurationFormatted = computed(() => {
      // Use totalAdditionalRuns from sequential and miscAdditional if sequential exists,
      // otherwise just miscAdditionalRuns.
      // We calculate duration = (totalAdditionalRuns * runtime) and, if Energy GC with sequential,
      // add 15 minutes (900 seconds).
      const allGcData = gcStore.allGcData;
      const selectedGc = gcStore.selectedGc;
      if (!selectedGc || !allGcData[selectedGc]) return "";
      const runtimeStr = allGcData[selectedGc].runTime;
      const runtimeMs = parseRunTime(runtimeStr);
      let totalRunsCount = 0;
      if (gcStore.timeDelayResults.sequentialBatchActive && gcStore.startTime.finalPosition) {
        // Calculate sequential batch runs then add misc additional runs.
        const seqPos = Number(gcStore.startTime.finalPosition);
        const sequentialRuns = seqPos <= 15 ? seqPos + 2 : seqPos + 1;
        const misc = Number(gcStore.miscAdditionalRuns || 0);
        totalRunsCount = sequentialRuns + misc;
      } else {
        totalRunsCount = Number(gcStore.miscAdditionalRuns || 0);
      }
      let durationMs = totalRunsCount * runtimeMs;
      // If Energy GC is selected and sequential batch is used, add extra 15 minutes
      const gcType = String(allGcData[selectedGc].type || "").trim().toLowerCase();
      if (gcType === "energy" && gcStore.startTime.finalPosition) {
        durationMs += 15 * 60000;
      }
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      let formatted = "";
      if (hours > 0) formatted += `${hours}h `;
      formatted += `${minutes}m`;
      return formatted.trim();
    });

    // ***********************
    // FINAL: Determine if any rows exist
    // ***********************
    const hasAnyRows = computed(() => {
      return (
        initialBatchRows.value.length ||
        sequentialRows.value.length ||
        additionalRows.value.length ||
        prebatchRows.value.length
      );
    });

    return {
      initialBatchRows,
      sequentialRows,
      additionalRows,
      prebatchRows,
      timeDelayRequired,
      delayedRunSelected,
      additionalDurationFormatted,
      hasAnyRows,
    };
  },
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
.run-column {
  width: 80px;
}
.title-row .batch-header,
.header-row {
  background-color: #f5f5f5;
  color: #333;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.batch-header {
  text-align: left;
  font-size: 1.2rem;
  background-color: #f5f5f5;
  color: #333;
  border: none;
  padding: 10px 10px 5px;
}
.time-delay-header {
  background-color: #f5f5f5;
  color: #333;
  font-style: italic;
  font-size: 0.85rem;
}
.run-table tbody tr {
  border-bottom: 1px solid #eee;
}
.run-table tbody tr:last-child {
  border-bottom: none;
}
</style>
