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
    </p>
    <!-- Display the computed batch duration (Batch Run Time) without seconds -->
    <p v-if="showDetailedResults && displayBatchDuration">
      Batch Run Time:
      <span class="result-value">{{ displayBatchDuration }}</span>
    </p>
    <!-- Batch End Time -->
    <p v-if="showDetailedResults && displayBatchEndTime">
      Batch End Time:
      <span class="result-value" :class="{ 'highlight-orange': initialBatchEndTimeAfter730 }">
        {{ displayBatchEndTime }}
      </span>
    </p>
    <!-- Candidate heading (closest position) -->
    <p
      v-if="showDetailedResults && displayFinalPosition && highlightCandidate && candidateDisplayLabel !== 'This Batch Ends At:'"
    >
      {{ candidateDisplayLabel }}
      <!-- Only the number is highlighted -->
      <span class="result-value highlight-yellow">{{ candidateParts.number }}</span>
      <!-- Display the time range normally if present -->
      <span v-if="candidateParts.times" class="result-value"> | {{ candidateParts.times }}</span>
    </p>
    <!-- Display the time gap computed locally from the batch end time to 7:30 AM -->
    <div
      v-if="showDetailedResults && computedTimeGapTo730AM !== '' && !delayedRunsExist && !additionalRunsExistBool"
    >
      <p class="time-gap-heading">
        Time Gap to 7:30 AM:
        <span class="result-value">{{ computedTimeGapTo730AM }}</span>
      </p>
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { useGcStore } from "../store";

