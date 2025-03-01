<template>
  <div class="start-time-input">
    <div v-if="!isLoading">
      <!-- Always show batch-related inputs -->
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

      <!-- Only show wait input when an Energy GC is selected -->
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

      <!-- Final Position with Toggle -->
      <div class="input-group">
        <label for="position-selector">Final Position:</label>
        <button type="button" @click="toggleFinalPositionSelector">
          Toggle Position Selector
        </button>
        <position-selector
          v-if="showFinalPositionSelector"
          id="position-selector"
          :allowed-positions="allowedFinalPositions"
          mode="start-time"
          field="start-time"
        />
        <div class="error-message">{{ startTimeFinalPositionError }}</div>
      </div>
    </div>
    <div v-else>Loading...</div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted } from "vue";
import { useGcStore } from "../store";
import PositionSelector from "./PositionSelector.vue";

export default {
  name: "StartTimeInput",
  components: { PositionSelector },
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

    const allowedFinalPositions = [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30, 31, 32,
    ];

    // New reactive variable for toggling the final position selector
    const showFinalPositionSelector = ref(true);
    const toggleFinalPositionSelector = () => {
      showFinalPositionSelector.value = !showFinalPositionSelector.value;
    };

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
        value = value.slice(0, 2) + ":" + value.slice(2, 4) + ":" + value.slice(4, 6);
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
      showFinalPositionSelector,
      toggleFinalPositionSelector,
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

.input-group {
  margin-bottom: 10px;
}
</style>
