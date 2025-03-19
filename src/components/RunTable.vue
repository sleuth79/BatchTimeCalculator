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
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Check if the first row is a wait row.
    const runsHasWait = computed(() =>
      props.runs.length > 0 &&
      String(props.runs[0].position).toLowerCase() === "wait"
    );
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // Exclude the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Final sample position from the store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));
    // If finalPosition < 23, then totalPositions = finalPosition.
    // Otherwise, totalPositions = finalPosition + 1.
    const totalPositions = computed(() => {
      if (isNaN(finalPosition.value) || finalPosition.value < 1) return 33;
      return finalPosition.value < 23 ? finalPosition.value : finalPosition.value + 1;
    });
    // Full batch flag (full batch if finalPosition is 32).
    const isFullBatch = computed(() => finalPosition.value === 32);

    // Raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // Compute control labels.
    // For our new naming:
    // "1st Control" and "3rd Control" use the larger control,
    // "2nd Control" and "4th Control" use the smaller control.
    const computedControls = computed(() => ({
      first: initialControlRaw.value,
      second: finalControlRaw.value,
      third: initialControlRaw.value,
      fourth: finalControlRaw.value
    }));

    // Build allowed sample positions from the full range 3–32.
    // Exclude the two control numbers and 16.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16) continue;
        arr.push(num);
      }
      return arr; // always 27 elements
    });

    // Build the positionOrder array.
    const positionOrder = computed(() => {
      const total = totalPositions.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      const order = new Array(total).fill("");
      // Fixed entries:
      order[0] = "Blank";
      order[1] = gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
      if (total > 2) order[2] = `1st Control - ${computedControls.value.first}`;
      
      if (total >= 23) {
        // For batches with total positions ≥ 23, we insert four controls.
        order[12] = `2nd Control - ${computedControls.value.second}`;
        order[22] = `3rd Control - ${computedControls.value.third}`;
        order[total - 1] = `4th Control - ${computedControls.value.fourth}`;
      } else {
        // For batches with total positions < 23, we insert three controls.
        if (total > 12) order[12] = `2nd Control - ${computedControls.value.second}`;
        order[total - 1] = `3rd Control - ${computedControls.value.third}`;
      }
      // Fill remaining positions with sample positions from sampleAllowed.
      let pointer = 0;
      for (let i = 0; i < total; i++) {
        if (order[i] !== "") continue;
        order[i] = `Position ${sampleAllowed.value[pointer] || ""}`;
        pointer++;
      }
      return order;
    });

    // fixedRows: assign run numbers sequentially (starting at 1) with titles from positionOrder.
    const fixedRows = computed(() =>
      positionOrder.value.map((title, idx) => ({
        position: idx + 1,
        computedTitle: title,
        startTime: (baseRuns.value[idx] && baseRuns.value[idx].startTime) || "",
        endTime: (baseRuns.value[idx] && baseRuns.value[idx].endTime) || ""
      }))
    );

    // finalRows: if a wait row exists, prepend it.
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
