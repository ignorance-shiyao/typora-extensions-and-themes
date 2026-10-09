// Writing Stats detail view (L1 page in the detail panel).
const view = window.typora.view;

function key(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function refresh() {
  const [days = {}, settings = {}] = await Promise.all([view.storage.get("days"), view.settings()]);
  const goal = Number(settings.dailyGoal) || 500;
  const now = new Date();
  const todayCount = days[key(now)] ?? 0;
  document.getElementById("count").textContent = todayCount.toLocaleString();
  document.getElementById("bar").style.width = `${Math.min(100, (todayCount / goal) * 100)}%`;
  document.getElementById("goal-text").textContent = `${Math.round((todayCount / goal) * 100)}% of ${goal.toLocaleString()} words`;
  const history = document.getElementById("history");
  history.replaceChildren();
  const values = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    values.push([key(d), days[key(d)] ?? 0]);
  }
  const max = Math.max(goal, ...values.map(([, v]) => v));
  for (const [day, value] of values) {
    const bar = document.createElement("div");
    bar.className = "day" + (day === key(now) ? " today" : "");
    bar.style.height = `${(value / max) * 100}%`;
    bar.title = `${day}: ${value} words`;
    history.append(bar);
  }
}

void refresh();
setInterval(() => void refresh(), 3000);
