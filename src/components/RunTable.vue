<template>
  <div class="run-table">
    <table v-if="hasAnyRows">
      <thead>
        <!-- Common header for all runs -->
        <tr class="header-row">
          <th>Run Name</th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Run #</th>
        </tr>
      </thead>
      <tbody>
        <!-- Initial Batch Rows (from new code) -->
        <template v-if="initialRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Initial Batch</td>
          </tr>
          <tr v-for="(row, index) in initialRows" :key="'initial-' + index">
            <td>{{ row.title }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.runNumber }}</td>
          </tr>
        </template>

        <!-- Sequential Batch Rows -->
        <template v-if="sequentialRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Sequential Batch</td>
          </tr>
          <tr v-for="(row, index) in sequentialRows" :key="'seq-' + index">
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
          <tr v-for="(row, index) in additionalRows" :key="'add-' + index">
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

        <!-- Time Delay Row (if applicable) -->
        <tr v-if="timeDelayRequired !== ''" class="title-row">
          <td colspan="4" class="batch-header time-delay-header">
            Time Delay: {{ timeDelayRequired }}
          </td>
        </tr>

        <!-- Delayed Runs Rows -->
        <template v-if="prebatchRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Delayed Runs</td>
          </tr>
          <tr v-for="(row, index) in prebatchRows" :key="'del-' + index">
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
import { computed, watch } from "vue";
import { useGcStore } from "../store";
import { parseTimeString } from "../utils/timeUtils.js";
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";

// Helper to convert a runtime string into milliseconds.
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
    // No external "runs" prop is needed now,
    // as we build rows from store data.
  },
  setup() {
    const gcStore = useGcStore();

    // ----- NEW CODE (First Batch) -----
    // Re-create the new code’s computed properties for the initial batch.
    // Here we build initialRows by mapping over the computed positionOrder.
    const runsHasWait = computed(() =>
      gcStore.results && gcStore.results.runs &&
      String(gcStore.results.runs[0]?.position || "").toLowerCase() === "wait"
    );
    const waitRow = computed(() =>
      runsHasWait.value ? gcStore.results.runs[0] : null
    );
    const baseRuns = computed(() =>
      runsHasWait.value ? gcStore.results.runs.slice(1) : gcStore.results?.runs || []
    );
    const positionOrder = computed(() => {
      // Using your new generatePositionOrder logic from your new code.
      // For brevity, we assume positionOrder was computed already in your new code.
      // (Replace this with your actual generatePositionOrder function if needed.)
      if (!gcStore.startTime.finalPosition) return [];
      const fp = Number(gcStore.startTime.finalPosition);
      // Here we mimic the new code’s ordering:
      let order = [];
      for (let i = 1; i <= fp; i++) {
        order.push(`Run ${i}`);
      }
      return order;
    });
    const initialRows = computed(() => {
      // For the initial batch, use the new code’s mapping.
      return positionOrder.value.map((title, idx) => ({
        title,
        startTime: (baseRuns.value[idx] && baseRuns.value[idx].startTime) || "",
        endTime: (baseRuns.value[idx] && baseRuns.value[idx].endTime) || "",
        runNumber: idx + 1,
      }));
    });

    // ----- OLD CODE (Extended Sections) -----
    // Sequential Batch Rows
    const sequentialRows = computed(() => {
      const { sequentialFinalPosition, startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      if (!sequentialFinalPosition || !timeDelayResults.sequentialBatchActive) return [];
      const gcType = String(allGcData[selectedGc]?.type || "").trim().toLowerCase();
      const totalNonWaitRows = sequentialFinalPosition <= 15 ? sequentialFinalPosition + 2 : sequentialFinalPosition + 1;
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime = new Date(startTime.batchEndTime);
      if (startTime.wait15) {
        baseTime = new Date(baseTime.getTime() + 15 * 60000);
      }
      const rows = [];
      // Use last initial row number as offset – here we take initialRows length if exists.
      const offset = initialRows.value.length ? initialRows.value[initialRows.value.length - 1].runNumber : 0;
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

    // Additional Runs Rows
    const additionalRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns
        ? Number(timeDelayResults.additionalRuns)
        : 0;
      if (!additionalCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (sequentialRows.value.length) {
        baseTime = sequentialRows.value[sequentialRows.value.length - 1].endDate;
      } else {
        baseTime = new Date(startTime.batchEndTime);
      }
      // Use last run number from initial + sequential rows as offset.
      let lastRunNumber = initialRows.value.length;
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

    // Delayed (Prebatch) Runs Rows
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
      const rows = [];
      // Use last run number from previous sections as offset.
      let lastRunNumber = initialRows.value.length;
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

    // Total Duration of Additional Runs
    const additionalDurationFormatted = computed(() => {
      const allGcData = gcStore.allGcData;
      const selectedGc = gcStore.selectedGc;
      if (!selectedGc || !allGcData[selectedGc]) return "";
      const runtimeStr = allGcData[selectedGc].runTime;
      const runtimeMs = parseRunTime(runtimeStr);
      let totalRunsCount = 0;
      if (gcStore.timeDelayResults.sequentialBatchActive && gcStore.startTime.finalPosition) {
        const seqPos = Number(gcStore.startTime.finalPosition);
        const sequentialRuns = seqPos <= 15 ? seqPos + 2 : seqPos + 1;
        const misc = Number(gcStore.miscAdditionalRuns || 0);
        totalRunsCount = sequentialRuns + misc;
      } else {
        totalRunsCount = Number(gcStore.miscAdditionalRuns || 0);
      }
      let durationMs = totalRunsCount * runtimeMs;
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

    // Time Delay Info (if any)
    const timeDelayRequired = computed(() => {
      return gcStore.timeDelayResults && gcStore.timeDelayResults.timeDelayRequired
        ? gcStore.timeDelayResults.timeDelayRequired
        : "";
    });

    // Determine if any rows exist
    const hasAnyRows = computed(() => {
      return (
        initialRows.value.length ||
        sequentialRows.value.length ||
        additionalRows.value.length ||
        prebatchRows.value.length
      );
    });

    return {
      initialRows,
      sequentialRows,
      additionalRows,
      prebatchRows,
      timeDelayRequired,
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
