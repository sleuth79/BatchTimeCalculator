<template>
  <div class="run-table">
    <table v-if="positionOrder.length">
      <thead>
        <tr class="title-row">
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

    // 1. Identify if there's a "Wait" row at the top.
    const runsHasWait = computed(() =>
      props.runs.length > 0 &&
      String(props.runs[0].position).toLowerCase() === "wait"
    );
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));

    // 2. Base runs = everything except the wait row (if present).
    const baseRuns = computed(() =>
      runsHasWait.value ? props.runs.slice(1) : props.runs
    );

    // 3. finalPosition from store
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));

    // 4. Control values from store (larger = "first"/"third", smaller = "second"/"fourth")
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const initialControlRaw = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const finalControlRaw = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // For clarity, you can keep these or use them directly.
    const computedControls = computed(() => ({
      first: initialControlRaw.value,   // bigger
      second: finalControlRaw.value,   // smaller
      third: initialControlRaw.value,  // bigger
      fourth: finalControlRaw.value    // smaller
    }));

    // 5. Build the “master” list of allowed sample positions (3..32),
    //    excluding control numbers and 16. We'll then filter by finalPosition.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControlRaw.value || num === finalControlRaw.value || num === 16) continue;
        arr.push(num);
      }
      return arr;
    });

    // 6. Helper to build the final run order.
    function generatePositionOrder(finalPos, controls, allSamples, gcType) {
      // Prepare a fresh array to hold the final run titles.
      const order = [];

      // Always start with:
      order.push("Blank");
      order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
      order.push(`1st Control - ${controls.first}`);

      // Filter the “allowed” samples to only those ≤ finalPosition.
      const samples = allSamples.filter(n => n <= finalPos);

      // If finalPos < 23, we do a simpler approach:
      if (finalPos < 23) {
        // Just add all sample positions
        for (const s of samples) {
          order.push(`Position ${s}`);
        }
        // Then the "3rd Control"
        order.push(`3rd Control - ${controls.third}`);
        return order;
      }

      // Otherwise, finalPos >= 23 => we do the "full" approach:
      //  a) group1 = positions ≤ 12
      //  b) group2 = positions 13..22
      //  c) group3 = positions > 22

      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n >= 13 && n <= 22);
      const group3 = samples.filter(n => n > 22);

      // a) Add group1
      for (const s of group1) {
        order.push(`Position ${s}`);
      }

      // b) Insert 2nd control if we have group2 or finalPos >= 13
      //    (At this point, finalPos is definitely >= 23, so we do want 2nd control.)
      order.push(`2nd Control - ${controls.second}`);

      // c) Add group2
      for (const s of group2) {
        order.push(`Position ${s}`);
      }

      // d) Insert 3rd control after "Position 22" if that exists
      const thirdLabel = `3rd Control - ${controls.third}`;
      const indexOf22 = order.indexOf("Position 22");

      if (indexOf22 !== -1) {
        // Insert immediately after "Position 22"
        order.splice(indexOf22 + 1, 0, thirdLabel);
      } else if (controls.third === 22) {
        // If the bigger control is 22, that means "Position 22" doesn't exist.
        // So try to place it after "Position 21" if that exists:
        const indexOf21 = order.indexOf("Position 21");
        if (indexOf21 !== -1) {
          order.splice(indexOf21 + 1, 0, thirdLabel);
        } else {
          // else just push at the end
          order.push(thirdLabel);
        }
      } else {
        // If we don't find "Position 22" for some reason, just push the 3rd control at the end of group2
        order.push(thirdLabel);
      }

      // e) Add group3
      for (const s of group3) {
        order.push(`Position ${s}`);
      }

      // f) Finally, 4th Control at the end
      order.push(`4th Control - ${controls.fourth}`);

      return order;
    }

    // 7. positionOrder is our main computed property that the table uses
    const positionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, computedControls.value, sampleAllowed.value, gcType);
    });

    // 8. (Optional) “closestBefore4” logic is unchanged
    function parseTimeStringToDate(timeStr) {
      const today = new Date();
      return new Date(`${today.toDateString()} ${timeStr}`);
    }

    const closestBefore4 = computed(() => {
      const cutoff = new Date(`${new Date().toDateString()} 4:00:00 PM`);
      let candidate = null;
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
