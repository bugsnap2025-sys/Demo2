import "dotenv/config";
import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import {
  load, save, getState, setJira, clearJira, isConnected,
  findIncident, pushEvent, addComment as storeComment,
} from "./store.js";
import {
  getIssue, searchIssues, addComment as jiraComment,
  transitionToDone, createIssue, fetchAccessibleResource, mapIssue,
} from "./jira.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

load();

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const REDIRECT_URI = `${BASE_URL}/auth/callback`;
const SCOPES = [
  "read:jira-work", "write:jira-work", "read:jira-user", "offline_access",
].join(" ");

const canSyncOut = () => ["two-way", "oppex-to-jira"].includes(getState().settings.syncMode);
const canSyncIn = () => ["two-way", "jira-to-oppex"].includes(getState().settings.syncMode);

/* ───────────────────────── health ───────────────────────── */
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* ───────────────────────── OAuth ─────────────────────────── */
let pendingState = null;

app.get("/auth/login", (_req, res) => {
  if (!process.env.JIRA_CLIENT_ID) {
    return res.status(500).send("Server is missing JIRA_CLIENT_ID. Set it in your host's environment settings.");
  }
  pendingState = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://auth.atlassian.com/authorize");
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", process.env.JIRA_CLIENT_ID);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", pendingState);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");
  res.redirect(url.toString());
});

app.get("/auth/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== pendingState) {
      return res.status(400).send("Login check failed. Please go back and click Connect to Jira again.");
    }
    pendingState = null;
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tok = await tokenRes.json();
    const { cloudId, site } = await fetchAccessibleResource(tok.access_token);
    setJira({
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
      cloudId, site,
    });
    res.redirect("/?connected=1");
  } catch (e) {
    console.error("OAuth callback error:", e.message);
    res.status(500).send("Connecting to Jira failed: " + e.message + "  — go back and try again.");
  }
});

app.post("/auth/logout", (_req, res) => { clearJira(); res.json({ ok: true }); });

/* ───────────────────────── app state ─────────────────────── */
app.get("/api/state", (_req, res) => {
  const s = getState();
  res.json({
    connected: isConnected(),
    site: s.jira.site,
    webhookUrl: `${BASE_URL}/webhooks/jira`,
    incidents: s.incidents,
    commentsById: s.commentsById,
    eventsById: s.eventsById,
    settings: s.settings,
  });
});

app.post("/api/settings", (req, res) => {
  const s = getState();
  s.settings = { ...s.settings, ...req.body };
  save();
  res.json({ ok: true, settings: s.settings });
});

