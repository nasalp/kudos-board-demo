// Kudos Board front end — plain JS, no build step.
const $ = (id) => document.getElementById(id);
let users = [];

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

function me() {
  return Number($("me").value);
}

function showMessage(text, kind) {
  const el = $("message");
  el.textContent = text;
  el.className = kind ?? "";
}

function renderTeammates() {
  const box = $("teammates");
  box.replaceChildren();
  for (const u of users.filter((u) => u.id !== me())) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `👍 ${u.name}`;
    btn.dataset.userId = u.id;
    btn.addEventListener("click", () => give(u));
    box.append(btn);
  }
}

async function give(to) {
  try {
    await api("/kudos", { method: "POST", body: JSON.stringify({ fromUserId: me(), toUserId: to.id }) });
    showMessage(`Kudos sent to ${to.name}!`, "ok");
    await refresh();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function refresh() {
  const [board, recent] = await Promise.all([api("/leaderboard"), api("/kudos/recent")]);

  $("leaderboard").replaceChildren(
    ...board.map((e) => {
      const li = document.createElement("li");
      li.textContent = `${e.name} — ${"★".repeat(Math.min(e.count, 10))} ${e.count}`;
      return li;
    }),
  );
  $("board-empty").hidden = board.length > 0;

  $("recent").replaceChildren(
    ...recent.map((k) => {
      const li = document.createElement("li");
      const time = new Date(k.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.textContent = `${k.from} → ${k.to} (${time})`;
      return li;
    }),
  );
}

async function init() {
  users = await api("/users");
  const select = $("me");
  select.replaceChildren(...users.map((u) => new Option(u.name, u.id)));
  const saved = localStorage.getItem("kudos.me");
  if (saved && users.some((u) => String(u.id) === saved)) select.value = saved;
  select.addEventListener("change", () => {
    localStorage.setItem("kudos.me", select.value);
    showMessage("");
    renderTeammates();
  });
  renderTeammates();
  await refresh();
}

init().catch((err) => showMessage(`Could not load the board: ${err.message}`, "error"));
