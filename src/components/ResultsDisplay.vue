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

    <!-- Always render StartTimeResults even if results is empty.
         We merge the computed selectedPositionLabel into the results object. -->
    <StartTimeResults
      :results="{ ...results, selectedPositionLabel: selectedPositionLabel }"
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
    
    <!-- Run Table -->
    <div v-if="showRunTable && ((results && results.runs && results.runs.length > 0) || delayedRunsExist)">
      <!-- Bind v-model:selectedPositionLabel so that RunTable emits its selected label -->
      <RunTable :runs="runData" v-model:selectedPositionLabel="selectedPositionLabel" />
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

    // New reactive property to capture the run table's selected candidate label.
    const selectedPositionLabel = ref("");

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
    };
  },
};
</script>

<style scoped>
.results-display {
  background-color: #fff;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
}

/* Header container with flex layout */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Updated results heading with drop shadow similar to the config window */
.results-heading {
  font-size: 2.1rem;
  margin: 0;
  color: #333;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.current-date-time {
  font-size: 1rem;
  color: #333;
  font-weight: bold;
}

.result-value {
  font-weight: bold;
}

.info-message {
  font-size: 1rem;
  color: #555;
  margin-top: 10px;
}

.results-display p {
  margin-bottom: 10px;
  font-size: 1rem;
  color: #333;
}

.time-delay-section {
  margin-top: 0;
  padding-top: 0 !important;
}

.section-separator {
  border: none;
  border-top: 1px solid #ccc;
  margin: 10px 0;
}

.toggle-run-table-button {
  display: block;
  width: fit-content;
  margin: 10px 0 0 0;
  padding: 4px 8px;
  font-size: 0.95rem;
  border: 1px solid #28a745;
  border-radius: 4px;
  background-color: #fff;
  color: #28a745;
  cursor: pointer;
  transition: background-color 0.3s ease;
  text-align: left;
}

.toggle-run-table-button:hover {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}
</style>
