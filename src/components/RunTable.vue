<template>
  <div class="run-table">
    <table v-if="positionOrder.length">
      <thead>
        <tr class="title-row">
          <!-- Adjust colspan to match the columns -->
          <th colspan="3" class="batch-header">Initial Batch</th>
        </tr>
        <tr class="header-row">
          <th>Run Title</th>
          <th>Start Time</th>
          <th>End Time</th>
        </tr>
      </thead>
      <tbody>
        <!-- Render wait row if present -->
        <tr v-if="runsHasWait">
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render the computed rows -->
        <tr v-for="(title, idx) in positionOrder" :key="idx">
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
    // Base runs exclude the wait row.
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // Get final sample position from the store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));

    // Raw control values.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // Rename controls.
    const computedControls = computed(() => ({
      first: initialControlRaw.value,
      second: finalControlRaw.value,
      third: initialControlRaw.value,
      fourth: finalControlRaw.value
    }));

    // Build allowed sample positions from 3 to 32, excluding the two control numbers and 16.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16) continue;
        arr.push(num);
      }
      return arr; // typically 27 elements
    });

    // A helper function to generate the final order.
    // In a full batch (finalPosition >= 23) we want:
    //   Blank, Argon/Methane Blank, 1st Control,
    //   then a first group of samples,
    //   then 2nd Control,
    //   then a second group of samples,
    //   then (dynamically) insert 3rd Control immediately after the sample labeled "Position 22",
    //   then the remaining samples,
    //   then 4th Control at the end.
    // For non-full batches, we just append all samples then a final control.
    function generatePositionOrder(finalPos, controls, samples, gcType) {
      let order = [];
      // Fixed header rows:
      order.push("Blank");
      order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
      order.push(`1st Control - ${controls.first}`);
      
      if (finalPos >= 23) {
        // Define group sizes (these numbers mimic the original fixed positions).
        const group1Count = 9;
        const group2Count = 9;
        // Add first group of sample positions.
        for (let i = 0; i < group1Count && i < samples.length; i++) {
          order.push(`Position ${samples[i]}`);
        }
        // Add 2nd Control.
        order.push(`2nd Control - ${controls.second}`);
        // Add second group of sample positions.
        for (let i = group1Count; i < group1Count + group2Count && i < samples.length; i++) {
          order.push(`Position ${samples[i]}`);
        }
        // Insert 3rd Control immediately after the sample labeled "Position 22" if found.
        const indexOf22 = order.findIndex(item => item === "Position 22");
        if (indexOf22 !== -1) {
          order.splice(indexOf22 + 1, 0, `3rd Control - ${controls.third}`);
        } else {
          // If "Position 22" isn’t in the current order, push 3rd Control now.
          order.push(`3rd Control - ${controls.third}`);
        }
        // Add any remaining sample positions.
        for (let i = group1Count + group2Count; i < samples.length; i++) {
          order.push(`Position ${samples[i]}`);
        }
        // Add 4th Control at the end.
        order.push(`4th Control - ${controls.fourth}`);
      } else {
        // For non-full batches, simply add all sample positions then the final control.
        for (let i = 0; i < samples.length; i++) {
          order.push(`Position ${samples[i]}`);
        }
        order.push(`3rd Control - ${controls.third}`);
      }
      return order;
    }

    // Compute the final ordering using the helper.
    const positionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, computedControls.value, sampleAllowed.value, gcType);
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
      // Use baseRuns (which are the rows excluding the wait row)
      for (const row of baseRuns.value) {
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
      runsHasWait,
      waitRow,
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
