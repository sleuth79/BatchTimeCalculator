<template>
  <!-- Only display results if resultsComplete is true -->
  <div class="time-delay-result" v-if="resultsComplete">
    <!-- Additional Runs Section -->
    <div v-if="timeDelayData.sequentialBatchActive || timeDelayData.additionalRunsEndTime">
      <p class="section-heading"><strong>Additional Runs</strong></p>
      <div v-if="timeDelayData.sequentialBatchActive">
        <p>
          Final Position for Sequential Batch:
          <strong>{{ timeDelayData.sequentialFinalPosition }}</strong>
          <span v-if="sequentialBatchRuns !== null">
            &nbsp;| Total Runs (Including Controls):
            <strong>{{ sequentialBatchRuns }}</strong>
          </span>
        </p>
      </div>
      <div>
        <p v-if="Number(timeDelayData.additionalRuns) > 0">
          Additional Runs:
          <strong>{{ timeDelayData.additionalRuns }}</strong>
        </p>
        <!-- Flip the order: Total Runs comes first -->
        <p v-if="timeDelayData.totalRuns">
          {{ totalRunsHeading }}:
          <strong>{{ timeDelayData.totalRuns }}</strong>
        </p>
        <p>
          <template v-if="timeDelayData.sequentialBatchActive">
            Additional Runs End Time:
            <strong>{{ timeDelayData.sequentialBatchEndTime }}</strong>
            <span class="result-date"> ({{ additionalRunsEndDate }})</span>
          </template>
          <template v-else>
            Additional Runs End Time:
            <strong>{{ timeDelayData.additionalRunsEndTime }}</strong>
            <span class="result-date"> ({{ additionalRunsEndDate }})</span>
          </template>
        </p>
      </div>
      <!-- Display time gap if additional runs exist and no delayed runs -->
      <div v-if="timeDelayData.timeGapTo730AM && !hasDelayedRuns">
        <hr class="time-gap-hr" />
        <p>
          Time Gap to 7:30 AM:
          <strong>{{ timeDelayData.timeGapTo730AM }}</strong>
        </p>
      </div>
    </div>
    
    <!-- Delayed Runs Section: only display if valid delayed runs exist -->
    <div v-if="hasDelayedRuns">
      <hr v-if="timeDelayData.sequentialBatchActive || timeDelayData.additionalRunsEndTime" />
      <p class="section-heading"><strong>Delayed Runs</strong></p>
      <div>
        <p v-if="timeDelayData.timeGapTo730AM">
          Time Gap to 7:30 AM:
          <strong>{{ timeDelayData.timeGapTo730AM }}</strong>
        </p>
        <p>
          Delayed Runs:
          <strong>{{ timeDelayData.prerunsDescription }}</strong>
        </p>
        <p>
          Total Number of Delayed Runs:
          <strong>{{ timeDelayData.totalDelayedRuns }}</strong>
        </p>
        <p>
          Total Duration of Delayed Runs:
          <strong>{{ timeDelayData.totalDelayedDurationFormatted }}</strong>
        </p>
        <!-- Combined heading for delayed runs start and end time with date -->
        <p v-if="Number(timeDelayData.totalDelayedRuns) > 0">
          Delayed Runs Time:
          <strong>
            {{ timeDelayData.delayedRunsStartTime }} to {{ timeDelayData.delayedRunsEndTime }}
          </strong>
          <span class="result-date"> ({{ delayedRunsDate }})</span>
        </p>
        <p v-if="Number(timeDelayData.totalDelayedRuns) > 0">
          Time Delay Required:
          <strong class="highlight-green">
            {{ timeDelayData.timeDelayRequired === '0 hours' ? 'No Time Delay Required' : timeDelayData.timeDelayRequired }}
          </strong>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useGcStore } from '../store';

export default {
  name: 'TimeDelayResult',
  props: {
    timeDelayData: {
      type: Object,
      required: true,
    },
  },
  setup() {
    const gcStore = useGcStore();
    return {};
  },
  computed: {
    // Only show results if sequentialBatchEndTime is non-empty.
    resultsComplete() {
      return (
        this.timeDelayData.sequentialBatchEndTime &&
        this.timeDelayData.sequentialBatchEndTime !== ''
      );
    },
    sequentialBatchRuns() {
      if (this.timeDelayData.sequentialFinalPosition !== null) {
        const seqPos = Number(this.timeDelayData.sequentialFinalPosition);
        return seqPos <= 15 ? seqPos + 2 : seqPos + 1;
      }
      return null;
    },
    totalRunsHeading() {
      return "Total Runs (Initial Batch + Additional Runs)";
    },
    hasDelayedRuns() {
      const description = this.timeDelayData.prerunsDescription;
      const totalDelayed = Number(this.timeDelayData.totalDelayedRuns);
      return (
        (description &&
          description.trim() !== '' &&
          description !== 'None' &&
          description !== 'Delayed Runs') ||
        (totalDelayed > 0)
      );
    },
    // Computed property for the Additional Runs End Date (assumed to be the next day)
    additionalRunsEndDate() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toLocaleDateString();
    },
    // Computed property for the Delayed Runs Date.
    // Based on the additional runs end date, add one extra day if the additional runs end time is after 7:30 AM.
    delayedRunsDate() {
      // Start with the date from additionalRunsEndDate as a Date object.
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1); // This is the additional runs date.
      const additionalEnd = this.timeDelayData.additionalRunsEndTime;
      if (additionalEnd) {
        const parts = additionalEnd.split(" ");
        if (parts.length >= 2) {
          const timePart = parts[0]; // e.g. "01:11:12"
          const ampm = parts[1];
          let [hour, minute] = timePart.split(":").map(Number);
          if (ampm.toUpperCase() === "PM" && hour < 12) {
            hour += 12;
          }
          if (ampm.toUpperCase() === "AM" && hour === 12) {
            hour = 0;
          }
          // If the additional runs end time is after 7:30 AM, then delayed runs wrap to the next day.
          if (hour > 7 || (hour === 7 && minute >= 30)) {
            baseDate.setDate(baseDate.getDate() + 1);
          }
        }
      }
      return baseDate.toLocaleDateString();
    },
  },
};
</script>

<style scoped>
.time-delay-result {
  margin: 0;
  padding: 0;
}

.section-heading {
  margin: 0 0 5px 0;
  font-size: 1rem;
  line-height: 1.2;
  color: #333;
}

.time-delay-result p {
  margin-bottom: 2px !important;
  line-height: 1.2 !important;
  font-size: 1rem !important;
  color: #333;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 10px 0;
  padding: 0;
}

.highlight-green {
  color: var(--highlight-color);
}

.time-gap-hr {
  border-top: 1px solid #ccc;
}

.result-date {
  font-weight: bold;
  font-size: 1rem;
  margin-left: 5px;
}
</style>

<style>
#timeDelayOverride .explanation {
  font-size: 0.9rem !important;
  color: #57ca48 !important;
  margin-top: 10px !important;
}
</style>
