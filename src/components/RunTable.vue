<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Only display the header if there are computed rows -->
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
        <!-- Render the 33 runs -->
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
import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: "RunTable",
  props: {
    // Expect an array of 33 run objects (already computed with start and end times)
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
    // Compute the control headings from the store values.
    // The initial control is the higher number, the final control is the lower number.
    initialControl() {
      const c1 = Number(this.gcStore.startTime.controls?.control1) || 0;
      const c2 = Number(this.gcStore.startTime.controls?.control2) || 0;
      return Math.max(c1, c2);
    },
    finalControl() {
      const c1 = Number(this.gcStore.startTime.controls?.control1) || 0;
      const c2 = Number(this.gcStore.startTime.controls?.control2) || 0;
      return Math.min(c1, c2);
    },
    computedRuns() {
      // We assume that this.runs is an array of 33 run objects
      // (each with computed startTime and endTime already).
      // We create a new array of 33 rows where each row gets a fixed run number (1..33)
      // and a title determined by its run number.
      const totalRuns = 33;
      // Helper: given a run number (1-indexed), return the title.
      function getTitle(runNumber, initialControl, finalControl, gcType) {
        // You can adjust the blank/argon blank titles based on gcType as needed.
        switch (runNumber) {
          case 1:
            return "blank";
          case 2:
            return gcType.includes("energy") ? "argon blank" : "methane blank";
          case 3:
            return `Control - ${initialControl}`;
          case 13:
            return `Control - ${finalControl}`;
          case 23:
            return `Control - ${initialControl}`;
          case 33:
            return `Final Control - ${finalControl}`;
          default:
            // For non-control rows, use a mapping that adjusts for the inserted controls.
            // The idea is that the "pos" number should equal:
            // runNumber minus the number of control rows that appear before it.
            let controlCount = 0;
            if (runNumber > 3) controlCount++;
            if (runNumber > 13) controlCount++;
            if (runNumber > 23) controlCount++;
            if (runNumber > 33) controlCount++; // not applicable for 33
            // For run 4, for example, pos = 4 - 1 = 3.
            // However, we want to preserve the special titles for run 1, 2, 3, 13, 23, 33.
            // So for any run that is not one of these, the title is "pos " + (runNumber - controlCount).
            return `pos ${runNumber - controlCount}`;
        }
      }
      
      // Determine gcType from the store data.
      const gcType = (this.gcStore.allGcData[this.gcStore.selectedGc]?.type || "").trim().toLowerCase();
      
      // Build a new array of 33 rows. We assume this.runs is already sorted in the desired order.
      // If not, you might want to sort them.
      // We'll map each run (by index) to a new object with fixed run number and computed title.
      // If there is any discrepancy (e.g., if this.runs doesn't have 33 items),
      // we fill in missing rows with empty times.
      const rows = [];
      for (let i = 0; i < totalRuns; i++) {
        const runNumber = i + 1;
        // Use the existing run from props if available.
        const run = this.runs[i] || { startTime: "", endTime: "" };
        rows.push({
          position: runNumber,
          computedTitle: getTitle(runNumber, this.initialControl, this.finalControl, gcType),
          startTime: run.startTime || "",
          endTime: run.endTime || ""
        });
      }
      return rows;
    },
    
    // The other computed properties (sequentialRows, additionalRows, prebatchRows, etc.)
    // remain unchanged or can be updated similarly if you need to apply the same ordering.
    sequentialRows() {
      // (Implement similar ordering for sequential batch if needed.)
      return [];
    },
    
    additionalRows() {
      // (Leave unchanged for now.)
      return [];
    },
    
    prebatchRows() {
      // (Leave unchanged for now.)
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
