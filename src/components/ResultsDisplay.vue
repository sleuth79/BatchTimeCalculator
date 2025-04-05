<template>
  <div class="results-display">
    <!-- Header with Results title on the left and current time/date on the right -->
    <div class="results-header">
      <h2 class="results-heading">Results</h2>
      <div class="current-date-time">
        {{ currentTimeString }} ({{ currentDate }})
      </div>
    </div>
    <!-- Always show Selected GC with updated heading styling -->
    <p class="selected-gc-heading">
      Selected GC:
      <span class="result-value">
        {{ formattedSelectedGc }}
      </span>
    </p>

    <!-- Pass the merged results object to StartTimeResults -->
    <StartTimeResults
      :results="mergedResults"
      :startTime="gcStore.startTime"
      :runtableClosestPositionFull="runtableClosestPositionFull"
      :selectedGcData="selectedGcData"
      :delayedRunsExist="delayedRunsExist"
      :additionalRunsExist="additionalRunsExist"
    />

    <!-- Display additional time delay section if applicable -->
    <div v-if="results && Object.keys(results).length && timeDelaySectionExists">
      <hr class="section-separator" />
      <div class="time-delay-section">
        <!-- Pass finalBatchEndTime, delayedRunsStartTime and delayedRunsEndTime to TimeDelayResult -->
        <TimeDelayResult
          :timeDelayData="timeDelayResults"
          :finalBatchEndTime="finalBatchEndTime"
          :delayedRunsStartTime="delayedRunsStartTime"
          :delayedRunsEndTime="delayedRunsEndTime"
        />
      </div>
    </div>

    <!-- Toggle Button for Run Table -->
    <template
      v-if="(results && results.runs && results.runs.length > 0) || delayedRunsExist || additionalRunsExist"
    >
      <button class="toggle-run-table-button" @click="toggleRunTable">
        {{ showRunTable ? "Hide Run Table" : "View Run Table" }}
      </button>
    </template>
    
    <!-- Run Table: Always mount if runs exist; control visibility with v-show.
         Bind the new v-model properties so that any changes in RunTable are passed upward.
         We add a key so that the run table will re-render when the runs change. -->
    <div
      v-if="(results && results.runs && results.runs.length > 0) || delayedRunsExist || additionalRunsExist"
    >
      <RunTable
        :key="runDataKey"
        :runs="runData"
        v-model:selectedPositionLabel="selectedPositionLabel"
        v-model:runtableClosestPositionFull="runtableClosestPositionFull"
        v-model:initialBatchEndTime="initialBatchEndTime"
        v-model:runTableInitialBatchDuration="runTableInitialBatchDuration"
        v-model:finalBatchEndTime="finalBatchEndTime"
        v-model:delayedRunsStartTime="delayedRunsStartTime"
        v-model:delayedRunsEndTime="delayedRunsEndTime"
        v-model:sequentialBatchDuration="sequentialBatchDuration"
        v-show="showRunTable"
      />
    </div>
  </div>
</template>

<script>
import { computed, ref } from "vue";
import { useGcStore } from "../store";
import StartTimeResults from "./StartTimeResults.vue";
import TimeDelayResult from "./TimeDelayResult.vue";
import RunTable from "./RunTable.vue";

