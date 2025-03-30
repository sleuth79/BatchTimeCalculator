<template>
  <div class="run-table">
    <!-- Toggle button to show/hide the entire run table -->
    <button @click="toggleRunTable">
      {{ showRunTable ? 'Hide Run Table' : 'Show Run Table' }}
    </button>

    <!-- Run Table Sections, only shown when toggled on -->
    <div v-if="showRunTable">
      <!-- Initial Batch Section (no heading for this one) -->
      <table v-if="initialPositionOrder.length">
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
          <!-- Render initial batch rows -->
          <tr
            v-for="(title, idx) in initialPositionOrder"
            :key="'initial-' + idx"
            :class="{ highlight: idx === runtableClosestCandidateIndex }"
          >
            <td>{{ title }}</td>
            <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].startTime) || "" }}</td>
            <td>{{ (initialBaseRuns[idx] && initialBaseRuns[idx].endTime) || "" }}</td>
            <td>{{ idx + 1 }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Sequential Batch Section (only rendered if sequential batch exists) -->
      <div v-if="hasSequentialBatch">
        <h3>Sequential Batch</h3>
        <table>
          <thead>
            <tr class="header-row">
              <th>Run Name</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Run #</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(title, idx) in sequentialPositionOrder"
              :key="'sequential-' + idx"
            >
              <td>{{ title }}</td>
              <td>{{ (sequentialBaseRuns[idx] && sequentialBaseRuns[idx].startTime) || "" }}</td>
              <td>{{ (sequentialBaseRuns[idx] && sequentialBaseRuns[idx].endTime) || "" }}</td>
              <td>{{ idx + 1 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
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

    // Toggle for showing/hiding the run table.
    const showRunTable = ref(false);
    const toggleRunTable = () => {
      showRunTable.value = !showRunTable.value;
    };

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

    // 3. finalPosition from store (for the initial batch)
    const finalPosition = computed(() => Number(gcStore.startTime.finalPosition));

    // 4. Control values from store.
    const c1 = computed(() => Number(gcStore.startTime.controls?.control1));
    const c2 = computed(() => Number(gcStore.startTime.controls?.control2));
    const biggerControl = computed(() => Math.max(c1.value || 0, c2.value || 0));
    const smallerControl = computed(() => Math.min(c1.value || 0, c2.value || 0));

    // 5. Build a “master” list of allowed sample positions (3..32), excluding the control numbers and 16.
    const sampleAllowed = computed(() => {
      const arr = [];
      for (let num = 3; num <= 32; num++) {
        if (num === biggerControl.value || num === smallerControl.value || num === 16)
          continue;
        arr.push(num);
      }
      return arr;
    });

    // 6. Helper to build the final run order with three scenarios.
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

    // 7. Compute the initial and sequential position orders.
    const initialPositionOrder = computed(() => {
      const fp = finalPosition.value;
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(fp, gcType);
    });
    const sequentialPositionOrder = computed(() => {
      if (gcStore.sequentialFinalPosition === null || gcStore.sequentialFinalPosition === undefined) return [];
      const seqFP = Number(gcStore.sequentialFinalPosition);
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      return generatePositionOrder(seqFP, gcType);
    });

    // 8. Split baseRuns into initial and sequential groups.
    const initialBaseRuns = computed(() =>
      baseRuns.value.slice(0, initialPositionOrder.value.length)
    );
    const sequentialBaseRuns = computed(() => {
      const startIndex = initialPositionOrder.value.length;
      return baseRuns.value.slice(startIndex);
    });

    // 9. Computed flag for sequential batch.
    const hasSequentialBatch = computed(() => {
      return gcStore.sequentialFinalPosition !== null &&
             gcStore.sequentialFinalPosition !== undefined;
    });

    // 10. Compute the index of the initial batch run that is the closest candidate to 4:00 PM.
    const runtableClosestCandidateIndex = computed(() => {
      const base = initialBaseRuns.value;
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
        runDate.setHours(parsed.hour, parsed.minute, parsed.second, 0);
        if (runDate < cutoff) {
          if (!candidateTime || runDate > candidateTime) {
            candidateTime = runDate;
            candidateIndex = idx;
          }
        }
      });
      return candidateIndex;
    });

    // 11. Compute the selected candidate run from initialBaseRuns.
    const selectedCandidate = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0) return null;
      return initialBaseRuns.value[idx];
    });

    // 12. Compute a label for the selected candidate using the table's displayed order.
    const selectedPositionLabel = computed(() => {
      const idx = runtableClosestCandidateIndex.value;
      if (idx < 0 || !initialPositionOrder.value || idx >= initialPositionOrder.value.length) {
        return "No candidate found";
      }
      return initialPositionOrder.value[idx];
    });

    // NEW: Compute a display string that includes the position label, start time, and end time.
    const runtableClosestPositionFull = computed(() => {
      if (!selectedCandidate.value) return "No candidate found";
      return `${selectedPositionLabel.value} : ${selectedCandidate.value.startTime} to ${selectedCandidate.value.endTime}`;
    });

    // Emit the new computed value so that parent components can use it.
    watch(runtableClosestPositionFull, (newVal) => {
      emit("update:runtableClosestPositionFull", newVal);
    }, { immediate: true });

    return {
      gcStore,
      showRunTable,
      toggleRunTable,
      initialPositionOrder,
      sequentialPositionOrder,
      hasSequentialBatch,
      runsHasWait,
      waitRow,
      initialBaseRuns,
      sequentialBaseRuns,
      runtableClosestCandidateIndex,
      selectedCandidate,
      selectedPositionLabel,
      runtableClosestPositionFull
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
.run-table button {
  margin-bottom: 10px;
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
.highlight {
  background-color: yellow;
}
</style>
