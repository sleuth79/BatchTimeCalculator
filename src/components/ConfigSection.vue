<template>
  <div class="config-section">
    <h1>Batch Time Calculator</h1>
    <div v-if="loadError">
      Failed to load GC data. Please try again.
    </div>
    <div v-else class="config-container">
      <!-- Scrollable main content -->
      <div class="scrollable-content">
        <mode-selector :selected-mode="selectedMode" @mode-changed="setSelectedMode" />
        <gc-selector :selected-gc="selectedGc" @gc-changed="setSelectedGc" />

        <!-- Render input components based on the selected mode -->
        <start-time-input
          v-if="selectedMode === 'start-time'"
          :selected-gc="selectedGc"
          @update-results="handleUpdateResults"
        />
        <time-delay-calculator-mode-input
          v-else-if="selectedMode === 'delay-calculator'"
          :batch1EndTime="batch1EndTime"
          :primaryFinalPosition="primaryFinalPosition"
          :gcRuntime="gcRuntime"
          :gcType="gcType"
          @update-time-delay="handleUpdateTimeDelay"
        />

        <!-- Render the Time Delay component for start-time mode.
             Adding a dynamic key forces the component to re-mount when the mode changes. -->
        <TimeDelayStartModeInput
          v-if="selectedMode === 'start-time'"
          :key="selectedMode"
          :batch1EndTime="batch1EndTime"
          :primaryFinalPosition="primaryFinalPosition"
          :gcRuntime="gcRuntime"
          :gcType="gcType"
          @update-time-delay="handleUpdateTimeDelay"
        />
      </div>

      <!-- Pinned box that remains at the bottom -->
      <div class="other-batch-types-box">
        <p class="other-batch-heading"><strong>Total Runs For Other Batch Types:</strong></p>
        <p>Repeats: 14 runs</p>
        <p>Validations: 10 runs</p>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useGcStore } from '../store';
import ModeSelector from './ModeSelector.vue';
import GcSelector from './GcSelector.vue';
import StartTimeInput from './StartTimeInput.vue';
import TimeDelayStartModeInput from './TimeDelayStartModeInput.vue';
import TimeDelayCalculatorModeInput from './TimeDelayCalculatorModeInput.vue';

export default {
  name: 'ConfigSection',
  components: {
    ModeSelector,
    GcSelector,
    StartTimeInput,
    TimeDelayStartModeInput,
    TimeDelayCalculatorModeInput,
  },
  emits: ['update-results'],
  setup(props, { emit }) {
    const gcStore = useGcStore();
    const loadError = computed(() => gcStore.error);

    onMounted(() => {
      if (Object.keys(gcStore.allGcData).length === 0) {
        gcStore.fetchGcData();
      }
    });

    const handleUpdateResults = (results) => {
      gcStore.results = results;
    };

    // Handler for Time Delay components
    const handleUpdateTimeDelay = (data) => {
      gcStore.timeDelayResults = data;
    };

    // Compute properties for the Time Delay component props.
    const batch1EndTime = computed(() => gcStore.startTime.batchEndTime || new Date());
    const primaryFinalPosition = computed(() =>
      gcStore.startTime.finalPosition !== null ? gcStore.startTime.finalPosition : 0
    );
    const gcRuntime = computed(() =>
      gcStore.selectedGc &&
      gcStore.allGcData[gcStore.selectedGc] &&
      gcStore.allGcData[gcStore.selectedGc].runTime
        ? gcStore.allGcData[gcStore.selectedGc].runTime
        : 18.91
    );
    const gcType = computed(() => (gcStore.selectedGcData ? gcStore.selectedGcData.type : ''));

    return {
      loadError,
      selectedMode: computed(() => gcStore.selectedMode),
      setSelectedMode: gcStore.setSelectedMode,
      selectedGc: computed(() => gcStore.selectedGc),
      setSelectedGc: gcStore.setSelectedGc,
      handleUpdateResults,
      batch1EndTime,
      primaryFinalPosition,
      gcRuntime,
      gcType,
      handleUpdateTimeDelay,
    };
  },
};
</script>

<style scoped>
.config-section {
  background-color: #fff;
  padding: 5px 10px 10px 10px; /* Reduced top padding from 10px to 5px */
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
}

.config-section h1 {
  margin-top: 0;   /* Remove any default top margin */
  margin-bottom: 5px;
}

/* Internal container for the flex layout */
.config-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* The scrollable content area */
.scrollable-content {
  flex-grow: 1;
  overflow-y: auto;
  margin-bottom: 60px; /* Ensure content doesn't overlap the pinned box */
}

/* The pinned box remains fixed at the bottom */
.other-batch-types-box {
  position: sticky;
  bottom: 0;
  background-color: #fff; /* Matching the original white background */
  border: 1px solid #ccc;
  padding: 5px;
  font-size: 0.85rem;
  border-radius: 4px;
  z-index: 1;
}
.other-batch-types-box p {
  margin: 2px 0;
}

/* Optional adjustments for labels */
.config-section label {
  display: block;
  margin-top: 1px;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
