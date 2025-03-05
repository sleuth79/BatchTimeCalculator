<template>
  <div class="start-time-results">
    <!-- Always display Start Time and Final Position headings -->
    <p>
      Start Time:
      <span class="result-value">{{ displayBatchStartTime }}</span>
      <span v-if="displayBatchStartTimeAMPM" class="result-value">&nbsp;{{ displayBatchStartTimeAMPM }}</span>
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
    <p v-if="results.closestPositionBefore4PM">
      Closest Position to 4:00 PM:
      <span class="result-value">
        <template v-if="isClosestPositionObject">
          {{ results.closestPositionBefore4PM.position }}
          <span v-if="results.closestPositionBefore4PM.startTime && results.closestPositionBefore4PM.endTime">
            ({{ results.closestPositionBefore4PM.startTime }} to {{ results.closestPositionBefore4PM.endTime }})
          </span>
        </template>
        <template v-else>
          {{ results.closestPositionBefore4PM }}
        </template>
      </span>
    </p>
    <!-- Show the initial batch time gap only if data exists, no delayed runs, and no additional runs -->
    <div v-if="results.timeGapTo730AM && !delayedRunsExist && !additionalRunsExistBool">
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
    displayBatchStartTime() {
      return this.results.batchStartTime || this.startTime.batchStartTime || "";
    },
    displayBatchStartTimeAMPM() {
      const time = this.results.batchStartTime || this.startTime.batchStartTime;
      return time ? (this.results.batchStartTimeAMPM || this.startTime.batchStartTimeAMPM || "AM") : "";
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
/* Default hr style */
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 5px 0;
  padding: 0;
}
/* Style for the hr above the time gap */
.time-gap-hr {
  margin-top: 0;
  margin-bottom: 5px;
}
</style>
