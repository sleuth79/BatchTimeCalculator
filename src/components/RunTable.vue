<template>
  <div class="run-table">
    <table>
      <thead>
        <template v-if="finalRows.length > 0">
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
        <!-- If a wait row exists (first element has position "Wait"), render it once -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render the fixed 33 runs -->
        <tr v-for="(row, index) in fixedRows" :key="index">
          <td class="run-column">{{ row.position }}</td>
          <td>{{ row.computedTitle }}</td>
          <td>{{ row.startTime }}</td>
          <td>{{ row.endTime }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { useGcStore } from "../store";
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";

export default {
  name: "RunTable",
  props: {
    // runs is the array produced by your calculation,
    // which might include a wait row at index 0 if wait15 is true.
    runs: {
      type: Array,
      required: true,
      default: () => [],
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    return { gcStore, props };
  },
  computed: {
    // Check if the first row in runs is a wait row.
    runsHasWait() {
      return (
        this.runs.length > 0 &&
        String(this.runs[0].position).toLowerCase() === "wait"
      );
    },
    // Get the wait row if present.
    waitRow() {
      return this.runsHasWait ? this.runs[0] : null;
    },
    // The baseRuns array excludes the wait row (if present).
    baseRuns() {
      return this.runsHasWait ? this.runs.slice(1) : this.runs;
    },
    // Determine control values from the store.
    initialControl() {
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      return Math.max(c1 || 0, c2 || 0);
    },
    finalControl() {
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      return Math.min(c1 || 0, c2 || 0);
    },
    // Allowed positions: numbers from 3 to 32, excluding initialControl, finalControl, and 16.
    allowedPositions() {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === this.initialControl || num === this.finalControl || num === 16) continue;
        positions.push(num);
      }
      return positions; // Should be 27 numbers.
    },
    // Build exactly 33 fixed run rows (not including any wait row).
    fixedRows() {
      const totalFixed = 33; // Runs 1 to 33.
      const rows = [];
      // We use the baseRuns array for run times.
      // If a run is missing, default to empty times.
      const getRunTime = (i) => {
        return this.baseRuns[i] ? this.baseRuns[i] : { startTime: "", endTime: "" };
      };
      // Helper: determine title based on fixed run number.
      // Fixed rows:
      // 1: "Blank" (capitalized)
      // 2: "Argon Blank" (or "Methane Blank" based on GC type)
      // 3: "Control - [initialControl]"
      // 13: "Control - [finalControl]"
      // 23: "Control - [initialControl]"
      // 33: "Control - [finalControl]"
      // Others: "Position [X]" where X comes from allowedPositions.
      const gcType = (this.gcStore.allGcData[this.gcStore.selectedGc]?.type || "").trim().toLowerCase();
      function getTitle(runNumber, allowedPositions, initialControl, finalControl, gcType) {
        if (runNumber === 1) {
          return "Blank";
        } else if (runNumber === 2) {
          return gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
        } else if (runNumber === 3) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 13) {
          return `Control - ${finalControl}`;
        } else if (runNumber === 23) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 33) {
          return `Control - ${finalControl}`;
        } else {
          // For non-control rows, assign a "Position" title.
          // We know there are exactly 27 allowed positions.
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            posIndex = runNumber - 4; // indices 0 to 8
          } else if (runNumber >= 14 && runNumber <= 22) {
            posIndex = (runNumber - 14) + 9; // indices 9 to 17
          } else if (runNumber >= 24 && runNumber <= 32) {
            posIndex = (runNumber - 24) + 18; // indices 18 to 26
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `Position ${allowedPositions[posIndex]}`
            : "";
        }
      }
      
      for (let i = 1; i <= totalFixed; i++) {
        const runTimes = getRunTime(i - 1);
        rows.push({
          position: i,
          computedTitle: getTitle(i, this.allowedPositions, this.initialControl, this.finalControl, gcType),
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    },
    // finalRows combines the wait row (if any) with the 33 fixed rows.
    finalRows() {
      return this.runsHasWait ? [this.waitRow, ...this.fixedRows] : this.fixedRows;
    },
    
    // (Other computed properties for sequentialRows, additionalRows, etc. remain unchanged.)
    sequentialRows() {
      return [];
    },
    additionalRows() {
      return [];
    },
    prebatchRows() {
      return [];
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
