<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Batch Start Time (unchanged) -->
      <div class="input-group">
        <label for="batch-start-time">Batch Start Time:</label>
        <div class="time-input">
          <input
            type="text"
            id="batch-start-time"
            v-model="localBatchStartTime"
            placeholder="HH:mm:ss"
            @input="formatTimeInput"
          />
          <div class="ampm-selector">
            <div
              class="ampm-box"
              :class="{ selected: localBatchStartTimeAMPM === 'AM' }"
              @click="setAmPm('AM')"
            >
              AM
            </div>
            <div
              class="ampm-box"
              :class="{ selected: localBatchStartTimeAMPM === 'PM' }"
              @click="setAmPm('PM')"
            >
              PM
            </div>
          </div>
        </div>
      </div>

      <!-- Wait input (unchanged) -->
      <div class="input-group wait-input" v-if="showWaitInput">
        <label>15-Minute Wait:</label>
        <div class="wait-selector">
          <div
            class="wait-box"
            :class="{ selected: localWait15 }"
            @click="setWait15(true)"
          >
            Yes
          </div>
          <div
            class="wait-box"
            :class="{ selected: !localWait15 }"
            @click="setWait15(false)"
          >
            No
          </div>
        </div>
      </div>

      <!-- Final Position Toggle -->
      <div class="input-group">
        <label>Final Position:</label>
        <div class="toggle-final-position">
          <div
            class="toggle-box"
            :class="{ selected: finalPositionActive }"
            @click="setFinalPositionActive(true)"
          >
            On
          </div>
          <div
            class="toggle-box"
            :class="{ selected: !finalPositionActive }"
            @click="setFinalPositionActive(false)"
          >
            Off
          </div>
        </div>
        <div class="error-message">{{ startTimeFinalPositionError }}</div>
      </div>
    </div>
    <div v-else>Loading...</div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted } from "vue";
import { useGcStore } from "../store";

export default {
  name: "StartTimeInput",
  setup(_, { emit }) {
    const gcStore = useGcStore();
    const startTimeFinalPositionError = ref("");

    const isLoading = computed(() => gcStore.isLoading);

    const localBatchStartTime = computed({
      get() {
        return gcStore.startTime.batchStartTime || "";
      },
      set(val) {
        gcStore.setBatchStartTime(val);
      },
    });

    const localBatchStartTimeAMPM = computed({
      get() {
        return gcStore.startTime.batchStartTimeAMPM || "AM";
      },
      set(val) {
        gcStore.setBatchStartTimeAMPM(val);
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

    // Allowed positions remain for reference (could be used for a default value)
    const allowedFinalPositions = [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30, 31, 32,
    ];

    // New toggle for final position
    const finalPositionActive = ref(false);
    const setFinalPositionActive = (val) => {
      finalPositionActive.value = val;
    };

    // Watch the toggle and update the store's final position accordingly
    watch(finalPositionActive, (newVal) => {
      if (!newVal) {
        gcStore.setFinalPosition(null);
      } else {
        // Use a default value – here, the first allowed position.
        gcStore.setFinalPosition(allowedFinalPositions[0]);
      }
      recalculateResults();
    });

    const isFormValid = computed(() => {
      return (
        localBatchStartTime.value &&
        gcStore.startTime.finalPosition !== null &&
        !startTimeFinalPositionError.value
      );
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

    watch([localBatchStartTime, localBatchStartTimeAMPM], () => {
      recalculateResults();
    });

    watch(localWait15, () => {
      recalculateResults();
    });

    watch(
      () => gcStore.startTime.finalPosition,
      (newFinalPosition) => {
        if (newFinalPosition !== null) {
          emitUpdateResultsIfValid();
        }
      }
    );

    const formatTimeInput = () => {
      let value = localBatchStartTime.value.replace(/\D/g, "");
      if (value.length > 4) {
        value =
          value.slice(0, 2) + ":" + value.slice(2, 4) + ":" + value.slice(4, 6);
      } else if (value.length > 2) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4);
      }
      localBatchStartTime.value = value.slice(0, 8);
      if (localBatchStartTime.value.length === 8) {
        validateTimeInput();
      }
    };

    const validateTimeInput = () => {
      const parts = localBatchStartTime.value.split(":").map(Number);
      if (
        parts.length !== 3 ||
        isNaN(parts[0]) ||
        isNaN(parts[1]) ||
        isNaN(parts[2]) ||
        parts[0] < 0 ||
        parts[0] > 23 ||
        parts[1] < 0 ||
        parts[1] > 59 ||
        parts[2] < 0 ||
        parts[2] > 59
      ) {
        localBatchStartTime.value = "";
        alert("Invalid time. Enter a valid time in HH:mm:ss format.");
      }
    };

    const emitUpdateResultsIfValid = () => {
      gcStore.calculateStartTimeBatch();
    };

    const recalculateResults = () => {
      gcStore.calculateStartTimeBatch();
    };

    const setAmPm = (value) => {
      localBatchStartTimeAMPM.value = value;
    };

    const setWait15 = (val) => {
      localWait15.value = val;
      recalculateResults();
    };

    onMounted(() => {
      if (!localBatchStartTimeAMPM.value) {
        setAmPm("AM");
      }
    });

    return {
      localBatchStartTime,
      localBatchStartTimeAMPM,
      localWait15,
      startTimeFinalPositionError,
      isLoading,
      formatTimeInput,
      allowedFinalPositions,
      recalculateResults,
      showWaitInput,
      setAmPm,
      setWait15,
      finalPositionActive,
      setFinalPositionActive,
    };
  },
};
</script>

<style scoped>
.time-input input {
  width: 90px;
}

.ampm-selector {
  display: flex;
  gap: 5px;
  margin-left: 5px;
}

.ampm-box {
  border: 1px solid #ccc;
  padding: 5px 10px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
}

.ampm-box.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

.ampm-box:hover {
  background-color: #f0f0f0;
}

.input-group.wait-input {
  display: flex;
  align-items: center;
}

.wait-selector {
  display: flex;
  gap: 5px;
  margin-left: 10px;
}

.wait-box {
  border: 1px solid #ccc;
  padding: 5px 10px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  border-radius: 4px;
  background-color: #fff;
}

.wait-box:hover {
  background-color: #f0f0f0;
}

.wait-box.selected {
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

/* Toggle styles for Final Position */
.toggle-final-position {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.toggle-box {
  border: 1px solid #ccc;
  padding: 5px 10px;
  cursor: pointer;
  user-select: none;
  font-size: 1rem;
  border-radius: 4px;
  background-color: #fff;
  transition: background-color 0.2s ease;
}

.toggle-box.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

.toggle-box:hover {
  background-color: #f0f0f0;
}

/* Generic Label */
label {
  font-weight: bold;
}
</style>
