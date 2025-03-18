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
        <!-- Render all 33 rows -->
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
    // Expect an array of run objects (ideally of length 33) for start/end times.
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
    // The two control values come from the store.
    // The higher one is the "initial control" and the lower one is the "final control."
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
    // Build a fixed array of allowed "pos" numbers: from 3 to 32 except the control numbers.
    allowedPositions() {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === this.initialControl || num === this.finalControl) continue;
        positions.push(num);
      }
      return positions; // length should be 27 if controls are within [3,32] and distinct.
    },
    computedRuns() {
      const totalRuns = 33; // Always 33 run rows (not counting the wait row).
      const rows = [];
      // Helper: get run times from the runs prop; if missing, default to "".
      const getRunTime = (i) => {
        return this.runs[i] ? this.runs[i] : { startTime: "", endTime: "" };
      };
      // We'll assign titles based on fixed run numbers:
      // Run 1: blank, Run 2: argon blank.
      // Run 3: Control – {initialControl}
      // Run 13: Control – {finalControl}
      // Run 23: Control – {initialControl}
      // Run 33: Final Control – {finalControl}
      // For the other run numbers, assign a "pos" title using allowedPositions.
      // The allowedPositions array has 27 numbers.
      // Map the runs as:
      // Runs 4–12 (indices 3 to 11) get allowedPositions[0..8]
      // Runs 14–22 (indices 13 to 21) get allowedPositions[9..17]
      // Runs 24–32 (indices 23 to 31) get allowedPositions[18..26]
      for (let i = 1; i <= totalRuns; i++) {
        let title = "";
        if (i === 1) {
          title = "blank";
        } else if (i === 2) {
          // For GC type, choose between "argon blank" or "methane blank"
          const gcType = (this.gcStore.allGcData[this.gcStore.selectedGc]?.type || "").trim().toLowerCase();
          title = gcType.includes("energy") ? "argon blank" : "methane blank";
        } else if (i === 3) {
          title = `Control - ${this.initialControl}`;
        } else if (i === 13) {
          title = `Control - ${this.finalControl}`;
        } else if (i === 23) {
          title = `Control - ${this.initialControl}`;
        } else if (i === 33) {
          title = `Final Control - ${this.finalControl}`;
        } else {
          // For non-control rows, determine which block they fall in.
          let posIndex;
          if (i >= 4 && i <= 12) {
            posIndex = i - 4; // indices 0 to 8
          } else if (i >= 14 && i <= 22) {
            posIndex = (i - 14) + 9; // indices 9 to 17
          } else if (i >= 24 && i <= 32) {
            posIndex = (i - 24) + 18; // indices 18 to 26
          }
          // Use the allowedPositions array.
          if (posIndex !== undefined && posIndex < this.allowedPositions.length) {
            title = `pos ${this.allowedPositions[posIndex]}`;
          } else {
            title = "";
          }
        }
        const runTimes = getRunTime(i - 1);
        rows.push({
          position: i,
          computedTitle: title,
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    },
    
    // Other computed properties (sequentialRows, additionalRows, etc.) remain unchanged.
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