export default {
  name: "ResultsDisplay",
  components: {
    StartTimeResults,
    TimeDelayResult,
    RunTable,
  },
  props: {
    showPlaceholders: {
      type: Boolean,
      required: true,
    },
  },
  setup() {
    const gcStore = useGcStore();

    const selectedGcData = computed(() => gcStore.selectedGcData);
    const results = computed(() => gcStore.results);
    const timeDelayResults = computed(() => gcStore.timeDelayResults);

    const batchStartTime = computed(() => gcStore.startTime.batchStartTime);
    const batchStartTimeAMPM = computed(() => gcStore.startTime.batchStartTimeAMPM);
    const wait15 = computed(() => gcStore.startTime.wait15);

    const additionalRunsExist = computed(() => {
      const tdr = timeDelayResults.value || {};
      return (
        Number(tdr.additionalRuns) > 0 ||
        (tdr.sequentialFinalPosition && Number(tdr.sequentialFinalPosition) > 0)
      );
    });

    const delayedRunsExist = computed(() => {
      const tdr = timeDelayResults.value || {};
      return Number(tdr.totalDelayedRuns) > 0;
    });

    const timeDelaySectionExists = computed(() => {
      return additionalRunsExist.value || delayedRunsExist.value;
    });

    const showRunTable = ref(false);
    const toggleRunTable = () => {
      showRunTable.value = !showRunTable.value;
    };

    const runData = computed(() => (gcStore.results ? gcStore.results.runs : []));
    const formattedSelectedGc = computed(() => {
      if (!gcStore.selectedGcData) return "";
      return `${gcStore.selectedGcData.name} (Runtime: ${gcStore.selectedGcData.runTime})`;
    });

    const currentTime = ref(new Date());
    setInterval(() => {
      currentTime.value = new Date();
    }, 1000);

    const currentTimeString = computed(() =>
      currentTime.value.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    );
    const currentDate = computed(() => new Date().toLocaleDateString());

    const selectedPositionLabel = ref("");
    const runtableClosestPositionFull = ref("");
    const initialBatchEndTime = ref("");
    const runTableInitialBatchDuration = ref("");
    const finalBatchEndTime = ref("");
    const delayedRunsStartTime = ref("");
    const delayedRunsEndTime = ref("");
    const sequentialBatchDuration = ref("");

    // Create a merged results object that only overrides if the run table values are not empty.
    const mergedResults = computed(() => {
      const base = { ...results.value };
      if (initialBatchEndTime.value) {
        base.batchEndTime = initialBatchEndTime.value;
      }
      if (finalBatchEndTime.value) {
        base.finalBatchEndTime = finalBatchEndTime.value;
      }
      if (runTableInitialBatchDuration.value) {
        base.batchDuration = runTableInitialBatchDuration.value;
      }
      if (sequentialBatchDuration.value) {
        base.sequentialBatchDuration = sequentialBatchDuration.value;
      }
      if (selectedPositionLabel.value) {
        base.selectedPositionLabel = selectedPositionLabel.value;
      }
      return base;
    });

    // Create a key for the RunTable that updates when the runs array changes.
    const runDataKey = computed(() => JSON.stringify(results.value.runs || []));

    return {
      gcStore,
      selectedGcData,
      formattedSelectedGc,
      results,
      timeDelayResults,
      batchStartTime,
      batchStartTimeAMPM,
      wait15,
      showRunTable,
      toggleRunTable,
      runData,
      additionalRunsExist,
      delayedRunsExist,
      timeDelaySectionExists,
      currentTimeString,
      currentDate,
      selectedPositionLabel,
      runtableClosestPositionFull,
      initialBatchEndTime,
      runTableInitialBatchDuration,
      finalBatchEndTime,
      delayedRunsStartTime,
      delayedRunsEndTime,
      sequentialBatchDuration,
      mergedResults,
      runDataKey,
    };
  },
};
</script>

<style scoped>
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-header h2 {
  margin: 0 0 7px 0;
  font-size: 2.1rem;
  color: #131313;
  text-align: left;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.current-date-time {
  text-align: right;
  font-weight: bold;
}

.toggle-run-table-button {
  width: 150px;
  text-align: center;
  display: block;
  margin-top: 15px;
}

/* Remove default margins for paragraph tags inside the results-display */
.results-display p {
  margin: 0;
}

/* Update the Selected GC heading to match StartTimeResults headings (1rem) */
.selected-gc-heading {
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
  margin: 7px 0;
}

.result-value {
  font-weight: bold;
  font-size: 1rem;
}
</style>
