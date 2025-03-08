<template>
  <div class="start-time-results">
    <!-- Always display Start Time and Final Position headings -->
    <p>
      Start Time:
      <span class="result-value">{{ displayBatchStartTime }}</span>
      <span class="result-date">{{ currentDate }}</span>
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
    // Parent may be passing 0 or 1, so allow any type and coerce it.
    additionalRunsExist: {
      type: [Boolean, Number],
      default: false,
    },
  },
  computed: {
    // Computed property for the current date (formatted as MM/DD/YYYY)
    currentDate() {
      return new Date().toLocaleDateString();
    },
    displayBatchStartTime() {
      return this.results.batchStartTime || this.startTime.batchStartTime || "";
    },
    displayFinalPosition() {
      return this.results.startTimeFinalPosition || this.startTime.finalPosition || "";
    },
    displayTotalRuns() {
      return !!this.results.totalRuns;
    },
    additionalRunsExistBool() {
      return Boolean(this.additionalRunsExist);
    },
    isClosestPositionObject() {
      return (
        this.results &&
        this.results.closestPositionBefore4PM &&
        typeof this.results.closestPositionBefore4PM === "object" &&
        this.results.closestPositionBefore4PM.position !== undefined
      );
    },
    // Computed property to check if the batch start time is after 4:00 PM.
    closestPositionDisplay() {
      const batchStart = this.results.batchStartTime || this.startTime.batchStartTime;
      if (batchStart) {
        // Expecting batchStart to be in HH:mm:ss (24-hour format)
        const parts = batchStart.split(":");
        if (parts.length === 3) {
          const hour = parseInt(parts[0], 10);
          if (hour >= 16) {
            // Batch started at or after 16:00:00 (4:00 PM)
            return "This Batch Started After 4:00 PM";
          }
        }
      }
      // Otherwise, return whatever the results object provides
      return this.results.closestPositionBefore4PM;
    },
  },
};
</script>

<style scoped>
.start-time-results {
  padding: 0;
}
.start-time-results p {
  margin-bottom: 0px;
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
}
.result-value {
  font-weight: bold;
  font-size: 1rem;
}
/* Updated the date style to be bold without any dash preceding it */
.result-date {
  font-weight: bold;
  font-size: 1rem;
  margin-left: 5px;
}

/* Update hr style to add more space */
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
