// candidateSelection.js
import { parseTimeString } from './timeUtils.js'; // adjust the path as needed
import { getDisplayedPosition, generateSampleAllowed, generateFullOrder, extractSamplePositions } from './candidateHelpers.js';
// (You can move the helper functions (getDisplayedPosition, generateSampleAllowed, etc.) into a separate file if you want.)

/**
 * selectCandidate performs candidate selection for sample runs.
 * It uses the batch date (derived from the batch start time) to compute a cutoff time.
 * @param {Array} runs - Array of run objects (each with a position, endTime string, etc.)
 * @param {Object} controls - Object with control1 and control2.
 * @param {number} finalPos - The final sample position (e.g., 32).
 * @param {string} gcType - The GC type (lowercase string).
 * @param {Date} batchDate - A Date object representing the day of the batch.
 * @returns {Object} - An object containing:
 *    candidate, adjustedCandidate, displayedLabel, sampleOrder, fullOrder, cutoff.
 */
export function selectCandidate(runs, controls, finalPos, gcType, batchDate) {
  // Set cutoff time to 4:00 PM on the batch day.
  const cutoff = new Date(batchDate);
  cutoff.setHours(16, 0, 0, 0);
  console.log(`[selectCandidate] Cutoff time based on batch date:`, cutoff);
  
  const fullOrder = generateFullOrder(finalPos, gcType, controls);
  console.log(`[selectCandidate] Full Order:`, fullOrder);
  
  const sampleOrder = extractSamplePositions(fullOrder);
  console.log(`[selectCandidate] Sample Order:`, sampleOrder);
  
  console.log(`[selectCandidate] All run data:`, runs);
  
  // For each run, compute its end time using the batch date.
  const candidateRuns = runs.filter(r => {
    if (!r.endTime || r.position < 4) return false;
    if (isNaN(Number(r.position))) return false;
    if (
      r.position === Number(controls.control1) ||
      r.position === Number(controls.control2)
    ) {
      console.log(`[selectCandidate] Excluding run with raw position ${r.position} because it equals a control.`);
      return false;
    }
    const adjusted = getDisplayedPosition(r.position, controls);
    console.log(`[selectCandidate] Run raw position ${r.position} adjusted to ${adjusted}`);
    if (!sampleOrder.some(label => label === `Position ${adjusted}`)) {
      console.log(`[selectCandidate] Excluding run with adjusted sample Position ${adjusted} not in sample order.`);
      return false;
    }
    // Parse the run's end time using batchDate.
    const endParts = parseTimeString(r.endTime); // Expected format: { hour, minute, second }
    if (!endParts) return false;
    const runEndDate = new Date(batchDate);
    runEndDate.setHours(endParts.hour, endParts.minute, endParts.second, 0);
    return runEndDate < cutoff;
  });
  console.log(`[selectCandidate] Candidate runs after filtering:`, candidateRuns);
  
  candidateRuns.sort((a, b) => {
    const adjustedA = getDisplayedPosition(a.position, controls);
    const adjustedB = getDisplayedPosition(b.position, controls);
    const indexA = sampleOrder.findIndex(label => label === `Position ${adjustedA}`);
    const indexB = sampleOrder.findIndex(label => label === `Position ${adjustedB}`);
    return indexA - indexB;
  });
  console.log(`[selectCandidate] Candidate runs sorted:`, candidateRuns);
  
  const candidate = candidateRuns[candidateRuns.length - 1];
  const adjustedCandidate = candidate ? getDisplayedPosition(candidate.position, controls) : null;
  const displayedLabel = candidate ? `Position ${adjustedCandidate}` : null;
  console.log(`[selectCandidate] Final candidate:`, candidate, "Adjusted as:", adjustedCandidate, "Displayed as:", displayedLabel);
  
  return {
    candidate,
    adjustedCandidate,
    displayedLabel,
    sampleOrder,
    fullOrder,
    cutoff
  };
}
