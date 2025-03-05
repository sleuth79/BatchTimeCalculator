<template>
  <div class="config-section">
    <h1>Batch Time Calculator</h1>
    <div v-if="loadError">
      Failed to load GC data. Please try again.
    </div>
    <div v-else>
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

      <!-- Render the appropriate Time Delay component for start-time mode.
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
    const batch1EndTime = computed(() => {
      // If no batchEndTime is set, default to the current date.
      return gcStore.startTime.batchEndTime || new Date();
    });

    const primaryFinalPosition = computed(() => {
      return gcStore.startTime.finalPosition !== null
        ? gcStore.startTime.finalPosition
        : 0;
    });

    const gcRuntime = computed(() => {
      return (gcStore.selectedGc &&
              gcStore.allGcData[gcStore.selectedGc] &&
              gcStore.allGcData[gcStore.selectedGc].runTime)
        ? gcStore.allGcData[gcStore.selectedGc].runTime
        : 18.91; // default runtime value (adjust as needed)
    });

    const gcType = computed(() => {
      return gcStore.selectedGcData ? gcStore.selectedGcData.type : '';
    });

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
  background-color: #fff;               /* White background for a clean, floating effect */
  padding: 10px;                        /* Consistent internal spacing */
  border: 1px solid #ddd;               /* Light border */
  border-radius: 8px;                   /* Rounded corners */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
  overflow-y: auto;
  box-sizing: border-box;
}

.config-section h1 {
  font-size: 2.4rem;
  margin-top: 0;
  margin-bottom: 10px;
  text-align: left;
  color: #131313;
  /* Adjusted subtle text shadow for a less intense drop shadow effect */
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.15);
}

.config-section label {
  display: block;
  margin-top: 1px;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
