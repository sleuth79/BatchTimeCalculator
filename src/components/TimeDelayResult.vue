<template>
  <div class="time-delay-result" v-if="resultsComplete">
    <!-- Additional Runs Section -->
    <div
      v-if="timeDelayData.sequentialBatchActive ||
           timeDelayData.additionalRunsEndTime ||
           (timeDelayData.additionalRunsDuration !== null && timeDelayData.additionalRunsDuration !== '')"
    >
      <p class="section-heading"><strong>Additional Runs</strong></p>
      <div v-if="timeDelayData.sequentialBatchActive">
        <p>
          Final Position for Sequential Batch:
          <strong>{{ timeDelayData.sequentialFinalPosition }}</strong>
        </p>
      </div>
      <div>
        <!-- Always display headings for additional runs -->
        <p>
          Total Number of Additional Runs:
          <strong>{{ totalAdditionalRuns !== null ? totalAdditionalRuns : 'N/A' }}</strong>
        </p>
        <p>
          Total Duration of Additional Runs:
          <strong>{{ additionalRunsDurationFormatted !== '' ? additionalRunsDurationFormatted : 'N/A' }}</strong>
        </p>
        <p>
          Additional Runs End Time:
          <strong>
            {{ finalBatchEndTimeToDisplay }}
          </strong>
          <span class="result-date"> ({{ additionalRunsEndDate }})</span>
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
    
    <!-- Delayed Runs Section -->
    <div v-if="hasDelayedRuns">
      <hr v-if="timeDelayData.sequentialBatchActive || timeDelayData.additionalRunsEndTime" />
      <p class="section-heading"><strong>Delayed Runs</strong></p>
      <div>
        <!-- Use the passed-in props for displaying the delayed runs times -->
        <p v-if="propsDelayedTimesAvailable">
          Delayed Runs Time:
          <strong>
            {{ delayedRunsStartTime }} to {{ delayedRunsEndTime }}
          </strong>
        </p>
        <p v-if="propsDelayedTimesAvailable">
          Time Delay Required:
          <strong style="color: black;">
            {{ formattedTimeDelayRequired }}
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
    // Overall batch end time (passed from ResultsDisplay)
    finalBatchEndTime: {
      type: String,
      default: ''
    },
    // Delayed runs start and end times (passed from ResultsDisplay, which gets them from RunTable)
    delayedRunsStartTime: {
      type: String,
      default: ''
    },
    delayedRunsEndTime: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    // Reactive timeDelayResults from the store for additional run info
    const timeDelayData = computed(() => gcStore.timeDelayResults);

    const resultsComplete = computed(() => {
      return (
        (timeDelayData.value.sequentialBatchEndTime && timeDelayData.value.sequentialBatchEndTime !== '') ||
        (timeDelayData.value.delayedRunsEndTime && timeDelayData.value.delayedRunsEndTime !== '')
      );
    });

    // Compute sequential batch runs based on the final position.
    const sequentialBatchRuns = computed(() => {
      if (timeDelayData.value.sequentialFinalPosition !== null) {
        const seqPos = Number(timeDelayData.value.sequentialFinalPosition);
        return seqPos <= 15 ? seqPos + 2 : seqPos + 1;
      }
      return null;
    });

    // Computed property for the total additional runs.
    const totalAdditionalRuns = computed(() => {
      const miscAdditional = Number(gcStore.miscAdditionalRuns || 0);
      if (timeDelayData.value.sequentialFinalPosition !== null) {
        const seqPos = Number(timeDelayData.value.sequentialFinalPosition);
        const sequentialRuns = seqPos <= 15 ? seqPos + 2 : seqPos + 1;
        return sequentialRuns + miscAdditional;
      }
      return miscAdditional || null;
    });

    // Derive the GC runtime (in minutes) from selectedGcData.
    const runtimeMinutes = computed(() => {
      const data = gcStore.selectedGcData;
      return data ? parseFloat(data.runTime) : 0;
    });
    const runtimeSeconds = computed(() => Math.round(runtimeMinutes.value * 60));

    // Computed property for the formatted additional runs duration.
    const additionalRunsDurationFormatted = computed(() => {
      if (totalAdditionalRuns.value === null) return '';
      let durationSeconds = totalAdditionalRuns.value * runtimeSeconds.value;
      // If Energy GC is selected and sequential batch is in use, add 15 minutes (900 seconds)
      if (
        gcStore.selectedGcData &&
        gcStore.selectedGcData.type &&
        gcStore.selectedGcData.type.toLowerCase() === 'energy' &&
        timeDelayData.value.sequentialFinalPosition !== null
      ) {
        durationSeconds += 900;
      }
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);
      let formatted = '';
      if (hours > 0) formatted += `${hours}h `;
      formatted += `${minutes}m`;
      return formatted.trim();
    });

    // Use the passed-in finalBatchEndTime prop if provided; otherwise, fallback to store data.
    const finalTimeString = computed(() => {
      return props.finalBatchEndTime ||
        (timeDelayData.value.sequentialBatchActive
          ? timeDelayData.value.sequentialBatchEndTime
          : timeDelayData.value.additionalRunsEndTime) || '';
    });

    // For display, expose the final batch end time as-is.
    const finalBatchEndTimeToDisplay = computed(() => finalTimeString.value);

    // Compute the additional runs end date from the final time string.
    const additionalRunsEndDate = computed(() => {
      const timeString = finalTimeString.value;
      if (!timeString) return '';
      const parts = timeString.split(" ");
      if (parts.length < 2) return '';
      const timePart = parts[0];
      const meridiem = parts[1];
      const timeParts = timePart.split(":");
      if (timeParts.length < 2) return '';
      let hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
      if (meridiem.toUpperCase() === "PM" && hour < 12) {
        hour += 12;
      }
      if (meridiem.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
      }
      const today = new Date();
      let runEndDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        hour,
        minute,
        second
      );
      if (runEndDate < today) {
        runEndDate.setDate(runEndDate.getDate() + 1);
      }
      return runEndDate.toLocaleDateString();
    });

    // Check if the end time is after 7:30 AM using finalTimeString.
    const batchEndTimeAfter730 = computed(() => {
      const timeString = finalTimeString.value;
      if (!timeString) return false;
      const parts = timeString.split(" ");
      if (parts.length < 2) return false;
      const timePart = parts[0];
      const ampm = parts[1];
      const timeParts = timePart.split(":");
      if (timeParts.length < 2) return false;
      let hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) {
        hour += 12;
      }
      if (ampm.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
      }
      return hour > 7 || (hour === 7 && minute >= 30);
    });

    const formattedTimeDelayRequired = computed(() => {
      const val = timeDelayData.value.timeDelayRequired;
      if (val === '0 hours') {
        return 'No Time Delay Required';
      }
      if (val === '1 hours') {
        return '1 hour';
      }
      return val;
    });

    // Override the delayed runs condition to focus on the passed-in props.
    const hasDelayedRuns = computed(() => {
      return props.delayedRunsStartTime !== '' && props.delayedRunsEndTime !== '';
    });

    // Computed to check if props delayed times are available.
    const propsDelayedTimesAvailable = computed(() => {
      return props.delayedRunsStartTime !== '' && props.delayedRunsEndTime !== '';
    });

    return {
      timeDelayData,
      resultsComplete,
      sequentialBatchRuns,
      totalAdditionalRuns,
      additionalRunsDurationFormatted,
      hasDelayedRuns,
      batchEndTimeAfter730,
      additionalRunsEndDate,
      formattedTimeDelayRequired,
      finalBatchEndTimeToDisplay,
      // Expose the delayed runs times from props
      delayedRunsStartTime: props.delayedRunsStartTime,
      delayedRunsEndTime: props.delayedRunsEndTime,
      propsDelayedTimesAvailable
    };
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
  color: #000;
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
