<template>
  <!-- Wrap all the main inputs in a content container -->
  <div class="time-delay-input">
    <div class="time-delay-content">
      <h3 class="main-heading">Additional Runs</h3>
      <div>
        <!-- Sequential Batch Section -->
        <div class="sequential-batch-section">
          <!-- Only show the Final Position For Sequential Batch selector if the initial batch has been calculated -->
          <template v-if="initialBatchCalculated">
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
          </template>
          <!-- Always show the Additional Runs input -->
          <div class="additional-runs-input">
            <label>Misc Additional Runs:</label>
            <input
              type="number"
              v-model="miscAdditionalRunsInput"
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
                v-model="miscDelayedRunsInput"
                min="0"
                max="99"
                @input="limitMiscDelayedRuns"
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

    // Use a computed property so that v-model updates the store directly.
    const sequentialFinalPosition = computed({
      get() {
        return gcStore.sequentialFinalPosition;
      },
      set(value) {
        gcStore.setSequentialFinalPosition(value);
      },
    });

    // Local state for additional runs input and delayed runs.
    const miscAdditionalRuns = ref(null);
    const prebatchSelected = ref(false);
    const calibrationSelected = ref(false);
    const miscDelayedRuns = ref(0);

    watch(miscAdditionalRuns, (newVal) => {
      gcStore.miscAdditionalRuns = newVal;
      gcStore.calculateStartTimeBatch();
    });

    watch(miscDelayedRuns, (newVal) => {
      gcStore.miscDelayedRuns = newVal;
      gcStore.calculateStartTimeBatch();
    });

    const isEnergy = computed(() => {
      return props.gcType && props.gcType.toLowerCase() === 'energy';
    });

    const currentTime = ref(new Date());
    setInterval(() => {
      currentTime.value = new Date();
    }, 1000);
    const currentTimeString = computed(() => currentTime.value.toLocaleTimeString());

    watch(() => gcStore.startTimeResetCounter, () => {
      sequentialFinalPosition.value = null;
      miscAdditionalRuns.value = null;
      prebatchSelected.value = false;
      calibrationSelected.value = false;
      miscDelayedRuns.value = 0;
    });

    const miscAdditionalRunsInput = computed({
      get() {
        return miscAdditionalRuns.value === null ? '' : miscAdditionalRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        miscAdditionalRuns.value = isNaN(num) ? null : (num > 99 ? 99 : num);
      },
    });

    const miscDelayedRunsInput = computed({
      get() {
        return miscDelayedRuns.value === 0 ? '' : miscDelayedRuns.value;
      },
      set(val) {
        const num = parseInt(val, 10);
        miscDelayedRuns.value = isNaN(num) ? 0 : (num > 99 ? 99 : num);
      },
    });

    const limitAdditionalRuns = (e) => {
      const value = e.target.value.toString();
      if (value.length > 2) {
        const truncated = value.slice(0, 2);
        e.target.value = truncated;
        miscAdditionalRunsInput.value = parseInt(truncated, 10);
      }
    };

    const limitMiscDelayedRuns = (e) => {
      const value = e.target.value.toString();
      if (value.length > 2) {
        const truncated = value.slice(0, 2);
        e.target.value = truncated;
        miscDelayedRunsInput.value = parseInt(truncated, 10);
      }
    };

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

    // Computed property to determine if the initial batch is calculated.
    // We now base this on whether gcStore.startTime.batchEndTime exists.
    const initialBatchCalculated = computed(() => !!gcStore.startTime.batchEndTime);

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
        const extra = miscAdditionalRuns.value ? Number(miscAdditionalRuns.value) : 0;
        return baseRuns + extra;
      }
      return 0;
    });

    const baseEndTime = computed(() => {
      if (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) {
        const secs =
          totalSequentialRuns.value * runtimeSeconds.value +
          (props.gcType === 'Energy' ? (15 * 60 + 25) : 0);
        let computedTime = new Date(batch1End.value.getTime() + secs * 1000);
        if (computedTime.getTime() < batch1End.value.getTime()) {
          computedTime.setDate(computedTime.getDate() + 1);
        }
        return computedTime;
      } else if (miscAdditionalRuns.value) {
        const secs = Number(miscAdditionalRuns.value) * runtimeSeconds.value;
        let computedTime = new Date(batch1End.value.getTime() + secs * 1000);
        if (computedTime.getDate() === batch1End.value.getDate()) {
          computedTime.setDate(computedTime.getDate() + 1);
        }
        return computedTime;
      }
      return batch1End.value;
    });

    const sequentialBatchEndTime = computed(() => {
      if (sequentialFinalPosition.value && Number(sequentialFinalPosition.value) > 0) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      } else if (miscAdditionalRuns.value) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      }
      return '';
    });

    const additionalRunsEndTime = computed(() => {
      if (miscAdditionalRuns.value) {
        return formatTimeWithAmPmAndSeconds(baseEndTime.value);
      }
      return '';
    });

    const calibrationRuns = computed(() => {
      if (!props.gcType || props.gcType === "") {
        return "";
      }
      return props.gcType === 'Energy' ? 8 : 9;
    });

    const totalPreruns = computed(() => {
      let total = 0;
      if (prebatchSelected.value) total += 4;
      if (calibrationSelected.value) total += calibrationRuns.value;
      total += miscDelayedRuns.value || 0;
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
        miscDelayedRuns.value > 0
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
      const additional = Number(miscAdditionalRuns.value) || 0;
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
        return "No Time Delay Required";
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
      const endDate = adjustedFinalEndTime.value;
      const timeStr = formatTimeWithAmPmAndSeconds(endDate);
      const dateStr = endDate.toLocaleDateString();
      return `${timeStr} (${dateStr})`;
    });

    const overallEndTimeFormatted = computed(() => {
      return formatTimeWithAmPmAndSeconds(finalEndTime.value);
    });

    const prerunsDescription = computed(() => {
      const arr = [];
      if (prebatchSelected.value) arr.push("Prebatch");
      if (calibrationSelected.value) {
        const cal = calibrationRuns.value;
        if (cal === "") {
          arr.push("Calibration");
        } else {
          arr.push(`Calibration (${cal})`);
        }
      }
      if (miscDelayedRuns.value > 0) arr.push(`Misc Runs: ${miscDelayedRuns.value}`);
      return arr.length ? arr.join(", ") : "None";
    });

    const totalDelayedDurationFormatted = computed(() => {
      const totalDurationMinutes = totalPreruns.value * parseFloat(props.gcRuntime);
      const totalSeconds = Math.round(totalDurationMinutes * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 3600 % 60;
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

    // 14. Generate sequential batch rows using the ordering logic.
    const sequentialRows = computed(() => {
      if (!gcStore.sequentialFinalPosition) return [];
      const runtime = Math.round(parseRunTime(gcStore.allGcData[gcStore.selectedGc].runTime));
      const initialCount = initialPositionOrder.value.length;
      const isEnergy = (gcStore.allGcData[gcStore.selectedGc]?.type || "").trim().toLowerCase() === "energy";
      let rows = [];
      let baseTime;
      if (sequentialBaseRuns.value && sequentialBaseRuns.value.length > 0) {
        baseTime = new Date(`${new Date().toDateString()} ${sequentialBaseRuns.value[0].startTime}`);
      } else if (gcStore.startTime.batchEndTime) {
        baseTime = new Date(`${new Date().toDateString()} ${gcStore.startTime.batchEndTime}`);
      } else {
        baseTime = new Date();
      }
      if (isEnergy) {
        // Prepend a 15-Min Wait row.
        const waitRowStart = baseTime;
        const waitRowEnd = new Date(baseTime.getTime() + 15 * 60000);
        rows.push({
          computedTitle: "15-Min Wait",
          startTime: formatTimeWithAmPmAndSeconds(waitRowStart),
          endTime: formatTimeWithAmPmAndSeconds(waitRowEnd),
          positionDisplay: initialCount + 1
        });
        // Use waitRowEnd as the new base for sequential rows.
        const newBase = waitRowEnd;
        sequentialPositionOrder.value.forEach((title, idx) => {
          const rowStart = new Date(newBase.getTime() + idx * runtime);
          const rowEnd = new Date(newBase.getTime() + (idx + 1) * runtime);
          rows.push({
            computedTitle: title,
            startTime: formatTimeWithAmPmAndSeconds(rowStart),
            endTime: formatTimeWithAmPmAndSeconds(rowEnd),
            positionDisplay: initialCount + 2 + idx
          });
        });
      } else {
        sequentialPositionOrder.value.forEach((title, idx) => {
          const rowStart = new Date(baseTime.getTime() + idx * runtime);
          const rowEnd = new Date(baseTime.getTime() + (idx + 1) * runtime);
          rows.push({
            computedTitle: title,
            startTime: formatTimeWithAmPmAndSeconds(rowStart),
            endTime: formatTimeWithAmPmAndSeconds(rowEnd),
            positionDisplay: initialCount + idx + 1
          });
        });
      }
      return rows;
    });

    // 15. Additional Runs computed from timeDelayResults.additionalRuns.
    const additionalRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const additionalCount = timeDelayResults && timeDelayResults.additionalRuns ? timeDelayResults.additionalRuns : 0;
      if (!additionalCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      // If sequential rows exist, use the last sequential row's end time.
      if (sequentialRows.value.length > 0) {
        baseTime = new Date(`${new Date().toDateString()} ${sequentialRows.value[sequentialRows.value.length - 1].endTime}`);
      } else if (gcStore.startTime.batchEndTime) {
        baseTime = new Date(`${new Date().toDateString()} ${gcStore.startTime.batchEndTime}`);
      } else {
        baseTime = new Date(`${new Date().toDateString()} ${startTime.batchEndTime}`);
      }
      const base = lastMainRunNumber.value || 0;
      const rows = [];
      for (let i = 0; i < additionalCount; i++) {
        const runNumber = base + i + 1;
        const computedTitle = `Add Run ${i + 1}`;
        const rowStart = new Date(baseTime.getTime() + i * runtime);
        const rowEnd = new Date(baseTime.getTime() + (i + 1) * runtime);
        rows.push({
          position: runNumber,
          positionDisplay: runNumber,
          computedTitle,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // 16. Delayed Runs computed from timeDelayResults.totalDelayedRuns.
    const prebatchRows = computed(() => {
      const { startTime, allGcData, selectedGc, timeDelayResults } = gcStore;
      const prebatchCount = timeDelayResults && timeDelayResults.totalDelayedRuns ? timeDelayResults.totalDelayedRuns : 0;
      if (!prebatchCount) return [];
      const runtime = Math.round(parseRunTime(allGcData[selectedGc].runTime));
      let baseTime;
      if (additionalRows.value.length) {
        baseTime = additionalRows.value[additionalRows.value.length - 1].endDate;
      } else if (sequentialBaseRuns.value && sequentialBaseRuns.value.length > 0) {
        const timeStr = sequentialBaseRuns.value[sequentialBaseRuns.value.length - 1].endTime;
        baseTime = new Date(`${new Date().toDateString()} ${timeStr}`);
      } else if (startTime.batchEndTime) {
        baseTime = new Date(`${new Date().toDateString()} ${startTime.batchEndTime}`);
      } else {
        baseTime = timeDelayResults.delayedRunsStartTimeDate ? new Date(timeDelayResults.delayedRunsStartTimeDate) : new Date();
      }
      let delayedStart;
      if (timeDelayResults.delayedRunsStartTimeDate) {
        delayedStart = new Date(timeDelayResults.delayedRunsStartTimeDate);
      } else {
        const delayHours = parseInt(timeDelayRequired.value, 10) || 0;
        delayedStart = new Date(baseTime.getTime() + delayHours * 3600000);
      }
      const rows = [];
      for (let i = 0; i < prebatchCount; i++) {
        const rowStart = new Date(delayedStart.getTime() + i * runtime);
        const rowEnd = new Date(delayedStart.getTime() + (i + 1) * runtime);
        const runNumber = (lastMainRunNumber.value || 0) + (additionalRows.value.length || 0) + i + 1;
        rows.push({
          position: runNumber,
          positionDisplay: runNumber,
          computedTitle: `Delayed Run ${i + 1}`,
          startTime: formatTimeWithAmPmAndSeconds(rowStart),
          endTime: formatTimeWithAmPmAndSeconds(rowEnd),
          endDate: rowEnd,
        });
      }
      return rows;
    });

    // 17. Computed for the delay time string.
    const timeDelayRequired = computed(() => {
      const { timeDelayResults } = gcStore;
      return timeDelayResults && timeDelayResults.timeDelayRequired ? timeDelayResults.timeDelayRequired : "";
    });

    // 18. Flag to indicate if delayed runs should be shown.
    const delayedRunSelected = computed(() => {
      const { timeDelayResults } = gcStore;
      return (
        timeDelayResults &&
        (timeDelayResults.prerunsDescription !== 'None' ||
          Number(timeDelayResults.totalDelayedRuns) > 0)
      );
    });

    // 19. Compute the end time of the last run in the initial batch.
    const initialBatchEndTime = computed(() => {
      if (initialBaseRuns.value && initialBaseRuns.value.length) {
        return initialBaseRuns.value[initialBaseRuns.value.length - 1].endTime;
      }
      return "";
    });
    watch(initialBatchEndTime, (newVal) => {
      emit("update:initialBatchEndTime", newVal);
    }, { immediate: true });

    watch(runtableClosestPositionFull, (newVal) => {
      emit("update:runtableClosestPositionFull", newVal);
    }, { immediate: true });

    return {
      gcStore,
      initialPositionOrder,
      sequentialPositionOrder,
      hasSequentialBatch,
      sequentialRows,
      runsHasWait,
      waitRow,
      initialBaseRuns,
      sequentialBaseRuns,
      runtableClosestCandidateIndex,
      selectedCandidate,
      selectedPositionLabel,
      runtableClosestPositionFull,
      additionalRows,
      prebatchRows,
      timeDelayRequired,
      delayedRunSelected,
      totalPreruns,
      totalRuns,
      hideInputs,
      limitAdditionalRuns,
      limitMiscDelayedRuns,
      calibrationRuns,
      gcType: props.gcType,
      isEnergy,
      currentTimeString,
      disabledPositions: computed(() => props.disabledPositions),
      initialBatchCalculated
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
