const ACTIVE_STATUSES = new Set(["status:approved", "status:active"]);
const DISPLAY_STATUSES = new Set(["status:approved", "status:active", "status:pending"]);

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

function issueCreateUrl(gitHost, repoSlug, prefill = {}) {
  if (!repoSlug) return "#";
  const params = new URLSearchParams({
    labels: "booking,status:pending"
  });

  if (prefill.resourceId) {
    params.set("title", `[BOOKING] ${prefill.resourceId} <start-end>`);
    params.set(
      "body",
      [
        "### Resource ID",
        prefill.resourceId,
        "",
        "### Start (UTC)",
        "YYYY-MM-DDTHH:MM:SSZ",
        "",
        "### End (UTC)",
        "YYYY-MM-DDTHH:MM:SSZ",
        "",
        "### Reason",
        "Describe the technical reason.",
        "",
        "### Contact",
        "@username",
        "",
        "### Security policy",
        "- [x] I will not include credentials or secrets in this issue."
      ].join("\n")
    );
  } else {
    params.set("template", "booking.md");
  }

  return `${gitHost}/${repoSlug}/issues/new?${params.toString()}`;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatUtc(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toISOString().replace(".000", "");
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

function renderResourceCard(resource, currentReservation, bookUrl) {
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
  const until = currentReservation ? formatUtc(currentReservation.end_utc) : "-";

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
      <td>${formatUtc(item.start_utc)}</td>
      <td>${formatUtc(item.end_utc)}</td>
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
    const resourceBookUrl = issueCreateUrl(gitHost, repoSlug, { resourceId: resource.id });
    list.appendChild(renderResourceCard(resource, current, resourceBookUrl));
  });

  const sortedReservations = [...reservations].sort((a, b) => {
    const d1 = parseDate(a.start_utc);
    const d2 = parseDate(b.start_utc);
    return (d1?.getTime() || 0) - (d2?.getTime() || 0);
  });
  renderReservations(sortedReservations);

  const updated = reservationsData.generated_at || resourcesData.generated_at || new Date().toISOString();
  document.getElementById("last-updated").textContent = `Data updated: ${formatUtc(updated)}`;

  const link = document.getElementById("new-booking-link");
  link.href = issueCreateUrl(gitHost, repoSlug);
}

loadDashboard().catch((error) => {
  const list = document.getElementById("resource-list");
  list.innerHTML = `<div class="card">Loading error: ${error.message}</div>`;
});
