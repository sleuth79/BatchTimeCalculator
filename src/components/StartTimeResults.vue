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
    <!-- Detailed outputs: only displayed when start time is valid -->
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
    <!-- Updated: Display Closest Position Before 4:00 PM -->
    <p v-if="showDetailedResults && results.closestPositionBefore4PM && displayFinalPosition">
      Closest Position Before 4:00 PM:
      <span class="result-value">
        <template v-if="isClosestPositionObject">
          {{ results.closestPositionBefore4PM.position }} :
          {{ results.closestPositionBefore4PM.startTime || displayBatchStartTime }} to 
          {{ results.closestPositionBefore4PM.endTime }}
        </template>
        <template v-else>
          {{ closestPositionDisplay }}
        </template>
      </span>
    </p>
    <div v-if="showDetailedResults && results.timeGapTo730AM">
      <hr class="time-gap-hr" />
      <p>
        Time Gap to 7:30 AM:
        <span class="result-value">{{ results.timeGapTo730AM }}</span>
      </p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { calculateStartTimeBatch } from "./utils/startTimeBatch";

export default {
  name: "StartTimeResults",
  setup() {
    // Example input values—replace these with your actual data.
    const gc = {};               // Your GC object
    const runtime = "05:00";       // Runtime in "mm:ss" (or a decimal string)
    const currentRun = 1;
    const finalPosition = 20;      // Example final position
    const batchStartTime = "08:00:00"; // Batch start time string
    const ampm = "AM";
    const wait15 = false;

    // Create a ref to hold the results.
    const results = ref({});

    // Call the calculation function on mount.
    onMounted(() => {
      results.value = calculateStartTimeBatch(
        gc,
        runtime,
        currentRun,
        finalPosition,
        batchStartTime,
        ampm,
        wait15
      );
    });

    // Computed properties for display
    const displayBatchStartTime = computed(() => results.value.batchStartTime || "");
    
    const showDetailedResults = computed(() => {
      // Using a simple check to see if batchStartTime is in hh:mm format.
      return /^\d{2}:\d{2}$/.test(displayBatchStartTime.value);
    });
    
    const displayFinalPosition = computed(() => results.value.startTimeFinalPosition || "");
    
    const displayTotalRuns = computed(() => !!results.value.totalRuns);
    
    // If the closest position is an object (with run details) then display that,
    // otherwise fall back to a simple string message.
    const isClosestPositionObject = computed(() => {
      if (results.value.batchEndTime) {
        let batchEndStr = results.value.batchEndTime;
        let timePart = batchEndStr.split(" ")[0];
        let period = "";
        const periodMatch = batchEndStr.match(/\b(AM|PM)\b/i);
        if (periodMatch) {
          period = periodMatch[0].toUpperCase();
        }
        const parts = timePart.split(":");
        if (parts.length === 3) {
          let hour = parseInt(parts[0], 10);
          if (period === "PM" && hour < 12) hour += 12;
          if (period === "AM" && hour === 12) hour = 0;
          if (hour < 16) {
            return false;
          }
        }
      }
      return (
        results.value &&
        results.value.closestPositionBefore4PM &&
        typeof results.value.closestPositionBefore4PM === "object" &&
        results.value.closestPositionBefore4PM.position !== undefined
      );
    });
    
    // A fallback display if the closest position is not an object.
    const closestPositionDisplay = computed(() => {
      const batchStart = results.value.batchStartTime;
      if (batchStart) {
        const parts = batchStart.split(":");
        if (parts.length === 3) {
          const hour = parseInt(parts[0], 10);
          const minute = parseInt(parts[1], 10);
          const second = parseInt(parts[2], 10);
          if (hour === 16 && minute === 0 && second === 0) {
            return "This Batch Started At 4:00 PM";
          }
          if (hour > 16) {
            return "This Batch Started After 4:00 PM";
          }
        }
      }
      if (results.value.batchEndTime) {
        let batchEndStr = results.value.batchEndTime;
        let timePart = batchEndStr.split(" ")[0];
        let period = "";
        const periodMatch = batchEndStr.match(/\b(AM|PM)\b/i);
        if (periodMatch) {
          period = periodMatch[0].toUpperCase();
        }
        const parts = timePart.split(":");
        if (parts.length === 3) {
          let hour = parseInt(parts[0], 10);
          if (period === "PM" && hour < 12) hour += 12;
          if (period === "AM" && hour === 12) hour = 0;
          if (hour < 16) {
            return `This Batch ends at ${batchEndStr}`;
          }
        }
      }
      return results.value.closestPositionBefore4PM || "No Sample Position Ends Before 4:00 PM";
    });
    
    const displayBatchEndTime = computed(() => {
      if (!results.value.batchEndTime) return "";
      const batchEndStr = results.value.batchEndTime;
      const currentDate = new Date().toLocaleDateString();
      const startStr = displayBatchStartTime.value;
      if (!startStr) {
        return `${batchEndStr} (${currentDate})`;
      }
      const startParts = startStr.split(":");
      if (startParts.length < 3) return `${batchEndStr} (${currentDate})`;
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
        return `${batchEndStr} (${currentDate})`;
      }
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      const endDateString = endDateCandidate.toLocaleDateString();
      return `${batchEndStr} (${endDateString})`;
    });
    
    const initialBatchEndTimeAfter730 = computed(() => {
      if (!results.value.batchEndTime) return false;
      const batchEndStr = results.value.batchEndTime;
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
      let endDateCandidate = new Date(`${startDate.toDateString()} ${results.value.batchEndTime}`);
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
      results,
      displayBatchStartTime,
      displayFinalPosition,
      displayTotalRuns,
      isClosestPositionObject,
      closestPositionDisplay,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showStartTimeFinalPosition,
      showDetailedResults
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
