<template>
  <div class="run-table">
    <table>
      <thead v-if="positionOrder.length">
        <tr class="title-row">
          <th colspan="4" class="batch-header">Initial Batch</th>
        </tr>
        <tr class="header-row">
          <th class="run-column">Run</th>
          <th>Run Title</th>
          <th>Start Time</th>
          <th>End Time</th>
        </tr>
      </thead>
      <tbody>
        <!-- Wait row if active -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render run rows (sequentially numbered) with computed titles -->
        <tr v-for="(title, idx) in positionOrder" :key="idx">
          <td class="run-column">{{ idx + (runsHasWait ? 2 : 1) }}</td>
          <td>{{ title }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].startTime) || "" }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].endTime) || "" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed, watch } from "vue";
import { useGcStore } from "../store";

export default {
  name: "RunTable",
  props: {
    // The runs prop may include a wait row as the first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Check if first row is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Base runs excludes the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final sample position from store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));
    // Total positions = finalPosition + 1.
    const totalPositions = computed(() => (isNaN(finalPosition.value) || finalPosition.value < 1 ? 33 : finalPosition.value + 1));

    // Full batch flag: true if finalPosition equals 32.
    const isFullBatch = computed(() => finalPosition.value === 32);

    // Raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    // Define initial (larger) and final (smaller) controls.
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // For labeling, we want four control labels:
    // "Initial Control" and "3rd Control" use the larger value,
    // "2nd Control" and "Final Control" use the smaller value.
    const computedControls = computed(() => ({
      initial: initialControlRaw.value,
      second: finalControlRaw.value,
      third: initialControlRaw.value,
      final: finalControlRaw.value
    }));

    // Build allowed sample positions.
    // For non-full batch, use numbers 3 to finalPosition.
    // For full batch, use numbers 3 to 32.
    const sampleAllowed = computed(() => {
      const arr = [];
      const max = isFullBatch.value ? 32 : finalPosition.value;
      for (let num = 3; num <= max; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16) continue;
        arr.push(num);
      }
      return arr;
    });

    // Now build the positionOrder array of length totalPositions.
    // We'll always insert the fixed titles at the following indexes (if the array is long enough):
    // index 0: "Blank"
    // index 1: "Argon Blank" (or "Methane Blank")
    // if length ≥ 3 then index 2: "Initial Control – [X]"
    // if length ≥ 13 then index 12: "2nd Control – [Y]"
    // if length ≥ 23 then index 22: "3rd Control – [X]"
    // last index: "Final Control – [Y]"
    // All other positions get "Position {sampleAllowed[i]}" in order.
    const positionOrder = computed(() => {
      const total = totalPositions.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      // Start with an array of empty strings.
      const order = new Array(total).fill("");
      // Fixed entries:
      order[0] = "Blank";
      order[1] = gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      if (total >= 3) {
        order[2] = `Initial Control - ${computedControls.value.initial}`;
      }
      if (total >= 13) {
        order[12] = `2nd Control - ${computedControls.value.second}`;
      }
      if (total >= 23) {
        order[22] = `3rd Control - ${computedControls.value.third}`;
      }
      order[total - 1] = `Final Control - ${computedControls.value.final}`;
      // Now fill in remaining positions with sample positions from sampleAllowed.
      // We'll maintain a pointer into sampleAllowed.
      let pointer = 0;
      for (let i = 0; i < total; i++) {
        // If this index is already filled with a fixed marker, skip.
        if (order[i] !== "") continue;
        // Otherwise, use the next available sampleAllowed value.
        order[i] = `Position ${sampleAllowed.value[pointer] || ""}`;
        pointer++;
      }
      return order;
    });

    // Our fixedRows are built by pairing each title in positionOrder with a sequential run number.
    const fixedRows = computed(() => {
      return positionOrder.value.map((title, idx) => {
        // Run number = idx + 1 (note: if a wait row is present, it will be prepended later).
        return {
          position: idx + 1,
          computedTitle: title,
          startTime: (baseRuns.value[idx] && baseRuns.value[idx].startTime) || "",
          endTime: (baseRuns.value[idx] && baseRuns.value[idx].endTime) || ""
        };
      });
    });

    // finalRows: if a wait row exists, put it at the top.
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
      positionOrder,
      finalRows,
      runsHasWait,
      waitRow,
      fixedRows,
      baseRuns
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
