<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Header Row -->
      <div class="heading-row">
        <label class="heading-batch" for="batch-start-time">Batch Start Time:</label>
        <label class="heading-controls" for="control1">Controls:</label>
      </div>
      
      <!-- Input Row -->
      <div class="input-row">
        <!-- Batch Start Time Input & Inline Note -->
        <div class="batch-time-input">
          <input
            type="text"
            id="batch-start-time"
            v-model="localBatchStartTime"
            placeholder="hh:mm"
            @input="formatTimeInput"
            @blur="validateTimeInput"
          />
          <span class="time-input-note">Enter 24 Hour Time</span>
        </div>
        <!-- Controls Inputs -->
        <div class="controls-inputs">
          <div class="control-group">
            <input
              type="number"
              id="control1"
              v-model.number="localControl1"
              :min="control1Range.min"
              :max="control1Range.max"
              @input="debouncedValidateControl1"
              class="control-input"
            />
          </div>
          <div class="control-group">
            <input
              type="number"
              id="control2"
              v-model.number="localControl2"
              :min="control2Range.min"
              :max="control2Range.max"
              @input="debouncedValidateControl2"
              class="control-input"
            />
          </div>
        </div>
      </div>
      
      <!-- Additional Inputs -->
      <div class="input-group wait-input" v-if="showWaitInput">
        <label class="wait-label">15-Minute Wait:</label>
        <div class="wait-toggle" :class="{ on: localWait15 }" @click="setWait15(!localWait15)">
          <span>{{ localWait15 ? 'Yes' : 'No' }}</span>
        </div>
      </div>
      <div class="input-group">
        <label for="position-selector">Final Position:</label>
        <position-selector
          id="position-selector"
          :allowed-positions="allowedFinalPositions"
          :disabledPositions="[...disabledPositions]"
          mode="start-time"
          field="start-time"
          v-model="finalPosition"
        />
        <div class="error-message">{{ startTimeFinalPositionError }}</div>
      </div>
    </div>
    <div v-else>Loading...</div>
  </div>
</template>

<script>
import { computed, ref, watch } from "vue";
import { useGcStore } from "../store";
import PositionSelector from "./PositionSelector.vue";

