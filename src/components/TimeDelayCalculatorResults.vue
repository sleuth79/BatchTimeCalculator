<template>
  <div class="delayed-results">
    <!-- Always show current time -->
    <p>
      Current Time:
      <span class="result-value">{{ currentTimeFormatted }}</span>
    </p>
    <!-- Always show the time gap -->
    <p>
      Time Gap to 7:30 AM:
      <span class="result-value">{{ formattedTimeGap }}</span>
    </p>
    <!-- If delayed runs are active, show extra details -->
    <template v-if="hasDelayedRuns">
      <p>
        Delayed runs:
        <span class="result-value">{{ displayDelayedRuns }}</span>
      </p>
      <p>
        Total Delayed Runs:
        <span class="result-value">{{ totalDelayedRuns }}</span>
      </p>
      <p>
        Total Duration of Delayed Runs:
        <span class="result-value">{{ totalDelayedDurationFormatted }}</span>
      </p>
      <p>
        Delayed Runs Time:
        <span class="result-value">{{ delayedRunsStartTime }} to {{ formattedAdjustedEndTime }}</span>
      </p>
      <hr class="separator" />
      <p>
        Time Delay Required:
        <span class="result-value green-text">{{ formattedTimeDelayRequired }}</span>
      </p>
    </template>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useGcStore } from '../store';
import { formatTimeWithAmPmAndSeconds } from '../utils/utils.js';

export default {
  name: 'TimeDelayCalculatorResults',
  setup() {
    const gcStore = useGcStore();

    // Use the stored preruns description (set by the input component)
    const prerunsDescription = computed(() =>
      (gcStore.timeDelayResults && gcStore.timeDelayResults.prerunsDescription) || "None"
    );
    const hasDelayedRuns = computed(() => prerunsDescription.value.toLowerCase() !== "none");

    // Parse misc runs from the preruns description or from stored value
    const miscRuns = computed(() => {
      if (gcStore.timeDelayResults && gcStore.timeDelayResults.miscRuns != null) {
        const val = Number(gcStore.timeDelayResults.miscRuns);
        if (!isNaN(val)) return val;
      }
      const match = prerunsDescription.value.match(/misc runs[:\s]*([\d]+)/i);
      return match && match[1] ? Number(match[1]) || 0 : 0;
    });

    // Determine GC type from the store's selected GC data
    const gcType = computed(() => {
      return gcStore.selectedGcData && gcStore.selectedGcData.type
        ? gcStore.selectedGcData.type
        : "";
    });
    // Compute calibration value: empty if no GC selected; else 8 for Energy, 9 otherwise.
    const calibrationValue = computed(() => {
      if (!gcType.value) return "";
      return gcType.value === "Energy" ? 8 : 9;
    });

    // Override display of delayed runs if calibration is active.
    const displayDelayedRuns = computed(() => {
      const lowerDesc = (prerunsDescription.value || "").trim().toLowerCase();
      if (lowerDesc.includes("prebatch")) {
        return miscRuns.value > 0
          ? `Prebatch, Misc Runs: ${miscRuns.value}`
          : `Prebatch`;
      }
      if (lowerDesc.includes("calibration")) {
        if (calibrationValue.value !== "") {
          return miscRuns.value > 0
            ? `Calibration (${calibrationValue.value}), Misc Runs: ${miscRuns.value}`
            : `Calibration (${calibrationValue.value})`;
        } else {
          return miscRuns.value > 0
            ? `Calibration, Misc Runs: ${miscRuns.value}`
            : `Calibration`;
        }
      }
      if (lowerDesc.includes("misc runs:")) {
        return `Misc Runs: ${miscRuns.value}`;
      }
      return prerunsDescription.value;
    });

    // For total delayed runs, if calibration is present, use the computed calibration value.
    const totalDelayedRuns = computed(() => {
      const baseDelayed = computed(() => {
        const lowerDesc = prerunsDescription.value.toLowerCase();
        if (lowerDesc.includes("prebatch")) return 4;
        if (lowerDesc.includes("calibration")) {
          return calibrationValue.value !== "" ? calibrationValue.value : 9;
        }
        return 0;
      });
      return baseDelayed.value + miscRuns.value;
    });

    const currentTimeFormatted = computed(() =>
      formatTimeWithAmPmAndSeconds(new Date())
    );

    const runtimeMinutes = computed(() => {
      return (gcStore.selectedGcData && gcStore.selectedGcData.runTime)
        ? Number(gcStore.selectedGcData.runTime)
        : 0;
    });
    const runtimeSeconds = computed(() => runtimeMinutes.value * 60);

    // Total delayed duration in milliseconds.
    const D = computed(() => totalDelayedRuns.value * runtimeSeconds.value * 1000);
    const totalDelayedDurationFormatted = computed(() => {
      const totalMinutes = Math.round(D.value / 60000);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return hrs > 0 ? `${hrs} hr, ${mins} min` : `${mins} minutes`;
    });

    const targetDisplay = computed(() => {
      const now = new Date();
      const t = new Date(now);
      t.setHours(7, 30, 0, 0);
      if (now >= t) t.setDate(t.getDate() + 1);
      return t;
    });

    const formattedTimeGap = computed(() => {
      const nowTime = new Date();
      const diffMs = targetDisplay.value.getTime() - nowTime.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 60000));
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hrs} hours, ${mins} minutes`;
    });

    const gapHoursExact = computed(() => (targetDisplay.value.getTime() - Date.now()) / 3600000);
    const D_hoursExact = computed(() => D.value / (1000 * 60 * 60));
    const computedDelayHours = computed(() => {
      const diff = gapHoursExact.value - D_hoursExact.value;
      return diff > 0 ? Math.floor(diff) : 0;
    });
    const formattedTimeDelayRequired = computed(() => {
      return computedDelayHours.value === 0
        ? "No time delay required"
        : `${computedDelayHours.value} hours`;
    });
    const adjustedEndTime = computed(() => {
      const nowMs = Date.now();
      const computedTime = nowMs + D.value + computedDelayHours.value * 3600000;
      return new Date(computedTime);
    });
    const formattedAdjustedEndTime = computed(() =>
      formatTimeWithAmPmAndSeconds(adjustedEndTime.value)
    );
    const delayedRunsStartTime = computed(() =>
      (gcStore.timeDelayResults && gcStore.timeDelayResults.delayedRunsStartTime) || ""
    );

    return {
      currentTimeFormatted,
      displayDelayedRuns,
      hasDelayedRuns,
      totalDelayedRuns,
      totalDelayedDurationFormatted,
      formattedTimeGap,
      formattedTimeDelayRequired,
      formattedAdjustedEndTime,
      delayedRunsStartTime,
    };
  },
};
</script>

<style scoped>
.delayed-results {
  margin-top: 5px;
  padding-top: 0;
  border-top: 1px solid #ddd;
}
.delayed-results h3 {
  margin: 0 0 10px;
  font-size: 1.2rem;
  color: #333;
}
.result-value {
  font-weight: bold;
}
.green-text {
  color: var(--highlight-color);
}
.separator {
  border: none;
  border-top: 1px solid #ccc;
}
</style>
