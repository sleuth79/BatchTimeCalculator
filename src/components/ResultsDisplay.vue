<template>
  <div class="results-display">
    <!-- Header with Results title on the left and current time/date on the right -->
    <div class="results-header">
      <h2 class="results-heading">Results</h2>
      <div class="current-date-time">
        {{ currentTimeString }} ({{ currentDate }})
      </div>
    </div>
    <!-- Always show Mode and Selected GC -->
    <p>
      Selected GC:
      <span class="result-value">
        {{ formattedSelectedGc }}
      </span>
    </p>

    <!-- When in Time Delay Calculator mode, display only the results -->
    <template v-if="selectedMode === 'delay-calculator'">
      <section class="delay-calculator-results-section">
        <TimeDelayCalculatorResults />
      </section>
    </template>

    <!-- Otherwise, display the normal results for start-time mode -->
    <template v-else>
      <div v-if="results">
        <StartTimeResults
          v-if="results.mode === 'start-time'"
          :results="results"
          :selectedGcData="selectedGcData"
          :delayedRunsExist="delayedRunsExist"
          :additionalRunsExist="additionalRunsExist"
        />
        <!-- Separator line if additional or delayed runs exist -->
        <hr class="section-separator" v-if="timeDelaySectionExists" />
        <div v-if="timeDelaySectionExists" class="time-delay-section">
          <TimeDelayResult :timeDelayData="timeDelayResults" />
        </div>
      </div>
      <div v-else-if="showPlaceholders">
        <template v-if="selectedMode === 'start-time'">
          <p>
            Start Time:
            <span class="result-value">{{ batchStartTime }} {{ batchStartTimeAMPM }}</span>
          </p>
          <p v-if="selectedGcData && selectedGcData.type === 'Energy'">
            15-Minute Wait:
            <span class="result-value">{{ wait15 !== null ? (wait15 ? 'Yes' : 'No') : '' }}</span>
          </p>
          <p>
            Final Position:
            <span class="result-value"></span>
          </p>
        </template>
      </div>
    </template>

    <!-- Toggle Button for Run Table -->
    <template v-if="(results && results.runs && results.runs.length > 0) || delayedRunsExist">
      <button class="toggle-run-table-button" @click="toggleRunTable">
        {{ showRunTable ? "Hide Run Table" : "View Run Table" }}
      </button>
    </template>
    
    <!-- Run Table -->
    <div v-if="showRunTable && ((results && results.runs && results.runs.length > 0) || delayedRunsExist)">
      <RunTable :runs="runData" />
    </div>
  </div>
</template>

<script>
import { computed, watch, ref } from "vue";
import { useGcStore } from "../store";
import StartTimeResults from "./StartTimeResults.vue";
import TimeDelayResult from "./TimeDelayResult.vue";
import TimeDelayCalculatorResults from "./TimeDelayCalculatorResults.vue";
import RunTable from "./RunTable.vue";
import ModeSelector from "./ModeSelector.vue";

export default {
  name: "ResultsDisplay",
  components: {
    StartTimeResults,
    TimeDelayResult,
    TimeDelayCalculatorResults,
    RunTable,
    ModeSelector,
  },
  props: {
    showPlaceholders: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const gcStore = useGcStore();

    const selectedMode = computed(() => gcStore.selectedMode);
    const selectedGcData = computed(() => gcStore.selectedGcData);
    const results = computed(() => gcStore.results);
    const timeDelayResults = computed(() => gcStore.timeDelayResults);

    const batchStartTime = computed(() => gcStore.startTime.batchStartTime);
    const batchStartTimeAMPM = computed(() => gcStore.startTime.batchStartTimeAMPM);
    const wait15 = computed(() => gcStore.startTime.wait15);

    const additionalRunsExist = computed(() => {
      const tdr = timeDelayResults.value || {};
      return (Number(tdr.additionalRuns) > 0) ||
             (tdr.sequentialFinalPosition && Number(tdr.sequentialFinalPosition) > 0);
    });

    const delayedRunsExist = computed(() => {
      const tdr = timeDelayResults.value || {};
      return Number(tdr.totalDelayedRuns) > 0;
    });

    const timeDelaySectionExists = computed(() => {
      return additionalRunsExist.value || delayedRunsExist.value;
    });

    const shouldShowTimeDelay = computed(() => {
      if (!results.value || !timeDelayResults.value || !selectedGcData.value) return false;
      if (selectedMode.value === 'start-time') {
        return batchStartTime.value && (results.value.startTimeFinalPosition || results.value.finalPosition);
      }
      return false;
    });

    const showRunTable = ref(false);
    const toggleRunTable = () => {
      showRunTable.value = !showRunTable.value;
    };

    const runData = computed(() => (gcStore.results ? gcStore.results.runs : []));

    // Computed property to format the selected GC with runtime to 2 decimals
    const formattedSelectedGc = computed(() => {
      if (!gcStore.selectedGcData) return "";
      const runtime = Number(gcStore.selectedGcData.runTime);
      return `${gcStore.selectedGcData.name} (Runtime: ${runtime.toFixed(2)})`;
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

    watch(
      () => gcStore.selectedMode,
      (newMode) => {
        if (newMode === 'start-time') {
          showRunTable.value = false;
        }
      },
      { immediate: true }
    );

    return {
      selectedMode,
      selectedGcData,
      formattedSelectedGc,
      results,
      timeDelayResults,
      batchStartTime,
      batchStartTimeAMPM,
      wait15,
      shouldShowTimeDelay,
      showRunTable,
      toggleRunTable,
      runData,
      additionalRunsExist,
      delayedRunsExist,
      timeDelaySectionExists,
      currentTimeString,
      currentDate,
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

.results-heading {
  font-size: 2.1rem;
  margin: 0;
  color: #333;
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
  margin-bottom: 2px !important;
  line-height: 1.2 !important;
  font-size: 1rem !important;
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
