// Shared proximity thresholds for sector detection
// Used consistently across BG task and UI store to avoid flickering

export const PROXIMITY_THRESHOLD_ENTER = 50;   // вход в сектор (метри)
export const PROXIMITY_THRESHOLD_EXIT = 120;   // изход от сектор (по-щедър, за да избегнем фликер)
export const WARNING_DISTANCE_M = 2000;        // early-warning зона (метри)
export const ROUTE_SNAP_THRESHOLD_M = 100;     // близост до трасе за предупреждения (метри)

// GPS quality thresholds
export const GPS_MAX_ACCURACY_M = 30;          // максимална точност за валидна точка
export const GPS_SPIKE_THRESHOLD_KMH = 50;     // максимална промяна в скоростта за 1s (за spike detection)

// Speed readings buffer
export const MAX_SPEED_READINGS = 60;          // максимален брой скоростни показания (rolling window ~60s при 1Hz)

