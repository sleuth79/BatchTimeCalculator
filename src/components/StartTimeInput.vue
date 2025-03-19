<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- ... other inputs ... -->
      <div class="input-group">
        <label for="position-selector">Final Position:</label>
        <position-selector
          id="position-selector"
          :allowed-positions="allowedFinalPositions"
          :disabledPositions="disabledPositions"
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

export default {
  name: "StartTimeInput",
  components: { PositionSelector },
  setup() {
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

    // Format and validate the time input.
    const formatTimeInput = () => {
      let value = localBatchStartTime.value.replace(/\D/g, "");
      if (value.length > 4) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4) + ":" + value.slice(4, 6);
      } else if (value.length > 2) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4);
      }
      localBatchStartTime.value = value.slice(0, 8);
      timeInputError.value = "";
      if (localBatchStartTime.value.length >= 7) {
        validateTimeInput();
      }
    };

    const validateTimeInput = () => {
      const timeString = localBatchStartTime.value;
      const parts = timeString.split(":");
      if (parts.length !== 3) {
        timeInputError.value =
          "Invalid format. Enter time as hh:mm:ss, with a 0 in front, such as 09:30:00.";
        return;
      }
      const [hour, minute, second] = parts.map(Number);
      if (
        isNaN(hour) ||
        isNaN(minute) ||
        isNaN(second) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
      ) {
        localBatchStartTime.value = "";
        timeInputError.value =
          "Invalid time. Enter time as hh:mm:ss, with a 0 in front, such as 09:30:00.";
      }
    };

    const recalculateResults = () => {
      gcStore.calculateStartTimeBatch();
    };

    const setWait15 = (val) => {
      localWait15.value = val;
      recalculateResults();
    };

    // --- New Local Control Inputs & Dynamic Allowed Ranges ---
    const localControl1 = ref(gcStore.startTime.controls?.control1 ?? "");
    const localControl2 = ref(gcStore.startTime.controls?.control2 ?? "");

    // Define allowed ranges:
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

    // Validation functions for controls on blur.
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

    // Compute disabled positions based on control values.
    const disabledPositions = computed(() => {
      const disabled = [];
      if (localControl1.value) disabled.push(Number(localControl1.value));
      if (localControl2.value) disabled.push(Number(localControl2.value));
      return disabled;
    });

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
      // Control bindings and dynamic ranges
      localControl1,
      localControl2,
      control1Range,
      control2Range,
      validateControl1,
      validateControl2,
      disabledPositions, // Added for passing to PositionSelector
    };
  },
};
</script>
