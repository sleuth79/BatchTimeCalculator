<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Header Row -->
      <div class="heading-row">
        <div class="heading-batch">Batch Start Time:</div>
        <div class="heading-controls">Enter Controls:</div>
      </div>
      
      <!-- Input Row -->
      <div class="input-row">
        <!-- Batch Start Time Input & Inline Note -->
        <div class="batch-time-input">
          <input
            type="text"
            id="batch-start-time"
            v-model="localBatchStartTime"
            placeholder="hh:mm:ss"
            @input="formatTimeInput"
            @blur="validateTimeInput"
          />
          <span class="time-input-note">Enter 24 Hour Time</span>
        </div>
        <!-- Controls Inputs -->
        <div class="controls-inputs">
          <div class="control-group">
            <label for="control1" class="control-label">1:</label>
            <input
              type="number"
              id="control1"
              v-model.number="control1"
              class="control-input"
              min="3"
              max="32"
            />
          </div>
          <div class="control-group">
            <label for="control2" class="control-label">2:</label>
            <input
              type="number"
              id="control2"
              v-model.number="control2"
              class="control-input"
              min="3"
              max="32"
            />
          </div>
        </div>
      </div>
      
      <!-- Additional Inputs -->
      <div class="input-group wait-input" v-if="showWaitInput">
        <label>15-Minute Wait:</label>
        <div class="wait-toggle" :class="{ on: localWait15 }" @click="setWait15(!localWait15)">
          <span>{{ localWait15 ? 'Yes' : 'No' }}</span>
        </div>
      </div>
      <div class="input-group">
        <label for="position-selector">Final Position:</label>
        <position-selector
          id="position-selector"
          :allowed-positions="allowedFinalPositions"
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

    // Bind Batch Start Time to the store.
    const localBatchStartTime = computed({
      get() {
        return gcStore.startTime.batchStartTime || "";
      },
      set(val) {
        gcStore.setBatchStartTime(val);
      },
    });

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

    // Bind Final Position to the store.
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
        timeInputError.value = "Invalid format. Enter time as hh:mm:ss, with a 0 in front, such as 09:30:00.";
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
        timeInputError.value = "Invalid time. Enter time as hh:mm:ss, with a 0 in front, such as 09:30:00.";
      }
    };

    const recalculateResults = () => {
      gcStore.calculateStartTimeBatch();
    };

    const setWait15 = (val) => {
      localWait15.value = val;
      recalculateResults();
    };

    // Computed properties for control inputs with constraint enforcement in the setter.
    const control1 = computed({
      get() {
        return gcStore.startTime.controls?.control1 ?? "";
      },
      set(val) {
        let num = Number(val);
        if (isNaN(num)) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control1: "" };
        } else if (num < 3) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control1: 3 };
        } else if (num > 32) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control1: 32 };
        } else if (num === 16) {
          // Skip 16 – default to 17.
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control1: 17 };
        } else {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control1: num };
        }
      }
    });

    const control2 = computed({
      get() {
        return gcStore.startTime.controls?.control2 ?? "";
      },
      set(val) {
        let num = Number(val);
        if (isNaN(num)) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control2: "" };
        } else if (num < 3) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control2: 3 };
        } else if (num > 32) {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control2: 32 };
        } else if (num === 16) {
          // Skip 16 – default to 17.
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control2: 17 };
        } else {
          gcStore.startTime.controls = { ...gcStore.startTime.controls, control2: num };
        }
      }
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
      control1,
      control2,
    };
  },
};
</script>

<style scoped>
.heading-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-weight: bold;
}
.heading-batch,
.heading-controls {
  flex: 1;
}
.input-row {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}
.batch-time-input {
  flex: 1;
  display: flex;
  align-items: center;
}
.batch-time-input input {
  width: 100px;
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
}
.control-group {
  display: flex;
  align-items: center;
  margin-right: 10px;
}
.control-label {
  font-size: 0.8rem;
  color: #181818;
  font-weight: bold;
  margin-right: 5px;
}
/* Increased specificity for control boxes */
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

