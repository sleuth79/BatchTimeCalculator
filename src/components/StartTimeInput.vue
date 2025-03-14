<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Batch Start Time Input -->
      <div class="input-group">
        <label for="batch-start-time">Batch Start Time:</label>
        <div class="time-input">
          <input
            type="text"
            id="batch-start-time"
            v-model="localBatchStartTime"
            placeholder="hh:mm:ss"
            @input="formatTimeInput"
            @blur="validateTimeInput"
          />
          <span class="time-input-note">
            Enter 24 Hour Time (ie. 09:30:00)
            <span v-if="timeInputError" class="error-message">
              - {{ timeInputError }}
            </span>
          </span>
        </div>
      </div>

      <!-- 15-Minute Wait Toggle -->
      <div class="input-group wait-input" v-if="showWaitInput">
        <label>15-Minute Wait:</label>
        <div class="wait-toggle" :class="{ on: localWait15 }" @click="setWait15(!localWait15)">
          <span>{{ localWait15 ? 'Yes' : 'No' }}</span>
        </div>
      </div>

      <!-- Final Position Selector -->
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

    // Use the store's batchStartTime, assuming it's stored as a 24-hour time string.
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
        return gcStore.startTime.wait15 || false;
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

    // Reactive variable for the final position.
    const finalPosition = ref(null);

    watch(finalPosition, (newVal) => {
      gcStore.startTime.finalPosition = newVal;
      recalculateResults();
    });

    watch(
      () => gcStore.selectedGc,
      (newGc) => {
        if (newGc && gcStore.allGcData[newGc]?.type === "Energy") {
          localWait15.value = true;
        } else if (newGc && gcStore.allGcData[newGc]?.type === "Sulphur") {
          localWait15.value = false;
        }
        recalculateResults();
      }
    );

    watch(localBatchStartTime, () => {
      recalculateResults();
    });

    watch(localWait15, () => {
      recalculateResults();
    });

    // Clear error when input is reset via store.
    watch(() => gcStore.startTimeResetCounter, () => {
      timeInputError.value = "";
    });

    // Formats input to HH:mm:ss format.
    const formatTimeInput = () => {
      let value = localBatchStartTime.value.replace(/\D/g, "");
      if (value.length > 4) {
        value =
          value.slice(0, 2) +
          ":" +
          value.slice(2, 4) +
          ":" +
          value.slice(4, 6);
      } else if (value.length > 2) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4);
      }
      localBatchStartTime.value = value.slice(0, 8);
      // Clear previous error as user types
      timeInputError.value = "";
      // If user has typed at least 7 characters (almost complete), validate the input
      if (localBatchStartTime.value.length >= 7) {
        validateTimeInput();
      }
    };

    // Validates that the time is in a proper HH:mm:ss format.
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

    return {
      localBatchStartTime,
      localWait15,
      startTimeFinalPositionError,
      timeInputError,
      isLoading,
      formatTimeInput,
      allowedFinalPositions,
      recalculateResults,
      showWaitInput,
      setWait15,
      finalPosition,
    };
  },
};
</script>

<style scoped>
.time-input {
  display: flex;
  align-items: center;
}

.time-input input {
  width: 90px;
  height: 36px; /* Fixed height */
  text-align: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.time-input-note {
  margin-left: 10px;
  font-size: 0.8rem;
  color: #181818;
  font-weight: bold;
}

.error-message {
  color: red;
  font-size: 0.8rem;
  margin-left: 5px;
}

.input-group.wait-input {
  display: flex;
  align-items: center;
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
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.wait-toggle.on {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

.start-time-results p {
  margin-bottom: 2px !important;
  line-height: 1.2 !important;
  font-size: 1rem !important;
  color: #333;
}

.result-value {
  font-weight: bold;
}

.input-group {
  margin-bottom: 10px;
}

label {
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.15);
}
</style>
