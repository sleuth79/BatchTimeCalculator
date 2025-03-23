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
 * (Not adjusted for controls.)
 */
function samplePositionForRun(i) {
  if (i < 4) return null;
  return i < 17 ? i - 1 : i;
}

/**
 * Computes the displayed (adjusted) sample number based on the raw run number and the control values.
 * For raw run numbers 4–16, base sample = run number – 1; if that equals a control, subtract one more.
 * For raw run numbers 17+, base sample = run number; if that equals a control, add one.
 */
function getDisplayedPosition(raw, controls) {
  const control1 = Number(controls.control1);
  const control2 = Number(controls.control2);
  if (raw < 4) return null;
  
  let sample;
  if (raw < 17) {
    sample = raw - 1;
    if (sample === control1 || sample === control2) {
      sample = sample - 1;
    }
  } else {
    sample = raw;
    if (sample === control1 || sample === control2) {
      sample = sample + 1;
    }
  }
  return sample;
}

/**
 * Helper: generate allowed sample numbers (mimicking run table’s "sampleAllowed").
 * Samples are numbers from 3 to finalPos (or 32) excluding the control numbers and 16.
 */
function generateSampleAllowed(finalPos, controls) {
  const arr = [];
  for (let num = 3; num <= finalPos; num++) {
    if (
      num === Number(controls.control1) ||
      num === Number(controls.control2) ||
      num === 16
    ) {
      continue;
    }
    arr.push(num);
  }
  return arr;
}

/**
 * Helper: generate the displayed sample order, similar to the run table's generatePositionOrder.
 * Returns an array of objects with keys: { raw, label }.
 */
function generateDisplayedOrder(finalPos, gcType, controls) {
  const sampleAllowed = generateSampleAllowed(finalPos, controls);
  let displayedSamples = [];
  
  if (finalPos < 13) {
    displayedSamples = sampleAllowed.map(n => ({ raw: n, label: `Position ${n}` }));
  } else if (finalPos < 23) {
    const group1 = sampleAllowed.filter(n => n <= 12);
    const group2 = sampleAllowed.filter(n => n > 12);
    displayedSamples = [
      ...group1.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group2.map(n => ({ raw: n, label: `Position ${n}` }))
    ];
  } else {
    const group1 = sampleAllowed.filter(n => n <= 12);
    const group2 = sampleAllowed.filter(n => n >= 13 && n <= 22);
    const group3 = sampleAllowed.filter(n => n > 22);
    displayedSamples = [
      ...group1.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group2.map(n => ({ raw: n, label: `Position ${n}` })),
      ...group3.map(n => ({ raw: n, label: `Position ${n}` }))
    ];
  }
  return displayedSamples;
}

/**
 * Main function to calculate start time batch results.
 * NOTE: We’ve added an extra parameter "controls" so that candidate selection uses the adjusted sample numbers.
 */
export function calculateStartTimeBatch(gc, runtime, currentRun, finalPosition, batchStartTime, ampm, wait15, controls) {
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
  
  // Parse runtime from either mm:ss or decimal format.
  let runtimeSeconds;
  if (typeof runtime === 'string' && runtime.includes(':')) {
    const parts = runtime.split(':');
    runtimeSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else {
    runtimeSeconds = Math.round(parseFloat(runtime) * 60);
  }
  
  const totalRunTimeSeconds = totalRuns * runtimeSeconds;
  const totalRunTimeMS = totalRunTimeSeconds * 1000;
  
  // Batch end time is computed from the effective start time.
  const batchEndTimeDate = new Date(effectiveStartTime.getTime() + totalRunTimeMS);
  const formattedBatchEndTime = formatTimeWithAmPmAndSeconds(batchEndTimeDate);
  
  // Overall run time from original batch start to batch end time.
  const overallRunTimeMS = batchEndTimeDate.getTime() - batchStartTimeDate.getTime();
  const totalRunTimeFormatted = formatDuration(overallRunTimeMS);
  
  // Set workDayEnd based on the ORIGINAL batch start time.
  const workDayEnd = new Date(batchStartTimeDate);
  workDayEnd.setHours(16, 0, 0, 0);
  
  let closestPositionBefore4PM;
  if (batchStartTimeDate >= workDayEnd) {
    closestPositionBefore4PM = "This Batch Started After 4:00 PM";
  } else {
    // Use the displayed order logic.
    const gcType = (gc && gc.type ? gc.type : "").trim().toLowerCase();
    const displayedSamples = generateDisplayedOrder(finalPositionNum, gcType, controls);
    console.log("Displayed Samples Order:", displayedSamples);
    
    const todayStr = batchStartTimeDate.toDateString();
    const cutoff = new Date(`${todayStr} 4:00:00 PM`);
    let candidateRuns = [];
    
    // Loop through run numbers from 4 to totalRuns.
    for (let i = 4; i <= totalRuns; i++) {
      // Use getDisplayedPosition to adjust the raw run number for controls.
      const candidateSample = getDisplayedPosition(i, controls);
      if (candidateSample === null || candidateSample > finalPositionNum) continue;
      // Only consider candidateSample if it appears in the displayedSamples.
      if (!displayedSamples.some(s => s.raw === candidateSample)) continue;
      const runStartTime = new Date(effectiveStartTime.getTime() + (i - 1) * runtimeSeconds * 1000);
      const runEndTime = new Date(runStartTime.getTime() + runtimeSeconds * 1000);
      if (runEndTime <= workDayEnd) {
        candidateRuns.push({
          raw: candidateSample,
          startTime: runStartTime,
          endTime: runEndTime
        });
      }
    }
    
    if (candidateRuns.length > 0) {
      // Sort candidateRuns by their index in displayedSamples.
      candidateRuns.sort((a, b) => {
        const indexA = displayedSamples.findIndex(s => s.raw === a.raw);
        const indexB = displayedSamples.findIndex(s => s.raw === b.raw);
        return indexA - indexB;
      });
      const candidate = candidateRuns[candidateRuns.length - 1];
      closestPositionBefore4PM = {
        position: candidate.raw,
        startTime: formatTimeWithAmPmAndSeconds(candidate.startTime),
        endTime: formatTimeWithAmPmAndSeconds(candidate.endTime)
      };
    } else {
      closestPositionBefore4PM = "No Sample Position Ends Before 4:00 PM";
    }
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
