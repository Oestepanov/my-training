(function () {
  "use strict";

  const DATA_PATH = "data/training.json";
  const DRAFT_KEY = "my-training-draft-v1";
  const apiBase = "https://api.github.com";
  let token = "";
  let owner = "";
  let repository = "my-training-data";
  let fileSha = "";
  let data = TrainingCore.normalizeData(null);
  let currentWorkoutId = "1";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const els = {
    app: $("#app"),
    appMessage: $("#appMessage"),
    completionBar: $("#completionBar"),
    connectionButton: $("#connectionButton"),
    connectionForm: $("#connectionForm"),
    connectionLabel: $("#connectionLabel"),
    connectionMessage: $("#connectionMessage"),
    connectionPanel: $("#connectionPanel"),
    exerciseList: $("#exerciseList"),
    exerciseSelect: $("#exerciseSelect"),
    historyList: $("#historyList"),
    repoInput: $("#repoInput"),
    remainingLabel: $("#remainingLabel"),
    saveButton: $("#saveButton"),
    sessionDate: $("#sessionDate"),
    tokenInput: $("#tokenInput"),
    workoutSelect: $("#workoutSelect"),
    workoutForm: $("#workoutForm"),
    workoutTitle: $("#workoutTitle"),
  };

  function message(element, text, type = "") {
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.message || `GitHub вернул ошибку ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  function decodeBase64Utf8(value) {
    const bytes = Uint8Array.from(atob(value.replace(/\n/g, "")), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary);
  }

  async function loadRemoteData() {
    const encodedPath = DATA_PATH.split("/").map(encodeURIComponent).join("/");
    const payload = await request(`${apiBase}/repos/${owner}/${repository}/contents/${encodedPath}`);
    fileSha = payload.sha;
    return TrainingCore.normalizeData(JSON.parse(decodeBase64Utf8(payload.content)));
  }

  async function saveRemoteData(nextData, sha) {
    const encodedPath = DATA_PATH.split("/").map(encodeURIComponent).join("/");
    const payload = await request(`${apiBase}/repos/${owner}/${repository}/contents/${encodedPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Сохранить тренировку ${new Date().toISOString().slice(0, 10)}`,
        content: encodeBase64Utf8(`${JSON.stringify(nextData, null, 2)}\n`),
        sha,
      }),
    });
    fileSha = payload.content.sha;
  }

  function today() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function getWorkout() {
    return data.workouts.find((item) => String(item.id) === String(currentWorkoutId));
  }

  function loadDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return draft?.workoutId === currentWorkoutId ? draft : null;
    } catch (_) {
      return null;
    }
  }

  function collectDraft() {
    return {
      workoutId: currentWorkoutId,
      date: els.sessionDate.value,
      exercises: $$(".exercise-card").map((card) => ({
        exerciseId: card.dataset.exerciseId,
        name: card.dataset.exerciseName,
        weight: Number(card.querySelector(".weight-input").value) || 0,
        sets: Number(card.querySelector(".sets-input").value) || 0,
        reps: Number(card.querySelector(".reps-input").value) || 0,
        completed: card.querySelector(".done-input").checked,
      })),
    };
  }

  function persistDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
    updateCompletion();
  }

  function updateCompletion() {
    const checks = $$(".done-input");
    const done = checks.filter((item) => item.checked).length;
    const remaining = checks.length - done;
    els.remainingLabel.textContent = `Осталось: ${remaining} из ${checks.length}`;
    els.completionBar.style.width = checks.length ? `${(done / checks.length) * 100}%` : "0%";
    $$(".exercise-card").forEach((card) => card.classList.toggle("completed", card.querySelector(".done-input").checked));
  }

  function renderWorkout() {
    const workout = getWorkout();
    if (!workout) return;
    els.workoutTitle.textContent = workout.name || `Тренировка №${workout.id}`;
    const latest = TrainingCore.latestMetrics(data, currentWorkoutId);
    const draft = loadDraft();
    els.sessionDate.value = draft?.date || today();
    els.exerciseList.innerHTML = "";

    workout.exercises.forEach((exercise) => {
      const item = $("#exerciseTemplate").content.firstElementChild.cloneNode(true);
      const previous = latest.get(exercise.id);
      const draftItem = draft?.exercises?.find((entry) => entry.exerciseId === exercise.id);
      const source = draftItem || previous || {};
      item.dataset.exerciseId = exercise.id;
      item.dataset.exerciseName = exercise.name;
      item.querySelector(".exercise-name").textContent = exercise.name;
      item.querySelector(".previous").textContent = previous
        ? `Ранее: ${previous.weight} кг × ${previous.reps}, ${previous.sets} подх.`
        : "Предыдущих данных нет";
      item.querySelector(".weight-input").value = source.weight ?? "";
      item.querySelector(".sets-input").value = source.sets ?? "";
      item.querySelector(".reps-input").value = source.reps ?? "";
      item.querySelector(".done-input").checked = Boolean(draftItem?.completed);
      item.addEventListener("input", persistDraft);
      item.addEventListener("change", persistDraft);
      els.exerciseList.append(item);
    });
    updateCompletion();
  }

  function renderHistory() {
    els.historyList.innerHTML = "";
    const sessions = [...data.history].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!sessions.length) {
      els.historyList.innerHTML = '<p class="empty">История пока пуста.</p>';
      return;
    }
    for (const session of sessions) {
      const workout = data.workouts.find((item) => String(item.id) === String(session.workoutId));
      const done = (session.exercises || []).filter((item) => item.completed).length;
      const details = document.createElement("details");
      details.className = "history-card";
      details.innerHTML = `
        <summary>${escapeHtml(workout?.name || `Тренировка №${session.workoutId}`)} · ${formatDate(session.date)}</summary>
        <p class="history-meta">Выполнено ${done} из ${(session.exercises || []).length}</p>
        <table class="history-table">
          <thead><tr><th>Упражнение</th><th>Вес</th><th>Подх.</th><th>Повт.</th></tr></thead>
          <tbody>${(session.exercises || []).map((item) => `
            <tr><td>${item.completed ? "✓ " : "— "}${escapeHtml(item.name)}</td><td>${item.weight}</td><td>${item.sets}</td><td>${item.reps}</td></tr>
          `).join("")}</tbody>
        </table>`;
      els.historyList.append(details);
    }
  }

  function formatDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value ?? "");
    return span.innerHTML;
  }

  function renderExerciseSelect() {
    const current = els.exerciseSelect.value;
    els.exerciseSelect.innerHTML = data.workouts.flatMap((workout) => workout.exercises).map((exercise) =>
      `<option value="${escapeHtml(exercise.id)}">${escapeHtml(exercise.name)}</option>`,
    ).join("");
    if ([...els.exerciseSelect.options].some((option) => option.value === current)) els.exerciseSelect.value = current;
    drawChart();
  }

  function drawChart() {
    const canvas = $("#progressChart");
    const empty = $("#chartEmpty");
    const ctx = canvas.getContext("2d");
    const points = TrainingCore.chartSeries(data, els.exerciseSelect.value);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    empty.classList.toggle("hidden", points.length > 0);
    if (!points.length) return;

    const pad = { left: 70, right: 35, top: 34, bottom: 62 };
    const plotW = canvas.width - pad.left - pad.right;
    const plotH = canvas.height - pad.top - pad.bottom;
    const max = Math.max(...points.map((item) => item.weight), 1);
    const min = Math.min(...points.map((item) => item.weight), 0);
    const range = Math.max(max - min, 1);
    const x = (index) => pad.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
    const y = (weight) => pad.top + plotH - ((weight - min) / range) * plotH;

    ctx.strokeStyle = "#333d2b";
    ctx.fillStyle = "#a8b29e";
    ctx.font = "20px system-ui";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const value = min + (range * i) / 4;
      const py = y(value);
      ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(canvas.width - pad.right, py); ctx.stroke();
      ctx.fillText(`${value.toFixed(value % 1 ? 1 : 0)} кг`, 8, py + 7);
    }

    ctx.strokeStyle = "#c8f56a";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(x(index), y(point.weight)) : ctx.moveTo(x(index), y(point.weight)));
    ctx.stroke();
    points.forEach((point, index) => {
      ctx.fillStyle = "#c8f56a";
      ctx.beginPath(); ctx.arc(x(index), y(point.weight), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a8b29e";
      ctx.textAlign = "center";
      ctx.fillText(point.date.slice(5).replace("-", "."), x(index), canvas.height - 22);
    });
    ctx.textAlign = "start";
  }

  function renderApp() {
    currentWorkoutId = String(data.ui.lastSelectedWorkoutId || data.workouts[0]?.id || "1");
    els.workoutSelect.innerHTML = data.workouts.map((item) =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || `Тренировка №${item.id}`)}</option>`,
    ).join("");
    els.workoutSelect.value = currentWorkoutId;
    renderWorkout();
    renderHistory();
    renderExerciseSelect();
  }

  async function connect(event) {
    event.preventDefault();
    token = els.tokenInput.value.trim();
    repository = els.repoInput.value.trim();
    if (!token || !repository) return;
    message(els.connectionMessage, "Проверяю доступ…");
    try {
      const user = await request(`${apiBase}/user`);
      owner = user.login;
      data = await loadRemoteData();
      if (!data.workouts.length) throw new Error("В JSON нет программ тренировок.");
      els.tokenInput.value = "";
      els.connectionPanel.classList.add("hidden");
      els.app.classList.remove("hidden");
      els.connectionButton.classList.add("connected");
      els.connectionLabel.textContent = `${owner}/${repository}`;
      renderApp();
      message(els.appMessage, "Данные загружены из приватного репозитория.", "success");
    } catch (error) {
      token = "";
      message(els.connectionMessage, friendlyError(error), "error");
    }
  }

  function friendlyError(error) {
    if (error.status === 401) return "Токен не принят GitHub. Проверьте его значение и срок действия.";
    if (error.status === 404) return `Репозиторий или файл ${DATA_PATH} не найден. Проверьте имя и доступ токена.`;
    if (error.status === 403) return "У токена недостаточно прав. Нужен Contents: Read and write только для репозитория данных.";
    return error.message || "Не удалось подключиться к GitHub.";
  }

  async function saveWorkout(event) {
    event.preventDefault();
    const draft = collectDraft();
    if (!draft.exercises.some((item) => item.completed)) {
      message(els.appMessage, "Отметьте хотя бы одно выполненное упражнение.", "error");
      return;
    }
    els.saveButton.disabled = true;
    message(els.appMessage, "Сохраняю в приватный репозиторий…");
    try {
      const latestRemote = await loadRemoteData();
      const session = {
        id: TrainingCore.makeId(),
        date: draft.date,
        workoutId: currentWorkoutId,
        createdAt: new Date().toISOString(),
        exercises: draft.exercises,
      };
      const merged = TrainingCore.mergeSession(TrainingCore.mergeRemoteWithLocal(latestRemote, data), session);
      await saveRemoteData(merged, fileSha);
      data = merged;
      localStorage.removeItem(DRAFT_KEY);
      renderWorkout();
      renderHistory();
      drawChart();
      message(els.appMessage, "Тренировка сохранена.", "success");
    } catch (error) {
      message(els.appMessage, friendlyError(error), "error");
    } finally {
      els.saveButton.disabled = false;
    }
  }

  els.connectionForm.addEventListener("submit", connect);
  els.connectionButton.addEventListener("click", () => {
    if (token) return;
    els.connectionPanel.classList.toggle("hidden");
  });
  els.workoutSelect.addEventListener("change", () => {
    currentWorkoutId = els.workoutSelect.value;
    data.ui.lastSelectedWorkoutId = currentWorkoutId;
    renderWorkout();
  });
  els.exerciseSelect.addEventListener("change", drawChart);
  els.workoutForm.addEventListener("submit", saveWorkout);
  els.sessionDate.value = today();

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    $$(".view").forEach((view) => view.classList.add("hidden"));
    $(`#${tab.dataset.view}View`).classList.remove("hidden");
    if (tab.dataset.view === "progress") drawChart();
  }));
})();
