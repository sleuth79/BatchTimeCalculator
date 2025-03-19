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
        <!-- Render wait row if active -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || '15-Min Wait' }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render fixed run rows (sequential numbering with computed titles) -->
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
    // The runs prop is expected to include a wait row (if active) as the first element.
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
    // Exclude the wait row for the rest.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final sample position from the store.
    const finalPositionStore = computed(() => Number(gcStore.startTime.finalPosition));
    // Full batch flag: true if final position equals 32.
    const isFullBatch = computed(() => finalPositionStore.value === 32);

    // Get raw control values from the store.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    // Define initial (larger) and final (smaller) controls.
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // For full batches we want four control labels:
    // "Initial Control" and "3rd Control" use the larger value,
    // "2nd Control" and "Final Control" use the smaller value.
    const computedControls = computed(() => {
      return {
        initial: initialControlRaw.value,
        second: finalControlRaw.value,
        third: initialControlRaw.value,
        final: finalControlRaw.value
      };
    });

    // Allowed sample positions: numbers 3 to 32 excluding the raw control values and 16.
    const allowedPositions = computed(() => {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        positions.push(num);
      }
      return positions;
    });

    // Determine total fixed rows (the total length of the "position order").
    // For full batch: always 33.
    // For non-full batch: final position + 1.
    const totalFixed = computed(() => {
      const fp = finalPositionStore.value;
      return isNaN(fp) || fp < 3 ? 33 : isFullBatch.value ? 33 : fp + 1;
    });

    // Compute the position order (the run titles) independently of run numbers.
    const positionOrder = computed(() => {
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      if (isFullBatch.value) {
        // Full batch: 33 positions with four control markers.
        const order = [];
        order.push("Blank");
        order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
        order.push(`Initial Control - ${computedControls.value.initial}`);
        // Next 9 sample positions (positions 4 to 12):
        for (let i = 0; i < 9; i++) {
          order.push(`Position ${allowedPositions.value[i]}`);
        }
        order.push(`2nd Control - ${computedControls.value.second}`);
        // Next 9 sample positions (positions 14 to 22):
        for (let i = 9; i < 18; i++) {
          order.push(`Position ${allowedPositions.value[i]}`);
        }
        order.push(`3rd Control - ${computedControls.value.third}`);
        // Next 9 sample positions (positions 24 to 32):
        for (let i = 18; i < 27; i++) {
          order.push(`Position ${allowedPositions.value[i]}`);
        }
        order.push(`Final Control - ${computedControls.value.final}`);
        return order; // length should be 33.
      } else {
        // Non-full batch: total positions = finalPositionStore + 1.
        const total = totalFixed.value;
        const order = [];
        order.push("Blank");
        order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
        // For sample positions, we need (total - 2) samples.
        for (let i = 0; i < total - 2; i++) {
          order.push(`Position ${allowedPositions.value[i]}`);
        }
        order.push(`Final Control - ${computedControls.value.final}`);
        return order; // length = total.
      }
    });

    // Build fixedRows using the computed positionOrder.
    const fixedRows = computed(() => {
      const order = positionOrder.value;
      const rows = [];
      for (let i = 0; i < order.length; i++) {
        // Use baseRuns if available; otherwise default blank times.
        const runTimes = baseRuns.value[i] || { startTime: "", endTime: "" };
        rows.push({
          position: i + 1, // runs are sequentially numbered.
          computedTitle: order[i],
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    });

    // The finalRows include the wait row (if any) at the top.
    const finalRows = computed(() => {
      return runsHasWait.value ? [waitRow.value, ...fixedRows.value] : fixedRows.value;
    });

    // (Optional) Compute which fixed run is closest to 4:00 PM.
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