export default {
  name: "StartTimeResults",
  props: {
    results: {
      type: Object,
      default: () => ({})
    },
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
    },
    runtableClosestPositionFull: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    const currentDate = computed(() => new Date().toLocaleDateString());

    // Helper: Remove seconds from a time string formatted as "HH:MM:SS AM/PM"
    function removeSeconds(timeStr) {
      if (!timeStr) return "";
      const regex = /^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)$/i;
      const match = timeStr.match(regex);
      if (match) {
        return `${match[1]} ${match[2].toUpperCase()}`;
      }
      return timeStr;
    }

    // Helper: Remove seconds from a duration string (e.g., "10h 43m 6s")
    function removeDurationSeconds(durationStr) {
      if (!durationStr) return "";
      return durationStr.replace(/\s+\d+s$/, "");
    }

    // Retrieve the raw batch start time.
    const rawBatchStartTime = computed(() => {
      return (
        props.results.batchStartTime ||
        props.results.startTime ||
        props.startTime.batchStartTime ||
        props.startTime.startTime ||
        ""
      );
    });
    const displayBatchStartTime = computed(() => removeSeconds(rawBatchStartTime.value));

    // Determine if we should show detailed results based on the batch start time format.
    const showDetailedResults = computed(() =>
      /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:AM|PM))?$/.test(displayBatchStartTime.value)
    );

    const displayFinalPosition = computed(() => {
      return (
        props.results.startTimeFinalPosition ||
        props.startTime.finalPosition ||
        ""
      );
    });

    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    // Format the controls as "X  | Y"
    const displayControls = computed(() => {
      const ctrl1 = gcStore.startTime.controls.control1;
      const ctrl2 = gcStore.startTime.controls.control2;
      if (ctrl1 == null || ctrl2 == null || ctrl1 === "" || ctrl2 === "") {
        return "";
      }
      const ctrl1Str = ctrl1.toString().padEnd(2, " ");
      return `${ctrl1Str} | ${ctrl2}`;
    });

    // Display Batch End Time – now using only props.results.batchEndTime.
    const displayBatchEndTime = computed(() => {
      if (!props.results.batchEndTime) return "";
      const batchEndStr = props.results.batchEndTime;
      const startStr = displayBatchStartTime.value;
      if (!startStr) {
        return `${batchEndStr} (${currentDate.value})`;
      }
      const startParts = startStr.split(":");
      if (startParts.length < 2)
        return `${batchEndStr} (${currentDate.value})`;
      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const startSecond = startParts[2] ? parseInt(startParts[2], 10) : 0;
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

    // Compute if the batch end time is after 7:30 AM (for highlighting purposes).
    const initialBatchEndTimeAfter730 = computed(() => {
      if (!props.results.batchEndTime) return false;
      const batchEndStr = props.results.batchEndTime;
      const startStr = displayBatchStartTime.value;
      if (!startStr) return false;
      const startParts = startStr.split(":");
      if (startParts.length < 2) return false;
      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const startSecond = startParts[2] ? parseInt(startParts[2], 10) : 0;
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
      if (isNaN(endDateCandidate.getTime())) return false;
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      if (endDateCandidate.getDate() === startDate.getDate()) return false;
      const endHour = endDateCandidate.getHours();
      const endMinute = endDateCandidate.getMinutes();
      return endHour > 7 || (endHour === 7 && endMinute >= 30);
    });

    // Compute if the batch end time is at or after 4:00 PM.
    const batchPasses4PM = computed(() => {
      const batchTime = props.results.batchEndTime;
      if (!batchTime) return false;
      const parts = batchTime.split(" ");
      if (parts.length < 2) return false;
      const timePart = parts[0];
      const ampm = parts[1];
      const timeParts = timePart.split(":");
      let hour = parseInt(timeParts[0], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) {
        hour += 12;
      }
      if (ampm.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
      }
      return hour >= 16;
    });

    // Decide which candidate label to show.
    const candidateDisplayLabel = computed(() => {
      if (
        props.runtableClosestPositionFull &&
        props.runtableClosestPositionFull !== "No candidate found"
      ) {
        return "Closest Position Before 4:00 PM:";
      }
      return "This Batch Ends At:";
    });

    const displayBatchDuration = computed(() => {
      const rawDuration = props.results.batchDuration || "";
      return removeDurationSeconds(rawDuration);
    });

    // Parse the Batch End Time into a Date object.
    const parsedBatchEndDateTime = computed(() => {
      const batchEnd = displayBatchEndTime.value;
      if (!batchEnd) return null;
      const match = batchEnd.match(/^([\d:]+\s*(?:AM|PM))\s*\((.+)\)$/);
      if (!match) return null;
      const timePart = match[1].trim();
      const datePart = match[2].trim();
      return new Date(`${datePart} ${timePart}`);
    });

    const computedTimeGapTo730AM = computed(() => {
      const endDT = parsedBatchEndDateTime.value;
      if (!endDT) return "";
      let target = new Date(endDT);
      target.setHours(7, 30, 0, 0);
      if (endDT > target) {
        target.setDate(target.getDate() + 1);
      }
      const diffMS = target - endDT;
      const diffHours = Math.floor(diffMS / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMS % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffHours} hours, ${diffMinutes} minutes`;
    });

    // Clean up the candidate string.
    const cleanedRuntableClosestPosition = computed(() => {
      let candidate = props.runtableClosestPositionFull || "";
      if (candidate.startsWith("Position ")) {
        candidate = candidate.substring("Position ".length);
      }
      candidate = candidate.replace(/^(\d+)\s*:\s*/, "$1 | ");
      return candidate;
    });

    // NEW: Split the candidate into a number and time range.
    const candidateParts = computed(() => {
      const fullCandidate = cleanedRuntableClosestPosition.value;
      const parts = fullCandidate.split(" | ");
      return {
        number: parts[0] || "",
        times: parts.length > 1 ? parts.slice(1).join(" | ") : ""
      };
    });

    // Compute parsed batch start time from displayBatchStartTime.
    const computedBatchStartTime = computed(() => {
      if (!displayBatchStartTime.value) return null;
      const parts = displayBatchStartTime.value.split(" ");
      if (parts.length < 2) return null;
      const timePart = parts[0];
      const ampm = parts[1];
      const timeParts = timePart.split(":");
      let hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      return d;
    });

    // Compute parsed batch end time from displayBatchEndTime.
    const computedBatchEndTime = computed(() => {
      if (!displayBatchEndTime.value) return null;
      const match = displayBatchEndTime.value.match(/^([\d:]+\s*(?:AM|PM))\s*\(/);
      if (!match) return null;
      const timeStr = match[1].trim();
      const parts = timeStr.split(" ");
      if (parts.length < 2) return null;
      const timePart = parts[0];
      const ampm = parts[1];
      const timeParts = timePart.split(":");
      let hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      return d;
    });

    // Compute highlightCandidate – true only if the batch starts before 4:00 PM and ends after 4:00 PM.
    const highlightCandidate = computed(() => {
      const start = computedBatchStartTime.value;
      const end = computedBatchEndTime.value;
      if (!start || !end) return false;
      let fourPM = new Date(start);
      fourPM.setHours(16, 0, 0, 0);
      return start < fourPM && end > fourPM;
    });

    return {
      currentDate,
      displayBatchStartTime,
      displayFinalPosition,
      additionalRunsExistBool,
      displayControls,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showDetailedResults,
      candidateDisplayLabel,
      highlightCandidate,
      displayBatchDuration,
      computedTimeGapTo730AM,
      cleanedRuntableClosestPosition,
      candidateParts
    };
  }
};
</script>

<style scoped>
.start-time-results {
  padding: 0;
}
.start-time-results p {
  margin: 12px 0;
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
  margin: 12px 0;
  padding: 0;
}
.time-gap-heading {
  margin: 12px 0;
}
.highlight-orange {
  color: orange;
}
/* Highlight only the candidate number with a yellow background */
.highlight-yellow {
  background-color: yellow;
}
</style>
