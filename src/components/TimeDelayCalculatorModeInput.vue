<template>
  <div class="time-delay-calculator-input">
    <!-- Optional disclaimer if inputs should be hidden -->
    <div v-if="hideInputs">
      <p class="info-message">
        The user inputs for this section are hidden because the batch passed 7:30 AM.
      </p>
    </div>
    <!-- Main Input Section -->
    <div v-else>
      <div class="delayed-runs-section">
        <label class="delayed-runs-heading">Delayed Runs:</label>
        <div class="delayed-runs-inputs">
          <div class="box" :class="{ selected: prebatchSelected }" @click="togglePrebatch">
            Prebatch
          </div>
          <div class="box" :class="{ selected: calibrationSelected }" @click="toggleCalibration">
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
        <!-- New line showing the formatted total duration of delayed runs -->
        <p>
          Total Duration of Delayed Runs:
          <span class="result-value">{{ totalDelayedDurationFormatted }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useGcStore } from '../store/index.js';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: 'TimeDelayCalculatorInput',
  props: {
    batch1EndTime: { type: [Date, String], required: true },
    gcRuntime: { type: Number, required: true },
    gcType: { type: String, required: true },
    primaryFinalPosition: { type: Number, required: false }
  },
  emits: ['update-time-delay'],
  setup(props, { emit }) {
    const gcStore = useGcStore();

    // --- Local States for Delayed Runs Inputs ---
    const prebatchSelected = ref(false);
    const calibrationSelected = ref(false);
    const miscRuns = ref(0);

    const miscRunsInput = computed({
      get() {
        return miscRuns.value === 0 ? '' : miscRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        miscRuns.value = isNaN(num) ? 0 : (num > 99 ? 99 : num);
      }
    });

    // Input limiting handler for miscRuns
    const limitMiscRuns = (e) => {
      const value = e.target.value.toString();
      if (value.length > 2) {
        const truncated = value.slice(0, 2);
        e.target.value = truncated;
        miscRunsInput.value = parseInt(truncated, 10);
      }
    };

    // --- Toggle Functions (mutually exclusive) ---
    const togglePrebatch = () => {
      prebatchSelected.value = !prebatchSelected.value;
      if (prebatchSelected.value) calibrationSelected.value = false;
    };

    const toggleCalibration = () => {
      calibrationSelected.value = !calibrationSelected.value;
      if (calibrationSelected.value) prebatchSelected.value = false;
    };

    // --- Computed: Hide Inputs Based on GC Store Results ---
    const hideInputs = computed(() => {
      return gcStore.results && gcStore.results.timeDelayRequired === "No time delay required";
    });

    // --- New: Computed property for calibration runs ---
    const calibrationRuns = computed(() => {
      if (!props.gcType || props.gcType === "") {
        return "";
      }
      return props.gcType === 'Energy' ? 8 : 9;
    });

    // --- Computed: Delayed Runs Description ---
    const prerunsDescription = computed(() => {
      const parts = [];
      if (prebatchSelected.value) parts.push("Prebatch");
      if (calibrationSelected.value) {
        const cal = calibrationRuns.value;
        if (cal === "") {
          parts.push("Calibration");
        } else {
          parts.push(`Calibration (${cal})`);
        }
      }
      if (miscRuns.value > 0) parts.push(`Misc Runs: ${miscRuns.value}`);
      return parts.length ? parts.join(", ") : "None";
    });

    // --- Computed: Total Delayed Runs ---
    const totalDelayedRuns = computed(() => {
      let total = 0;
      if (prebatchSelected.value) total += 4;
      if (calibrationSelected.value) total += (calibrationRuns.value || 0);
      total += miscRuns.value;
      return total;
    });

    // --- Delay Calculation ---
    const runtimeSeconds = computed(() => Math.round(parseFloat(props.gcRuntime) * 60));
    const totalDelayedMs = computed(() => totalDelayedRuns.value * runtimeSeconds.value * 1000);

    // Compute target time (next 7:30 AM)
    const targetDisplay = computed(() => {
      const now = new Date();
      const t = new Date(now);
      t.setHours(7, 30, 0, 0);
      if (now >= t) t.setDate(t.getDate() + 1);
      return t;
    });

    // Compute the gap (in hours) from now to the target time.
    const gapHoursExact = computed(() => (targetDisplay.value.getTime() - Date.now()) / 3600000);
    // Convert the extra delayed runs time to hours.
    const D_hoursExact = computed(() => totalDelayedMs.value / (1000 * 60 * 60));
    // Calculate the delay required (in whole hours)
    const computedDelayHours = computed(() => {
      const diff = gapHoursExact.value - D_hoursExact.value;
      return diff > 0 ? Math.floor(diff) : 0;
    });

    // --- Computed: Delayed Runs Start Time ---
    const delayedRunsStartTime = computed(() => {
      const nowMs = Date.now();
      const delayMs = computedDelayHours.value * 3600000;
      const startTime = new Date(nowMs + delayMs);
      return formatTimeWithAmPmAndSeconds(startTime);
    });

    // --- Computed: Delayed Runs End Time ---
    const delayedRunsEndTime = computed(() => {
      const baseTime = props.batch1EndTime instanceof Date 
        ? props.batch1EndTime 
        : new Date(props.batch1EndTime);
      const extraTime = totalDelayedMs.value;
      const endTime = new Date(baseTime.getTime() + extraTime);
      return formatTimeWithAmPmAndSeconds(endTime);
    });

    // --- New: Computed: Total Delayed Duration Formatted ---
    const totalDelayedDurationFormatted = computed(() => {
      // Convert totalDelayedMs from milliseconds to seconds.
      const totalSeconds = Math.round(totalDelayedMs.value / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      let formatted = "";
      if (hours > 0) {
        formatted += `${hours}h `;
      }
      formatted += `${minutes}m`;
      if (seconds > 0) {
        formatted += ` ${seconds}s`;
      }
      return formatted.trim();
    });

    // --- Emit Payload When Inputs Change ---
    watch([prebatchSelected, calibrationSelected, miscRuns], () => {
      const payload = {
        prerunsDescription: prerunsDescription.value,
        totalDelayedRuns: totalDelayedRuns.value,
        delayedRunsStartTime: delayedRunsStartTime.value,
        delayedRunsEndTime: delayedRunsEndTime.value,
        totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
      };
      emit('update-time-delay', payload);
    }, { deep: true });

    onMounted(() => {
      const initialPayload = {
        prerunsDescription: prerunsDescription.value,
        totalDelayedRuns: totalDelayedRuns.value,
        delayedRunsStartTime: delayedRunsStartTime.value,
        delayedRunsEndTime: delayedRunsEndTime.value,
        totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
      };
      emit('update-time-delay', initialPayload);
    });

    return {
      prebatchSelected,
      calibrationSelected,
      miscRunsInput,
      togglePrebatch,
      toggleCalibration,
      hideInputs,
      delayedRunsStartTime,
      delayedRunsEndTime,
      limitMiscRuns,
      calibrationRuns,
      totalDelayedDurationFormatted
    };
  },
};
</script>

<style scoped>
.time-delay-calculator-input {
  border-top: 1px solid #ddd;
  padding-top: 10px;
  margin-top: 0;
}

.main-heading {
  font-size: 1.6rem;
  margin-top: 0.5rem;
  margin-bottom: 10px;
}

.info-message {
  color: #666;
  font-style: italic;
  margin: 10px 0;
}

.delayed-runs-section {
  margin-bottom: 10px;
}

.delayed-runs-heading {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
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
.misc-runs input {
  width: 60px;
}

.time-delay-calculator-input .delayed-runs-inputs .box {
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

.time-delay-calculator-input .delayed-runs-inputs .box:hover {
  background-color: #f0f0f0;
}

.time-delay-calculator-input .delayed-runs-inputs .box.selected {
  background-color: var(--highlight-color) !important;
  color: var(--text-highlight) !important;
}

.result-value {
  font-weight: bold;
}
</style>
