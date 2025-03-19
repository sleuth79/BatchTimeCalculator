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
        <!-- Render run rows from positionOrder -->
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

    // Check if the first row is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Base runs: exclude the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final sample position from store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));
    // Total positions: finalPosition + 1 (or 33 if finalPosition is 32).
    const totalPositions = computed(() =>
      isNaN(finalPosition.value) || finalPosition.value < 1
        ? 33
        : finalPosition.value === 32
        ? 33
        : finalPosition.value + 1
    );
    // Full batch flag.
    const isFullBatch = computed(() => finalPosition.value === 32);

    // Get raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // For labeling we now use four control labels:
    // "1st Control" and "3rd Control" show the larger value,
    // "2nd Control" and "4th Control" show the smaller value.
    const computedControls = computed(() => ({
      first: initialControlRaw.value,
      second: finalControlRaw.value,
      third: initialControlRaw.value,
      fourth: finalControlRaw.value
    }));

    // Build allowed sample positions.
    const sampleAllowed = computed(() => {
      const arr = [];
      const max = isFullBatch.value ? 32 : finalPosition.value;
      for (let num = 3; num <= max; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr;
    });

    // Build positionOrder array of length totalPositions.
    // Fixed entries:
    // index 0: "Blank"
    // index 1: "Argon Blank" or "Methane Blank"
    // if total > 2, index 2: "1st Control – [X]"
    // if total > 12, index 12: "2nd Control – [Y]"
    // if total > 22, index 22: "3rd Control – [X]"
    // if total > 24, last index (total - 1): "4th Control – [Y]"
    const positionOrder = computed(() => {
      const total = totalPositions.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      const order = new Array(total).fill("");
      order[0] = "Blank";
      order[1] = gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      if (total > 2) order[2] = `1st Control - ${computedControls.value.first}`;
      if (total > 12) order[12] = `2nd Control - ${computedControls.value.second}`;
      if (total > 22) order[22] = `3rd Control - ${computedControls.value.third}`;
      if (total > 24) order[total - 1] = `4th Control - ${computedControls.value.fourth}`;
      // Fill remaining indices with sample positions from sampleAllowed.
      let pointer = 0;
      for (let i = 0; i < total; i++) {
        if (order[i] !== "") continue;
        order[i] = `Position ${sampleAllowed.value[pointer] || ""}`;
        pointer++;
      }
      return order;
    });

    // fixedRows: assign sequential run numbers (starting at 1) with titles from positionOrder.
    const fixedRows = computed(() => {
      return positionOrder.value.map((title, idx) => ({
        position: idx + 1,
        computedTitle: title,
        startTime: (baseRuns.value[idx] && baseRuns.value[idx].startTime) || "",
        endTime: (baseRuns.value[idx] && baseRuns.value[idx].endTime) || ""
      }));
    });

    // finalRows: if a wait row exists, prepend it.
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
