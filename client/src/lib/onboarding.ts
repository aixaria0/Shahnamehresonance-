const TOUR_COMPLETION_KEY = "shahnameh-court-tour-complete";

function getStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hasCompletedCourtTour() {
  try {
    return getStorage()?.getItem(TOUR_COMPLETION_KEY) === "true";
  } catch {
    return false;
  }
}

export function completeCourtTour() {
  try {
    getStorage()?.setItem(TOUR_COMPLETION_KEY, "true");
  } catch {}
}
