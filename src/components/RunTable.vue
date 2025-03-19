<template>
  <div class="run-table">
    <table>
      <thead v-if="positionOrder.length > 0">
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
        <!-- Wait row, if active -->
        <tr v-if="runsHasWait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle || waitRow.title || '15-Min Wait' }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render fixed run rows sequentially from the positionOrder -->
        <tr v-for="(title, index) in positionOrder" :key="index">
          <td class="run-column">{{ index + (runsHasWait ? 2 : 1) }}</td>
          <td>{{ title }}</td>
          <td>{{ (baseRuns[index] && baseRuns[index].startTime) || "" }}</td>
          <td>{{ (baseRuns[index] && baseRuns[index].endTime) || "" }}</td>
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
    // The runs prop may include a wait row as the first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();

    // Determine if the first run is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // The remaining runs (if any) – we won’t use these to determine position order.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Get final sample position from the store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));
    // Flag: full batch if final position equals 32.
    const isFullBatch = computed(() => finalPosition.value === 32);

    // Get raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    // Define initial (larger) and final (smaller) control numbers.
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // In our design for full batches we want four control labels:
    // "Initial Control" and "3rd Control" will both show the larger control,
    // "2nd Control" and "Final Control" will both show the smaller control.
    const computedControls = computed(() => {
      return {
        initial: initialControlRaw.value,
        second: finalControlRaw.value,
        third: initialControlRaw.value,
        final: finalControlRaw.value
      };
    });

    // Build allowed positions arrays.
    // For full batch, use numbers from 3 to 32.
    const fullAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr; // typically 27 numbers
    });
    // For non-full batch, use numbers from 3 up to the finalPosition.
    const nonFullAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= finalPosition.value; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr;
    });

    // Now build the positionOrder array (the run titles) independent of run numbers.
    const positionOrder = computed(() => {
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      if (isFullBatch.value) {
        // Full batch: always 33 entries.
        const order = [];
        order.push("Blank");
        order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
        order.push(`Initial Control - ${computedControls.value.initial}`);
        // Next 9 sample positions.
        for (let i = 0; i < 9; i++) {
          order.push(`Position ${fullAllowed.value[i] || ""}`);
        }
        order.push(`2nd Control - ${computedControls.value.second}`);
        // Next 9 sample positions.
        for (let i = 9; i < 18; i++) {
          order.push(`Position ${fullAllowed.value[i] || ""}`);
        }
        order.push(`3rd Control - ${computedControls.value.third}`);
        // Next 9 sample positions.
        for (let i = 18; i < 27; i++) {
          order.push(`Position ${fullAllowed.value[i] || ""}`);
        }
        order.push(`Final Control - ${computedControls.value.final}`);
        return order; // length 33.
      } else {
        // Non-full batch: total positions = finalPosition + 1.
        const total = finalPosition.value + 1; // e.g., if finalPosition=31 then total=32.
        const order = [];
        order.push("Blank");
        order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
        // Number of sample positions = total - 3.
        const sampleCount = total - 3;
        const allowed = nonFullAllowed.value;
        for (let i = 0; i < sampleCount; i++) {
          order.push(`Position ${allowed[i] || ""}`);
        }
        order.push(`Final Control - ${computedControls.value.final}`);
        return order; // length equals total.
      }
    });

    // Finally, our fixedRows are built from the positionOrder array.
    // The run number will be the index+1 (after the wait row, if any).
    const fixedRows = computed(() => {
      return positionOrder.value.map((title, idx) => {
        // Use baseRuns[idx] if available for start/end times.
        const times = baseRuns.value[idx] || { startTime: "", endTime: "" };
        return {
          position: idx + 1,
          computedTitle: title,
          startTime: times.startTime,
          endTime: times.endTime
        };
      });
    });

    // Our finalRows include the wait row at the top (if active).
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
