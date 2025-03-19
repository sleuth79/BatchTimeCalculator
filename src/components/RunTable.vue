<template>
  <div class="run-table">
    <table v-if="positionOrder.length">
      <thead>
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
        <!-- Wait row, if present -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render fixed run rows (sequential run numbers from 1 to totalPositions) -->
        <tr v-for="(title, idx) in positionOrder" :key="idx">
          <td class="run-column">{{ idx + 1 }}</td>
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

    // Determine if the first row is a wait row.
    const runsHasWait = computed(() =>
      props.runs.length > 0 &&
      String(props.runs[0].position).toLowerCase() === "wait"
    );
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Base runs exclude the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final sample position from store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));
    // Total positions = finalPosition + 1 (if finalPosition is 32 then total = 33).
    const totalPositions = computed(() => {
      if (isNaN(finalPosition.value) || finalPosition.value < 1) return 33;
      return finalPosition.value === 32 ? 33 : finalPosition.value + 1;
    });
    // Full batch flag.
    const isFullBatch = computed(() => finalPosition.value === 32);

    // Get raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // For labeling, we want four control labels:
    // "1st Control" and "3rd Control" will show the larger (initial) control,
    // "2nd Control" and "4th Control" will show the smaller (final) control.
    const computedControls = computed(() => ({
      first: initialControlRaw.value,
      second: finalControlRaw.value,
      third: initialControlRaw.value,
      fourth: finalControlRaw.value
    }));

    // Compute allowed sample positions using the full range 3 to 32.
    // Exclude the raw control numbers and 16.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16) continue;
        arr.push(num);
      }
      return arr; // This array will always be 27 elements long.
    });

    // Build the positionOrder array (the run titles) of length totalPositions.
    const positionOrder = computed(() => {
      const total = totalPositions.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      const order = new Array(total).fill("");
      // Fixed entries:
      order[0] = "Blank";
      order[1] = gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      if (total > 2) order[2] = `1st Control - ${computedControls.value.first}`;
      if (total > 12) order[12] = `2nd Control - ${computedControls.value.second}`;
      if (total > 22) order[22] = `3rd Control - ${computedControls.value.third}`;
      // For the final control marker, only force it if there's at least one sample slot
      // after the last forced control marker. Otherwise, omit it.
      if (total > 24) order[total - 1] = `4th Control - ${computedControls.value.fourth}`;
      // Fill remaining indices with sample positions from sampleAllowed.
      let pointer = 0;
      for (let i = 0; i < total; i++) {
        if (order[i] !== "") continue;
        // Only assign if we have a sample value.
        order[i] = `Position ${sampleAllowed.value[pointer] || ""}`;
        pointer++;
      }
      return order;
    });

    // fixedRows: Pair each title in positionOrder with a sequential run number.
    const fixedRows = computed(() =>
      positionOrder.value.map((title, idx) => ({
        position: idx + 1,
        computedTitle: title,
        startTime: (baseRuns.value[idx] && baseRuns.value[idx].startTime) || "",
        endTime: (baseRuns.value[idx] && baseRuns.value[idx].endTime) || ""
      }))
    );

    // finalRows: Prepend the wait row if it exists.
    const finalRows = computed(() =>
      runsHasWait.value ? [waitRow.value, ...fixedRows.value] : fixedRows.value
    );

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
