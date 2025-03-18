<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Only display the header if there are computed rows -->
        <template v-if="computedRuns.length > 0">
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
        <tr v-for="(row, index) in computedRuns" :key="index">
          <td class="run-column">
            <!-- If the row is a control row, leave run number blank (or show a dash) -->
            {{ row.position || '-' }}
          </td>
          <td>{{ row.computedTitle }}</td>
          <td>{{ row.startTime }}</td>
          <td>{{ row.endTime }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

function parseRunTime(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === "number") return timeStr * 60000;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
  return 0;
}

export default {
  name: "RunTable",
  props: {
    runs: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  setup() {
    const gcStore = useGcStore();
    return { gcStore };
  },
  computed: {
    // Compute control headings from the store values.
    initialControlHeading() {
      // Higher number becomes the initial control heading.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      const higher = Math.max(c1 || 0, c2 || 0);
      return higher ? `Control - ${higher}` : "Initial Control";
    },
    finalControlHeading() {
      // Lower number becomes the final control heading.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      const lower = Math.min(c1 || 0, c2 || 0);
      return lower ? `Control - ${lower}` : "Final Control";
    },
    computedRuns() {
      // Separate the wait row from the normal runs.
      let waitRow = null;
      const nonWaitRuns = [];
      for (const run of this.runs) {
        if (String(run.position).toLowerCase() === 'wait') {
          waitRow = run;
        } else {
          nonWaitRuns.push(run);
        }
      }
      
      // If control values aren’t set, just return the original order.
      const c1 = Number(this.gcStore.startTime.controls?.control1);
      const c2 = Number(this.gcStore.startTime.controls?.control2);
      if (!c1 || !c2) {
        return waitRow ? [waitRow, ...nonWaitRuns] : nonWaitRuns;
      }
      
      // Determine the control values.
      const finalControl = Math.min(c1, c2);    // e.g., 11
      const initialControl = Math.max(c1, c2);   // e.g., 25
      
      // Filter out runs whose numeric positions equal either control value.
      const filteredRuns = nonWaitRuns.filter(run => {
        const pos = Number(run.position);
        return pos !== finalControl && pos !== initialControl;
      });
      
      // Sort the remaining runs in ascending order.
      filteredRuns.sort((a, b) => Number(a.position) - Number(b.position));
      
      const newRuns = [];
      // Start with the wait row (if it exists).
      if (waitRow) {
        newRuns.push({
          position: "wait",
          computedTitle: "15-Min Wait",
          startTime: waitRow.startTime || "",
          endTime: waitRow.endTime || ""
        });
      }
      
      // Now, build the new order from the filtered runs.
      // We assume the filteredRuns array (F) has the following order (example when controls are 11 and 25):
      // F = [ pos 1, pos 2, pos 3, pos 4, pos 5, pos 6, pos 7, pos 8, pos 9, pos 10, pos 12, pos 13, pos 14, pos 15, pos 17, pos 18, pos 19, pos 20, pos 21, pos 22, pos 23, pos 24, pos 26, pos 27, pos 28, pos 29, pos 30, pos 31, pos 32 ]
      
      // Insert control rows at fixed F indices:
      // - Insert a control row for the initial control (e.g., "Control - 25") at index 2.
      // - Insert a control row for the final control (e.g., "Control - 11") after index 10.
      // - Insert another initial control row after index 19.
      // - Append a final control row at the end.
      
      for (let i = 0; i < filteredRuns.length; i++) {
        // At F index 2, insert the initial control row.
        if (i === 2) {
          newRuns.push({
            position: "",
            computedTitle: this.initialControlHeading,
            startTime: "",
            endTime: ""
          });
        }
        // Add the current run.
        newRuns.push(filteredRuns[i]);
        // At F index 10, insert the final control row.
        if (i === 10) {
          newRuns.push({
            position: "",
            computedTitle: this.finalControlHeading,
            startTime: "",
            endTime: ""
          });
        }
        // At F index 19, insert another initial control row.
        if (i === 19) {
          newRuns.push({
            position: "",
            computedTitle: this.initialControlHeading,
            startTime: "",
            endTime: ""
          });
        }
      }
      
      // Finally, append a bottom row for the final control.
      newRuns.push({
        position: "",
        computedTitle: `Final ${this.finalControlHeading}`,
        startTime: "",
        endTime: ""
      });
      
      return newRuns;
    },
    
    // The sequentialRows, additionalRows, and prebatchRows computed properties remain unchanged.
    sequentialRows() {
      // (Leave as is or implement similar control-insertion logic if needed.)
      return [];
    },
    
    lastMainRunNumber() {
      if (this.sequentialRows.length) {
        const nonWaitRows = this.sequentialRows.filter(r => r.position !== 'Wait');
        if (nonWaitRows.length) {
          return Number(nonWaitRows[nonWaitRows.length - 1].position);
        }
      }
      if (this.computedRuns.length) {
        const numericRows = this.computedRuns.filter(r => r.position && !isNaN(Number(r.position)));
        if (numericRows.length) {
          return Number(numericRows[numericRows.length - 1].position);
        }
      }
      return 0;
    },
    
    additionalRows() {
      // (Unchanged from your existing code.)
      const { startTime, allGcData, selectedGc, timeDelayResults } = this.gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns
        ? timeDelayResults.additionalRuns
        : 0;
      if (!additionalCount) return [];
      
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (this.sequentialRows.length) {
        const nonWaitRows = this.sequentialRows.filter(r => r.position !== 'Wait');
        baseTime = nonWaitRows.length
          ? nonWaitRows[nonWaitRows.length - 1].endDate
          : new Date(startTime.batchEndTime);
      } else {
        baseTime = new Date(startTime.batchEndTime);
      }
      const base = this.lastMainRunNumber;
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = base + i + 1;
        const computedTitle = `Add Run ${i + 1}`;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd   = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: runNumber,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    },
    
    prebatchRows() {
      // (Unchanged from your existing code.)
      const { startTime, allGcData, selectedGc, timeDelayResults } = this.gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns
        ? timeDelayResults.totalDelayedRuns
        : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      
      let baseTime;
      if (this.additionalRows.length) {
        baseTime = this.additionalRows[this.additionalRows.length - 1].endDate;
      } else if (this.sequentialRows.length) {
        baseTime = this.sequentialRows[this.sequentialRows.length - 1].endDate;
      } else if (startTime.batchEndTime) {
        baseTime = new Date(startTime.batchEndTime);
      } else {
        baseTime = timeDelayResults.delayedRunsStartTimeDate
          ? new Date(timeDelayResults.delayedRunsStartTimeDate)
          : new Date();
      }
      
      let delayedStart;
      if (timeDelayResults.delayedRunsStartTimeDate) {
        delayedStart = new Date(timeDelayResults.delayedRunsStartTimeDate);
      } else {
        const delayHours = parseInt(this.timeDelayRequired, 10) || 0;
        delayedStart = new Date(baseTime.getTime() + delayHours * 3600000);
      }
      
      let rows = [];
      for (let i = 0; i < prebatchCount; i++) {
        const rowStart = new Date(delayedStart.getTime() + i * runtime);
        const rowEnd   = new Date(delayedStart.getTime() + (i + 1) * runtime);
        rows.push({
          position: (this.lastMainRunNumber + (this.additionalRows.length || 0)) + i + 1,
          computedTitle: `Delayed Run ${i + 1}`,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    },
    
    timeDelayRequired() {
      const { timeDelayResults } = this.gcStore;
      return timeDelayResults && timeDelayResults.timeDelayRequired
        ? timeDelayResults.timeDelayRequired
        : "";
    },
    
    delayedRunSelected() {
      const { timeDelayResults } = this.gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== 'None' ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    }
  },
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
