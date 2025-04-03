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
    <!-- New: Display the computed batch duration (Batch Run Time) without seconds -->
    <p v-if="showDetailedResults && displayBatchDuration">
      Batch Run Time:
      <span class="result-value">{{ displayBatchDuration }}</span>
    </p>
    <!-- Batch End Time now uses the new prop if available -->
    <p v-if="showDetailedResults && displayBatchEndTime">
      Batch End Time:
      <span
        class="result-value"
        :class="{ 'highlight-orange': initialBatchEndTimeAfter730 }"
      >
        {{ displayBatchEndTime }}
      </span>
    </p>
    <!-- Display candidate heading if detailed results are shown,
         final position is set, and either the batch passes 4:00 PM
         OR a candidate was computed (even if batch end time is formatted as AM) -->
    <p v-if="showDetailedResults && displayFinalPosition && (batchPasses4PM || runtableClosestPositionFull)">
      {{ candidateDisplayLabel }}
      <span class="result-value">
        <template v-if="candidateDisplayLabel === 'This Batch Ends At:'">
          {{ displayBatchEndTime }}
        </template>
        <template v-else>
          {{ cleanedRuntableClosestPosition }}
        </template>
      </span>
    </p>
    <!-- Display the time gap computed locally from the batch end time to 7:30 AM -->
    <div v-if="showDetailedResults && computedTimeGapTo730AM !== '' && !delayedRunsExist && !additionalRunsExistBool">
      <!-- <hr class="time-gap-hr" /> -->
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
    },
    // NEW: Accept the run table's computed batch end time.
    initialBatchEndTime: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const gcStore = useGcStore();
    const currentDate = computed(() => new Date().toLocaleDateString());

    // Helper function: Remove seconds from a time string formatted as "HH:MM:SS AM/PM"
    function removeSeconds(timeStr) {
      if (!timeStr) return "";
      // Regex to capture hours and minutes and ignore seconds if present
      const regex = /^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)$/i;
      const match = timeStr.match(regex);
      if (match) {
        return `${match[1]} ${match[2].toUpperCase()}`;
      }
      return timeStr;
    }

    // Helper function: Remove seconds from a duration string formatted like "10h 43m 6s"
    function removeDurationSeconds(durationStr) {
      if (!durationStr) return "";
      // Remove the seconds part if it appears at the end
      return durationStr.replace(/\s+\d+s$/, "");
    }

    // First, get the raw batch start time from props.
    const rawBatchStartTime = computed(() => {
      return (
        props.results.batchStartTime ||
        props.results.startTime ||
        props.startTime.batchStartTime ||
        props.startTime.startTime ||
        ""
      );
    });
    // Now remove seconds from the batch start time.
    const displayBatchStartTime = computed(() => {
      return removeSeconds(rawBatchStartTime.value);
    });

    // Relaxed regex to allow optional seconds and AM/PM.
    const showDetailedResults = computed(() => {
      return /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:AM|PM))?$/.test(displayBatchStartTime.value);
    });

    const displayFinalPosition = computed(() => {
      return (
        props.results.startTimeFinalPosition ||
        props.startTime.finalPosition ||
        ""
      );
    });

    const displayTotalRuns = computed(() => !!props.results.totalRuns);
    const additionalRunsExistBool = computed(() => Boolean(props.additionalRunsExist));

    // Updated displayControls: format as "X  | Y" with left control padded to 2 characters.
    const displayControls = computed(() => {
      const ctrl1 = gcStore.startTime.controls.control1;
      const ctrl2 = gcStore.startTime.controls.control2;
      if (ctrl1 == null || ctrl2 == null || ctrl1 === "" || ctrl2 === "") {
        return "";
      }
      const ctrl1Str = ctrl1.toString().padEnd(2, " ");
      return `${ctrl1Str} | ${ctrl2}`;
    });

    // Use the new prop if available; otherwise fallback to original logic for batch end time.
    const displayBatchEndTime = computed(() => {
      if (props.initialBatchEndTime) return props.initialBatchEndTime;
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
      let endDateCandidate = new Date(
        `${startDate.toDateString()} ${batchEndStr}`
      );
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
      // Use the new prop if available.
      const batchEndStr = props.initialBatchEndTime || props.results.batchEndTime;
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
      let endDateCandidate = new Date(
        `${startDate.toDateString()} ${batchEndStr}`
      );
      if (isNaN(endDateCandidate.getTime())) return false;
      if (endDateCandidate <= startDate) {
        endDateCandidate.setDate(endDateCandidate.getDate() + 1);
      }
      if (endDateCandidate.getDate() === startDate.getDate()) return false;
      const endHour = endDateCandidate.getHours();
      const endMinute = endDateCandidate.getMinutes();
      return endHour > 7 || (endHour === 7 && endMinute >= 30);
    });

    // New computed property to determine if the batch passes 4:00 PM.
    const batchPasses4PM = computed(() => {
      const batchTime = props.initialBatchEndTime || props.results.batchEndTime;
      if (!batchTime) return false;
      const parts = batchTime.split(" ");
      if (parts.length < 2) return false;
      const timePart = parts[0];
      const ampm = parts[1];
      const timeParts = timePart.split(":");
      if (timeParts.length < 2) return false;
      let hour = parseInt(timeParts[0], 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) {
        hour += 12;
      }
      if (ampm.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
      }
      // 4:00 PM in 24-hour time is 16:00.
      return hour >= 16;
    });

    // Computed property to decide which candidate label to show.
    const candidateDisplayLabel = computed(() => {
      if (props.runtableClosestPositionFull && props.runtableClosestPositionFull !== "No candidate found") {
        return "Closest Position Before 4:00 PM:";
      }
      return "This Batch Ends At:";
    });

    // NEW: Computed property to display the batch duration without seconds.
    const displayBatchDuration = computed(() => {
      const rawDuration = props.results.batchDuration || "";
      return removeDurationSeconds(rawDuration);
    });

    // --- New: Compute time gap from batch end time to 7:30 AM ---
    // Parse the displayBatchEndTime string which is expected to be in the format "TIME (DATE)"
    const parsedBatchEndDateTime = computed(() => {
      const batchEnd = displayBatchEndTime.value;
      if (!batchEnd) return null;
      // Expecting format like "8:43:06 PM (4/2/2025)"
      const match = batchEnd.match(/^([\d:]+\s*(?:AM|PM))\s*\((.+)\)$/);
      if (!match) return null;
      const timePart = match[1].trim();
      const datePart = match[2].trim();
      // Construct a Date object (this assumes the datePart is in a format parseable by Date)
      return new Date(`${datePart} ${timePart}`);
    });

    const computedTimeGapTo730AM = computed(() => {
      const endDT = parsedBatchEndDateTime.value;
      if (!endDT) return '';
      let target = new Date(endDT);
      target.setHours(7, 30, 0, 0);
      // If batch end time is after 7:30 AM, the target becomes 7:30 AM on the next day.
      if (endDT > target) {
        target.setDate(target.getDate() + 1);
      }
      const diffMS = target - endDT;
      const diffHours = Math.floor(diffMS / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMS % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffHours} hours, ${diffMinutes} minutes`;
    });
    // --- End new time gap calculation ---

    // --- New: Clean the candidate string to remove the word "Position" and change the separator ---
    const cleanedRuntableClosestPosition = computed(() => {
      let candidate = props.runtableClosestPositionFull || "";
      if (candidate.startsWith("Position ")) {
        candidate = candidate.substring("Position ".length);
      }
      // Replace the first occurrence of " : " with " | "
      candidate = candidate.replace(/^(\d+)\s*:\s*/, "$1 | ");
      return candidate;
    });
    // --- End candidate string cleanup ---

    return {
      currentDate,
      displayBatchStartTime,
      displayFinalPosition,
      displayTotalRuns,
      additionalRunsExistBool,
      displayControls,
      displayBatchEndTime,
      initialBatchEndTimeAfter730,
      showDetailedResults,
      candidateDisplayLabel,
      batchPasses4PM,
      displayBatchDuration,
      // New computed time gap for 7:30 AM
      computedTimeGapTo730AM,
      // New cleaned candidate string
      cleanedRuntableClosestPosition
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
/* The separator is commented out in the template */
/* .time-gap-hr {
  border-top: 1px solid #ccc;
  margin-top: 10px;
  margin-bottom: 5px;
} */
/* Align the time gap heading with other headings */
.time-gap-heading {
  margin-top: 0;
}
.highlight-orange {
  color: orange;
}
</style>
