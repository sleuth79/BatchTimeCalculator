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
      <span v-if="displayTotalRuns">
        &nbsp;| Total Runs (Including Controls):
        <span class="result-value">{{ results.totalRuns }}</span>
      </span>
    </p>
    <!-- Additional details -->
    <p v-if="showDetailedResults && results.totalRunTime">
      Total Run Time:
      <span class="result-value">{{ results.totalRunTime }}</span>
    </p>
    <p v-if="showDetailedResults && results.batchEndTime">
      Batch End Time:
      <span class="result-value" :class="{ 'highlight-orange': initialBatchEndTimeAfter730 }">
        {{ displayBatchEndTime }}
      </span>
    </p>
    <!-- Display Closest Position Before 4:00 PM using the candidateDisplay computed property -->
    <p v-if="showDetailedResults && candidateDisplay && displayFinalPosition">
      Closest Position Before 4:00 PM:
      <span class="result-value">
        <template v-if="typeof candidateDisplay === 'object'">
          {{ candidateDisplay.displayedPosition }} :
          {{ candidateDisplay.startTime }} to
          {{ candidateDisplay.endTime }}
        </template>
        <template v-else>
          {{ candidateDisplay }}
        </template>
      </span>
    </p>
    <div v-if="showDetailedResults && results.timeGapTo730AM && !delayedRunsExist && !additionalRunsExistBool">
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
// We no longer rely on the store for the candidate value, so we only import what's needed.
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
    }
  },
  setup(props) {
    // Using the store for a few values (like controls) if needed.
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

    const showDetailedResults = computed(() => {
      return /^\d{2}:\d{2}/.test(displayBatchStartTime.value);
    });

    const displayFinalPosition = computed(() => {
      return props.results.startTimeFinalPosition || props.startTime.finalPosition || "";
    });

    const displayTotalRuns = computed(() => !!props.results.totalRuns);
    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    // Use the store's controls directly.
    const displayControls = computed(() => {
      const ctrl1 = gcStore.startTime.controls.control1;
      const ctrl2 = gcStore.startTime.controls.control2;
      if (ctrl1 == null || ctrl2 == null || ctrl1 === "" || ctrl2 === "") {
        return "";
      }
      return `${ctrl1}, ${ctrl2}`;
    });

    // Instead of using the store for candidate display, we derive it from the results.
    // Ensure that the results object includes a property `closestPositionBefore4PM`.
    const candidateDisplay = computed(() => {
      return props.results.closestPositionBefore4PM || "No Sample Position Ends Before 4:00 PM";
    });

    const displayBatchEndTime = computed(() => {
      if (!props.results.batchEndTime) return "";
      const batchEndStr = props.results.batchEndTime;
      const startStr = displayBatchStartTime.value;
      if (!startStr) {
        return `${batchEndStr} (${currentDate.value})`;
      }
      const startParts = startStr.split(":");
      if (startParts.length < 3) return `${batchEndStr} (${currentDate.value})`;
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
      let endDateCandidate = new Date(`${startDate.toDateString()} ${batchEndStr}`);
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
      let endDateCandidate = new Date(`${startDate.toDateString()} ${props.results.batchEndTime}`);
      if (isNaN(endDateCandidate.getTime())) return false;
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      if (endDateCandidate.getDate() === startDate.getDate()) return false;
      const endHour = endDateCandidate.getHours();
      const endMinute = endDateCandidate.getMinutes();
      return endHour > 7 || (endHour === 7 && endMinute >= 30);
    });

    const showStartTimeFinalPosition = computed(() => true);

    return {
      currentDate,
      displayBatchStartTime,
      displayFinalPosition,
      displayTotalRuns,
      additionalRunsExistBool,
      displayControls,
      candidateDisplay,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showStartTimeFinalPosition,
      showDetailedResults,
      results: props.results
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