// Simple debounce utility function.
function debounce(fn, delay = 300) {
  let timeoutID;
  return function(...args) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

export default {
  name: "StartTimeInput",
  components: { PositionSelector },
  props: {
    disabledPositions: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    const timeInputError = ref("");
    const startTimeFinalPositionError = ref("");

    const isLoading = computed(() => gcStore.isLoading);

    // Batch Start Time binding
    const localBatchStartTime = computed({
      get() {
        return gcStore.startTime.batchStartTime || "";
      },
      set(val) {
        gcStore.setBatchStartTime(val);
      },
    });

    // Wait toggle binding
    const localWait15 = computed({
      get() {
        return gcStore.startTime.wait15;
      },
      set(val) {
        gcStore.setWait15(val);
      },
    });

    const showWaitInput = computed(() => {
      const selectedGc = gcStore.selectedGc;
      return selectedGc && gcStore.allGcData[selectedGc]?.type === "Energy";
    });

    const allowedFinalPositions = [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30, 31, 32,
    ];

    // Final Position binding
    const finalPosition = ref(null);
    watch(finalPosition, (newVal) => {
      gcStore.startTime.finalPosition = newVal;
      recalculateResults();
    });

    watch(() => gcStore.selectedGc, (newGc) => {
      if (newGc && gcStore.allGcData[newGc]?.type === "Energy") {
        localWait15.value = true;
      } else if (newGc && gcStore.allGcData[newGc]?.type === "Sulphur") {
        localWait15.value = false;
      }
      recalculateResults();
    });

    watch(localBatchStartTime, () => {
      recalculateResults();
    });
    watch(localWait15, () => {
      recalculateResults();
    });
    watch(() => gcStore.startTimeResetCounter, () => {
      timeInputError.value = "";
    });
    
    // When local control values change, recalculate the results.
    const localControl1 = ref(gcStore.startTime.controls?.control1 ?? "");
    const localControl2 = ref(gcStore.startTime.controls?.control2 ?? "");
    watch(
      [() => localControl1.value, () => localControl2.value],
      () => {
        recalculateResults();
      }
    );

    // Format and validate the time input.
    const formatTimeInput = () => {
      let value = localBatchStartTime.value.replace(/\D/g, "");
      if (value.length > 2) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4);
      }
      localBatchStartTime.value = value.slice(0, 5);
      timeInputError.value = "";
      if (localBatchStartTime.value.length >= 5) {
        validateTimeInput();
      }
    };

    const validateTimeInput = () => {
      const timeString = localBatchStartTime.value;
      const parts = timeString.split(":");
      if (parts.length !== 2) {
        timeInputError.value =
          "Invalid format. Enter time as hh:mm, with a 0 in front, such as 09:30.";
        return;
      }
      const [hour, minute] = parts.map(Number);
      if (
        isNaN(hour) ||
        isNaN(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
      ) {
        localBatchStartTime.value = "";
        timeInputError.value =
          "Invalid time. Enter time as hh:mm, with a 0 in front, such as 09:30.";
      }
    };

    const recalculateResults = () => {
      gcStore.calculateStartTimeBatch();
    };

    const setWait15 = (val) => {
      localWait15.value = val;
      recalculateResults();
    };

    // Local Control Inputs & Dynamic Allowed Ranges
    watch(
      () => gcStore.startTime.controls,
      (newControls) => {
        localControl1.value = newControls?.control1 ?? "";
        localControl2.value = newControls?.control2 ?? "";
      },
      { deep: true }
    );

    const control1Range = computed(() => {
      const other = Number(localControl2.value);
      if (!isNaN(other) && other !== 0) {
        if (other >= 3 && other <= 15) {
          return { min: 17, max: 32 };
        } else if (other >= 17 && other <= 32) {
          return { min: 3, max: 15 };
        }
      }
      return { min: 3, max: 32 };
    });

    const control2Range = computed(() => {
      const other = Number(localControl1.value);
      if (!isNaN(other) && other !== 0) {
        if (other >= 3 && other <= 15) {
          return { min: 17, max: 32 };
        } else if (other >= 17 && other <= 32) {
          return { min: 3, max: 15 };
        }
      }
      return { min: 3, max: 32 };
    });

    const validateControl1 = () => {
      let num = Number(localControl1.value);
      if (isNaN(num)) {
        num = control1Range.value.min;
      }
      if (num === 16) {
        num = control1Range.value.min;
      }
      if (num < control1Range.value.min) {
        num = control1Range.value.min;
      } else if (num > control1Range.value.max) {
        num = control1Range.value.max;
      }
      localControl1.value = num;
      gcStore.startTime.controls = {
        ...gcStore.startTime.controls,
        control1: num,
      };
    };

    const validateControl2 = () => {
      let num = Number(localControl2.value);
      if (isNaN(num)) {
        num = control2Range.value.min;
      }
      if (num === 16) {
        num = control2Range.value.min;
      }
      if (num < control2Range.value.min) {
        num = control2Range.value.min;
      } else if (num > control2Range.value.max) {
        num = control2Range.value.max;
      }
      localControl2.value = num;
      gcStore.startTime.controls = {
        ...gcStore.startTime.controls,
        control2: num,
      };
    };

    // Create debounced versions of the validation functions.
    const debouncedValidateControl1 = debounce(validateControl1, 300);
    const debouncedValidateControl2 = debounce(validateControl2, 300);

    // Expose the parent's disabledPositions prop via computed for reactivity.
    const disabledPositionsComputed = computed(() => props.disabledPositions);

    return {
      isLoading,
      localBatchStartTime,
      formatTimeInput,
      validateTimeInput,
      timeInputError,
      localWait15,
      setWait15,
      finalPosition,
      allowedFinalPositions,
      startTimeFinalPositionError,
      recalculateResults,
      showWaitInput,
      localControl1,
      localControl2,
      control1Range,
      control2Range,
      validateControl1,
      validateControl2,
      debouncedValidateControl1,
      debouncedValidateControl2,
      disabledPositions: disabledPositionsComputed,
    };
  },
};
</script>

<style scoped>
.heading-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0px; /* Adjusted to match GC selector spacing */
}

/* Header label styling to match the global config section */
.heading-batch,
.heading-controls {
  flex: 1;
  text-align: left;
  font-weight: bold;
  font-size: 1.1rem;
}

.input-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.batch-time-input {
  flex: 1;
  display: flex;
  align-items: center;
}

.batch-time-input input {
  width: 75px;
  height: 36px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.time-input-note {
  margin-left: 10px;
  font-size: 0.8rem;
  color: #181818;
  font-weight: bold;
}

.controls-inputs {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-left: 0;
  gap: 10px;
}

.control-group {
  display: flex;
  align-items: center;
}

.start-time-input .control-input {
  width: 60px;
  height: 36px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.input-group.wait-input {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

/* 15-Minute Wait label set slightly smaller */
.wait-label {
  font-size: 1rem;
  font-weight: bold;
}

.wait-toggle {
  margin-left: 10px;
  width: 60px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.wait-toggle.on {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

/* Default label styling */
label {
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.12);
}
</style>
