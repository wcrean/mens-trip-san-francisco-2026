import { QUESTIONS } from "./questions.js";
import {
  initializeFirebase,
  getCurrentUser,
  createRoom,
  joinRoom,
  subscribeToRoom,
  subscribeToPlayers,
  subscribeToAnswers,
  startGame,
  submitAnswer,
  revealRound,
  showStandings,
  nextRound,
  resetGame,
  endGame,
  deleteRoom
} from "./firebase-service.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const GAME_LENGTH = 5;

const REACTION_IMAGES = {
  correct: [
    "correct-avi.webp", "correct-baker.webp", "correct-bill.webp", "correct-gus.webp",
    "correct-james.webp", "correct-jason.webp", "correct-roland.webp", "correct-tato.webp"
  ],
  incorrect: [
    "incorrect-avi.webp", "incorrect-baker.webp", "incorrect-bill.webp", "incorrect-gus.webp",
    "incorrect-james.webp", "incorrect-jason.webp", "incorrect-roland.webp", "incorrect-tato.webp"
  ]
};

const state = {
  roomCode: localStorage.getItem("mensTripTriviaRoom") || "",
  room: null,
  players: [],
  answers: [],
  isHost: false,
  selectedChoice: null,
  unsubscribers: [],
  answerUnsubscriber: null
};

const screens = {
  loading: $("#screen-loading"),
  home: $("#screen-home"),
  create: $("#screen-create"),
  lobby: $("#screen-lobby"),
  question: $("#screen-question"),
  reveal: $("#screen-reveal"),
  standings: $("#screen-standings"),
  finished: $("#screen-finished"),
  error: $("#screen-error")
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
}

function setError(message, technical = "") {
  $("#error-message").textContent = message;
  $("#error-details").textContent = technical;
  showScreen("error");
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("auth/operation-not-allowed")) {
    return "Anonymous sign-in is not enabled in Firebase Authentication.";
  }
  if (code.includes("permission-denied")) {
    return "Firestore denied access. Publish the included firestore.rules file.";
  }
  if (code.includes("network-request-failed")) {
    return "Firebase could not be reached. Check your internet connection.";
  }
  return error?.message || "An unexpected error occurred.";
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function shuffledQuestionIds(count) {
  return [...QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(question => question.id);
}

function currentQuestion() {
  if (!state.room) return null;
  const id = state.room.questionIds?.[state.room.roundIndex];
  return QUESTIONS.find(question => question.id === id) || null;
}

function saveRoom(code) {
  state.roomCode = code;
  localStorage.setItem("mensTripTriviaRoom", code);
}

function leaveRoom() {
  state.answerUnsubscriber?.();
  state.answerUnsubscriber = null;
  state.unsubscribers.forEach(unsubscribe => unsubscribe?.());
  state.unsubscribers = [];
  state.roomCode = "";
  state.room = null;
  state.players = [];
  state.answers = [];
  state.selectedChoice = null;
  localStorage.removeItem("mensTripTriviaRoom");
  $("#room-label").textContent = "";
  showScreen("home");
}

function subscribe(code) {
  state.answerUnsubscriber?.();
  state.answerUnsubscriber = null;
  state.unsubscribers.forEach(unsubscribe => unsubscribe?.());
  state.unsubscribers = [];

  const roomUnsub = subscribeToRoom(code, room => {
    if (!room) {
      leaveRoom();
      return;
    }

    state.room = room;
    state.isHost = room.hostId === getCurrentUser().uid;
    $("#room-label").textContent = `Room ${code}`;
    routeRoom();
  }, error => setError(friendlyError(error), error?.message));

  const playerUnsub = subscribeToPlayers(code, players => {
    state.players = players;
    renderPlayers();
    renderScoreboard();
  }, error => setError(friendlyError(error), error?.message));

  state.unsubscribers.push(roomUnsub, playerUnsub);
}

function routeRoom() {
  if (!state.room) return;

  const status = state.room.status;
  if (status === "lobby") {
    renderLobby();
    showScreen("lobby");
  } else if (status === "question") {
    renderQuestion();
    showScreen("question");
  } else if (status === "reveal") {
    renderReveal();
    showScreen("reveal");
  } else if (status === "standings") {
    renderStandings();
    showScreen("standings");
  } else if (status === "finished") {
    renderFinished();
    showScreen("finished");
  }
}

function renderPlayers() {
  const html = state.players.map(player => `
    <div class="player-row">
      <span>${escapeHtml(player.name)}${player.isHost ? " 👑" : ""}</span>
      <strong>${player.score ?? 0}</strong>
    </div>
  `).join("");

  $("#player-list").innerHTML = html || '<p class="muted">No players yet.</p>';
  $("#player-count").textContent = String(state.players.length);
}

function renderLobby() {
  $("#room-code").textContent = state.roomCode;
  $("#host-lobby-controls").classList.toggle("hidden", !state.isHost);
  $("#lobby-status").textContent = state.isHost
    ? "Share the room code, then start when everyone has joined."
    : "Waiting for the host to start the game.";
}

function resetAnswerSubscription() {
  state.answerUnsubscriber?.();
  state.answerUnsubscriber = subscribeToAnswers(
    state.roomCode,
    state.room.roundIndex,
    answers => {
      state.answers = answers;
      $("#answer-progress").textContent = `${answers.length} answered`;
      renderRevealVotes();
    },
    error => setError(friendlyError(error), error?.message)
  );
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) {
    setError("The question could not be loaded.");
    return;
  }

  state.selectedChoice = null;
  $("#round-progress").textContent =
    `Question ${state.room.roundIndex + 1} of ${state.room.roundCount}`;
  $("#question-stem").textContent = question.stem;
  $("#choice-list").innerHTML = question.choices.map((choice, index) => `
    <button class="choice-button" data-choice="${index}">
      <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
      <span>${escapeHtml(choice)}</span>
    </button>
  `).join("");

  $("#host-question-controls").classList.toggle("hidden", !state.isHost);
  $("#reveal-button").disabled = false;
  $("#submitted-panel").classList.add("hidden");
  resetAnswerSubscription();
}

