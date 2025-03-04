<template>
  <div class="results-display">
    <h2 class="results-heading">Results</h2>
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
        <!-- Additional Runs Section -->
        <div v-if="timeDelayResults.sequentialBatchActive" class="additional-runs-section">
          <h3>Additional Runs</h3>
          <p>
            Final Position for Sequential Batch:
            <span class="result-value">{{ timeDelayResults.sequentialFinalPosition }}</span> |
            Total Runs (Including Controls):
            <span class="result-value">{{ timeDelayResults.totalRunsSequential }}</span>
          </p>
          <p>
            Additional Runs End Time:
            <span class="result-value">{{ timeDelayResults.sequentialBatchEndTime }}</span>
          </p>
          <p>
            Total Runs (Initial Batch + Additional Runs):
            <span class="result-value">{{ timeDelayResults.overallTotalRuns }}</span>
          </p>
          <p v-if="additionalRunsDuration">
            Total Duration of Additional Runs:
            <span class="result-value">{{ additionalRunsDuration }}</span>
          </p>
        </div>
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
            <span class="result-value">
              {{ wait15 !== null ? (wait15 ? 'Yes' : 'No') : '' }}
            </span>
          </p>
          <p>
            Final Position:
            <span class="result-value"></span>
          </p>
        </template>
      </div>
    </template>

    <!-- Toggle Button for Run Table -->
    <template v-if="results && results.runs && results.runs.length > 0">
      <button class="toggle-run-table-button" @click="toggleRunTable">
        {{ showRunTable ? "Hide Run Table" : "View Run Table" }}
      </button>
    </template>
    
    <!-- Run Table -->
    <div v-if="showRunTable && results && results.runs && results.runs.length > 0">
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

    // Computed property to format the selected GC with runtime to 2 decimals
    const formattedSelectedGc = computed(() => {
      if (!gcStore.selectedGcData) return "";
      const runtime = Number(gcStore.selectedGcData.runTime);
      return `${gcStore.selectedGcData.name} (Runtime: ${runtime.toFixed(2)})`;
    });

    // Computed property to calculate total duration of additional runs (in human-readable format)
    const additionalRunsDuration = computed(() => {
      if (
        timeDelayResults.value &&
        timeDelayResults.value.sequentialBatchActive &&
        selectedGcData.value &&
        timeDelayResults.value.totalRunsSequential
      ) {
        const totalRunsSeq = timeDelayResults.value.totalRunsSequential;
        // The runtime in minutes from the selected GC
        const runtime = Number(selectedGcData.value.runTime);
        // Each run takes runtime minutes, so total duration in seconds:
        const totalSeconds = totalRunsSeq * runtime * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        let formatted = "";
        if (hours > 0) {
          formatted += hours + "h ";
        }
        formatted += minutes + "m";
        if (seconds > 0) {
          formatted += " " + seconds + "s";
        }
        return formatted.trim();
      }
      return "";
    });

    watch(
      () => gcStore.selectedMode,
      (newMode) => {
        if (newMode === "start-time") {
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
      showRunTable,
      toggleRunTable,
      runData,
      additionalRunsExist,
      delayedRunsExist,
      timeDelaySectionExists,
      additionalRunsDuration,
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

.results-heading {
  font-size: 2.1rem;
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
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

.additional-runs-section {
  margin: 20px 0;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.additional-runs-section h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2rem;
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
