const ACTIVE_STATUSES = new Set(["status:approved", "status:active"]);
const BUSY_STATUSES = new Set(["status:pending", "status:approved", "status:active"]);
const DISPLAY_STATUSES = new Set(["status:pending", "status:approved", "status:active"]);

function detectRepoSlug() {
  const explicit = document.body.dataset.repo;
  if (explicit) return explicit;

  const host = window.location.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.replace(".github.io", "");
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return `${owner}/${parts[0]}`;
  }
  return "";
}

function detectGitHost() {
  const explicit = document.body.dataset.gitHost;
  if (explicit) return explicit.replace(/\/+$/, "");
  return "https://github.com";
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ceilToMinute(value) {
  const d = new Date(value);
  if (d.getSeconds() > 0 || d.getMilliseconds() > 0) {
    d.setMinutes(d.getMinutes() + 1);
  }
  d.setSeconds(0, 0);
  return d;
}

function addHours(value, hours) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function toUtcNoSeconds(value) {
  const d = ceilToMinute(value);
  return `${d.toISOString().slice(0, 16)}Z`;
}

function formatLocal(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(d);
}

function issueCreateUrl(gitHost, repoSlug, prefill = {}) {
  if (!repoSlug) return "#";

  const startUtc = prefill.startUtc || toUtcNoSeconds(new Date());
  const endUtc = prefill.endUtc || toUtcNoSeconds(addHours(parseDate(startUtc) || new Date(), 24));
  const resourceId = prefill.resourceId || "<resource-id>";

  const body = [
    "Resource ID",
    resourceId,
    "",
    "Start (UTC)",
    startUtc,
    "",
    "End (UTC)",
    endUtc,
    "",
    "Reason",
    "Describe the technical reason.",
    "",
    "Contact",
    "@username"
  ].join("\n");

  const params = new URLSearchParams({
    labels: "booking,status:pending",
    title: `[BOOKING] ${resourceId} <start-end>`,
    body
  });

  return `${gitHost}/${repoSlug}/issues/new?${params.toString()}`;
}

function currentReservationFor(resourceId, reservations, now) {
  return reservations.find((item) => {
    if (item.resource_id !== resourceId) return false;
    if (!ACTIVE_STATUSES.has(item.status)) return false;
    const start = parseDate(item.start_utc);
    const end = parseDate(item.end_utc);
    if (!start || !end) return false;
    return start <= now && now < end;
  });
}

function nextSuggestedWindow(resourceId, reservations, now) {
  const intervals = reservations
    .filter((item) => item.resource_id === resourceId && BUSY_STATUSES.has(item.status))
    .map((item) => ({
      start: parseDate(item.start_utc),
      end: parseDate(item.end_utc)
    }))
    .filter((x) => x.start && x.end && x.start < x.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let cursor = ceilToMinute(now);
  for (const interval of intervals) {
    if (interval.end <= cursor) continue;
    if (interval.start > cursor) break;
    cursor = ceilToMinute(interval.end);
  }

  const start = cursor;
  const end = addHours(start, 24);
  return {
    startUtc: toUtcNoSeconds(start),
    endUtc: toUtcNoSeconds(end)
  };
}

function renderResourceCard(resource, currentReservation, suggestion, bookUrl) {
  const box = document.createElement("article");
  box.className = "card";

  let uiStatus = "free";
  if (resource.status === "offline") uiStatus = "offline";
  if (currentReservation) uiStatus = "occupied";

  const alerts = resource.health?.alerts || [];
  const alertList = alerts.length
    ? `<ul>${alerts.map((x) => `<li>${x}</li>`).join("")}</ul>`
    : "<span class=\"muted\">No alerts</span>";

  const owner = currentReservation?.owner || resource.default_owner || "-";
  const until = currentReservation ? formatLocal(currentReservation.end_utc) : "-";

  box.innerHTML = `
    <div>
      <strong>${resource.name}</strong>
      <span class="meta"> (${resource.id})</span>
    </div>
    <span class="badge ${uiStatus}">${uiStatus.toUpperCase()}</span>
    <div class="meta">Type: ${resource.kind} | Location: ${resource.location}</div>
    <div class="meta">Hostname: <code>${resource.hostname || "-"}</code></div>
    <div class="meta">Public IP: <code>${resource.public_ip || "-"}</code></div>
    <div>Current owner: <strong>${owner}</strong></div>
    <div>Occupied until: <strong>${until}</strong></div>
    <div class="meta">Suggested start (UTC): <code>${suggestion.startUtc}</code></div>
    <div class="meta">Suggested end (UTC): <code>${suggestion.endUtc}</code></div>
    <div>CPU ${resource.health.cpu_pct}% | RAM ${resource.health.memory_pct}% | GPU ${resource.health.gpu_pct}%</div>
    <div>Alerts: ${alertList}</div>
    <div class="meta">SSH: <code>${resource.access.ssh}</code></div>
    <div class="meta">VPN: <a href="${resource.access.vpn_doc}" target="_blank" rel="noreferrer">documentation</a></div>
    <div class="meta">Slurm: <code>${resource.access.slurm}</code></div>
    <div class="meta">${resource.access.notes}</div>
    <div><a class="button secondary" href="${bookUrl}" target="_blank" rel="noreferrer">Book This Machine</a></div>
  `;

  return box;
}

function renderReservations(rows) {
  const tbody = document.getElementById("reservation-table-body");
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan=\"6\">No reservations available</td>";
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const issueLink = item.issue_url
      ? `<a href="${item.issue_url}" target="_blank" rel="noreferrer">#${item.issue_number}</a>`
      : "-";

    tr.innerHTML = `
      <td>${item.resource_id || "-"}</td>
      <td>${item.owner || "-"}</td>
      <td>${formatLocal(item.start_utc)}</td>
      <td>${formatLocal(item.end_utc)}</td>
      <td>${item.status || "-"}</td>
      <td>${issueLink}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadDashboard() {
  const [resourcesRes, reservationsRes] = await Promise.all([
    fetch("./data/resources.json"),
    fetch("./data/reservations.json")
  ]);

  if (!resourcesRes.ok || !reservationsRes.ok) {
    throw new Error("Unable to load dashboard data.");
  }

  const resourcesData = await resourcesRes.json();
  const reservationsData = await reservationsRes.json();
  const resources = resourcesData.resources || [];
  const reservations = (reservationsData.reservations || []).filter((x) => DISPLAY_STATUSES.has(x.status));
  const now = new Date();
  const repoSlug = detectRepoSlug();
  const gitHost = detectGitHost();

  const list = document.getElementById("resource-list");
  list.innerHTML = "";

  resources.forEach((resource) => {
    const current = currentReservationFor(resource.id, reservations, now);
    const suggestion = nextSuggestedWindow(resource.id, reservations, now);
    const resourceBookUrl = issueCreateUrl(gitHost, repoSlug, {
      resourceId: resource.id,
      startUtc: suggestion.startUtc,
      endUtc: suggestion.endUtc
    });
    list.appendChild(renderResourceCard(resource, current, suggestion, resourceBookUrl));
  });

  const sortedReservations = [...reservations].sort((a, b) => {
    const d1 = parseDate(a.start_utc);
    const d2 = parseDate(b.start_utc);
    return (d1?.getTime() || 0) - (d2?.getTime() || 0);
  });
  renderReservations(sortedReservations);

  const updated = reservationsData.generated_at || resourcesData.generated_at || new Date().toISOString();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local timezone";
  document.getElementById("last-updated").textContent = `Data updated: ${formatLocal(updated)} (${timeZone})`;

  const defaultStart = ceilToMinute(now);
  const link = document.getElementById("new-booking-link");
  link.href = issueCreateUrl(gitHost, repoSlug, {
    startUtc: toUtcNoSeconds(defaultStart),
    endUtc: toUtcNoSeconds(addHours(defaultStart, 24))
  });
}

loadDashboard().catch((error) => {
  const list = document.getElementById("resource-list");
  list.innerHTML = `<div class="card">Loading error: ${error.message}</div>`;
});
