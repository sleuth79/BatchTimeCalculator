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

        <!-- Always render start-time input components with a dynamic key to force re-render on reset -->
        <start-time-input
          :key="gcStore.startTimeResetCounter"
          :selected-gc="selectedGc"
          :disabledPositions="[...disabledPositions]"
          @update-results="handleUpdateResults"
        />
        <time-delay-input
          :key="gcStore.startTimeResetCounter"
          :batch1EndTime="batch1EndTime"
          :primaryFinalPosition="primaryFinalPosition"
          :gcRuntime="gcRuntime"
          :gcType="gcType"
          :disabledPositions="[...disabledPositions]"
          @update-time-delay="handleUpdateTimeDelay"
        />
      </div>

      <!-- Sticky container for the reset button and the pinned box -->
      <div class="sticky-bottom-container">
        <div class="reset-button-container">
          <button @click="resetInputs">Clear All Inputs</button>
        </div>
        <div class="other-batch-types-box">
          <p class="other-batch-heading">
            <strong>Total Runs For Other Batch Types:</strong>
          </p>
          <p>Repeats: 14 runs</p>
          <p>Validations: 10 runs</p>
        </div>
      </div>

      <!-- Render the results component; pass the reactive store state -->
      <start-time-results
        :results="gcStore.results"
        :startTime="gcStore.startTime"
        :delayedRunsExist="delayedRunsExist"
        :additionalRunsExist="additionalRunsExist"
      />
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useGcStore } from '../store';
import GcSelector from './GcSelector.vue';
import StartTimeInput from './StartTimeInput.vue';
import TimeDelayInput from './TimeDelayInput.vue';
import StartTimeResults from './StartTimeResults.vue';

export default {
  name: 'ConfigSection',
  components: {
    GcSelector,
    StartTimeInput,
    TimeDelayInput,
    StartTimeResults,
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

    const handleUpdateTimeDelay = (data) => {
      gcStore.timeDelayResults = data;
    };

    // Props for TimeDelayInput.
    const batch1EndTime = computed(() => gcStore.startTime.batchEndTime || new Date());
    const primaryFinalPosition = computed(() =>
      gcStore.startTime.finalPosition !== null ? gcStore.startTime.finalPosition : 0
    );
    const gcRuntime = computed(() => {
      if (
        gcStore.selectedGc &&
        gcStore.allGcData[gcStore.selectedGc] &&
        gcStore.allGcData[gcStore.selectedGc].runTime
      ) {
        return gcStore.allGcData[gcStore.selectedGc].runTime;
      }
      return 18.91;
    });
    const gcType = computed(() => (gcStore.selectedGcData ? gcStore.selectedGcData.type : ''));

    // Compute disabledPositions based on controls.
    const disabledPositions = computed(() => {
      const ctrl1 = gcStore.startTime.controls.control1;
      const ctrl2 = gcStore.startTime.controls.control2;
      const arr = [];
      if (ctrl1 !== null && ctrl1 !== undefined && ctrl1 !== '') {
        arr.push(Number(ctrl1));
      }
      if (ctrl2 !== null && ctrl2 !== undefined && ctrl2 !== '') {
        arr.push(Number(ctrl2));
      }
      return arr;
    });

    // Compute flags for delayed and additional runs based on timeDelayResults.
    const additionalRunsExist = computed(() => {
      const tdr = gcStore.timeDelayResults || {};
      return (
        Number(tdr.additionalRuns) > 0 ||
        (tdr.sequentialFinalPosition && Number(tdr.sequentialFinalPosition) > 0)
      );
    });
    const delayedRunsExist = computed(() => {
      const tdr = gcStore.timeDelayResults || {};
      return Number(tdr.totalDelayedRuns) > 0;
    });

    // Reset function that calls the store's resetStartTime and also clears finalPosition and selectedGc.
    const resetInputs = () => {
      gcStore.resetStartTime();
      gcStore.startTime.finalPosition = null;
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
      disabledPositions,
      gcStore, // Passing the store so that children get the reactive object.
      additionalRunsExist,
      delayedRunsExist,
    };
  },
};
</script>

<style scoped>
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
.sticky-bottom-container {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
}
.reset-button-container {
  padding-bottom: 2px;
}
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
.other-batch-types-box {
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