function renderReveal() {
  const question = currentQuestion();
  if (!question) return;

  renderReactionImage(question);
  $("#reveal-answer").textContent = question.choices[question.correctIndex];
  $("#reveal-note").textContent = question.note;
  $("#host-reveal-controls").classList.toggle("hidden", !state.isHost);
  renderRevealVotes();
  renderRightWrong(question);
}


function renderRightWrong(question) {
  const answerByPlayer = new Map(state.answers.map(answer => [answer.id, answer]));
  const right = [];
  const wrong = [];

  state.players.forEach(player => {
    const answer = answerByPlayer.get(player.id);
    if (!answer) {
      wrong.push(`${player.name} (no answer)`);
    } else if (answer.choiceIndex === question.correctIndex) {
      right.push(player.name);
    } else {
      wrong.push(player.name);
    }
  });

  $("#right-player-list").innerHTML = right.length
    ? right.map(name => `<span class="name-chip right-chip">${escapeHtml(name)}</span>`).join("")
    : '<span class="muted">Nobody</span>';
  $("#wrong-player-list").innerHTML = wrong.length
    ? wrong.map(name => `<span class="name-chip wrong-chip">${escapeHtml(name)}</span>`).join("")
    : '<span class="muted">Nobody</span>';
}

function renderStandings() {
  renderScoreboard();
  const questionNumber = state.room.roundIndex + 1;
  $("#standings-progress").textContent = `After Question ${questionNumber} of ${state.room.roundCount}`;
  $("#host-standings-controls").classList.toggle("hidden", !state.isHost);
  $("#standings-waiting").textContent = state.isHost
    ? "Advance when everyone is ready."
    : "Waiting for the host to continue.";
  $("#next-round-button").textContent =
    questionNumber >= state.room.roundCount ? "Show Final Results" : "Next Question";
}

function renderReactionImage(question) {
  const card = $("#reaction-card");
  const image = $("#reaction-image");
  const userId = getCurrentUser().uid;
  const myAnswer = state.answers.find(answer => answer.id === userId);

  if (!myAnswer) {
    card.classList.add("hidden");
    image.removeAttribute("src");
    return;
  }

  const result = myAnswer.choiceIndex === question.correctIndex ? "correct" : "incorrect";
  const choices = REACTION_IMAGES[result];
  const seed = [...`${state.roomCode}-${state.room.roundIndex}-${userId}`]
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const filename = choices[seed % choices.length];

  image.src = `./images/reactions/${filename}`;
  image.alt = result === "correct" ? "Correct answer reaction" : "Incorrect answer reaction";
  card.classList.remove("hidden");
}

function renderRevealVotes() {
  const container = $("#vote-results");
  if (!state.room || !container) return;
  const question = currentQuestion();
  if (!question) return;

  const counts = question.choices.map((_, index) =>
    state.answers.filter(answer => answer.choiceIndex === index).length
  );

  container.innerHTML = question.choices.map((choice, index) => `
    <div class="result-row ${index === question.correctIndex ? "correct" : ""}">
      <span>${escapeHtml(choice)}</span>
      <strong>${counts[index]}</strong>
    </div>
  `).join("");
}

function renderScoreboard() {
  const html = state.players.map((player, index) => `
    <div class="score-row">
      <span><strong>${index + 1}.</strong> ${escapeHtml(player.name)}</span>
      <strong>${player.score ?? 0}</strong>
    </div>
  `).join("");

  $("#scoreboard").innerHTML = html;
  $("#final-scoreboard").innerHTML = html;
}

