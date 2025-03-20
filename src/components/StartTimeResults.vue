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
    <p v-if="showDetailedResults && (results.closestPositionBefore4PM || closestPositionDisplay) && displayFinalPosition">
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
    const currentDate = computed(() => new Date().toLocaleDateString());

    const displayBatchStartTime = computed(() => {
      const storedTime =
        props.results.batchStartTime ||
        props.results.startTime ||
        props.startTime.batchStartTime ||
        props.startTime.startTime ||
        "";
      return storedTime;
    });

    // Updated to match hh:mm instead of hh:mm:ss
    const showDetailedResults = computed(() => {
      return /^\d{2}:\d{2}$/.test(displayBatchStartTime.value);
    });

    const displayFinalPosition = computed(() => {
      return props.results.startTimeFinalPosition || props.startTime.finalPosition || "";
    });

    const displayTotalRuns = computed(() => !!props.results.totalRuns);
    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    const closestPositionDisplay = computed(() => {
      const batchStart = props.results.batchStartTime || props.startTime.batchStartTime;
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
      if (props.results.batchEndTime) {
        let batchEndStr = props.results.batchEndTime;
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
      return props.results.closestPositionBefore4PM || "No Sample Position Ends Before 4:00 PM";
    });

    const isClosestPositionObject = computed(() => {
      if (props.results.batchEndTime) {
        let batchEndStr = props.results.batchEndTime;
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
        props.results &&
        props.results.closestPositionBefore4PM &&
        typeof props.results.closestPositionBefore4PM === "object" &&
        props.results.closestPositionBefore4PM.position !== undefined
      );
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
      isClosestPositionObject,
      closestPositionDisplay,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showStartTimeFinalPosition,
      showDetailedResults,
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
.highlight-orange {
  color: orange;
}
</style>
