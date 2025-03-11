import { 
  formatTimeWithAmPm, 
  formatTimeWithAmPmAndSeconds, 
  formatDuration 
} from './utils.js';

/**
 * Parses a start time string (e.g. "10:00:30" or "10:00") with an AM/PM indicator.
 * Defaults missing seconds to "00".
 */
function parseStartTime(batchStartTime, ampm) {
  const parts = batchStartTime.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2] || "00", 10);
  
  let startHour = hours;
  if (ampm === 'PM' && hours !== 12) startHour += 12;
  if (ampm === 'AM' && hours === 12) startHour = 0;
  
  const batchStartTimeDate = new Date();
  batchStartTimeDate.setHours(startHour, minutes, seconds, 0);
  return batchStartTimeDate;
}

/**
 * Determines the target 7:30 AM based on the effective start and batch end time.
 */
function get730Target(effectiveStartTime, batchEndTime) {
  const target = new Date(effectiveStartTime);
  target.setHours(7, 30, 0, 0);
  // If the batch starts at or after 4:00 AM and ends at/after target, or if effectiveStartTime is already past target:
  if ((effectiveStartTime.getHours() >= 4 && batchEndTime >= target) || effectiveStartTime >= target) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Calculates the time gap to 7:30 AM.
 */
function calculateTimeGapTo730AM(batchEndTime, effectiveStartTime) {
  const target = get730Target(effectiveStartTime, batchEndTime);
  const diffMS = batchEndTime - target;
  const absDiffMS = Math.abs(diffMS);
  const diffHours = Math.floor(absDiffMS / (1000 * 60 * 60));
  const diffMinutes = Math.floor((absDiffMS % (1000 * 60 * 60)) / (1000 * 60));
  return diffMS >= 0 
    ? `This batch passes 7:30 AM by ${diffHours} hours, ${diffMinutes} minutes`
    : `${diffHours} hours, ${diffMinutes} minutes`;
}

/**
 * Computes the time delay required (in whole hours) so that the next batch can finish before 7:30 AM.
 */
function computeTimeDelayRequired(batchEndTime, effectiveStartTime) {
  const target = get730Target(effectiveStartTime, batchEndTime);
  const diffMS = target - batchEndTime;
  const hours = Math.floor(diffMS / (1000 * 60 * 60));
  return diffMS > 0 && hours > 0 ? `${hours} hours` : "No Time Delay Required";
}

/**
 * Given a run number (for sample runs only), returns its sample position.
 * For runs 4–16, sample position = run number – 1; for 17+, sample position = run number.
 */
function samplePositionForRun(i) {
  if (i < 4) return null;
  return i < 17 ? i - 1 : i;
}

/**
 * Main function to calculate start time batch results.
 * Uses seconds-based arithmetic to minimize rounding errors.
 */
export function calculateStartTimeBatch(gc, runtime, currentRun, finalPosition, batchStartTime, ampm, wait15) {
  if (!gc || !finalPosition) {
    return {
      batchEndTime: null,
      batchEndTimeDate: null,
      closestPositionBefore4PM: null,
      timeGapTo730AM: null,
      timeDelayRequired: null,
      batchStartTime: null,
      batchStartTimeAMPM: null,
      startTimeFinalPosition: null,
      wait15: null,
      totalRuns: null,
      totalRunTime: null,
      runs: []
    };
  }
  
  // Original batch start time (before any wait)
  const batchStartTimeDate = parseStartTime(batchStartTime, ampm);
  const wait15MS = wait15 ? 15 * 60 * 1000 : 0;
  // Effective start time shifts by 15 minutes if wait15 is true.
  const effectiveStartTime = wait15 ? new Date(batchStartTimeDate.getTime() + wait15MS) : batchStartTimeDate;
  const finalPositionNum = Number(finalPosition);
  const totalRuns = finalPositionNum <= 15 ? finalPositionNum + 2 : finalPositionNum + 1;
  
  const runtimeSeconds = Math.round(parseFloat(runtime) * 60);
  const totalRunTimeSeconds = totalRuns * runtimeSeconds;
  const totalRunTimeMS = totalRunTimeSeconds * 1000;
  
  // Batch end time is computed from the effective start time.
  const batchEndTimeDate = new Date(effectiveStartTime.getTime() + totalRunTimeMS);
  const formattedBatchEndTime = formatTimeWithAmPmAndSeconds(batchEndTimeDate);
  
  // Calculate overall run time from original batch start to batch end time.
  const overallRunTimeMS = batchEndTimeDate.getTime() - batchStartTimeDate.getTime();
  const totalRunTimeFormatted = formatDuration(overallRunTimeMS);
  
  // Set workDayEnd based on the ORIGINAL batch start time.
  const workDayEnd = new Date(batchStartTimeDate);
  workDayEnd.setHours(16, 0, 0, 0);
  
  let closestPositionBefore4PM;
  if (batchStartTimeDate >= workDayEnd) {
    closestPositionBefore4PM = "This Batch Started After 4:00 PM";
  } else {
    let candidate = null, candidateStartTime = null, candidateEndTime = null;
    for (let i = 4; i <= totalRuns; i++) {
      const samplePos = samplePositionForRun(i);
      if (samplePos === null || samplePos > finalPositionNum) continue;
      const runStartTime = new Date(effectiveStartTime.getTime() + (i - 1) * runtimeSeconds * 1000);
      const runEndTime = new Date(runStartTime.getTime() + runtimeSeconds * 1000);
      if (runEndTime <= workDayEnd) {
        candidate = i;
        candidateStartTime = runStartTime;
        candidateEndTime = runEndTime;
      }
    }
    closestPositionBefore4PM = candidate === null 
      ? "No Sample Position Ends Before 4:00 PM" 
      : { 
          position: samplePositionForRun(candidate), 
          startTime: formatTimeWithAmPmAndSeconds(candidateStartTime),
          endTime: formatTimeWithAmPmAndSeconds(candidateEndTime)
        };
  }
  
  const timeGapTo730AM = calculateTimeGapTo730AM(batchEndTimeDate, effectiveStartTime);
  const timeDelayRequired = computeTimeDelayRequired(batchEndTimeDate, effectiveStartTime);
  
  const runs = [];
  if (wait15) {
    runs.push({
      position: "Wait",
      startTime: formatTimeWithAmPmAndSeconds(batchStartTimeDate),
      endTime: formatTimeWithAmPmAndSeconds(effectiveStartTime)
    });
  }
  
  for (let i = 1; i <= totalRuns; i++) {
    const runStartTime = new Date(effectiveStartTime.getTime() + (i - 1) * runtimeSeconds * 1000);
    const runEndTime = new Date(runStartTime.getTime() + runtimeSeconds * 1000);
    runs.push({
      position: i,
      startTime: formatTimeWithAmPmAndSeconds(runStartTime),
      endTime: formatTimeWithAmPmAndSeconds(runEndTime)
    });
  }
  
  return {
    batchEndTime: formattedBatchEndTime,
    batchEndTimeDate,
    closestPositionBefore4PM,
    timeGapTo730AM,
    timeDelayRequired,
    batchStartTime,
    batchStartTimeAMPM: ampm,
    startTimeFinalPosition: finalPosition,
    wait15,
    totalRuns,
    totalRunTime: totalRunTimeFormatted,
    runs
  };
}
