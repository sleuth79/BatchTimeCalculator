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
          <template v-if="timeDelayData.sequentialBatchActive">
            Additional Runs End Time:
            <strong :class="{ 'highlight-orange': batchEndTimeAfter730 }">
              {{ timeDelayData.sequentialBatchEndTime }}
            </strong>
            <span class="result-date"> ({{ additionalRunsEndDate }})</span>
          </template>
          <template v-else>
            Additional Runs End Time:
            <strong :class="{ 'highlight-orange': batchEndTimeAfter730 }">
              {{ timeDelayData.additionalRunsEndTime }}
            </strong>
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
    
    <!-- Delayed Runs Section -->
    <div v-if="hasDelayedRuns">
      <hr v-if="timeDelayData.sequentialBatchActive || timeDelayData.additionalRunsEndTime" />
      <p class="section-heading"><strong>Delayed Runs</strong></p>
      <div>
        <p v-if="timeDelayData.timeGapTo730AM">
          Time Gap to 7:30 AM:
          <strong>{{ timeDelayData.timeGapTo730AM }}</strong>
        </p>
        <p>
          Total Number of Delayed Runs:
          <strong>{{ timeDelayData.totalDelayedRuns }}</strong>
        </p>
        <p>
          Total Duration of Delayed Runs:
          <strong>{{ timeDelayData.totalDelayedDurationFormatted }}</strong>
        </p>
        <p v-if="Number(timeDelayData.totalDelayedRuns) > 0">
          Delayed Runs Time:
          <strong>
            {{ timeDelayData.delayedRunsStartTime }} to {{ timeDelayData.delayedRunsEndTime }}
          </strong>
        </p>
        <p v-if="Number(timeDelayData.totalDelayedRuns) > 0">
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
  setup() {
    const gcStore = useGcStore();
    // Reference the store's reactive timeDelayResults object.
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

    // We'll derive the GC runtime (in minutes) from selectedGcData.
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

    // For consistency, re-use your existing computed properties.
    const hasDelayedRuns = computed(() => {
      const description = timeDelayData.value.prerunsDescription;
      const totalDelayed = Number(timeDelayData.value.totalDelayedRuns);
      return (
        (description &&
          description.trim() !== '' &&
          description !== 'None' &&
          description !== 'Delayed Runs') ||
        (totalDelayed > 0)
      );
    });

    const additionalRunsEndDate = computed(() => {
      let timeString = timeDelayData.value.sequentialBatchActive
        ? timeDelayData.value.sequentialBatchEndTime
        : timeDelayData.value.additionalRunsEndTime;
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

    const batchEndTimeAfter730 = computed(() => {
      const todayStr = new Date().toLocaleDateString();
      if (additionalRunsEndDate.value === todayStr) {
        return false;
      }
      let timeString = timeDelayData.value.sequentialBatchActive
        ? timeDelayData.value.sequentialBatchEndTime
        : timeDelayData.value.additionalRunsEndTime;
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
.highlight-orange {
  color: orange;
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
