<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Only display the header if there are computed rows -->
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
        <!-- Render wait row if active -->
        <tr v-if="gcStore.startTime.wait15">
          <td class="run-column">wait</td>
          <td>15-Min Wait</td>
          <td>{{ waitStartTime }}</td>
          <td>{{ waitEndTime }}</td>
        </tr>
        <!-- Render the 33 fixed runs -->
        <tr v-for="(row, index) in finalRows" :key="index">
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
    // Expect an array of run objects (ideally 33 items for the fixed ordering)
    runs: {
      type: Array,
      required: true,
      default: () => [],
    },
    // Optionally, you can pass wait times as props.
    waitStartTime: {
      type: String,
      default: ""
    },
    waitEndTime: {
      type: String,
      default: ""
    }
  },
  setup() {
    const gcStore = useGcStore();
    return { gcStore };
  },
  computed: {
    // Determine the two control values from the store.
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
    // Build the allowed positions: numbers from 3 to 32, excluding initialControl, finalControl, and 16.
    allowedPositions() {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === this.initialControl || num === this.finalControl || num === 16) continue;
        positions.push(num);
      }
      return positions; // Should have 27 numbers.
    },
    // Compute the 33 fixed run rows.
    fixedRows() {
      const totalRuns = 33;
      const rows = [];
      // Helper: retrieve run times from the runs prop (if available) or use empty strings.
      const getRunTime = (i) => {
        return this.runs[i] ? this.runs[i] : { startTime: "", endTime: "" };
      };
      // Helper function to compute a title for a given run number.
      // Run numbers:
      // 1: "Blank"
      // 2: "Argon Blank" (or "Methane Blank" if not energy)
      // 3: "Control - {initialControl}"
      // 13: "Control - {finalControl}"
      // 23: "Control - {initialControl}"
      // 33: "Control - {finalControl}"
      // All others: "Position {X}" where X is from allowedPositions.
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
          // Determine which group the run falls into:
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            posIndex = runNumber - 4; // group 1: 9 items (indices 0..8)
          } else if (runNumber >= 14 && runNumber <= 22) {
            posIndex = (runNumber - 14) + 9; // group 2: indices 9..17
          } else if (runNumber >= 24 && runNumber <= 32) {
            posIndex = (runNumber - 24) + 18; // group 3: indices 18..26
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `Position ${allowedPositions[posIndex]}`
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
    // If wait is active, prepend the wait row to the fixedRows.
    finalRows() {
      if (this.gcStore.startTime.wait15) {
        return [
          {
            position: "wait",
            computedTitle: "15-Min Wait",
            startTime: this.waitStartTime,
            endTime: this.waitEndTime
          },
          ...this.fixedRows
        ];
      } else {
        return this.fixedRows;
      }
    },
    
    // Other computed properties (sequentialRows, additionalRows, prebatchRows) can remain as before.
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
