<template>
  <div class="start-time-results">
    <!-- Always display Start Time and Final Position headings -->
    <p>
      Start Time:
      <span class="result-value">{{ displayBatchStartTime }}</span>
    </p>
    <p>
      Final Position:
      <span class="result-value">{{ displayFinalPosition }}</span>
      <span v-if="displayTotalRuns">
        &nbsp;| Total Runs (Including Controls):
        <span class="result-value">{{ results.totalRuns }}</span>
      </span>
    </p>
    <!-- Only render these fields if they have values -->
    <p v-if="results.totalRunTime">
      Total Run Time:
      <span class="result-value">{{ results.totalRunTime }}</span>
    </p>
    <p v-if="results.batchEndTime">
      Batch End Time:
      <span class="result-value">{{ results.batchEndTime }}</span>
    </p>
    <p v-if="results.closestPositionBefore4PM || closestPositionDisplay">
      Closest Position Before 4:00 PM:
      <span class="result-value">
        <template v-if="isClosestPositionObject">
          {{ results.closestPositionBefore4PM.position }}
          <span
            v-if="results.closestPositionBefore4PM.startTime && results.closestPositionBefore4PM.endTime"
          >
            ({{ results.closestPositionBefore4PM.startTime }} to {{ results.closestPositionBefore4PM.endTime }})
          </span>
        </template>
        <template v-else>
          {{ closestPositionDisplay }}
        </template>
      </span>
    </p>
    <!-- Show the initial batch time gap only if data exists, no delayed runs, and no additional runs -->
    <div
      v-if="results.timeGapTo730AM && !delayedRunsExist && !additionalRunsExistBool"
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
import { ref, computed } from "vue";

export default {
  name: "StartTimeResults",
  props: {
    results: {
      type: Object,
      default: () => ({}),
    },
    startTime: {
      type: Object,
      default: () => ({}),
    },
    selectedGcData: {
      type: Object,
      default: null,
    },
    delayedRunsExist: {
      type: Boolean,
      default: false,
    },
    additionalRunsExist: {
      type: [Boolean, Number],
      default: false,
    },
  },
  setup(props) {
    // A reactive property that updates every second
    const currentTime = ref(new Date());
    setInterval(() => {
      currentTime.value = new Date();
    }, 1000);

    // Current date as MM/DD/YYYY (not used for display in this component now)
    const currentDate = computed(() => new Date().toLocaleDateString());

    // If no start time is provided, return an empty string.
    const displayBatchStartTime = computed(() => {
      const storedTime =
        props.results.batchStartTime ||
        props.results.startTime ||
        props.startTime.batchStartTime ||
        props.startTime.startTime ||
        "";
      return storedTime;
    });

    const displayFinalPosition = computed(() => {
      return props.results.startTimeFinalPosition || props.startTime.finalPosition || "";
    });

    const displayTotalRuns = computed(() => !!props.results.totalRuns);

    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    const isClosestPositionObject = computed(() => {
      return (
        props.results &&
        props.results.closestPositionBefore4PM &&
        typeof props.results.closestPositionBefore4PM === "object" &&
        props.results.closestPositionBefore4PM.position !== undefined
      );
    });

    // Checks if the batch start time is after 4:00 PM.
    const closestPositionDisplay = computed(() => {
      const batchStart = props.results.batchStartTime || props.startTime.batchStartTime;
      if (batchStart) {
        const parts = batchStart.split(":");
        if (parts.length === 3) {
          const hour = parseInt(parts[0], 10);
          if (hour >= 16) {
            return "This Batch Started After 4:00 PM";
          }
        }
      }
      return props.results.closestPositionBefore4PM;
    });

    return {
      currentDate,
      displayBatchStartTime,
      displayFinalPosition,
      displayTotalRuns,
      additionalRunsExistBool,
      isClosestPositionObject,
      closestPositionDisplay,
    };
  },
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
</style>
