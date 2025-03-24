// candidateSelection.js
import { parseTimeString } from './timeUtils.js'; // Ensure this function now handles AM/PM
// We assume that helper functions (getDisplayedPosition, generateSampleAllowed, generateFullOrder, extractSamplePositions)
// are defined here or imported from another file if you choose to split them further.

function getDisplayedPosition(raw, controls) {
  const control1 = Number(controls.control1);
  const control2 = Number(controls.control2);
  console.log(`[candidateSelection] getDisplayedPosition: raw=${raw}, control1=${control1}, control2=${control2}`);
  if (raw < 4) return null;
  
  let sample;
  if (raw < 17) {
    sample = raw - 1;
    if (sample === control1 || sample === control2) {
      console.log(`[candidateSelection] Raw ${raw}: base sample ${sample} equals a control; adjusting downward.`);
      sample = sample - 1;
    }
  } else {
    sample = raw;
    if (raw === control1 || raw === control2) {
      if (raw < 23) {
        console.log(`[candidateSelection] Raw ${raw}: equals a control in lower block; adjusting upward.`);
        sample = raw + 1;
      } else {
        console.log(`[candidateSelection] Raw ${raw}: equals a control in higher block; adjusting downward.`);
        sample = raw - 1;
      }
    }
  }
  console.log(`[candidateSelection] Final displayed sample for raw ${raw} = ${sample}`);
  return sample;
}

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

function generateFullOrder(finalPos, gcType, controls) {
  const order = [];
  order.push("Blank");
  order.push(gcType.includes("energy") ? "Argon Blank" : "Methane Blank");
  const c1 = Number(controls.control1);
  const c2 = Number(controls.control2);
  const biggerControl = Math.max(c1, c2);
  const smallerControl = Math.min(c1, c2);
  order.push(`1st Control - ${biggerControl}`);
  const allowed = generateSampleAllowed(finalPos, controls);
  if (finalPos < 13) {
    for (const s of allowed) {
      order.push(`Position ${s}`);
    }
    order.push(`2nd Control - ${smallerControl}`);
    return order;
  }
  if (finalPos < 23) {
    const group1 = allowed.filter(n => n <= 12);
    const group2 = allowed.filter(n => n > 12);
    for (const s of group1) {
      order.push(`Position ${s}`);
    }
    order.push(`2nd Control - ${smallerControl}`);
    for (const s of group2) {
      order.push(`Position ${s}`);
    }
    order.push(`3rd Control - ${biggerControl}`);
    return order;
  }
  const group1 = allowed.filter(n => n <= 12);
  const group2 = allowed.filter(n => n >= 13 && n <= 22);
  const group3 = allowed.filter(n => n > 22);
  for (const s of group1) {
    order.push(`Position ${s}`);
  }
  order.push(`2nd Control - ${smallerControl}`);
  for (const s of group2) {
    order.push(`Position ${s}`);
  }
  const thirdLabel = `3rd Control - ${biggerControl}`;
  const indexOf22 = order.indexOf("Position 22");
  if (indexOf22 !== -1) {
    order.splice(indexOf22 + 1, 0, thirdLabel);
  } else if (biggerControl === 22) {
    const indexOf21 = order.indexOf("Position 21");
    if (indexOf21 !== -1) {
      order.splice(indexOf21 + 1, 0, thirdLabel);
    } else {
      order.push(thirdLabel);
    }
  } else {
    order.push(thirdLabel);
  }
  for (const s of group3) {
    order.push(`Position ${s}`);
  }
  order.push(`4th Control - ${smallerControl}`);
  return order;
}

function extractSamplePositions(fullOrder) {
  return fullOrder.filter(item => item.startsWith("Position "));
}

/**
 * selectCandidate performs the candidate selection.
 * It uses the provided batch date and assumes run end times include AM/PM.
 *
 * @param {Array} runs - Array of run objects (each with a numeric position and an endTime string, e.g. "03:38:34 PM")
 * @param {Object} controls - Object with control1 and control2 values.
 * @param {number} finalPos - The final sample position.
 * @param {string} gcType - The GC type in lowercase.
 * @param {Date} batchDate - The Date representing the batch day.
 * @returns {Object} - An object with candidate, adjustedCandidate, displayedLabel, sampleOrder, fullOrder, and cutoff.
 */
export function selectCandidate(runs, controls, finalPos, gcType, batchDate) {
  // Set cutoff time to 4:00 PM on the batch date.
  const cutoff = new Date(batchDate);
  cutoff.setHours(16, 0, 0, 0);
  console.log(`[selectCandidate] Cutoff time based on batch date:`, cutoff);
  
  const fullOrder = generateFullOrder(finalPos, gcType, controls);
  console.log(`[selectCandidate] Full Order:`, fullOrder);
  
  const sampleOrder = extractSamplePositions(fullOrder);
  console.log(`[selectCandidate] Sample Order:`, sampleOrder);
  
  console.log(`[selectCandidate] All run data:`, runs);
  
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
    // Parse r.endTime including AM/PM using parseTimeString.
    const endParts = parseTimeString(r.endTime); // Should return 24-hour time parts if r.endTime includes AM/PM.
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
