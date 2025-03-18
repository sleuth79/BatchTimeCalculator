<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Render header only if there are computed rows -->
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
        <!-- Render all 33 runs -->
        <tr v-for="(row, index) in computedRuns" :key="index">
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
    // Expect an array of run objects (ideally 33 items for the initial batch).
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
    // Determine control values from the store.
    initialControl() {
      // Higher number becomes the initial control.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      return Math.max(c1 || 0, c2 || 0);
    },
    finalControl() {
      // Lower number becomes the final control.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      return Math.min(c1 || 0, c2 || 0);
    },
    // Build the allowed "pos" numbers from 3 to 32 excluding the control values and 16.
    allowedPositions() {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === this.initialControl || num === this.finalControl || num === 16) continue;
        positions.push(num);
      }
      return positions; // Should have 27 numbers.
    },
    computedRuns() {
      const totalRuns = 33; // Always 33 rows.
      const rows = [];
      // Helper to retrieve run times from the runs prop; if missing, default to empty strings.
      const getRunTime = (i) => {
        return this.runs[i] ? this.runs[i] : { startTime: "", endTime: "" };
      };
      // Helper: given a run number, return the title.
      // Fixed titles:
      // Run 1: "blank"
      // Run 2: "argon blank" (or "methane blank" based on GC type)
      // Run 3: "Control - {initialControl}"
      // Run 13: "Control - {finalControl}"
      // Run 23: "Control - {initialControl}"
      // Run 33: "Final Control - {finalControl}"
      // For other runs, use allowedPositions.
      const gcType = (this.gcStore.allGcData[this.gcStore.selectedGc]?.type || "").trim().toLowerCase();
      function getTitle(runNumber, allowedPositions, initialControl, finalControl, gcType) {
        if (runNumber === 1) {
          return "blank";
        } else if (runNumber === 2) {
          return gcType.includes("energy") ? "argon blank" : "methane blank";
        } else if (runNumber === 3) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 13) {
          return `Control - ${finalControl}`;
        } else if (runNumber === 23) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 33) {
          return `Final Control - ${finalControl}`;
        } else {
          // Determine which group this run falls into.
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            // 9 rows: indices 0..8
            posIndex = runNumber - 4;
          } else if (runNumber >= 14 && runNumber <= 22) {
            // 9 rows: indices 9..17
            posIndex = (runNumber - 14) + 9;
          } else if (runNumber >= 24 && runNumber <= 32) {
            // 9 rows: indices 18..26
            posIndex = (runNumber - 24) + 18;
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `pos ${allowedPositions[posIndex]}`
            : "";
        }
      }
      
      for (let i = 1; i <= totalRuns; i++) {
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
    
    sequentialRows() {
      // (Implement similar ordering for sequential batch if needed.)
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
