<template>
  <div class="run-table" ref="tableRoot">
    <table>
      <thead>
        <template v-if="finalRows.length > 0">
          <tr class="title-row">
            <th colspan="4" class="batch-header">Initial Batch</th>
          </tr>
          <tr class="header-row">
            <th class="run-column">Run</th>
            <th>Run Title</th>
            <th>Start Time</th>
            <th>End Time</th>
          </tr>
        </template>
      </thead>
      <tbody>
        <!-- Render wait row if present (only once) -->
        <tr v-if="runsHasWait" class="run-row wait-row" data-run-type="wait">
          <td class="run-column">{{ waitRow.position }}</td>
          <td>{{ waitRow.computedTitle }}</td>
          <td>{{ waitRow.startTime }}</td>
          <td>{{ waitRow.endTime }}</td>
        </tr>
        <!-- Render the fixed 33 run rows -->
        <tr
          v-for="(row, index) in fixedRows"
          :key="index"
          class="run-row"
          :data-end-time="row.endTime"
        >
          <td class="run-column">{{ row.position }}</td>
          <td>{{ row.computedTitle }}</td>
          <td>{{ row.startTime }}</td>
          <td>{{ row.endTime }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { onMounted, onUpdated, nextTick, computed } from "vue";
import { useGcStore } from "../store";
import { formatTimeWithAmPmAndSeconds } from "../utils/utils.js";

export default {
  name: "RunTable",
  props: {
    // runs is expected to be an array that may include a wait row as its first element.
    runs: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    const tableRoot = ref(null);

    // Check if the first run in props is a wait row.
    const runsHasWait = computed(() => {
      return (
        props.runs.length > 0 &&
        String(props.runs[0].position).toLowerCase() === "wait"
      );
    });
    const waitRow = computed(() => (runsHasWait.value ? props.runs[0] : null));
    // baseRuns excludes the wait row (if present)
    const baseRuns = computed(() => (runsHasWait.value ? props.runs.slice(1) : props.runs));

    // Fixed 33-run ordering as before.
    const initialControl = computed(() => {
      const c1 = Number(gcStore.startTime.controls?.control1);
      const c2 = Number(gcStore.startTime.controls?.control2);
      return Math.max(c1 || 0, c2 || 0);
    });
    const finalControl = computed(() => {
      const c1 = Number(gcStore.startTime.controls?.control1);
      const c2 = Number(gcStore.startTime.controls?.control2);
      return Math.min(c1 || 0, c2 || 0);
    });
    const allowedPositions = computed(() => {
      const positions = [];
      for (let num = 3; num <= 32; num++) {
        if (num === initialControl.value || num === finalControl.value || num === 16) continue;
        positions.push(num);
      }
      return positions;
    });
    const fixedRows = computed(() => {
      const totalFixed = 33;
      const rows = [];
      const getRunTime = (i) => {
        return baseRuns.value[i] ? baseRuns.value[i] : { startTime: "", endTime: "" };
      };
      const gcType = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase();
      function getTitle(runNumber, allowedPositions, initialControl, finalControl, gcType) {
        if (runNumber === 1) {
          return "Blank";
        } else if (runNumber === 2) {
          return gcType.includes("energy") ? "Argon Blank" : "Methane Blank";
        } else if (runNumber === 3) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 13) {
          return `Control - ${finalControl}`;
        } else if (runNumber === 23) {
          return `Control - ${initialControl}`;
        } else if (runNumber === 33) {
          return `Control - ${finalControl}`;
        } else {
          let posIndex;
          if (runNumber >= 4 && runNumber <= 12) {
            posIndex = runNumber - 4;
          } else if (runNumber >= 14 && runNumber <= 22) {
            posIndex = (runNumber - 14) + 9;
          } else if (runNumber >= 24 && runNumber <= 32) {
            posIndex = (runNumber - 24) + 18;
          }
          return posIndex !== undefined && posIndex < allowedPositions.length
            ? `Position ${allowedPositions[posIndex]}`
            : "";
        }
      }
      for (let i = 1; i <= totalFixed; i++) {
        const runTimes = getRunTime(i - 1);
        rows.push({
          position: i,
          computedTitle: getTitle(i, allowedPositions.value, initialControl.value, finalControl.value, gcType),
          startTime: runTimes.startTime,
          endTime: runTimes.endTime
        });
      }
      return rows;
    });
    const finalRows = computed(() => {
      return runsHasWait.value ? [waitRow.value, ...fixedRows.value] : fixedRows.value;
    });

    // NEW: After the table is rendered, pull from the DOM the run row whose end time is the latest before 4:00 PM.
    function updateClosestFromDOM() {
      if (!tableRoot.value) return;
      // Find all fixed run rows (exclude the wait row).
      const rows = tableRoot.value.querySelectorAll("tr.run-row:not(.wait-row)");
      const today = new Date();
      const cutoff = new Date(`${today.toDateString()} 4:00:00 PM`);
      let candidate = null;
      rows.forEach(row => {
        const endTimeStr = row.getAttribute("data-end-time");
        if (!endTimeStr) return;
        const endDate = new Date(`${today.toDateString()} ${endTimeStr}`);
        if (endDate < cutoff) {
          if (!candidate || endDate > new Date(`${today.toDateString()} ${candidate.endTime}`)) {
            candidate = { row, endTime: endTimeStr };
          }
        }
      });
      if (candidate && candidate.row) {
        // Get the run title from the candidate row.
        const titleCell = candidate.row.querySelector("td:nth-child(2)");
        if (titleCell && titleCell.textContent) {
          // Call the store action to set this value.
          gcStore.setClosestPositionBefore4PM(titleCell.textContent.trim());
        }
      }
    }

    // Update after mounting and after each update.
    onMounted(() => {
      nextTick(updateClosestFromDOM);
    });
    onUpdated(() => {
      nextTick(updateClosestFromDOM);
    });

    return {
      gcStore,
      finalRows,
      runsHasWait,
      waitRow,
      fixedRows,
      tableRoot
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
