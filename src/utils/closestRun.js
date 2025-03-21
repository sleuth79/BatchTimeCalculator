// src/utils/closestRun.js
export function getClosestRunToTarget(runs, targetTimeStr = "4:00:00 PM") {
    console.log("getClosestRunToTarget: Starting calculation for target time:", targetTimeStr);
    
    if (!Array.isArray(runs)) {
      console.warn("getClosestRunToTarget: Provided 'runs' is not an array:", runs);
      return null;
    }
    
    const todayStr = new Date().toDateString();
    const target = new Date(`${todayStr} ${targetTimeStr}`);
    console.log("getClosestRunToTarget: Target Date object:", target);
  
    let closest = null;
    runs.forEach((run, index) => {
      if (!run.endTime) {
        console.warn(`getClosestRunToTarget: Run at index ${index} missing endTime. Skipping:`, run);
        return;
      }
      const runEnd = new Date(`${todayStr} ${run.endTime}`);
      console.log(`getClosestRunToTarget: Evaluating run at index ${index}:`, run, "Run end time:", runEnd);
  
      if (runEnd <= target) {
        if (!closest) {
          closest = run;
          console.log(`getClosestRunToTarget: Initial closest run set at index ${index}:`, run);
        } else {
          const closestEnd = new Date(`${todayStr} ${closest.endTime}`);
          if (runEnd > closestEnd) {
            console.log(`getClosestRunToTarget: Updating closest run. Previous closest end time: ${closestEnd}, new run end time: ${runEnd}`);
            closest = run;
          }
        }
      }
    });
    
    console.log("getClosestRunToTarget: Final closest run:", closest);
    return closest;
  }
  