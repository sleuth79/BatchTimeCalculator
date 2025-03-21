<template>
  <div class="run-table">
    <table v-if="positionOrder.length">
      <thead>
        <tr class="title-row">
          <!-- Increase colspan to account for the new "Run" column -->
          <th colspan="4" class="batch-header">Initial Batch</th>
        </tr>
        <tr class="header-row">
          <th>Run</th>
          <th>Run Title</th>
          <th>Start Time</th>
          <th>End Time</th>
        </tr>
      </thead>
      <tbody>
        <!-- Render wait row if present -->
        <tr v-if="runsHasWait">
          <td>Wait</td>
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render the computed rows -->
        <tr v-for="(title, idx) in positionOrder" :key="idx">
          <td>{{ idx + 1 }}</td>
          <td>{{ title }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].startTime) || "" }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].endTime) || "" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed } from "vue";
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

    // 1. Check if there's a "Wait" row at the top.
    const runsHasWait = computed(() =>
      props.runs.length > 0 &&
      String(props.runs[0].position).toLowerCase() === "wait"
    );
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));

    // 2. Base runs = everything except the wait row (if present).
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // 3. finalPosition from store.
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));

    // 4. Control values from store.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const biggerControl = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const smallerControl = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // 5. Build a “master” list of allowed sample positions (3..32), excluding
    //    the control numbers themselves and 16.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === biggerControl.value || num === smallerControl.value || num === 16) continue;
        arr.push(num);
      }
      return arr;
    });

    // 6. Helper to build the final run order with three scenarios.
    function generatePositionOrder(finalPos, gcType) {
      // Start with the fixed header rows:
      const order = [];
      order.push("Blank");
      order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
      order.push(`1st Control - ${biggerControl.value}`);

      // Filter the allowed sample positions so we only keep ≤ finalPos.
      const samples = sampleAllowed.value.filter(n => n <= finalPos);

      // SCENARIO A: finalPos < 13 => only one control row (2nd control)
      if (finalPos < 13) {
        // Add all sample positions, then append the 2nd Control (using the smaller control)
        for (const s of samples) {
          order.push(`Position ${s}`);
        }
        order.push(`2nd Control - ${smallerControl.value}`);
        return order;
      }

      // SCENARIO B: 13 <= finalPos < 23 => add a 2nd control after position 12, then the 3rd control at the end.
      if (finalPos < 23) {
        // Group1 = positions ≤ 12
        const group1 = samples.filter(n => n <= 12);
        // Group2 = positions > 12
        const group2 = samples.filter(n => n > 12);

        // Add group1.
        for (const s of group1) {
          order.push(`Position ${s}`);
        }

        // 2nd Control (the smaller control).
        order.push(`2nd Control - ${smallerControl.value}`);

        // Add group2.
        for (const s of group2) {
          order.push(`Position ${s}`);
        }

        // 3rd Control (the bigger control) at the end.
        order.push(`3rd Control - ${biggerControl.value}`);
        return order;
      }

      // SCENARIO C: finalPos >= 23 => full approach with groups and two control insertions.
      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n >= 13 && n <= 22);
      const group3 = samples.filter(n => n > 22);

      // a) Add group1.
      for (const s of group1) {
        order.push(`Position ${s}`);
      }

      // b) Insert 2nd Control.
      order.push(`2nd Control - ${smallerControl.value}`);

      // c) Add group2.
      for (const s of group2) {
        order.push(`Position ${s}`);
      }

      // d) 3rd control (the bigger control) after "Position 22" if it exists.
      const thirdLabel = `3rd Control - ${biggerControl.value}`;
      const indexOf22 = order.indexOf("Position 22");
      if (indexOf22 !== -1) {
        order.splice(indexOf22 + 1, 0, thirdLabel);
      } else if (biggerControl.value === 22) {
        // If 22 is the bigger control, "Position 22" won't exist.
        // Try "Position 21" or else just push it.
        const indexOf21 = order.indexOf("Position 21");
        if (indexOf21 !== -1) {
          order.splice(indexOf21 + 1, 0, thirdLabel);
        } else {
          order.push(thirdLabel);
        }
      } else {
        order.push(thirdLabel);
      }

      // e) Add group3.
      for (const s of group3) {
        order.push(`Position ${s}`);
      }

      // f) 4th Control at the end (the smaller control again).
      order.push(`4th Control - ${smallerControl.value}`);

      return order;
    }

    // 7. The main computed property for our table.
    const positionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, gcType);
    });

    // The centralized closest position logic is now handled in the store,
    // so we do not need to compute it here.

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
