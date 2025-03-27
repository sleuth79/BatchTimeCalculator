<template>
  <!-- Wrap all the main inputs in a content container -->
  <div class="time-delay-input">
    <div class="time-delay-content">
      <h3 class="main-heading">Additional Runs</h3>
      <div>
        <!-- Sequential Batch Optional Field -->
        <div class="sequential-batch-section">
          <label>
            Final Position For Sequential Batch:
          </label>
          <!-- Pass disabledPositions from prop -->
          <position-selector
            :allowed-positions="allowedPositionsForSequential"
            :disabledPositions="[...disabledPositions]"
            mode="sequential"
            field="sequential"
            v-model="sequentialFinalPosition"
          />
          <!-- Additional Runs input -->
          <div class="additional-runs-input">
            <label>Misc Additional Runs:</label>
            <input
              type="number"
              v-model="additionalRunsInput"
              min="0"
              max="99"
              @input="limitAdditionalRuns"
            />
            <p class="caveat additional-runs-caveat">
              If no batches are currently running, select a GC and input misc additional runs to calculate the run time based on the current time of day.
            </p>
          </div>
        </div>

        <!-- Separator line between Additional Runs and Delayed Runs -->
        <hr class="separator" />

        <!-- Delayed Runs Section -->
        <div class="delayed-runs-section">
          <h3 class="delayed-runs-heading">Delayed Runs</h3>
          <div class="delayed-runs-inputs">
            <!-- Prebatch button is only shown if GC type is not Energy -->
            <div
              v-if="!isEnergy"
              class="box"
              :class="{ selected: prebatchSelected }"
              @click="togglePrebatch"
            >
              Prebatch
            </div>
            <div
              class="box"
              :class="{ selected: calibrationSelected }"
              @click="toggleCalibration"
            >
              Calibration<span v-if="calibrationRuns !== ''"> ({{ calibrationRuns }})</span>
            </div>
            <div class="misc-runs">
              <span class="misc-label">Misc Delayed Runs:</span>
              <input
                type="number"
                v-model="miscRunsInput"
                min="0"
                max="99"
                @input="limitMiscRuns"
              />
            </div>
          </div>
          <!-- Informational Text -->
          <p class="caveat">
            If no batches are currently running, select a GC and select delayed runs to calculate the time delay required based on the current time of day.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import PositionSelector from './PositionSelector.vue';
import { useGcStore } from '../store/index.js';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: 'TimeDelayInput',
  components: { PositionSelector },
  props: {
    batch1EndTime: { type: [Date, String], required: true },
    primaryFinalPosition: { type: Number, required: true },
    gcRuntime: { type: Number, required: true },
    gcType: { type: String, required: true },
    disabledPositions: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update-time-delay'],
  setup(props, { emit }) {
    const gcStore = useGcStore();

    // --- Local Input States ---
    const sequentialFinalPosition = ref(null);
    const additionalRuns = ref(null);
    const prebatchSelected = ref(false);
    const calibrationSelected = ref(false);
    const miscRuns = ref(0);

    // Update store when additionalRuns changes
    watch(additionalRuns, (newVal) => {
      gcStore.additionalRuns = newVal;
      gcStore.calculateStartTimeBatch();
    });

    // *** NEW: Update store when miscRuns changes ***
    watch(miscRuns, (newVal) => {
      gcStore.miscRuns = newVal;
      gcStore.calculateStartTimeBatch();
    });

    // ... rest of your code remains unchanged
    // For instance, your computed setters:
    const miscRunsInput = computed({
      get() {
        return miscRuns.value === 0 ? '' : miscRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        miscRuns.value = isNaN(num) ? 0 : (num > 99 ? 99 : num);
      },
    });

    // ... remaining setup code and return statement
    return {
      sequentialFinalPosition,
      additionalRuns,
      miscRunsInput,
      prebatchSelected,
      calibrationSelected,
      // ... rest of your exposed properties
    };
  },
};
</script>


<style scoped>
.main-heading,
.batch-label,
.delayed-runs-heading {
  font-size: 1.3rem !important;
  margin-top: 0.5rem !important;
  margin-bottom: 6px;
  font-weight: bold;
}
.time-delay-input {
  border-top: 1px solid #ddd;
  margin-top: 0;
  padding-top: 0;
  display: flex;
  flex-direction: column;
  height: 400px; /* fixed height */
  overflow: hidden;
}
.time-delay-content {
  flex: 1 1 auto;
  overflow: hidden;
}
.section-header {
  background-color: #d0d0d0;
  padding: 8px 10px;
  margin-bottom: 6px;
  width: 100%;
  text-align: left;
}
.caveat {
  font-size: 0.65rem;
  color: #666;
  margin-top: 4px;
  margin-bottom: 8px;
}
.additional-runs-caveat {
  font-size: 0.65rem;
  color: #666;
  margin-top: 4px;
  margin-bottom: 0;
}
.current-time {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 8px;
}
.info-message {
  color: #666;
  font-style: italic;
  margin: 10px 0;
}
.sequential-batch-section {
  margin-bottom: 10px;
}
.sequential-batch-section label {
  display: block;
  margin-bottom: 10px;
}
.additional-runs-input label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  white-space: nowrap;
  height: 36px;
  line-height: 36px;
  margin: 0;
}
.additional-runs-input input,
.misc-runs input {
  width: 60px;
  height: 36px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.11);
}
.separator {
  border: none;
  border-top: 1px solid #ccc;
  margin: 0 !important;
  padding: 0;
}
.delayed-runs-section {
  margin-top: 10px;
}
.delayed-runs-inputs {
  display: flex;
  align-items: center;
  gap: 10px;
}
.misc-runs {
  display: flex;
  align-items: center;
  gap: 5px;
}
.misc-runs .misc-label {
  white-space: nowrap;
}
.box {
  display: inline-block;
  border: 1px solid #ccc;
  padding: 5px 10px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  border-radius: 4px;
  background-color: #fff;
  transition: background-color 0.2s ease;
}
.box:hover {
  background-color: #f0f0f0;
}
.box.selected {
  background-color: var(--highlight-color);
}
label {
  font-weight: bold;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.12);
}
.highlight-green {
  color: var(--highlight-color);
}
</style>
