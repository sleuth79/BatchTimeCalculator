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
        <!-- Render wait row if present (only once) -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || '15-Min Wait' }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render the fixed run rows -->
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
import { computed, watch } from "vue";
import { useGcStore } from "../store";
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";

export default {
  name: "RunTable",
  props: {
    // The runs prop is expected to include the wait row (if active) as the first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Determine whether the first row is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // baseRuns excludes the wait row (if present)
    const baseRuns = computed(() => (runsHasWait.value ? props.runs.slice(1) : props.runs));

    // Use the final position from the GC store.
    const finalPositionStore = computed(() => Number(gcStore.startTime.finalPosition));

    // Compute allowed positions (for labeling the normal runs).
    const initialControl = computed(() => {
      const c1 = Number(gcStore.startTime.controls?.control1);
      const c2 = Number(gcStore.startTime.controls?.control2);
      return Math.max(c1 || 0, c2 || 0);
    });
    const finalControl = computed(() => {
      const c1 = Number(gcStore.startTime.controls?.control1);
      const c2 = Number(gcStore.startTime.controls?.control2);
      return Math.min(c1 || 0, c2 || 0);
    });
    const allowedPositions = computed(() => {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControl.value || num === finalControl.value || num === 16)
          continue;
        positions.push(num);
      }
      return positions;
    });

    // Dynamically compute total fixed rows as (final position + 1).
    // For example, if final position is 32, total fixed rows = 33; if final position is 23, total fixed rows = 24.
    const totalFixed = computed(() => {
      const fp = finalPositionStore.value;
      return isNaN(fp) || fp < 3 ? 33 : fp + 1;
    });

    // Helper function to assign a run title.
    // In this version, we want:
    // - Row 1: "Blank"
    // - Row 2: "Argon Blank" (or "Methane Blank")
    // - Row 3: Control - initialControl
    // - Row 13: Control - finalControl
    // - The final row (row === totalFixed): Control - finalControl
    // All other rows: "Position X" (using allowedPositions) 
    function getTitle(runNumber, allowedPositions, initialControl, finalControl, gcType, totalFixedValue) {
      if (runNumber === 1) {
        return "Blank";
      } else if (runNumber === 2) {
        return gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      } else if (runNumber === 3) {
        return `Control - ${initialControl}`;
      } else if (runNumber === 13) {
        return `Control - ${finalControl}`;
      } else if (runNumber === totalFixedValue) {
        return `Control - ${finalControl}`;
      } else {
        // For all other rows, assign a position label.
        let posIndex;
        if (runNumber >= 4 && runNumber < 13) {
          posIndex = runNumber - 4; // group 1: indices 0..8
        } else if (runNumber > 13 && runNumber < totalFixedValue) {
          posIndex = (runNumber - 14) + 9; // group 2: indices 9..
        }
        return posIndex !== undefined && posIndex < allowedPositions.length
          ? `Position ${allowedPositions[posIndex]}`
          : "";
      }
    }

    // Build fixedRows: exactly totalFixed rows.
    const fixedRows = computed(() => {
      const total = totalFixed.value;
      const rows = [];
      // Helper: get run times from baseRuns if available.
      const getRunTime = (i) => {
        return baseRuns.value[i] ? baseRuns.value[i] : { startTime: "", endTime: "" };
      };
      // Get GC type (for blank titles)
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      for (let i = 1; i <= total; i++) {
        const runTimes = getRunTime(i - 1);
        rows.push({
          position: i,
          computedTitle: getTitle(i, allowedPositions.value, initialControl.value, finalControl.value, gcType, total),
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    });

    // Combine wait row (if any) with fixedRows.
    const finalRows = computed(() => {
      return runsHasWait.value ? [waitRow.value, ...fixedRows.value] : fixedRows.value;
    });

    // --- (Optional) Compute the fixed run closest to 4:00 PM (ignoring the wait row) ---
    function parseTimeStringToDate(timeStr) {
      const today = new Date();
      return new Date(`${today.toDateString()} ${timeStr}`);
    }
    const closestBefore4 = computed(() => {
      const today = new Date();
      const cutoff = new Date(`${today.toDateString()} 4:00:00 PM`);
      let candidate = null;
      for (const row of fixedRows.value) {
        if (!row.endTime) continue;
        const endDate = parseTimeStringToDate(row.endTime);
        if (endDate < cutoff) {
          if (!candidate || endDate > parseTimeStringToDate(candidate.endTime)) {
            candidate = row;
          }
        }
      }
      return candidate;
    });
    watch(closestBefore4, (newVal) => {
      if (newVal) {
        gcStore.setClosestPositionBefore4PM(newVal.computedTitle);
      }
    }, { immediate: true });

    return {
      gcStore,
      finalRows,
      runsHasWait,
      waitRow,
      fixedRows
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
