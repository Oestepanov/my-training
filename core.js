(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TrainingCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EMPTY_DATA = Object.freeze({
    schemaVersion: 1,
    workouts: [],
    history: [],
    ui: { lastSelectedWorkoutId: "1" },
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeData(input) {
    const source = input && typeof input === "object" ? input : EMPTY_DATA;
    return {
      schemaVersion: 1,
      workouts: Array.isArray(source.workouts) ? source.workouts : [],
      history: Array.isArray(source.history) ? source.history : [],
      ui: {
        lastSelectedWorkoutId: String(
          source.ui?.lastSelectedWorkoutId || source.workouts?.[0]?.id || "1",
        ),
      },
    };
  }

  function latestMetrics(data, workoutId) {
    const sessions = normalizeData(data).history
      .filter((session) => String(session.workoutId) === String(workoutId))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const result = new Map();
    for (const session of sessions) {
      for (const item of session.exercises || []) {
        if (!result.has(item.exerciseId)) result.set(item.exerciseId, clone(item));
      }
    }
    return result;
  }

  function mergeSession(data, session) {
    const result = normalizeData(clone(data));
    const index = result.history.findIndex((item) => item.id === session.id);
    if (index >= 0) result.history[index] = clone(session);
    else result.history.push(clone(session));
    result.history.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    result.ui.lastSelectedWorkoutId = String(session.workoutId);
    return result;
  }

  function mergeRemoteWithLocal(remote, local) {
    const result = normalizeData(clone(remote));
    const localData = normalizeData(local);
    const known = new Set(result.history.map((item) => item.id));
    for (const session of localData.history) {
      if (!known.has(session.id)) result.history.push(clone(session));
    }
    if (!result.workouts.length && localData.workouts.length) {
      result.workouts = clone(localData.workouts);
    }
    result.history.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    result.ui.lastSelectedWorkoutId = localData.ui.lastSelectedWorkoutId;
    return result;
  }

  function chartSeries(data, exerciseId) {
    return normalizeData(data).history
      .flatMap((session) =>
        (session.exercises || [])
          .filter((item) => item.exerciseId === exerciseId && item.completed)
          .map((item) => ({
            date: session.date,
            weight: Number(item.weight) || 0,
            reps: Number(item.reps) || 0,
            sets: Number(item.sets) || 0,
          })),
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function makeId(prefix = "session") {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  return {
    chartSeries,
    latestMetrics,
    makeId,
    mergeRemoteWithLocal,
    mergeSession,
    normalizeData,
  };
});
