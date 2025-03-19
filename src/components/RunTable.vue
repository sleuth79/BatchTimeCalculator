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
        <!-- Wait row (if active) -->
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
    // Expects an array of run objects; if a wait row is active, it is the first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Determine if the first row is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Exclude the wait row for fixed rows.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final position from the store.
    const finalPositionStore = computed(() => Number(gcStore.startTime.finalPosition));
    // Full batch flag: true when final position equals 32.
    const isFullBatch = computed(() => finalPositionStore.value === 32);

    // Get raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    // Define initial control as the larger value and final control as the smaller.
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // Compute four control values.
    // For labeling purposes, we want:
    // - "Initial" and "3rd" to show the larger value.
    // - "2nd" and "Final" to show the smaller value.
    const computedControls = computed(() => {
      return {
        initial: initialControlRaw.value,
        second: finalControlRaw.value,
        third: initialControlRaw.value,
        final: finalControlRaw.value
      };
    });

    // Allowed positions: numbers from 3 to 32 excluding the two control values and 16.
    const allowedPositions = computed(() => {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        positions.push(num);
      }
      return positions;
    });

    // Compute total fixed rows.
    // For full batch: always 33 rows.
    // For non-full batch: total fixed rows = final position + 1.
    const totalFixed = computed(() => {
      const fp = finalPositionStore.value;
      return isNaN(fp) || fp < 3 ? 33 : isFullBatch.value ? 33 : fp + 1;
    });

    // Helper function to assign run titles.
    // For full batches, we want four control rows:
    //   Row 3: "Initial Control - [number]"  
    //   Row 13: "2nd Control - [number]"  
    //   Row 23: "3rd Control - [number]"  
    //   Row 33: "Final Control - [number]"
    // Other rows get "Position ..." labels.
    // For non-full batches, only the final row is control.
    function getTitle(runNumber, allowedPositions, computedControls, gcType, totalFixedValue) {
      if (runNumber === 1) {
        return "Blank";
      }
      if (runNumber === 2) {
        return gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      }
      if (isFullBatch.value) {
        if (runNumber === 3) {
          return `Initial Control - ${computedControls.initial}`;
        } else if (runNumber === 13) {
          return `2nd Control - ${computedControls.second}`;
        } else if (runNumber === 23) {
          return `3rd Control - ${computedControls.third}`;
        } else if (runNumber === totalFixedValue) {
          return `Final Control - ${computedControls.final}`;
        } else {
          // For non-control rows, assign position labels.
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            posIndex = runNumber - 4; // group 1: indices 0..8
          } else if (runNumber >= 14 && runNumber <= 22) {
            posIndex = (runNumber - 14) + 9; // group 2: indices 9..17
          } else if (runNumber >= 24 && runNumber < totalFixedValue) {
            posIndex = (runNumber - 24) + 18; // group 3: indices 18..(total-2)
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `Position ${allowedPositions[posIndex]}`
            : "";
        }
      } else {
        // For non-full batches, only the final row is control.
        if (runNumber >= 3 && runNumber < totalFixedValue) {
          const posIndex = runNumber - 3;
          return posIndex < allowedPositions.length ? `Position ${allowedPositions[posIndex]}` : "";
        }
        if (runNumber === totalFixedValue) {
          return `Final Control - ${computedControls.final}`;
        }
      }
      return "";
    }

    // Build fixedRows.
    const fixedRows = computed(() => {
      const total = totalFixed.value;
      const rows = [];
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      for (let i = 1; i <= total; i++) {
        const runTimes = baseRuns.value[i - 1]
          ? baseRuns.value[i - 1]
          : { startTime: "", endTime: "" };
        rows.push({
          position: i,
          computedTitle: getTitle(i, allowedPositions.value, computedControls.value, gcType, total),
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
