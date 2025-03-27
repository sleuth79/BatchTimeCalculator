<template>
  <div class="run-table">
    <table v-if="positionOrder.length">
      <thead>
        <tr class="header-row">
          <th>Run Name</th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Run #</th>
        </tr>
      </thead>
      <tbody>
        <!-- Render wait row if present -->
        <tr v-if="runsHasWait">
          <td>{{ waitRow.computedTitle || waitRow.title || "15-Min Wait" }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
          <td>Wait</td>
        </tr>
        <!-- Render the computed rows and conditionally highlight the candidate run -->
        <tr
          v-for="(title, idx) in positionOrder"
          :key="idx"
          :class="{ highlight: shouldHighlight && idx === runtableClosestCandidateIndex }"
        >
          <td>{{ title }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].startTime) || "" }}</td>
          <td>{{ (baseRuns[idx] && baseRuns[idx].endTime) || "" }}</td>
          <td>{{ idx + 1 }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed, watch } from "vue";
import { useGcStore } from "../store";
import { parseTimeString } from "../utils/timeUtils.js";

export default {
  name: "RunTable",
  props: {
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props, { emit }) {
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
        if (num === biggerControl.value || num === smallerControl.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr;
    });

    // 6. Helper to build the final run order.
    function generatePositionOrder(finalPos, gcType) {
      const order = [];
      order.push("Blank");
      order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
      order.push(`1st Control : ${biggerControl.value}`);

      const samples = sampleAllowed.value.filter(n => n <= finalPos);

      if (finalPos < 13) {
        for (const s of samples) {
          order.push(`Position ${s}`);
        }
        order.push(`2nd Control : ${smallerControl.value}`);
        return order;
      }
      if (finalPos < 23) {
        const group1 = samples.filter(n => n <= 12);
        const group2 = samples.filter(n => n > 12);
        for (const s of group1) {
          order.push(`Position ${s}`);
        }
        order.push(`2nd Control : ${smallerControl.value}`);
        for (const s of group2) {
          order.push(`Position ${s}`);
        }
        order.push(`3rd Control : ${biggerControl.value}`);
        return order;
      }
      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n >= 13 && n <= 22);
      const group3 = samples.filter(n => n > 22);
      for (const s of group1) {
        order.push(`Position ${s}`);
      }
      order.push(`2nd Control : ${smallerControl.value}`);
      for (const s of group2) {
        order.push(`Position ${s}`);
      }
      const thirdLabel = `3rd Control : ${biggerControl.value}`;
      const indexOf22 = order.indexOf("Position 22");
      if (indexOf22 !== -1) {
        order.splice(indexOf22 + 1, 0, thirdLabel);
      } else if (biggerControl.value === 22) {
        const indexOf21 = order.indexOf("Position 21");
        if (indexOf21 !== -1) {
          order.splice(indexOf21 + 1, 0, thirdLabel);
        } else {
          order.push(thirdLabel);
        }
      } else {
        order.push(thirdLabel);
      }
      for (const s of group3) {
        order.push(`Position ${s}`);
      }
      order.push(`4th Control : ${smallerControl.value}`);
      return order;
    }

    // 7. The main computed property for our table.
    const positionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, gcType);
    });

    // 8. Compute the index of the base run that is the closest candidate to 4:00 PM.
    const runtableClosestCandidateIndex = computed(() => {
      const base = baseRuns.value;
      if (!base || base.length === 0) return -1;
      const cutoff = new Date();
      cutoff.setHours(16, 0, 0, 0);
      let candidateIndex = -1;
      let candidateTime = null;
      base.forEach((run, idx) => {
        if (!run.endTime) return;
        const parsed = parseTimeString(run.endTime);
        if (!parsed) return;
        const runDate = new Date();
        runDate.setHours(parsed.hour, parsed.minute, parsed.second || 0, 0);
        // Use <= so runs ending exactly at 4:00 PM count.
        if (runDate <= cutoff) {
          if (!candidateTime || runDate > candidateTime) {
            candidateTime = runDate;
            candidateIndex = idx;
          }
        }
      });
      return candidateIndex;
    });

    // 9. Compute the selected candidate run (if any) from base runs.
    const selectedCandidate = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0) return null;
      return baseRuns.value[idx];
    });

    // 10. Compute a label for the selected candidate using the table's displayed order.
    const selectedPositionLabel = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0 || !positionOrder.value || idx >= positionOrder.value.length) {
        return "No candidate found";
      }
      return positionOrder.value[idx];
    });

    // Compute a display string that includes the position label, start time, and end time.
    const runtableClosestPositionFull = computed(() => {
      if (!selectedCandidate.value) return "No candidate found";
      return `${selectedPositionLabel.value} : ${selectedCandidate.value.startTime} to ${selectedCandidate.value.endTime}`;
    });

    // Emit the new computed value so that parent components can use it.
    watch(runtableClosestPositionFull, (newVal) => {
      emit("update:runtableClosestPositionFull", newVal);
    }, { immediate: true });

    // Compute batch start time parsed.
    const batchStartTimeParsed = computed(() => {
      if (!gcStore.startTime.batchStartTime) return null;
      return parseTimeString(gcStore.startTime.batchStartTime);
    });

    // Determine if at least one base run ends at or before 4:00 PM.
    const hasCandidateRun = computed(() => {
      return baseRuns.value.some(run => {
        if (!run.endTime) return false;
        const parsed = parseTimeString(run.endTime);
        return parsed && (parsed.hour < 16 || (parsed.hour === 16 && parsed.minute === 0));
      });
    });

    // Should we highlight the candidate run?
    const shouldHighlight = computed(() => {
      if (!batchStartTimeParsed.value) return false;
      // If the batch starts at or after 4:00 PM, no highlighting.
      if (batchStartTimeParsed.value.hour >= 16) return false;
      // If no run ends at or before 4:00 PM, no highlighting.
      if (!hasCandidateRun.value) return false;
      return true;
    });

    return {
      gcStore,
      positionOrder,
      runsHasWait,
      waitRow,
      baseRuns,
      runtableClosestCandidateIndex,
      selectedCandidate,
      selectedPositionLabel,
      runtableClosestPositionFull,
      shouldHighlight
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
.header-row {
  background-color: #f5f5f5;
  color: #333;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.run-table tbody tr {
  border-bottom: 1px solid #eee;
}
.run-table tbody tr:last-child {
  border-bottom: none;
}
/* Highlighting style applied only when conditions are met */
.highlight {
  background-color: #f0f0f0;
}
.results {
  margin-top: 20px;
  padding: 10px;
  background-color: #eef;
  border: 1px solid #ccc;
}
.results h3 {
  margin: 0 0 10px;
}
</style>
