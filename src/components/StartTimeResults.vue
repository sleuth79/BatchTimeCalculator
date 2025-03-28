<template>
  <div class="start-time-results">
    <!-- Always display Batch Start Time -->
    <p>
      Batch Start Time:
      <span class="result-value">{{ displayBatchStartTime }}</span>
    </p>
    <!-- Controls heading; shows the controls once both are set -->
    <p>
      Controls:
      <span class="result-value">{{ displayControls }}</span>
    </p>
    <!-- Always display Final Position -->
    <p>
      Final Position:
      <span class="result-value">{{ displayFinalPosition }}</span>
    </p>
    <!-- Additional details -->
    <p v-if="showDetailedResults && results.totalRunTime">
      Total Run Time:
      <span class="result-value">{{ results.totalRunTime }}</span>
    </p>
    <p v-if="showDetailedResults && results.batchEndTime">
      Batch End Time:
      <span
        class="result-value"
        :class="{ 'highlight-orange': initialBatchEndTimeAfter730 }"
      >
        {{ displayBatchEndTime }}
      </span>
    </p>
    <!-- Display candidate heading only if batch passes 4:00 PM -->
    <p v-if="showDetailedResults && displayFinalPosition && batchPasses4PM">
      {{ candidateDisplayLabel }}
      <span class="result-value">
        <template v-if="candidateDisplayLabel === 'This Batch Ends At:'">
          {{ results.batchEndTime }}
        </template>
        <template v-else>
          {{ runtableClosestPositionFull }}
        </template>
      </span>
    </p>
    <div
      v-if="showDetailedResults && results.timeGapTo730AM && !delayedRunsExist && !additionalRunsExistBool"
    >
      <hr class="time-gap-hr" />
      <p>
        Time Gap to 7:30 AM:
        <span class="result-value">{{ results.timeGapTo730AM }}</span>
      </p>
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { useGcStore } from "../store";

export default {
  name: "StartTimeResults",
  props: {
    results: {
      type: Object,
      default: () => ({})
    },
    // You can still pass startTime for other computed values if needed.
    startTime: {
      type: Object,
      default: () => ({})
    },
    selectedGcData: {
      type: Object,
      default: null
    },
    delayedRunsExist: {
      type: Boolean,
      default: false
    },
    additionalRunsExist: {
      type: [Boolean, Number],
      default: false
    },
    // Prop to receive the full closest position string from the run table
    runtableClosestPositionFull: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    const currentDate = computed(() => new Date().toLocaleDateString());

    const displayBatchStartTime = computed(() => {
      return (
        props.results.batchStartTime ||
        props.results.startTime ||
        props.startTime.batchStartTime ||
        props.startTime.startTime ||
        ""
      );
    });

    // Relaxed regex to allow optional seconds and AM/PM.
    const showDetailedResults = computed(() => {
      return /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:AM|PM))?$/.test(displayBatchStartTime.value);
    });

    const displayFinalPosition = computed(() => {
      return (
        props.results.startTimeFinalPosition ||
        props.startTime.finalPosition ||
        ""
      );
    });

    const displayTotalRuns = computed(() => !!props.results.totalRuns);
    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    // Updated displayControls: format as "X  | Y" with left control padded to 2 characters.
    const displayControls = computed(() => {
      const ctrl1 = gcStore.startTime.controls.control1;
      const ctrl2 = gcStore.startTime.controls.control2;
      if (ctrl1 == null || ctrl2 == null || ctrl1 === "" || ctrl2 === "") {
        return "";
      }
      const ctrl1Str = ctrl1.toString().padEnd(2, " ");
      return `${ctrl1Str} | ${ctrl2}`;
    });

    const displayBatchEndTime = computed(() => {
      if (!props.results.batchEndTime) return "";
      const batchEndStr = props.results.batchEndTime;
      const startStr = displayBatchStartTime.value;
      if (!startStr) {
        return `${batchEndStr} (${currentDate.value})`;
      }
      const startParts = startStr.split(":");
      if (startParts.length < 3)
        return `${batchEndStr} (${currentDate.value})`;
      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const startSecond = parseInt(startParts[2], 10);
      const today = new Date();
      const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        startHour,
        startMinute,
        startSecond
      );
      let endDateCandidate = new Date(
        `${startDate.toDateString()} ${batchEndStr}`
      );
      if (isNaN(endDateCandidate.getTime())) {
        return `${batchEndStr} (${currentDate.value})`;
      }
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      const endDateString = endDateCandidate.toLocaleDateString();
      return `${batchEndStr} (${endDateString})`;
    });

    const initialBatchEndTimeAfter730 = computed(() => {
      if (!props.results.batchEndTime) return false;
      const batchEndStr = props.results.batchEndTime;
      const startStr = displayBatchStartTime.value;
      if (!startStr) return false;
      const startParts = startStr.split(":");
      if (startParts.length < 3) return false;
      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const startSecond = parseInt(startParts[2], 10);
      const today = new Date();
      const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        startHour,
        startMinute,
        startSecond
      );
      let endDateCandidate = new Date(
        `${startDate.toDateString()} ${props.results.batchEndTime}`
      );
      if (isNaN(endDateCandidate.getTime())) return false;
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      if (endDateCandidate.getDate() === startDate.getDate()) return false;
      const endHour = endDateCandidate.getHours();
      const endMinute = endDateCandidate.getMinutes();
      return endHour > 7 || (endHour === 7 && endMinute >= 30);
    });

    // New computed property to determine if the batch passes 4:00 PM.
    const batchPasses4PM = computed(() => {
      if (!props.results.batchEndTime) return false;
      const parts = props.results.batchEndTime.split(" ");
      if (parts.length < 2) return false;
      const timePart = parts[0]; // e.g., "02:22:26"
      const ampm = parts[1]; // e.g., "PM"
      const timeParts = timePart.split(":");
      if (timeParts.length < 2) return false;
      let hour = parseInt(timeParts[0], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) {
        hour += 12;
      }
      if (ampm.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
      }
      // 4:00 PM in 24-hour time is 16:00.
      return hour >= 16;
    });

    // Computed property to decide which candidate label to show.
    const candidateDisplayLabel = computed(() => {
      if (
        props.runtableClosestPositionFull &&
        props.runtableClosestPositionFull.startsWith("No candidate found")
      ) {
        return "This Batch Ends At:";
      }
      return "Closest Position Before 4:00 PM:";
    });

    return {
      currentDate,
      displayBatchStartTime,
      displayFinalPosition,
      displayTotalRuns,
      additionalRunsExistBool,
      displayControls,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showDetailedResults,
      candidateDisplayLabel,
      batchPasses4PM
    };
  }
};
</script>

<style scoped>
.start-time-results {
  padding: 0;
}
.start-time-results p {
  margin-bottom: 0;
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
}
.result-value {
  font-weight: bold;
  font-size: 1rem;
}
.result-date {
  font-weight: bold;
  font-size: 1rem;
  margin-left: 5px;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 10px 0;
  padding: 0;
}
.time-gap-hr {
  margin-top: 10px;
  margin-bottom: 10px;
}
.highlight-orange {
  color: orange;
}
</style>
