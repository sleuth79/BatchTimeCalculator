<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Header Row -->
      <div class="heading-row">
        <label class="heading-batch" for="batch-start-time">Batch Start Time:</label>
        <label class="heading-controls" for="control1">Batch Controls:</label>
      </div>
      
      <!-- Input Row -->
      <div class="input-row">
        <!-- Batch Start Time Input & Inline Note -->
        <div class="batch-time-input">
          <input
            type="text"
            id="batch-start-time"
            v-model="localBatchStartTime"
            placeholder="hhmm"
            @keydown="handleTimeKeydown"
            @input="formatTimeInput"
            @blur="validateTimeInput"
          />
          <span class="time-input-note">Enter 24 Hour Time (NO 0 FIRST)</span>
        </div>
        <!-- Controls Inputs -->
        <div class="controls-inputs">
          <div class="control-group">
            <input
              type="number"
              id="control1"
              ref="control1Input"
              v-model.number="localControl1"
              :min="control1Range.min"
              :max="control1Range.max"
              @keydown="handleControlKeydown('control1', $event)"
              @input="debouncedValidateControl1"
              class="control-input"
            />
          </div>
          <div class="control-group">
            <input
              type="number"
              id="control2"
              ref="control2Input"
              v-model.number="localControl2"
              :min="control2Range.min"
              :max="control2Range.max"
              @keydown="handleControlKeydown('control2', $event)"
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

    // Batch Start Time binding (stored as "hh:mm")
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

    // Final Position binding: local ref synced with store.
    const finalPosition = ref(gcStore.startTime.finalPosition);
    watch(finalPosition, (newVal) => {
      gcStore.startTime.finalPosition = newVal;
      recalculateResults();
    });
    watch(
      () => gcStore.startTime.finalPosition,
      (newVal) => {
        finalPosition.value = newVal;
      }
    );

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
    
    const localControl1 = ref(gcStore.startTime.controls?.control1 ?? "");
    const localControl2 = ref(gcStore.startTime.controls?.control2 ?? "");
    watch(
      [() => localControl1.value, () => localControl2.value],
      () => {
        recalculateResults();
      }
    );

    // FORMAT TIME INPUT:
    // Remove any non-digits, and if a leading "0" is present, drop it.
    // Then, format according to:
    //  • 1–2 digits: assume hour only (no colon yet)
    //  • 3 digits: if the first two digits form a valid hour (10–24), then use them as hour and the last as minute;
    //           otherwise, use the first digit as hour and the remaining two as minute.
    //  • 4 or more digits: use first two as hour and next two as minute.
    const formatTimeInput = () => {
      let digits = localBatchStartTime.value.replace(/\D/g, "");
      // Remove a leading 0, if present.
      if (digits.startsWith("0")) {
        digits = digits.slice(1);
      }
      if (!digits) {
        localBatchStartTime.value = "";
        return;
      }
      let formatted = "";
      if (digits.length <= 2) {
        formatted = digits;
      } else if (digits.length === 3) {
        const firstTwo = Number(digits.slice(0, 2));
        if (firstTwo >= 10 && firstTwo <= 24) {
          formatted = digits.slice(0, 2) + ":" + digits.slice(2);
        } else {
          formatted = digits.slice(0, 1) + ":" + digits.slice(1, 3);
        }
      } else {
        formatted = digits.slice(0, 2) + ":" + digits.slice(2, 4);
      }
      localBatchStartTime.value = formatted;
    };

    // VALIDATE TIME INPUT on blur:
    // Re-read digits and rebuild a valid "hh:mm" string.
    const validateTimeInput = () => {
      let digits = localBatchStartTime.value.replace(/\D/g, "");
      // Remove a leading 0 if present.
      if (digits.startsWith("0")) {
        digits = digits.slice(1);
      }
      let hour = "";
      let minute = "";
      if (!digits) {
        localBatchStartTime.value = "";
        return;
      }
      if (digits.length <= 2) {
        hour = digits;
        minute = "00";
      } else if (digits.length === 3) {
        const firstTwo = Number(digits.slice(0, 2));
        if (firstTwo >= 10 && firstTwo <= 24) {
          hour = digits.slice(0, 2);
          minute = digits.slice(2, 3).padStart(2, "0");
        } else {
          hour = digits.slice(0, 1);
          minute = digits.slice(1, 3);
        }
      } else {
        hour = digits.slice(0, 2);
        minute = digits.slice(2, 4);
      }
      const h = Number(hour);
      const m = Number(minute);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 24 || m < 0 || m > 59) {
        localBatchStartTime.value = "";
        timeInputError.value = "Invalid time. Enter a valid time between 00:00 and 24:59.";
        return;
      }
      localBatchStartTime.value = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    };

    const recalculateResults = () => {
      gcStore.calculateStartTimeBatch();
    };

    const setWait15 = (val) => {
      localWait15.value = val;
      recalculateResults();
    };

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

    const debouncedValidateControl1 = debounce(validateControl1, 300);
    const debouncedValidateControl2 = debounce(validateControl2, 300);

    const disabledPositionsComputed = computed(() => props.disabledPositions);

    // --- Keydown handler for the start time input ---
    // If the start time is empty and "0" is pressed, prevent it and shift focus to Control 1.
    const handleTimeKeydown = (event) => {
      if (event.key === "0" && localBatchStartTime.value === "") {
        event.preventDefault();
        if (control1InputRef.value) {
          control1InputRef.value.focus();
        }
      }
    };

    // --- Keydown handler for the control inputs ---
    // For control1: if empty and "0" is pressed, prevent it and move focus to Control 2.
    // For control2: if empty and "0" is pressed, simply prevent it.
    const handleControlKeydown = (field, event) => {
      if (event.key === "0") {
        if (field === "control1" && localControl1.value === "") {
          event.preventDefault();
          if (control2InputRef.value) {
            control2InputRef.value.focus();
          }
        } else if (field === "control2" && localControl2.value === "") {
          event.preventDefault();
        }
      }
    };

    // Create refs for the control input elements.
    const control1InputRef = ref(null);
    const control2InputRef = ref(null);

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
      handleTimeKeydown,
      handleControlKeydown,
      control1Input: control1InputRef,
      control2Input: control2InputRef,
    };
  },
};
</script>

<style scoped>
.heading-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: -2px;
}

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

label {
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.12);
}
</style>
