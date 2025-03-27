<template>
  <div class="results-display">
    <!-- Header with Results title on the left and current time/date on the right -->
    <div class="results-header">
      <h2 class="results-heading">Results</h2>
      <div class="current-date-time">
        {{ currentTimeString }} ({{ currentDate }})
      </div>
    </div>
    <!-- Always show Selected GC -->
    <p>
      Selected GC:
      <span class="result-value">
        {{ formattedSelectedGc }}
      </span>
    </p>

    <!-- Pass runtableClosestPositionFull to StartTimeResults -->
    <StartTimeResults
      :results="{ ...results, selectedPositionLabel: selectedPositionLabel }"
      :runtableClosestPositionFull="runtableClosestPositionFull"
      :selectedGcData="selectedGcData"
      :delayedRunsExist="delayedRunsExist"
      :additionalRunsExist="additionalRunsExist"
    />

    <!-- Display additional time delay section if applicable -->
    <div v-if="results && Object.keys(results).length && timeDelaySectionExists">
      <hr class="section-separator" />
      <div class="time-delay-section">
        <TimeDelayResult :timeDelayData="timeDelayResults" />
      </div>
    </div>

    <!-- Toggle Button for Run Table -->
    <template v-if="(results && results.runs && results.runs.length > 0) || delayedRunsExist">
      <button class="toggle-run-table-button" @click="toggleRunTable">
        {{ showRunTable ? "Hide Run Table" : "View Run Table" }}
      </button>
    </template>
    
    <!-- Run Table: Always mount if runs exist; control visibility with v-show -->
    <div v-if="(results && results.runs && results.runs.length > 0) || delayedRunsExist">
      <RunTable
        :runs="runData"
        v-model:selectedPositionLabel="selectedPositionLabel"
        v-model:runtableClosestPositionFull="runtableClosestPositionFull"
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

    // Simply return the runtime value as stored in the selected GC data.
    const formattedSelectedGc = computed(() => {
      if (!gcStore.selectedGcData) return "";
      return `${gcStore.selectedGcData.name} (Runtime: ${gcStore.selectedGcData.runTime})`;
    });

    // Create a reactive current time that updates every second.
    const currentTime = ref(new Date());
    setInterval(() => {
      currentTime.value = new Date();
    }, 1000);

    // Format current time (24-hour format)
    const currentTimeString = computed(() =>
      currentTime.value.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    );
    // Format current date as MM/DD/YYYY
    const currentDate = computed(() => new Date().toLocaleDateString());

    // Reactive properties for run table selected label and full candidate string.
    const selectedPositionLabel = ref("");
    const runtableClosestPositionFull = ref("");

    return {
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
    };
  },
};
</script>

<style scoped>
/* Flex layout for the header */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Right align the current date/time and bold it */
.current-date-time {
  text-align: right;
  font-weight: bold;
}

/* Style for the toggle button: the button is aligned left in its container,
   has a fixed width of 150px, centered text, and added top margin for spacing */
.toggle-run-table-button {
  width: 150px;
  text-align: center;
  display: block;
  margin-top: 15px;
}
</style>
