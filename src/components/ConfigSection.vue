<template>
  <div class="config-section">
    <h1>Batch Time Calculator</h1>
    <div v-if="loadError">
      Failed to load GC data. Please try again.
    </div>
    <div v-else class="config-container">
      <!-- Scrollable main content -->
      <div class="scrollable-content">
        <!-- GC Selector remains -->
        <gc-selector :selected-gc="selectedGc" @gc-changed="setSelectedGc" />

        <!-- Always render start-time input components (i.e. start-time mode is assumed) -->
        <start-time-input
          :selected-gc="selectedGc"
          @update-results="handleUpdateResults"
        />
        <TimeDelayStartModeInput
          :batch1EndTime="batch1EndTime"
          :primaryFinalPosition="primaryFinalPosition"
          :gcRuntime="gcRuntime"
          :gcType="gcType"
          @update-time-delay="handleUpdateTimeDelay"
        />
      </div>

      <!-- Reset Inputs Button, absolutely positioned above the pinned box -->
      <div class="reset-button-container">
        <button @click="resetInputs">Reset Inputs</button>
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
import GcSelector from './GcSelector.vue';
import StartTimeInput from './StartTimeInput.vue';
import TimeDelayStartModeInput from './TimeDelayStartModeInput.vue';

export default {
  name: 'ConfigSection',
  components: {
    GcSelector,
    StartTimeInput,
    TimeDelayStartModeInput,
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

    // New method to reset inputs
    const resetInputs = () => {
      gcStore.setSelectedGc(null);
      gcStore.results = null;
      gcStore.timeDelayResults = null;
      gcStore.startTime = {};
    };

    return {
      loadError,
      selectedGc: computed(() => gcStore.selectedGc),
      setSelectedGc: gcStore.setSelectedGc,
      handleUpdateResults,
      batch1EndTime,
      primaryFinalPosition,
      gcRuntime,
      gcType,
      handleUpdateTimeDelay,
      resetInputs,
    };
  },
};
</script>

<style scoped>
/* Overall component styling */
.config-section {
  background-color: #fff;
  padding: 0 10px 10px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  margin-top: 0;
}

.config-section h1 {
  margin-top: 0 !important;
  margin-bottom: 5px;
}

/* Flex container */
.config-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Scrollable content */
.scrollable-content {
  flex-grow: 1;
  overflow-y: auto;
  margin-bottom: 60px;
}

/* Reset button container, absolutely positioned and pinned to the left.
   Adjusted bottom value to raise the button above the pinned box. */
.reset-button-container {
  position: absolute;
  left: 10px;
  bottom: 90px; /* Increase to raise the button further */
  z-index: 2;
}

/* Reset button styling to match global CSS and GC selector height */
.reset-button-container button {
  border: 1px solid #ccc;
  padding: 0 8px;
  height: 28px;
  line-height: 28px;
  font-size: 0.85rem;
  border-radius: 4px;
  background-color: var(--highlight-color);
  color: var(--text-highlight);
  cursor: pointer;
  width: auto;
}
.reset-button-container button:hover {
  background-color: var(--highlight-color-hover, #218838);
}

/* Pinned box styling with a visible top border */
.other-batch-types-box {
  position: sticky;
  bottom: 0;
  background-color: #fff;
  border: 1px solid #ccc;
  border-top: 1px solid #ccc;
  padding: 5px;
  font-size: 0.85rem;
  border-radius: 4px;
  z-index: 1;
}
.other-batch-types-box p {
  margin: 2px 0;
}
</style>
