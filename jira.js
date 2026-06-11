// Thin wrapper around Jira Cloud REST v3, with automatic OAuth token refresh.
import { getState, setJira, isConnected } from "./store.js";

const AUTH_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const API_BASE = "https://api.atlassian.com";

// Map a raw Jira issue (REST v3) to the compact shape the front-end uses.
export function mapIssue(issue) {
  const f = issue.fields || {};
  const cat = (f.status?.statusCategory?.key) || "new"; // new | indeterminate | done
  const statusCategory = cat === "done" ? "done" : cat === "indeterminate" ? "inprogress" : "todo";
  const priorityName = f.priority?.name || null;
  const priority =
    priorityName === "Highest" ? "Highest" :
    priorityName === "High" ? "High" :
    priorityName === "Medium" ? "Medium" :
    priorityName === "Low" || priorityName === "Lowest" ? "Low" : "Medium";
  const isEpic = (f.issuetype?.name || "").toLowerCase() === "epic";
  return {
    key: issue.key,
    project: issue.key.split("-")[0],
    type: f.issuetype?.name || "Task",
    isEpic,
    summary: f.summary || "(no summary)",
    statusName: f.status?.name || "Unknown",
    statusCategory,
    priority,
    assignee: f.assignee?.displayName || "Unassigned",
    syncedAgo: "just now",
  };
}

async function refreshIfNeeded() {
  const { jira } = getState();
  if (!jira.refreshToken) throw new Error("Not connected to Jira");
  if (jira.accessToken && Date.now() < jira.expiresAt - 60_000) return jira.accessToken;

  const res = await fetch(AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: jira.refreshToken,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Token refresh failed: " + txt);
  }
  const data = await res.json();
  setJira({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || jira.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

async function jiraFetch(pathname, options = {}) {
  if (!isConnected()) throw new Error("Not connected to Jira");
  const token = await refreshIfNeeded();
  const { jira } = getState();
  const url = `${API_BASE}/ex/jira/${jira.cloudId}/rest/api/3${pathname}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Jira API ${res.status}: ${txt}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export async function getIssue(key) {
  const issue = await jiraFetch(`/issue/${encodeURIComponent(key)}?fields=summary,status,priority,assignee,issuetype`);
  const mapped = mapIssue(issue);
  if (mapped.isEpic) {
    mapped.children = await getEpicChildren(key);
  }
  return mapped;
}

// Epic children: try new "parent = KEY" (team-managed), then "Epic Link" (company-managed).
export async function getEpicChildren(epicKey) {
  const tryJql = async (jql) => {
    const data = await jiraFetch(`/search?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,assignee,issuetype&maxResults=50`);
    return (data.issues || []).map(mapIssue);
  };
  try {
    const kids = await tryJql(`parent = ${epicKey} ORDER BY created ASC`);
    if (kids.length) return kids;
  } catch (e) { /* fall through */ }
  try {
    return await tryJql(`"Epic Link" = ${epicKey} ORDER BY created ASC`);
  } catch (e) {
    return [];
  }
}

export async function searchIssues(text) {
  // If it looks like a key (ABC-123), fetch directly; else do a text search.
  const isKey = /^[A-Z][A-Z0-9]+-\d+$/i.test(text.trim());
  const jql = isKey
    ? `key = ${text.trim().toUpperCase()}`
    : `summary ~ "${text.replace(/"/g, "")}" ORDER BY updated DESC`;
  const data = await jiraFetch(`/search?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,assignee,issuetype&maxResults=10`);
  return (data.issues || []).map(mapIssue);
}

export async function addComment(key, text) {
  // REST v3 wants Atlassian Document Format for the comment body.
  const body = {
    body: {
      type: "doc", version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  };
  return jiraFetch(`/issue/${encodeURIComponent(key)}/comment`, { method: "POST", body: JSON.stringify(body) });
}

// Move an issue to a status in the "done" category (resolve).
export async function transitionToDone(key) {
  const data = await jiraFetch(`/issue/${encodeURIComponent(key)}/transitions`);
  const transitions = data.transitions || [];
  const doneT = transitions.find((t) => t.to?.statusCategory?.key === "done")
    || transitions.find((t) => /done|resolve|close/i.test(t.name));
  if (!doneT) {
    throw new Error(`No 'Done' transition available for ${key}. Available: ${transitions.map((t) => t.name).join(", ") || "none"}`);
  }
  await jiraFetch(`/issue/${encodeURIComponent(key)}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: doneT.id } }),
  });
  return doneT.to?.name || "Done";
}

export async function createIssue({ project, type, summary, assignee }) {
  const body = {
    fields: {
      project: { key: project },
      issuetype: { name: type },
      summary,
    },
  };
  const created = await jiraFetch(`/issue`, { method: "POST", body: JSON.stringify(body) });
  return getIssue(created.key);
}

// Discover the connected site + cloudId after OAuth.
export async function fetchAccessibleResource(accessToken) {
  const res = await fetch(`${API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Could not read accessible resources: " + (await res.text()));
  const arr = await res.json();
  if (!arr.length) throw new Error("This Jira account has no accessible sites for the app.");
  return { cloudId: arr[0].id, site: arr[0].url };
}