function renderFinished() {
  renderScoreboard();
  const winner = state.players[0];
  $("#winner-text").textContent = winner
    ? `${winner.name} wins with ${winner.score ?? 0} points!`
    : "Game over!";
  $("#host-final-controls").classList.toggle("hidden", !state.isHost);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function restoreSavedRoom() {
  if (!state.roomCode) {
    showScreen("home");
    return;
  }
  subscribe(state.roomCode);
}

$("#show-create-button").addEventListener("click", () => showScreen("create"));
$("#show-join-button").addEventListener("click", () => {
  $("#join-form").classList.toggle("hidden");
});
$("#back-home-button").addEventListener("click", () => showScreen("home"));
$("#retry-button").addEventListener("click", () => location.reload());
$("#leave-game-button").addEventListener("click", leaveRoom);

$("#create-form").addEventListener("submit", async event => {
  event.preventDefault();
  const hostName = $("#host-name").value.trim();
  const roundCount = GAME_LENGTH;
  const button = event.submitter;
  button.disabled = true;

  try {
    let code;
    let attempts = 0;
    while (attempts < 5) {
      code = randomCode();
      try {
        await createRoom({
          code,
          hostName,
          roundCount,
          questionIds: shuffledQuestionIds(roundCount)
        });
        break;
      } catch (error) {
        if (!error.message.includes("already in use")) throw error;
      }
      attempts += 1;
    }

    if (!code) throw new Error("Could not create a unique room code.");
    saveRoom(code);
    subscribe(code);
  } catch (error) {
    setError(friendlyError(error), error?.message);
  } finally {
    button.disabled = false;
  }
});


$("#join-code").addEventListener("input", event => {
  event.currentTarget.value = event.currentTarget.value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 5);
});

$("#join-form").addEventListener("submit", async event => {
  event.preventDefault();
  const playerName = $("#join-name").value.trim();
  const code = $("#join-code").value.trim().toUpperCase();
  const button = event.submitter;
  button.disabled = true;

  try {
    await joinRoom({ code, playerName });
    saveRoom(code);
    subscribe(code);
  } catch (error) {
    $("#home-error").textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
});

$("#share-room-button").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}?room=${state.roomCode}`;
  try {
    await navigator.share({ title: "Join Men’s Trip Trivia", text: `Join room ${state.roomCode}`, url });
  } catch {
    await navigator.clipboard.writeText(`${state.roomCode} — ${url}`);
    $("#lobby-status").textContent = "Invite copied to clipboard.";
  }
});

$("#start-game-button").addEventListener("click", () =>
  startGame(state.roomCode).catch(error => setError(friendlyError(error), error?.message))
);

$("#choice-list").addEventListener("click", async event => {
  const button = event.target.closest("[data-choice]");
  if (!button) return;

  const choiceIndex = Number(button.dataset.choice);
  state.selectedChoice = choiceIndex;
  $$(".choice-button").forEach(choice =>
    choice.classList.toggle("selected", Number(choice.dataset.choice) === choiceIndex)
  );

  try {
    await submitAnswer(state.roomCode, state.room.roundIndex, choiceIndex);
    $("#submitted-panel").classList.remove("hidden");
  } catch (error) {
    setError(friendlyError(error), error?.message);
  }
});

$("#reveal-button").addEventListener("click", async event => {
  const question = currentQuestion();
  if (!question) return;

  event.currentTarget.disabled = true;
  try {
    await revealRound(state.roomCode, state.room.roundIndex, question.correctIndex);
  } catch (error) {
    event.currentTarget.disabled = false;
    setError(friendlyError(error), error?.message);
  }
});

$("#show-standings-button").addEventListener("click", () =>
  showStandings(state.roomCode).catch(error => setError(friendlyError(error), error?.message))
);

$("#next-round-button").addEventListener("click", () =>
  nextRound(state.roomCode, state.room.roundIndex, state.room.roundCount)
    .catch(error => setError(friendlyError(error), error?.message))
);

$("#play-again-button").addEventListener("click", () =>
  resetGame(state.roomCode).catch(error => setError(friendlyError(error), error?.message))
);

async function finishGameEarly() {
  if (!state.isHost) return;
  const confirmed = window.confirm("End the game now and show the current final scores?");
  if (!confirmed) return;

  try {
    await endGame(state.roomCode);
  } catch (error) {
    setError(friendlyError(error), error?.message);
  }
}

async function endRoom() {
  try {
    await deleteRoom(state.roomCode);
    leaveRoom();
  } catch (error) {
    setError(friendlyError(error), error?.message);
  }
}
$("#end-game-question-button").addEventListener("click", finishGameEarly);
$("#end-game-reveal-button").addEventListener("click", finishGameEarly);
$("#end-game-standings-button").addEventListener("click", finishGameEarly);
$("#delete-room-button").addEventListener("click", endRoom);
$("#finish-room-button").addEventListener("click", endRoom);

window.addEventListener("online", () => $("#offline-banner").classList.add("hidden"));
window.addEventListener("offline", () => $("#offline-banner").classList.remove("hidden"));

(async function start() {
  try {
    $("#loading-text").textContent = "Signing in anonymously…";
    await initializeFirebase();

    const roomFromUrl = new URLSearchParams(location.search).get("room");
    if (roomFromUrl && !state.roomCode) {
      $("#join-code").value = roomFromUrl.toUpperCase();
      $("#join-form").classList.remove("hidden");
    }

    $("#loading-text").textContent = "Ready.";
    await restoreSavedRoom();
  } catch (error) {
    console.error("Men’s Trip Trivia startup failed:", error);
    setError(friendlyError(error), `${error?.code || ""}\n${error?.message || error}`);
  }
})();
