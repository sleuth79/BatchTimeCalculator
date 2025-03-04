<template>
  <div class="time-delay-input">
    <h3 class="main-heading">Additional Runs</h3>
    <!-- We no longer hide the inputs -->
    <div>
      <!-- Sequential Batch Optional Field: Only shown if delayed mode is OFF -->
      <div v-if="!delayedMode" class="sequential-batch-section">
        <label>
          Final Position for Sequential Batch:
          <span style="font-size: 0.80em;">(if required)</span>
        </label>
        <position-selector
          :allowed-positions="allowedPositionsForSequential"
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
        </div>
      </div>

      <!-- Separator line between Additional Runs and Delayed Runs -->
      <hr v-if="!delayedMode" class="separator" />

      <!-- Delayed Runs Section -->
      <div class="delayed-runs-section">
        <h3 class="delayed-runs-heading">Delayed Runs:</h3>
        <div class="delayed-runs-inputs">
          <div
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
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import PositionSelector from './PositionSelector.vue';
import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: 'TimeDelayStartModeInput',
  components: { PositionSelector },
  props: {
    batch1EndTime: { type: [Date, String], required: true },
    primaryFinalPosition: { type: Number, required: true },
    gcRuntime: { type: Number, required: true },
    gcType: { type: String, required: true },
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

    // Reset local inputs when the store signals a reset
    watch(
      () => gcStore.startTimeResetCounter,
      () => {
        sequentialFinalPosition.value = null;
        additionalRuns.value = null;
        prebatchSelected.value = false;
        calibrationSelected.value = false;
        miscRuns.value = 0;
      }
    );

    // Also watch selectedMode for resets
    watch(
      () => gcStore.selectedMode,
      (newMode) => {
        if (newMode === 'start-time') {
          sequentialFinalPosition.value = null;
          additionalRuns.value = null;
          prebatchSelected.value = false;
          calibrationSelected.value = false;
          miscRuns.value = 0;
        }
      }
    );

    // Computed setters for capping inputs to 99
    const additionalRunsInput = computed({
      get() {
        return additionalRuns.value === null ? '' : additionalRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        additionalRuns.value = isNaN(num) ? null : (num > 99 ? 99 : num);
      },
    });

    const miscRunsInput = computed({
      get() {
        return miscRuns.value === 0 ? '' : miscRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        miscRuns.value = isNaN(num) ? 0 : (num > 99 ? 99 : num);
      },
    });

    // Input limiting handlers
    const limitAdditionalRuns = (e) => {
      const value = e.target.value.toString();
      if (value.length > 2) {
        const truncated = value.slice(0, 2);
        e.target.value = truncated;
        additionalRunsInput.value = parseInt(truncated, 10);
      }
    };

    const limitMiscRuns = (e) => {
      const value = e.target.value.toString();
      if (value.length > 2) {
        const truncated = value.slice(0, 2);
        e.target.value = truncated;
        miscRunsInput.value = parseInt(truncated, 10);
      }
    };

    // Toggle functions
    const togglePrebatch = () => {
      prebatchSelected.value = !prebatchSelected.value;
      if (prebatchSelected.value) calibrationSelected.value = false;
    };

    const toggleCalibration = () => {
      calibrationSelected.value = !calibrationSelected.value;
      if (calibrationSelected.value) prebatchSelected.value = false;
    };

    const allowedPositionsForSequential = ref([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      13, 14, 15, 17, 18, 19, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30, 31, 32,
    ]);

    const delayedMode = ref(false);
    const handleDelayedRunsModeChange = (mode) => {
      delayedMode.value = mode;
      if (mode) {
        sequentialFinalPosition.value = null;
        additionalRuns.value = null;
      }
    };

    // --- Helper Computations for Time Calculations ---
    const batch1End = computed(() => {
      if (props.batch1EndTime) {
        return props.batch1EndTime instanceof Date
          ? props.batch1EndTime
          : new Date(props.batch1EndTime);
      }
      return new Date();
    });

    const runtimeSeconds = computed(() =>
      Math.round(parseFloat(props.gcRuntime) * 60)
    );

    const totalSequentialRuns = computed(() => {
      if (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) {
        const seqPos = Number(sequentialFinalPosition.value);
        const baseRuns = seqPos <= 15 ? seqPos + 2 : seqPos + 1;
        const extra = additionalRuns.value ? Number(additionalRuns.value) : 0;
        return baseRuns + extra;
      }
      return 0;
    });

    const baseEndTime = computed(() => {
      if (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) {
        const secs =
          totalSequentialRuns.value * runtimeSeconds.value +
          (props.gcType === 'Energy' ? 15 * 60 : 0);
        return new Date(batch1End.value.getTime() + secs * 1000);
      } else if (additionalRuns.value) {
        const secs = Number(additionalRuns.value) * runtimeSeconds.value;
        let endTime = new Date(batch1End.value.getTime() + secs * 1000);
        if (endTime.getHours() >= 12) {
          endTime.setDate(endTime.getDate() + 1);
        }
        return endTime;
      }
      return batch1End.value;
    });

    const sequentialBatchEndTime = computed(() => {
      if (
        sequentialFinalPosition.value &&
        Number(sequentialFinalPosition.value) > 0
      ) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      } else if (additionalRuns.value) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      }
      return '';
    });

    const additionalRunsEndTime = computed(() => {
      if (additionalRuns.value) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      }
      return '';
    });

    // --- New: Computed property for calibration runs ---
    // Only return a value if a GC is selected (gcType is truthy)
    const calibrationRuns = computed(() => {
      if (!props.gcType || props.gcType === "") {
        return "";
      }
      return props.gcType === 'Energy' ? 8 : 9;
    });

    // Update totalPreruns to use calibrationRuns
    const totalPreruns = computed(() => {
      let total = 0;
      if (prebatchSelected.value) total += 4;
      if (calibrationSelected.value) total += calibrationRuns.value;
      total += miscRuns.value || 0;
      return total;
    });

    const finalEndTime = computed(() => {
      const secs = totalPreruns.value * runtimeSeconds.value;
      return new Date(baseEndTime.value.getTime() + secs * 1000);
    });

    const delayedRunSelected = computed(() => {
      return (
        prebatchSelected.value ||
        calibrationSelected.value ||
        miscRuns.value > 0
      );
    });

    const totalRuns = computed(() => {
      const initialPos = Number(props.primaryFinalPosition) || 0;
      let effectiveInitial = 0;
      if (initialPos > 0) {
        effectiveInitial = initialPos <= 15 ? initialPos + 2 : initialPos + 1;
      }
      const sequentialPos = Number(sequentialFinalPosition.value) || 0;
      let effectiveSequential = 0;
      if (sequentialPos > 0) {
        effectiveSequential = sequentialPos <= 15 ? sequentialPos + 2 : sequentialPos + 1;
      }
      const additional = Number(additionalRuns.value) || 0;
      return effectiveInitial + effectiveSequential + additional;
    });

    const targetTime = computed(() => {
      const base = baseEndTime.value;
      const t = new Date(base);
      t.setHours(7, 30, 0, 0);
      if (base.getTime() >= t.getTime()) {
        t.setDate(t.getDate() + 1);
      }
      return t;
    });

    const timeGapTo730AM = computed(() => {
      const baseT = baseEndTime.value;
      const target = targetTime.value;
      if (baseT < target) {
        const diffMS = target.getTime() - baseT.getTime();
        const diffMinutes = Math.floor(diffMS / 60000);
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return `${hours} hours, ${minutes} minutes`;
      } else {
        return "0 hours, 0 minutes";
      }
    });

    const timeDelayRequiredLocal = computed(() => {
      const F = finalEndTime.value;
      const target = targetTime.value;
      const diffMS = target.getTime() - F.getTime();
      if (diffMS > 0) {
        const diffHours = Math.floor(diffMS / (3600 * 1000));
        return `${diffHours} hours`;
      } else {
        return "No time delay required";
      }
    });

    const computedDelayHours = computed(() => {
      const parts = timeDelayRequiredLocal.value.split(" ");
      const hours = Number(parts[0]);
      return isNaN(hours) ? 0 : hours;
    });

    const delayedRunsStartTimeComputed = computed(() => {
      if (!delayedRunSelected.value) return '';
      const start = new Date(
        baseEndTime.value.getTime() + computedDelayHours.value * 3600 * 1000
      );
      return formatTimeWithAmPmAndSeconds(start);
    });

    const adjustedFinalEndTime = computed(() => {
      return new Date(
        finalEndTime.value.getTime() + computedDelayHours.value * 3600 * 1000
      );
    });

    const delayedRunsEndTimeComputed = computed(() => {
      if (!delayedRunSelected.value) return "";
      return formatTimeWithAmPmAndSeconds(adjustedFinalEndTime.value);
    });

    const overallEndTimeFormatted = computed(() => {
      return formatTimeWithAmPmAndSeconds(finalEndTime.value);
    });

    // Updated prerunsDescription:
    const prerunsDescription = computed(() => {
      const arr = [];
      if (prebatchSelected.value) arr.push("Prebatch");
      if (calibrationSelected.value) {
        // Use unwrapped calibrationRuns value
        const cal = calibrationRuns.value;
        if (cal === "") {
          arr.push("Calibration");
        } else {
          arr.push(`Calibration (${cal})`);
        }
      }
      if (miscRuns.value > 0) arr.push(`Misc Runs: ${miscRuns.value}`);
      return arr.length ? arr.join(", ") : "None";
    });

    const totalDelayedDurationFormatted = computed(() => {
      const totalDurationMinutes = totalPreruns.value * parseFloat(props.gcRuntime);
      const totalSeconds = Math.round(totalDurationMinutes * 60);
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

    const hideInputs = computed(() => false);

    watch(
      [
        sequentialFinalPosition,
        additionalRuns,
        prebatchSelected,
        calibrationSelected,
        miscRuns,
        () => props.batch1EndTime,
        () => props.gcRuntime,
        () => props.primaryFinalPosition,
      ],
      () => {
        if (!(
          (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) ||
          delayedRunSelected.value ||
          additionalRuns.value
        )) {
          const fallbackPayload = {
            sequentialBatchActive: false,
            sequentialFinalPosition: null,
            sequentialBatchEndTime: '',
            additionalRuns: additionalRuns.value,
            additionalRunsEndTime: '',
            prerunsDescription: prerunsDescription.value,
            totalDelayedRuns: totalPreruns.value,
            totalRuns: totalRuns.value,
            timeDelayRequired: timeDelayRequiredLocal.value,
            timeGapTo730AM: timeGapTo730AM.value,
            delayedRunsStartTime: '',
            delayedRunsEndTime: '',
            totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
          };
          emit('update-time-delay', fallbackPayload);
          return;
        }
        const payload = {
          sequentialBatchActive: (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0),
          sequentialFinalPosition: sequentialFinalPosition.value ? Number(sequentialFinalPosition.value) : null,
          sequentialBatchEndTime: formatTimeWithAmPmAndSeconds(baseEndTime.value),
          additionalRuns: additionalRuns.value,
          additionalRunsEndTime: additionalRunsEndTime.value,
          prerunsDescription: prerunsDescription.value,
          totalDelayedRuns: totalPreruns.value,
          totalRuns: totalRuns.value,
          timeDelayRequired: timeDelayRequiredLocal.value,
          timeGapTo730AM: timeGapTo730AM.value,
          delayedRunsStartTime: delayedRunsStartTimeComputed.value,
          delayedRunsEndTime: delayedRunSelected.value ? delayedRunsEndTimeComputed.value : '',
          totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
        };
        emit('update-time-delay', payload);
      },
      { deep: true }
    );

    onMounted(() => {
      if (!(
        (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) ||
        delayedRunSelected.value ||
        additionalRuns.value
      )) {
        const emptyPayload = {
          sequentialBatchActive: false,
          sequentialFinalPosition: null,
          sequentialBatchEndTime: '',
          additionalRuns: additionalRuns.value,
          additionalRunsEndTime: '',
          prerunsDescription: prerunsDescription.value,
          totalDelayedRuns: totalPreruns.value,
          totalRuns: totalRuns.value,
          timeDelayRequired: '',
          timeGapTo730AM: '',
          delayedRunsStartTime: '',
          delayedRunsEndTime: '',
          totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
        };
        emit('update-time-delay', emptyPayload);
      } else {
        const initialPayload = {
          sequentialBatchActive: (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0),
          sequentialFinalPosition: sequentialFinalPosition.value ? Number(sequentialFinalPosition.value) : null,
          sequentialBatchEndTime: formatTimeWithAmPmAndSeconds(baseEndTime.value),
          additionalRuns: additionalRuns.value,
          additionalRunsEndTime: additionalRunsEndTime.value,
          prerunsDescription: prerunsDescription.value,
          totalDelayedRuns: totalPreruns.value,
          totalRuns: totalRuns.value,
          timeDelayRequired: timeDelayRequiredLocal.value,
          timeGapTo730AM: timeGapTo730AM.value,
          delayedRunsStartTime: delayedRunsStartTimeComputed.value,
          delayedRunsEndTime: delayedRunSelected.value ? delayedRunsEndTimeComputed.value : '',
          totalDelayedDurationFormatted: totalDelayedDurationFormatted.value,
        };
        emit('update-time-delay', initialPayload);
      }
    });

    return {
      sequentialFinalPosition,
      additionalRuns,
      additionalRunsInput,
      prebatchSelected,
      calibrationSelected,
      togglePrebatch,
      toggleCalibration,
      miscRunsInput,
      miscRuns,
      sequentialBatchEndTime,
      additionalRunsEndTime,
      timeDelayRequired: timeDelayRequiredLocal,
      timeGapTo730AM,
      prerunsDescription,
      allowedPositionsForSequential,
      totalPreruns,
      totalRuns,
      hideInputs,
      handleDelayedRunsModeChange,
      delayedMode,
      totalDelayedDurationFormatted,
      limitAdditionalRuns,
      limitMiscRuns,
      calibrationRuns,
    };
  },
};
</script>

<style scoped>
/* Unified Heading Styles for all headings */
.main-heading,
.batch-label,
.delayed-runs-heading {
  font-size: 1.2rem !important;
  margin-top: 0.5rem !important;
  margin-bottom: 10px;
  font-weight: bold;
}

/* The rest of your styles */
.time-delay-input {
  border-top: 1px solid #ddd;
  margin-top: 0;
  padding-top: 0;
}
.info-message {
  color: #666;
  font-style: italic;
  margin: 10px 0;
}
.sequential-batch-section {
  margin-bottom: 10px;
}
.additional-runs-input label {
  /* Removed font-size so it inherits unified style */
  font-weight: bold;
  white-space: nowrap;
}
.additional-runs-input input {
  width: 60px;
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
.misc-runs input {
  width: 60px;
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
}
.highlight-green {
  color: var(--highlight-color);
}
/* Add a subtle drop shadow to all headings (labels in this case) */
label {
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.15);
}
</style>
