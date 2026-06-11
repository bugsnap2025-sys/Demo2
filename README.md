# Oppex × Jira — Setup Guide (no coding required)

This connects the Oppex incident app to **your real Jira**. You'll do it by
clicking through three websites — GitHub, Render, and Atlassian. You won't write
any code. Budget about 30–40 minutes the first time.

When you're done you'll have a real web link (like `https://oppex-jira.onrender.com`)
where you can link real Jira tickets, resolve them, sync comments, and have Jira
changes flow back into incidents.

---

## A note on safety before you start
At one step Atlassian gives you a **Client Secret**. Treat it like a password.
You'll paste it into Render's settings page — never into a chat, email, or any
public place. If you ever expose it, you can regenerate it in Atlassian and update Render.

---

## Step 1 — Put the code on GitHub

1. Unzip the project folder I gave you (`oppex-jira`).
2. Go to **github.com**, sign in, click the **+** (top-right) → **New repository**.
3. Name it `oppex-jira`. Choose **Public** (Render's free plan reads public repos most easily). Click **Create repository**.
4. On the new empty repo page, click the link **“uploading an existing file”**.
5. Open the unzipped `oppex-jira` folder on your computer, select **all the files and folders inside it** (not the outer folder — its contents), and **drag them onto the GitHub page**.
   - You should see: `server`, `web`, `package.json`, `render.yaml`, `README.md`, `.gitignore`, `.env.example`, `vite.config.js`.
6. Click **Commit changes**.

Your code now lives on GitHub. ✅

---

## Step 2 — Create your Atlassian (Jira) app — this gives you 2 secret values

1. Go to **developer.atlassian.com**, sign in with the same account as your Jira.
2. Click your profile (top-right) → **Developer console**.
3. Click **Create** → **OAuth 2.0 integration**.
4. Give it a name like `Oppex` and agree to the terms → **Create**.
5. In the left menu, click **Permissions**:
   - Find **Jira API** → click **Add**, then **Configure**.
   - Add these scopes (tick them): **read:jira-work**, **write:jira-work**, **read:jira-user**.
   - Save.
6. In the left menu, click **Settings**. Scroll down — you'll see:
   - **Client ID**
   - **Secret** (click to reveal)
   Keep this tab open; you'll copy these into Render in Step 3. **Don't share the Secret.**

We'll set the "callback URL" in Step 4, once we have your web address.

---

## Step 3 — Deploy on Render (this puts your app online)

1. Go to **render.com** → **Get Started** → sign up **with GitHub** (easiest).
2. Click **New +** (top-right) → **Blueprint**.
3. Connect your GitHub and pick the **oppex-jira** repository → **Connect**.
4. Render reads the included `render.yaml` and asks you to fill in three values:
   - **JIRA_CLIENT_ID** → paste the Client ID from Step 2.
   - **JIRA_CLIENT_SECRET** → paste the Secret from Step 2.
   - **APP_BASE_URL** → leave this **blank for now** (we fill it in Step 4).
5. Click **Apply** / **Create**. Render builds the app (takes a few minutes — watch the log until it says it's **live**).
6. At the top of your service page, Render shows your web address, like
   **`https://oppex-jira.onrender.com`**. **Copy it.**

---

## Step 4 — Connect the two ends (the address)

**In Render:**
1. Open your service → left menu **Environment**.
2. Find **APP_BASE_URL**, set it to the address you copied (e.g. `https://oppex-jira.onrender.com`) → **Save Changes**. Render redeploys automatically.

**Back in Atlassian (the tab from Step 2):**
3. Left menu → **Authorization** → next to **OAuth 2.0 (3LO)** click **Configure** (or **Add**).
4. In **Callback URL**, paste your address **plus `/auth/callback`**, e.g.
   `https://oppex-jira.onrender.com/auth/callback` → **Save**.

---

## Step 5 — Turn it on

1. Open your web address in a browser. You'll see Oppex with a **“Connect to Jira”** button.
2. Click it → Atlassian asks you to **Accept** → you're bounced back, now **Connected**.
3. Open an incident → **Link ticket** → search a real ticket key from your Jira (e.g. `OPS-12`) and link it. You'll see its real status, assignee, and priority.
4. Try **Resolve** — it moves the linked Jira ticket to a Done status for real.

That's the core integration working. 🎉

---

## Step 6 — (Optional) Let Jira changes flow back (auto-resolve)

This is the “a developer closes the ticket in Jira and the incident resolves” direction.
It needs one webhook in Jira.

1. In Oppex, go to **Jira integration → Inbound webhook** and **copy the URL** shown.
2. In **Jira**: click the **gear icon** → **System** → scroll to **WebHooks** (under Advanced) → **Create a WebHook**.
3. Name it `Oppex`. Paste the **URL** you copied.
4. Under **Events**, tick **Issue → updated** and **Comment → created**.
5. **Create**.

Now move a linked ticket to Done in Jira — within a few seconds the matching incident
shows a **“resolve this incident?”** prompt in Oppex (or auto-resolves, if you turned that
on in settings).

---

## Good to know (free plan quirks)
- **It sleeps when idle.** On Render's free plan the app naps after ~15 minutes unused. The next visit takes ~30–60 seconds to wake. That's normal.
- **A restart asks you to reconnect.** The Jira login is held in memory, so after a sleep/restart you may need to click **Connect to Jira** once more. (Fine for a prototype; we can make it permanent later.)
- **Webhooks need the app awake.** If Jira sends a change while the app is asleep, it may miss it. Open the app first, or upgrade off the free plan, for reliable inbound sync.

## If something doesn't work
- **“Connecting to Jira failed”** → usually the Callback URL in Atlassian doesn't exactly match your address + `/auth/callback`. Re-check Step 4.
- **Link/search says an error** → make sure you clicked **Connect to Jira** and accepted.
- **Resolve says “No Done transition”** → that Jira project's workflow doesn't have a simple move-to-Done from the ticket's current status. Move it manually once in Jira, or pick a ticket whose workflow allows it.
