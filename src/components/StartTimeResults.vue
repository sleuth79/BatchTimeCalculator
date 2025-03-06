<template>
  <div class="start-time-results">
    <!-- Initial Batch heading appears once at the very top -->
    <p class="section-heading initial-batch-heading"><strong>Initial Batch</strong></p>
    
    <!-- If Selected GC is to be shown within this component, you can include it here. 
         Otherwise, remove this block if Selected GC info is rendered elsewhere. -->
    <p v-if="selectedGcDisplay" class="selected-gc">
      Selected GC: <span class="result-value">{{ selectedGcDisplay }}</span>
    </p>
    
    <!-- Always display Start Time and Final Position details -->
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
    <p v-if="results.totalRunTime">
      Total Run Time:
      <span class="result-value">{{ results.totalRunTime }}</span>
    </p>
    <p v-if="results.batchEndTime">
      Batch End Time:
      <span class="result-value">{{ results.batchEndTime }}</span>
    </p>
    <p v-if="results.closestPositionBefore4PM || closestPositionDisplay">
      Closest Position to 4:00 PM:
      <span class="result-value">
        <template v-if="isClosestPositionObject">
          {{ results.closestPositionBefore4PM.position }}
          <span v-if="results.closestPositionBefore4PM.startTime && results.closestPositionBefore4PM.endTime">
            ({{ results.closestPositionBefore4PM.startTime }} to {{ results.closestPositionBefore4PM.endTime }})
          </span>
        </template>
        <template v-else>
          {{ closestPositionDisplay }}
        </template>
      </span>
    </p>
    <!-- Separator line for time gap (with extra spacing) -->
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
    // If Selected GC info should be displayed here, pass it via this prop.
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
  computed: {
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
    // If you need to display Selected GC info from selectedGcData, for example:
    selectedGcDisplay() {
      return this.selectedGcData && this.selectedGcData.name ? this.selectedGcData.name : "";
    },
    isClosestPositionObject() {
      return (
        this.results &&
        this.results.closestPositionBefore4PM &&
        typeof this.results.closestPositionBefore4PM === "object" &&
        this.results.closestPositionBefore4PM.position !== undefined
      );
    },
    // Checks if the batch start time indicates a batch started after 4:00 PM.
    closestPositionDisplay() {
      const batchStart = this.results.batchStartTime || this.startTime.batchStartTime;
      if (batchStart) {
        // Expecting batchStart to be in HH:mm:ss (24-hour format)
        const parts = batchStart.split(":");
        if (parts.length === 3) {
          const hour = parseInt(parts[0], 10);
          if (hour >= 16) {
            return "This Batch Started After 4:00 PM";
          }
        }
      }
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
  margin-bottom: 0;
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
}
/* Heading style for sections */
.section-heading {
  margin: 0 0 5px 0;
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
}
/* Extra bottom margin for the Initial Batch heading */
.initial-batch-heading {
  margin-bottom: 10px;
}
.result-value {
  font-weight: bold;
  font-size: 1rem;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 10px 0;
  padding: 0;
}
/* Adjust spacing for the separator line */
.time-gap-hr {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
