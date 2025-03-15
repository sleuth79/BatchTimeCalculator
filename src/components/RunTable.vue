<template>
  <div class="run-table">
    <table>
      <thead>
        <!-- Only display the Initial Batch header if computedRuns has entries -->
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
        <!-- Initial Batch Rows -->
        <tr v-for="(run, index) in computedRuns" :key="'initial-' + index" v-if="computedRuns.length > 0">
          <td class="run-column">{{ run.position }}</td>
          <td>{{ run.computedTitle }}</td>
          <td>{{ run.startTime }}</td>
          <td>{{ run.endTime }}</td>
        </tr>

        <!-- Sequential Batch Rows -->
        <template v-if="sequentialRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Sequential Batch</td>
          </tr>
          <tr v-for="(row, index) in sequentialRows" :key="'seq-' + index">
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
        </template>

        <!-- Additional Runs Rows -->
        <template v-if="additionalRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Additional Runs</td>
          </tr>
          <tr v-for="(row, index) in additionalRows" :key="'additional-' + index">
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
        </template>

        <!-- Time Delay Row -->
        <tr v-if="delayedRunSelected" class="title-row">
          <td colspan="4" class="batch-header time-delay-header">
            Time Delay: {{ timeDelayRequired }}
          </td>
        </tr>

        <!-- Delayed Runs Rows -->
        <template v-if="prebatchRows.length">
          <tr class="title-row">
            <td colspan="4" class="batch-header">Delayed Runs</td>
          </tr>
          <tr v-for="(row, index) in prebatchRows" :key="'prebatch-' + index">
            <td class="run-column">{{ row.position }}</td>
            <td>{{ row.computedTitle }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

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

    // Helper function to parse runTime strings (mm:ss or hh:mm:ss) into milliseconds
    const parseRunTime = (timeStr) => {
      if (!timeStr) return 0;
      if (typeof timeStr === "number") return timeStr * 60000;
      const parts = timeStr.split(":");
      if (parts.length === 2) {
        // mm:ss format
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        return (minutes * 60 + seconds) * 1000;
      } else if (parts.length === 3) {
        // hh:mm:ss format
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      }
      // Fallback if it doesn't match expected formats:
      return Number(timeStr) * 60000;
    };

    return { gcStore, parseRunTime };
  },
  computed: {
    computedRuns() {
      if (!this.gcStore.results || !this.gcStore.results.startTimeFinalPosition) {
        return [];
      }
      let seq = 3;
      const gcType = String(this.gcStore.allGcData[this.gcStore.selectedGc]?.type || '')
        .trim()
        .toLowerCase();
      // Use parseRunTime() to compute runtime in milliseconds.
      const runtime = Math.round(parseRunTime(this.gcStore.allGcData[this.gcStore.selectedGc].runTime));
      return this.runs.map((run, index) => {
        let title = '';
        let posString = run.position.toString().trim().toLowerCase();
        if (posString.startsWith('run ')) {
          posString = posString.substring(4).trim();
        }
        const numericPos = Number(posString);
        if (index === this.runs.length - 1) {
          title = 'Final Control';
        } else if (posString === 'wait') {
          title = '15-Min Wait';
        } else if (numericPos === 1) {
          title = 'Blank';
        } else if (numericPos === 2) {
          if (gcType.indexOf('energy') !== -1) {
            title = 'Argon Blank';
          } else if (gcType.indexOf('sulphur') !== -1) {
            title = 'Methane Blank';
          } else {
            title = 'Blank 2';
          }
        } else if (numericPos === 3) {
          title = 'Initial Control';
        } else {
          if (seq === 16) seq++; // skip 16 if needed
          title = 'Position ' + seq;
          seq++;
        }
        return {
          ...run,
          computedTitle: title,
          startTime: run.startTime,
          endTime:
            index === this.runs.length - 1 &&
            this.gcStore.results &&
            this.gcStore.results.batchEndTime
              ? this.gcStore.results.batchEndTime
              : run.endTime
        };
      });
    },

    sequentialRows() {
      const { sequentialFinalPosition, timeDelayResults, startTime, allGcData, selectedGc } = this.gcStore;
      if (!sequentialFinalPosition || !timeDelayResults.sequentialBatchActive) {
        return [];
      }
      const gcType = String(allGcData[selectedGc]?.type || '')
        .trim()
        .toLowerCase();
      const lastInitial = Number(this.computedRuns[this.computedRuns.length - 1].position);
      const rows = [];
      let baseTime = new Date(startTime.batchEndTime);
      if (startTime.wait15) {
        const waitStart = new Date(baseTime);
        const waitEnd = new Date(baseTime.getTime() + 15 * 60000);
        rows.push({
          position: "Wait",
          computedTitle: '15-Min Wait',
          startTime: formatTimeWithAmPmAndSeconds(waitStart),
          endTime: formatTimeWithAmPmAndSeconds(waitEnd),
          endDate: waitEnd,
        });
        baseTime = waitEnd;
      }
      const seqFinal = Number(sequentialFinalPosition);
      const totalNonWaitRows = seqFinal <= 15 ? seqFinal + 2 : seqFinal + 1;
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      for (let i = 0; i < totalNonWaitRows; i++) {
        let computedTitle = "";
        if (i === 0) {
          computedTitle = 'Blank';
        } else if (i === 1) {
          if (gcType.indexOf('energy') !== -1) {
            computedTitle = 'Argon Blank';
          } else if (gcType.indexOf('sulphur') !== -1) {
            computedTitle = 'Methane Blank';
          } else {
            computedTitle = 'Blank 2';
          }
        } else if (i === 2) {
          computedTitle = "Initial Control";
        } else if (i === totalNonWaitRows - 1) {
          computedTitle = "Final Control";
        } else {
          computedTitle = "Position " + i;
        }
        let overallPosition = lastInitial + i + 1;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd   = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: overallPosition,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    },

    lastMainRunNumber() {
      if (this.sequentialRows.length) {
        const nonWaitRows = this.sequentialRows.filter(r => r.position !== 'Wait');
        if (nonWaitRows.length) {
          return Number(nonWaitRows[nonWaitRows.length - 1].position);
        }
      }
      if (this.computedRuns.length) {
        return Number(this.computedRuns[this.computedRuns.length - 1].position);
      }
      return 0;
    },

    additionalRows() {
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
  padding: 8px 10px;
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
