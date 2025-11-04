/**
 * Shared speed calculation utilities
 * Used consistently across BG task and UI store
 */

/**
 * Computes recommended speed to compensate for average speed violation
 * @param avgKmH Current average speed in km/h
 * @param limitKmH Speed limit in km/h
 * @param distanceSoFarM Distance traveled so far in meters
 * @param remainingM Remaining distance in meters
 * @returns Recommended speed in km/h, or null if not applicable, or -1 if must slow down significantly
 */
export function computeRecommendedSpeedKmH(
  avgKmH: number,
  limitKmH: number,
  distanceSoFarM: number,
  remainingM: number
): number | null {
  if (remainingM <= 0) return null;
  
  const d_s = distanceSoFarM;
  const d_r = remainingM;
  
  // Formula: (v_avg * d_s + x * d_r) / (d_s + d_r) <= limit
  // => x <= (limit * (d_s + d_r) - v_avg * d_s) / d_r
  const x = ((limitKmH * (d_s + d_r)) - (avgKmH * d_s)) / d_r;
  
  if (x < 0) return -1; // "карай много бавно/спри"
  
  // Clamp to reasonable range: minimum 20 km/h, maximum (limit - 5) km/h
  return Math.max(20, Math.min(x, limitKmH - 5));
}