/* ───────────────────────── linking ───────────────────────── */
app.get("/api/jira/search", async (req, res) => {
  try { res.json({ results: await searchIssues(req.query.q || "") }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post("/api/incidents/:id/link", async (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  try {
    const issue = await getIssue(req.body.key);
    if (inc.jira.some((t) => t.key === issue.key)) return res.status(400).json({ error: "Already linked" });
    inc.jira.push(issue);
    if (!inc.jira.some((t) => t.key === inc.primaryKey)) inc.primaryKey = issue.key;
    pushEvent(inc.id, { tone: "jira", text: `Linked ${issue.key} to this incident`, sub: issue.summary });
    save();
    res.json({ ok: true, incident: inc });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post("/api/incidents/:id/unlink", (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  inc.jira = inc.jira.filter((t) => t.key !== req.body.key);
  if (inc.primaryKey === req.body.key) inc.primaryKey = inc.jira[0]?.key || null;
  pushEvent(inc.id, { tone: "jira", text: `Unlinked ${req.body.key}` });
  save();
  res.json({ ok: true, incident: inc });
});

app.post("/api/incidents/:id/primary", (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  inc.primaryKey = req.body.key;
  pushEvent(inc.id, { tone: "jira", text: `${req.body.key} set as primary`, sub: "now drives resolution" });
  save();
  res.json({ ok: true, incident: inc });
});

app.post("/api/incidents/:id/refresh", async (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  try {
    for (let i = 0; i < inc.jira.length; i++) {
      try { inc.jira[i] = await getIssue(inc.jira[i].key); }
      catch (e) { inc.jira[i] = { ...inc.jira[i], broken: true, summary: "Can't load — deleted or no access" }; }
    }
    save();
    res.json({ ok: true, incident: inc });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

/* ───────────────────────── create ────────────────────────── */
app.post("/api/incidents/:id/create-ticket", async (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  try {
    const issue = await createIssue(req.body);
    inc.jira.push(issue);
    if (!inc.jira.some((t) => t.key === inc.primaryKey)) inc.primaryKey = issue.key;
    pushEvent(inc.id, { tone: "jira", text: `Created ${issue.key} in Jira and linked it`, sub: issue.summary });
    save();
    res.json({ ok: true, incident: inc, key: issue.key });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

/* ───────────────────────── resolve (outbound) ────────────── */
app.post("/api/incidents/:id/resolve", async (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  inc.status = "Resolved";
  inc.pendingResolve = null;
  const primary = inc.jira.find((t) => t.key === inc.primaryKey);
  try {
    if (primary && canSyncOut()) {
      const to = await transitionToDone(primary.key);
      primary.statusName = to; primary.statusCategory = "done";
      if (primary.isEpic) {
        // best-effort: move children too
        for (const c of primary.children || []) {
          try { const t = await transitionToDone(c.key); c.statusName = t; c.statusCategory = "done"; }
          catch (e) { /* leave child if no transition */ }
        }
      }
      pushEvent(inc.id, { tone: "jira", text: `Primary ${primary.key} transitioned to ${to} in Jira`, sub: "by Oppex · incident resolved" });
    }
    save();
    res.json({ ok: true, incident: inc });
  } catch (e) {
    pushEvent(inc.id, { tone: "jira", text: `Couldn't move ${primary?.key} in Jira`, sub: e.message });
    save();
    res.status(e.status || 500).json({ error: e.message, incident: inc });
  }
});

// Confirm an inbound (Jira-driven) resolve that was waiting for a human.
app.post("/api/incidents/:id/confirm-resolve", (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  const reason = inc.pendingResolve?.key;
  inc.status = "Resolved"; inc.pendingResolve = null;
  pushEvent(inc.id, { tone: "jira", text: `Resolved from Jira — confirmed by responder`, sub: `triggered by ${reason}` });
  save();
  res.json({ ok: true, incident: inc });
});

app.post("/api/incidents/:id/dismiss-resolve", (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  const reason = inc.pendingResolve?.key;
  inc.pendingResolve = null;
  pushEvent(inc.id, { tone: "jira", text: `Kept open despite ${reason} closing`, sub: "auto-resolve declined" });
  save();
  res.json({ ok: true, incident: inc });
});

/* ───────────────────────── comments ──────────────────────── */
app.post("/api/incidents/:id/comment", async (req, res) => {
  const inc = findIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  const { text, toJira } = req.body;
  const primary = inc.jira.find((t) => t.key === inc.primaryKey) || inc.jira.find((t) => !t.broken);
  let synced = null;
  try {
    if (toJira && primary && canSyncOut()) {
      await jiraComment(primary.key, text);
      synced = primary.key;
      pushEvent(inc.id, { tone: "jira", text: `Comment synced to ${primary.key}`, sub: "primary ticket" });
    }
    storeComment(inc.id, { author: "You (Oppex)", text, time: new Date().toLocaleString(), origin: "oppex", synced });
    res.json({ ok: true });
  } catch (e) {
    storeComment(inc.id, { author: "You (Oppex)", text, time: new Date().toLocaleString(), origin: "oppex", synced: null });
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ───────────────────────── webhook (inbound) ─────────────── */
// Jira posts here when an issue changes. We match the issue key to a linked
// incident, update the cached ticket, and (for the primary) stage a resolve.
app.post("/webhooks/jira", (req, res) => {
  res.json({ ok: true }); // ack fast
  try {
    const evt = req.body || {};
    const issue = evt.issue;
    if (!issue?.key) return;
    const mapped = (() => { try { return mapIssue(issue); } catch { return null; } })();
    const state = getState();
    let commentText = evt.comment?.body && typeof evt.comment.body === "string" ? evt.comment.body : null;

    for (const inc of state.incidents) {
      const idx = inc.jira.findIndex((t) => t.key === issue.key);
      if (idx === -1) continue;

      // Mirror an inbound Jira comment
      if (evt.webhookEvent === "comment_created" && commentText) {
        storeComment(inc.id, { author: (evt.comment?.author?.displayName || "Jira user") + " (Jira)", text: commentText, time: new Date().toLocaleString(), origin: "jira" });
      }

      if (mapped) {
        const wasDone = inc.jira[idx].statusCategory === "done";
        inc.jira[idx] = { ...inc.jira[idx], ...mapped, children: inc.jira[idx].children };
        const nowDone = mapped.statusCategory === "done";

        if (!wasDone && nowDone && inc.status !== "Resolved") {
          const isPrimary = inc.primaryKey === issue.key;
          if (isPrimary && canSyncIn()) {
            if (state.settings.autoResolveConfirm) {
              inc.pendingResolve = { key: issue.key, reason: `Primary ${issue.key} was closed` };
              pushEvent(inc.id, { tone: "jira", text: `Primary ${issue.key} moved to Done in Jira`, sub: "awaiting confirmation to resolve" });
            } else {
              inc.status = "Resolved";
              pushEvent(inc.id, { tone: "jira", text: `Resolved automatically — ${issue.key} moved to Done`, sub: "Jira webhook" });
            }
          } else {
            pushEvent(inc.id, { tone: "jira", text: `${issue.key} moved to Done in Jira`, sub: isPrimary ? "" : "secondary ticket · incident not resolved" });
          }
        } else {
          pushEvent(inc.id, { tone: "jira", text: `${issue.key} updated in Jira → ${mapped.statusName}`, sub: "synced from Jira" });
        }
      }
    }
    save();
  } catch (e) {
    console.error("Webhook handling error:", e.message);
  }
});

/* ───────────────────────── static front-end ──────────────── */
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));

app.listen(PORT, () => {
  console.log(`Oppex × Jira running on ${BASE_URL}`);
  console.log(`Webhook URL: ${BASE_URL}/webhooks/jira`);
  if (!process.env.JIRA_CLIENT_ID) console.log("⚠  JIRA_CLIENT_ID not set yet — set env vars to enable connecting.");
});
