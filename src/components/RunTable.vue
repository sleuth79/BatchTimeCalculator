<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Only display the Initial Batch header if computedRuns has entries -->
        <template v-if="computedRuns.length > 0">
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
        <!-- Render the computed rows -->
        <tr v-for="(row, index) in computedRuns" :key="index">
          <td class="run-column">{{ row.position || '-' }}</td>
          <td>{{ row.computedTitle }}</td>
          <td>{{ row.startTime }}</td>
          <td>{{ row.endTime }}</td>
        </tr>

        <!-- (The sequential, additional, and delayed sections would follow a similar pattern.) -->
      </tbody>
    </table>
  </div>
</template>

<script>
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

import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: "RunTable",
  props: {
    runs: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  setup() {
    const gcStore = useGcStore();
    return { gcStore };
  },
  computed: {
    // Computed headings (as before)
    initialControlHeading() {
      const c1 = Number(this.gcStore.startTime.controls?.control1) || 0;
      const c2 = Number(this.gcStore.startTime.controls?.control2) || 0;
      const higher = Math.max(c1, c2);
      return higher > 0 ? `Control - ${higher}` : "Initial Control";
    },
    finalControlHeading() {
      const c1 = Number(this.gcStore.startTime.controls?.control1) || 0;
      const c2 = Number(this.gcStore.startTime.controls?.control2) || 0;
      const lower = Math.min(c1, c2);
      return lower > 0 ? `Control - ${lower}` : "Final Control";
    },

    computedRuns() {
      // Ensure both control values exist; otherwise, fall back to a default mapping.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      if (!c1 || !c2) {
        // Fallback: simply return the original runs mapped with existing titles.
        return this.runs.map(run => ({
            ...run,
            computedTitle: run.computedTitle || run.position,
        }));
      }
      
      // Determine control values.
      const finalControl = Math.min(c1, c2);    // e.g., 11
      const initialControl = Math.max(c1, c2);   // e.g., 25
      
      // Sort the runs by numeric position.
      let runsSorted = this.runs.slice().sort((a, b) => Number(a.position) - Number(b.position));
      
      // Filter out runs whose positions equal the control values,
      // and skip run 16 (as per earlier logic).
      runsSorted = runsSorted.filter(run => {
        const pos = Number(run.position);
        return pos !== finalControl && pos !== initialControl && pos !== 16;
      });
      
      const newRuns = [];
      
      // Insert a top control row with the initial control (higher number)
      newRuns.push({
        position: '',
        computedTitle: `Control - ${initialControl}`,
        startTime: '',  // Could later be computed or left blank
        endTime: '',
        isControl: true,
      });
      
      // Iterate through the filtered runs and insert control rows after fixed boundaries.
      for (let i = 0; i < runsSorted.length; i++) {
        const run = runsSorted[i];
        const pos = Number(run.position);
        newRuns.push(run);
        if (pos === 12) {
          // Insert final control row (lower number) after run 12.
          newRuns.push({
            position: '',
            computedTitle: `Control - ${finalControl}`,
            startTime: '',
            endTime: '',
            isControl: true,
          });
        }
        if (pos === 22) {
          // Insert initial control row (higher number) after run 22.
          newRuns.push({
            position: '',
            computedTitle: `Control - ${initialControl}`,
            startTime: '',
            endTime: '',
            isControl: true,
          });
        }
      }
      
      // Insert a bottom control row with the final control.
      newRuns.push({
        position: '',
        computedTitle: `Control - ${finalControl}`,
        startTime: '',
        endTime: '',
        isControl: true,
      });
      
      return newRuns;
    },

    // (You would apply similar logic to sequentialRows if needed.)
    sequentialRows() {
      // Example: if you want sequential rows to follow similar insertion rules,
      // you can mirror the logic from computedRuns using the sequential run data.
      // For brevity, this example leaves it unchanged.
      return [];
    },

    // Other computed properties (additionalRows, prebatchRows, etc.) remain unchanged.
    lastMainRunNumber() {
      if (this.sequentialRows.length) {
        const nonWaitRows = this.sequentialRows.filter(r => r.position !== 'Wait');
        if (nonWaitRows.length) {
          return Number(nonWaitRows[nonWaitRows.length - 1].position);
        }
      }
      if (this.computedRuns.length) {
        // Find the last row with a numeric position.
        const numericRows = this.computedRuns.filter(r => r.position && !isNaN(Number(r.position)));
        if (numericRows.length) {
          return Number(numericRows[numericRows.length - 1].position);
        }
      }
      return 0;
    },

    additionalRows() {
      // (Unchanged from your existing code.)
      const { startTime, allGcData, selectedGc, timeDelayResults } = this.gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns
        ? timeDelayResults.additionalRuns
        : 0;
      if (!additionalCount) return [];
      
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (this.sequentialRows.length) {
        const nonWaitRows = this.sequentialRows.filter(r => r.position !== 'Wait');
        baseTime = nonWaitRows.length
          ? nonWaitRows[nonWaitRows.length - 1].endDate
          : new Date(startTime.batchEndTime);
      } else {
        baseTime = new Date(startTime.batchEndTime);
      }
      const base = this.lastMainRunNumber;
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = base + i + 1;
        const computedTitle = `Add Run ${i + 1}`;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd   = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: runNumber,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    },

    prebatchRows() {
      // (Unchanged from your existing code.)
      const { startTime, allGcData, selectedGc, timeDelayResults } = this.gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns
        ? timeDelayResults.totalDelayedRuns
        : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      
      let baseTime;
      if (this.additionalRows.length) {
        baseTime = this.additionalRows[this.additionalRows.length - 1].endDate;
      } else if (this.sequentialRows.length) {
        baseTime = this.sequentialRows[this.sequentialRows.length - 1].endDate;
      } else if (startTime.batchEndTime) {
        baseTime = new Date(startTime.batchEndTime);
      } else {
        baseTime = timeDelayResults.delayedRunsStartTimeDate
          ? new Date(timeDelayResults.delayedRunsStartTimeDate)
          : new Date();
      }
      
      let delayedStart;
      if (timeDelayResults.delayedRunsStartTimeDate) {
        delayedStart = new Date(timeDelayResults.delayedRunsStartTimeDate);
      } else {
        const delayHours = parseInt(this.timeDelayRequired, 10) || 0;
        delayedStart = new Date(baseTime.getTime() + delayHours * 3600000);
      }
      
      let rows = [];
      for (let i = 0; i < prebatchCount; i++) {
        const rowStart = new Date(delayedStart.getTime() + i * runtime);
        const rowEnd   = new Date(delayedStart.getTime() + (i + 1) * runtime);
        rows.push({
          position: (this.lastMainRunNumber + (this.additionalRows.length || 0)) + i + 1,
          computedTitle: `Delayed Run ${i + 1}`,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    },

    timeDelayRequired() {
      const { timeDelayResults } = this.gcStore;
      return timeDelayResults && timeDelayResults.timeDelayRequired
        ? timeDelayResults.timeDelayRequired
        : "";
    },

    delayedRunSelected() {
      const { timeDelayResults } = this.gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== 'None' ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    }
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
/* Reduced vertical padding for table cells */
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
  text-transform: none;
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
