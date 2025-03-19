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

        <!-- Always render start-time input components -->
        <start-time-input
          :selected-gc="selectedGc"
          :disabledPositions="disabledPositions"  
          @update-results="handleUpdateResults"
        />
        <time-delay-input
          :batch1EndTime="batch1EndTime"
          :primaryFinalPosition="primaryFinalPosition"
          :gcRuntime="gcRuntime"
          :gcType="gcType"
          :disabledPositions="disabledPositions"  
          @update-time-delay="handleUpdateTimeDelay"
        />
      </div>

      <!-- Sticky container for the reset button and the pinned box -->
      <div class="sticky-bottom-container">
        <div class="reset-button-container">
          <button @click="resetInputs">Reset All Inputs</button>
        </div>
        <div class="other-batch-types-box">
          <p class="other-batch-heading">
            <strong>Total Runs For Other Batch Types:</strong>
          </p>
          <p>Repeats: 14 runs</p>
          <p>Validations: 10 runs</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useGcStore } from '../store';
import GcSelector from './GcSelector.vue';
import StartTimeInput from './StartTimeInput.vue';
import TimeDelayInput from './TimeDelayInput.vue';

export default {
  name: 'ConfigSection',
  components: {
    GcSelector,
    StartTimeInput,
    TimeDelayInput,
  },
  emits: ['update-results'],
  setup() {
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

    // Compute properties for Time Delay component props.
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

    // Compute the disabled positions based on control values stored in the store.
    const disabledPositions = computed(() => {
      const disabled = [];
      if (gcStore.startTime.controls.control1)
        disabled.push(Number(gcStore.startTime.controls.control1));
      if (gcStore.startTime.controls.control2)
        disabled.push(Number(gcStore.startTime.controls.control2));
      return disabled;
    });

    // Reset function now always calls resetStartTime since only one mode is supported.
    const resetInputs = () => {
      gcStore.resetStartTime();
      // Optionally, reset the GC selector:
      gcStore.setSelectedGc(null);
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
      disabledPositions, // Make sure to return the computed disabled positions.
    };
  },
};
</script>

<style scoped>
/* Overall container styling */
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

.config-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

.scrollable-content {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 60px;
}

/* Sticky container for the reset button and the pinned box */
.sticky-bottom-container {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

/* Reset button container: no extra left margin */
.reset-button-container {
  padding-bottom: 2px; /* small spacing between button and pinned box */
}

/* Reset button styled to match the GC selector boxes */
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

/* Pinned box styling with visible top border */
.other-batch-types-box {
  background-color: #fff;
  border: 1px solid #ccc;
  border-top: 1px solid #ccc; /* ensures the top line is visible */
  padding: 5px;
  font-size: 0.85rem;
  border-radius: 4px;
  z-index: 1;
}
.other-batch-types-box p {
  margin: 2px 0;
}
</style>
