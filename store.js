// Simple file-backed store. Good enough for a single-user prototype.
// Holds: Jira OAuth tokens, the connected site/cloud info, app-local incidents,
// per-incident timeline events, comments, and integration settings.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data.json");

const SERVICES = ["Payments API", "Auth Gateway", "Notification Service", "Edge / CDN"];

function seedIncidents() {
  return [
    {
      id: "inc-1001",
      title: "Elevated p99 latency on Payments API",
      status: "Assigned", sev: 2, service: SERVICES[0],
      assignee: "On-call Engineer", time: new Date().toLocaleString(),
      type: "Root Incident", source: "Prometheus",
      primaryKey: null, jira: [], pendingResolve: null,
    },
    {
      id: "inc-1002",
      title: "Auth Gateway 5xx spike in eu-west-1",
      status: "Triggered", sev: 1, service: SERVICES[1],
      assignee: "On-call Engineer", time: new Date().toLocaleString(),
      type: "Root Incident", source: "Datadog",
      primaryKey: null, jira: [], pendingResolve: null,
    },
  ];
}

const defaultState = () => ({
  jira: { accessToken: null, refreshToken: null, expiresAt: 0, cloudId: null, site: null },
  incidents: seedIncidents(),
  commentsById: {},
  eventsById: {},
  settings: {
    syncMode: "two-way", // two-way | jira-to-oppex | oppex-to-jira
    autoResolveConfirm: true,
  },
});

let state = defaultState();

export function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      state = { ...defaultState(), ...raw };
    }
  } catch (e) {
    console.error("Could not load data file, starting fresh:", e.message);
  }
  return state;
}

export function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Could not save data file:", e.message);
  }
}

export function getState() { return state; }

export function setJira(patch) { state.jira = { ...state.jira, ...patch }; save(); }
export function clearJira() { state.jira = defaultState().jira; save(); }
export function isConnected() { return !!state.jira.refreshToken && !!state.jira.cloudId; }

export function findIncident(id) { return state.incidents.find((i) => i.id === id); }

export function pushEvent(id, ev) {
  state.eventsById[id] = state.eventsById[id] || [];
  state.eventsById[id].push({ time: new Date().toLocaleTimeString(), ...ev });
  save();
}

export function addComment(id, comment) {
  state.commentsById[id] = state.commentsById[id] || [];
  state.commentsById[id].push(comment);
  save();
}

export { SERVICES };
