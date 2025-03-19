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
        <!-- Wait row, if present -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || '15-Min Wait' }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Fixed run rows -->
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
    // Expects runs array; if a wait row is active it is the first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Check if the first run is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Exclude wait row for fixed rows.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final position from the store.
    const finalPositionStore = computed(() => Number(gcStore.startTime.finalPosition));
    // A flag: full batch if final position equals 32.
    const isFullBatch = computed(() => finalPositionStore.value === 32);

    // User-entered controls (we have two control fields).
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    // Define initial control as the larger and final control as the smaller.
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // Compute four control values by equally spacing between the initial and final.
    // If one or both are missing, fallback to using the raw values.
    const computedControls = computed(() => {
      const init = initialControlRaw.value;
      const fin = finalControlRaw.value;
      if (!init || !fin) {
        return {
          initial: init,
          second: init,
          third: fin,
          final: fin
        };
      }
      const diff = init - fin;
      const segment = diff / 3;
      return {
        initial: init,
        second: Math.round(init - segment),
        third: Math.round(init - 2 * segment),
        final: fin
      };
    });

    // Allowed positions: numbers 3–32 excluding the user controls and 16.
    const allowedPositions = computed(() => {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        positions.push(num);
      }
      return positions;
    });

    // Determine total fixed rows.
    // For a full batch, we want 33 rows; for non-full batches, use final position + 1.
    const totalFixed = computed(() => {
      const fp = finalPositionStore.value;
      return isNaN(fp) || fp < 3 ? 33 : isFullBatch.value ? 33 : fp + 1;
    });

    // Helper function to assign run titles.
    // For a full batch, we want four control rows:
    //   Row 1: "Blank"
    //   Row 2: "Argon Blank" (or "Methane Blank")
    //   Row 3: Control – computedControls.initial
    //   Rows 4–12: Position labels
    //   Row 13: Control – computedControls.second
    //   Rows 14–22: Position labels
    //   Row 23: Control – computedControls.third
    //   Rows 24–32: Position labels
    //   Row 33: Control – computedControls.final
    // For non-full batches, only the last row is control.
    function getTitle(runNumber, allowedPositions, computedControls, gcType, totalFixedValue) {
      if (runNumber === 1) {
        return "Blank";
      }
      if (runNumber === 2) {
        return gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      }
      if (isFullBatch.value) {
        if (runNumber === 3) {
          return `Control - ${computedControls.initial}`;
        } else if (runNumber === 13) {
          return `Control - ${computedControls.second}`;
        } else if (runNumber === 23) {
          return `Control - ${computedControls.third}`;
        } else if (runNumber === totalFixedValue) {
          return `Control - ${computedControls.final}`;
        } else {
          // For position rows: we assign based on groups.
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            posIndex = runNumber - 4; // group 1 (indices 0..8)
          } else if (runNumber >= 14 && runNumber <= 22) {
            posIndex = (runNumber - 14) + 9; // group 2 (indices 9..17)
          } else if (runNumber >= 24 && runNumber < totalFixedValue) {
            posIndex = (runNumber - 24) + 18; // group 3 (indices 18..(total-2))
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `Position ${allowedPositions[posIndex]}`
            : "";
        }
      } else {
        // Non-full batch: rows 1 & 2 fixed; rows 3 to (totalFixed - 1) are positions; last row is control.
        if (runNumber >= 3 && runNumber < totalFixedValue) {
          const posIndex = runNumber - 3;
          return posIndex < allowedPositions.length ? `Position ${allowedPositions[posIndex]}` : "";
        }
        if (runNumber === totalFixedValue) {
          return `Control - ${computedControls.final}`;
        }
      }
      return "";
    }

    // Build the fixedRows array.
    const fixedRows = computed(() => {
      const total = totalFixed.value;
      const rows = [];
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      for (let i = 1; i <= total; i++) {
        const runTimes = baseRuns.value[i - 1] ? baseRuns.value[i - 1] : { startTime: "", endTime: "" };
        rows.push({
          position: i,
          computedTitle: getTitle(i, allowedPositions.value, computedControls.value, gcType, total),
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    });

    // Combine wait row (if present) with fixed rows.
    const finalRows = computed(() => {
      return runsHasWait.value ? [waitRow.value, ...fixedRows.value] : fixedRows.value;
    });

    // (Optional) Compute which fixed row is closest to 4:00 PM.
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
