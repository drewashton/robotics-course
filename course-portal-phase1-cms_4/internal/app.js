// Internal portal front end. Same look as the Prep Team learning platform, but
// organized around the two teams. A section is a "stream", a group inside it
// is a "unit", and the pages and resources inside a group are its lessons and
// resources. Content is read from /api/streams?site=internal and edited in the
// Admin Panel.

// The heading text, the buttons under it, and the boxes with their sections
// all come from "Portal layout" in the Admin Panel (/api/layout). A "box" is
// one tab at the top and one panel on the landing page. Each box lists items:
// a section whose groups are listed straight in the box ("inline"), or a
// section shown as a single row that opens it. A section that is not placed
// in any box falls into the last one, so nothing added later gets lost.
// This is only used if the layout can't be loaded.
const FALLBACK_LAYOUT = {
    hero: { line1: "Penticton Robotics", line2: "Internal Portal", tagline: "" },
    quickLinks: [],
    boxes: [{ key: "all", title: "Portal", blurb: "", tools: [], items: [] }],
};

const TOOLS = {
    reflection: { label: "Daily Reflection", hash: "#/reflection", icon: "fa-pen-to-square" },
};

const SITE_TITLE = "Penticton Robotics - Internal Portal";
const CONFIG = window.PR_CONFIG || {};

const WEB3FORMS_URL = "https://api.web3forms.com/submit";
// These wordings are also the column headings in the marks sheet.
const FORM_KEYS = {
    name: "Name",
    date: "Date",
    q1: "1. What did you work on today?",
    q2: "2. How productive were you today?",
    q3: "3. What mark out of 100 do you believe you deserve for today's work?",
    q4: "4. Why do you believe you deserve this mark?",
    q5: "5. What is one thing you want to accomplish next time?",
};

let sections = [];
let layout = FALLBACK_LAYOUT;

document.addEventListener("DOMContentLoaded", async () => {
    const portalScreen = document.getElementById("portal-screen");
    const appInterface = document.getElementById("app-interface");
    const chaptersNav = document.getElementById("chapters-nav");

    const homeView = document.getElementById("home-view");
    const chapterView = document.getElementById("chapter-view");
    const lessonView = document.getElementById("lesson-view");
    const reflectionView = document.getElementById("reflection-view");

    const lessonTitle = document.getElementById("lesson-title");
    const lessonContentBody = document.getElementById("lesson-content-body");
    const btnPrevLesson = document.getElementById("btn-prev-lesson");
    const btnNextLesson = document.getElementById("btn-next-lesson");

    // ---------- helpers ----------

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : String(str);
        return div.innerHTML;
    }

    function hasRealContent(html) {
        if (!html) return false;
        const hasText = html.replace(/<[^>]*>/g, "").trim().length > 0;
        const hasMedia = /<(img|iframe)\b/i.test(html);
        return hasText || hasMedia;
    }

    // The app shell and landing page swap with display:none, not real page
    // loads, so the browser never resets scroll on its own. Which element
    // actually scrolls differs between desktop and mobile, so reset them all.
    function resetScroll() {
        const doReset = () => {
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            document.querySelectorAll(".content-body, .nav-menu, .portal-container, .app-container").forEach((el) => {
                el.scrollTop = 0;
            });
        };
        doReset();
        requestAnimationFrame(() => requestAnimationFrame(doReset));
        setTimeout(doReset, 150);
    }

    const sectionByKey = (key) => sections.find((s) => s.key === key);
    const pagesLabel = (section) => (section.key === "roles" ? "Handbook" : "Pages");

    // Boxes that have something in them, each with its sections resolved.
    // Sections hidden in the Admin Panel are removed from `sections` at load.
    function activeSpaces() {
        const claimed = new Set();
        const list = layout.boxes.map((box) => {
            const entries = [];
            box.items.forEach((it) => {
                const section = sectionByKey(it.stream);
                if (!section) return;
                claimed.add(section.key);
                // A section that lists its groups in the box has nothing to show if it has no groups.
                if (it.inline && section.units.length === 0) return;
                entries.push({ section, inline: it.inline, noun: it.noun || "" });
            });
            return { key: box.key, title: box.title, blurb: box.blurb, tools: box.tools.filter((t) => TOOLS[t]), entries };
        });
        const stray = sections.filter((s) => !claimed.has(s.key));
        stray.forEach((section) => list[list.length - 1].entries.push({ section, inline: false, noun: "" }));
        list.forEach((sp) => { sp.secs = sp.entries.map((e) => e.section); });
        return list.filter((sp) => sp.secs.length || sp.tools.length);
    }

    function spaceOfSection(key) {
        return activeSpaces().find((sp) => sp.secs.some((s) => s.key === key)) || null;
    }
    function spaceOfTool(toolKey) {
        return activeSpaces().find((sp) => sp.tools.includes(toolKey)) || null;
    }
    const spaceHome = (sp) => (sp.secs.length ? "#/" + sp.secs[0].key : TOOLS[sp.tools[0]].hash);

    // ---------- routing ----------
    // The address bar carries where you are, so the browser's Back button
    // works and any page can be shared as a link:
    //   #/reflection            the Daily Reflection form
    //   #/comp-team             a section
    //   #/comp-team/12          a group in it (by id)
    //   #/comp-team/12/lesson/45    a page   (kind: lesson | resource)

    function parseHash() {
        const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
        return { section: parts[0] || null, unit: parts[1] ? Number(parts[1]) : null, kind: parts[2] || null, item: parts[3] ? Number(parts[3]) : null };
    }

    function navigate(section, unitId, kind, itemId) {
        const parts = [section];
        if (unitId != null) parts.push(unitId);
        if (kind && itemId != null) parts.push(kind, itemId);
        const next = "#/" + parts.join("/");
        if (location.hash === next) render();
        else location.hash = next; // triggers render() through hashchange
    }

    function goLanding() {
        if (location.hash) history.pushState("", document.title, location.pathname + location.search);
        render();
    }

    function showShell() {
        portalScreen.style.display = "none";
        appInterface.style.display = "flex";
    }

    function render() {
        const state = parseHash();

        if (state.section === "reflection") {
            const sp = spaceOfTool("reflection");
            if (sp) {
                showShell();
                buildShell(sp, { tool: "reflection" });
                return showReflection(sp);
            }
        }

        const section = state.section ? sectionByKey(state.section) : null;
        if (!section) {
            appInterface.style.display = "none";
            portalScreen.style.display = "flex";
            document.title = SITE_TITLE;
            resetScroll();
            return;
        }

        const space = spaceOfSection(section.key);
        const unit = state.unit != null ? section.units.find((u) => u.id === state.unit) : null;
        showShell();
        buildShell(space, { section: section.key, unit: unit ? unit.id : null });
        if (!unit) return showHome(section, space);

        const kindField = state.kind === "resource" ? "resources" : state.kind === "lesson" ? "lessons" : null;
        const item = kindField && state.item != null ? unit[kindField].find((i) => i.id === state.item) : null;
        if (!item) return showUnit(section, unit, space);
        showItem(section, unit, space, state.kind, kindField, item);
    }

    // ---------- landing ----------

    function renderHero() {
        const h = layout.hero;
        const title = document.getElementById("portal-title");
        title.textContent = h.line1;
        if (h.line2) {
            const br = document.createElement("span");
            br.className = "portal-title-break";
            br.textContent = h.line2;
            title.append(" ", br);
        }
        const tag = document.getElementById("portal-tagline");
        tag.textContent = h.tagline;
        tag.hidden = !h.tagline;
    }

    function renderQuickLinks() {
        const box = document.getElementById("quick-links");
        box.innerHTML = "";
        layout.quickLinks.filter((l) => l.url).forEach((l) => {
            const a = document.createElement("a");
            a.className = "quick-link" + (l.primary ? " primary" : "");
            a.href = l.url;
            if (!l.url.startsWith("#")) {
                a.target = "_blank";
                a.rel = "noopener";
            }
            a.textContent = l.label;
            box.appendChild(a);
        });
    }

    function panelRows(sp) {
        const rows = [];
        sp.tools.forEach((t) => rows.push({ label: TOOLS[t].label, href: TOOLS[t].hash, tool: true }));
        sp.entries.forEach(({ section, inline, noun }) => {
            if (inline) {
                section.units.forEach((u) => rows.push({ label: u.title, href: `#/${section.key}/${u.id}` }));
            } else {
                const n = section.units.length;
                const meta = noun && n ? `${n} ${noun}${n === 1 ? "" : "s"}` : "";
                rows.push({ label: section.name, href: "#/" + section.key, meta });
            }
        });
        return rows;
    }

    function renderLanding() {
        const host = document.getElementById("portal-groups");
        host.innerHTML = "";

        const spaces = activeSpaces();
        if (spaces.length === 0) {
            host.innerHTML = `<p class="empty-note on-dark">The portal is being set up. Check back soon.</p>`;
            return;
        }

        const wrap = document.createElement("div");
        wrap.className = "team-panels";
        spaces.forEach((sp, i) => {
            const panel = document.createElement("section");
            // With an odd number of boxes the last one spans the full width.
            const wide = spaces.length > 1 && spaces.length % 2 === 1 && i === spaces.length - 1;
            panel.className = "team-panel" + (wide ? " is-wide" : "");
            const rows = panelRows(sp);
            panel.innerHTML = `
                <h2><a href="${spaceHome(sp)}">${escapeHtml(sp.title)}</a></h2>
                ${sp.blurb ? `<p class="team-blurb">${escapeHtml(sp.blurb)}</p>` : ""}
                <ul class="panel-index">
                    ${rows.map((r) => `
                        <li><a href="${r.href}"${r.tool ? ' class="is-tool"' : ""}>
                            <span>${escapeHtml(r.label)}</span>
                            ${r.meta ? `<small>${escapeHtml(r.meta)}</small>` : ""}
                        </a></li>`).join("")}
                </ul>`;
            wrap.appendChild(panel);
        });
        host.appendChild(wrap);

        const end = document.createElement("div");
        end.className = "landing-end";
        host.appendChild(end);
    }

    // ---------- shell: tabs along the top, this team's pages on the left ----------

    function buildShell(space, active) {
        const spaces = activeSpaces();

        const selector = document.getElementById("stream-selector");
        selector.innerHTML = "";
        spaces.forEach((sp) => {
            const a = document.createElement("a");
            a.className = "stream-btn" + (space && sp.key === space.key ? " active" : "");
            a.href = spaceHome(sp);
            a.textContent = sp.title;
            a.setAttribute("role", "tab");
            if (a.classList.contains("active")) a.setAttribute("aria-selected", "true");
            selector.appendChild(a);
        });

        chaptersNav.innerHTML = "";
        if (!space) return;

        space.tools.forEach((t) => {
            const a = document.createElement("a");
            a.className = "nav-item nav-tool" + (active.tool === t ? " active" : "");
            a.href = TOOLS[t].hash;
            a.innerHTML = `<i class="fa-solid ${TOOLS[t].icon}"></i> ${escapeHtml(TOOLS[t].label)}`;
            chaptersNav.appendChild(a);
        });

        space.secs.forEach((s) => {
            const heading = document.createElement("a");
            heading.className = "nav-heading" + (active.section === s.key && active.unit == null ? " active" : "");
            heading.href = "#/" + s.key;
            heading.textContent = s.name;
            chaptersNav.appendChild(heading);

            s.units.forEach((u) => {
                const a = document.createElement("a");
                a.className = "nav-item" + (active.section === s.key && active.unit === u.id ? " active" : "");
                a.href = `#/${s.key}/${u.id}`;
                a.textContent = u.title;
                chaptersNav.appendChild(a);
            });
        });

        const current = chaptersNav.querySelector(".nav-item.active");
        if (current) current.scrollIntoView({ block: "nearest", inline: "center" });
    }

    // ---------- views ----------

    function showOnly(view) {
        [homeView, chapterView, lessonView, reflectionView].forEach((v) => v.classList.toggle("active-view", v === view));
    }

    function crumbHtml(space, section, unit) {
        const bits = [];
        if (space) bits.push(`<a href="${spaceHome(space)}">${escapeHtml(space.title)}</a>`);
        if (section && (!space || section.name !== space.title)) {
            bits.push(unit ? `<a href="#/${section.key}">${escapeHtml(section.name)}</a>` : escapeHtml(section.name));
        }
        if (unit) bits.push(`<a href="#/${section.key}/${unit.id}">${escapeHtml(unit.title)}</a>`);
        return bits.join('<span aria-hidden="true"> / </span>');
    }

    function rowHtml(href, title, meta, icon) {
        return `<a href="${href}">
            <span class="row-title">${icon ? `<i class="fa-solid ${icon}"></i>` : ""}${escapeHtml(title)}</span>
            <span class="row-meta">${meta ? escapeHtml(meta) : ""}<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
        </a>`;
    }

    function showHome(section, space) {
        showOnly(homeView);
        document.title = `${section.name} - ${SITE_TITLE}`;

        document.getElementById("home-stream-title").textContent = section.name;
        document.getElementById("home-description-container").innerHTML = `<p>${escapeHtml(section.description)}</p>`;

        const overviewCard = document.getElementById("home-overview-card");
        const showOverview = hasRealContent(section.objectives);
        overviewCard.hidden = !showOverview;
        document.getElementById("home-overview-box").innerHTML = showOverview ? section.objectives : "";

        const roles = section.key === "roles";
        const tiles = document.getElementById("home-tiles");
        const rows = [];
        if (space && space.secs[0] && space.secs[0].key === section.key) {
            space.tools.forEach((t) => rows.push(rowHtml(TOOLS[t].hash, TOOLS[t].label, "", TOOLS[t].icon)));
        }
        section.units.forEach((unit) => {
            const pages = unit.lessons.length;
            const res = unit.resources.length;
            const bits = [];
            if (pages) bits.push(`${pages} ${pages === 1 ? "page" : "pages"}`);
            if (res) bits.push(`${res} ${res === 1 ? "resource" : "resources"}`);
            rows.push(rowHtml(`#/${section.key}/${unit.id}`, unit.title, bits.join(", ")));
        });
        tiles.innerHTML = rows.map((r) => `<li>${r}</li>`).join("");
        tiles.hidden = rows.length === 0;

        const empty = document.getElementById("home-tiles-empty");
        empty.hidden = rows.length > 0;
        empty.textContent = roles ? "Role handbooks are being added." : "Nothing has been added to this section yet.";

        renderContacts(section.mentors);
        resetScroll();
    }

    function renderContacts(mentors) {
        const column = document.getElementById("mentor-column");
        const header = document.getElementById("mentor-section-header");
        column.innerHTML = "";
        header.hidden = !mentors || mentors.length === 0;
        if (!mentors || mentors.length === 0) return;
        mentors.forEach((m, index) => {
            const card = document.createElement("div");
            card.className = "mentor-card";
            card.style.setProperty("--i", index);
            const photo = m.photo && m.photo.trim() ? m.photo : "/pr_logo2x.PNG";
            card.innerHTML = `
                <img class="mentor-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(m.name)}">
                <div>
                    <div class="mentor-name">${escapeHtml(m.name)}</div>
                    ${m.title ? `<div class="mentor-title">${escapeHtml(m.title)}</div>` : ""}
                </div>
                ${m.email ? `<a class="mentor-email-btn" href="mailto:${escapeHtml(m.email)}"><i class="fa-solid fa-envelope"></i> Email</a>` : ""}
            `;
            column.appendChild(card);
        });
    }

    function showUnit(section, unit, space) {
        showOnly(chapterView);
        document.title = `${unit.title} - ${SITE_TITLE}`;

        document.getElementById("chapter-crumb").innerHTML = crumbHtml(space, section, null);
        document.getElementById("view-chapter-name").textContent = unit.title;
        document.getElementById("pages-label").textContent = pagesLabel(section);

        const hasPages = unit.lessons.length > 0;
        const hasResources = unit.resources.length > 0;
        document.getElementById("pages-card").hidden = !hasPages;
        document.getElementById("view-chapter-lessons").hidden = !hasPages;
        document.getElementById("resources-card").hidden = !hasResources;
        document.getElementById("view-chapter-resources").hidden = !hasResources;
        document.getElementById("chapter-empty").hidden = hasPages || hasResources;

        document.getElementById("view-chapter-lessons").innerHTML = unit.lessons
            .map((l) => `<li>${rowHtml(`#/${section.key}/${unit.id}/lesson/${l.id}`, l.title)}</li>`).join("");
        document.getElementById("view-chapter-resources").innerHTML = unit.resources
            .map((r) => `<li>${rowHtml(`#/${section.key}/${unit.id}/resource/${r.id}`, r.title, "", "fa-file-lines")}</li>`).join("");
        resetScroll();
    }

    // Page navigation (Previous/Next) only applies to handbook pages; a
    // resource is a standalone reference and goes straight to its content.
    function showItem(section, unit, space, kind, kindField, item) {
        showOnly(lessonView);
        document.title = `${item.title} - ${SITE_TITLE}`;

        document.getElementById("lesson-crumb").innerHTML = crumbHtml(space, section, unit);
        lessonTitle.textContent = item.title;

        lessonContentBody.innerHTML = hasRealContent(item.content) ? item.content : "<p>No content added yet.</p>";
        addPdfLinks(lessonContentBody);

        const items = unit[kindField];
        const index = items.findIndex((i) => i.id === item.id);
        const showNav = kind === "lesson";
        const hasPrev = showNav && index > 0;
        const hasNext = showNav && index < items.length - 1;

        btnPrevLesson.hidden = !hasPrev;
        if (hasPrev) btnPrevLesson.onclick = () => navigate(section.key, unit.id, kind, items[index - 1].id);
        btnNextLesson.hidden = !hasNext;
        if (hasNext) btnNextLesson.onclick = () => navigate(section.key, unit.id, kind, items[index + 1].id);
        resetScroll();
    }

    // Phones often show only the first page of an embedded PDF, so every
    // embedded PDF gets an "Open PDF" link above it.
    function addPdfLinks(root) {
        root.querySelectorAll('iframe[src*=".pdf"]').forEach((frame) => {
            const href = frame.getAttribute("src").split("#")[0];
            const link = document.createElement("a");
            link.className = "pdf-open-link";
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener";
            link.innerHTML = `<i class="fa-solid fa-up-right-from-square"></i> Open PDF in a new tab`;
            frame.parentNode.insertBefore(link, frame);
        });
    }

    // ---------- Daily Reflection form ----------

    const form = document.getElementById("reflection-form");
    const rfStatus = document.getElementById("rf-status");
    const rfSubmit = document.getElementById("rf-submit");
    const rfDone = document.getElementById("rf-done");
    const FIELDS = ["name", "date", "q1", "q2", "q3", "q4", "q5"];
    const fieldEl = (k) => document.getElementById("rf-" + k);

    function todayLocal() {
        const d = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function remember(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode: fine */ }
    }
    function recall(key) {
        try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
    }

    function setError(key, message) {
        const err = document.getElementById(`rf-${key}-err`);
        const input = fieldEl(key);
        err.hidden = !message;
        err.textContent = message || "";
        input.classList.toggle("has-error", !!message);
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
    }

    function validateForm() {
        let firstBad = null;
        const bad = (key, msg) => {
            setError(key, msg);
            if (!firstBad) firstBad = fieldEl(key);
        };
        const v = (k) => fieldEl(k).value.trim();

        FIELDS.forEach((k) => setError(k, ""));
        if (!v("name")) bad("name", "Enter your name.");
        if (!v("date")) bad("date", "Pick the date.");
        if (!v("q1")) bad("q1", "Tell us what you worked on.");
        if (!v("q2")) bad("q2", "Tell us how productive you were.");
        const mark = v("q3");
        if (mark === "") bad("q3", "Enter a mark from 0 to 100.");
        else if (!/^\d{1,3}$/.test(mark) || Number(mark) > 100) bad("q3", "Use a whole number from 0 to 100.");
        if (!v("q4")) bad("q4", "Explain why you gave yourself this mark.");
        if (!v("q5")) bad("q5", "Add one thing you want to accomplish next time.");
        if (firstBad) firstBad.focus();
        return !firstBad;
    }

    function collectFields() {
        const out = {};
        FIELDS.forEach((k) => { out[FORM_KEYS[k]] = fieldEl(k).value.trim(); });
        return out;
    }

    async function sendToWeb3Forms(fields) {
        const res = await fetch(WEB3FORMS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                access_key: CONFIG.web3formsKey,
                subject: `Daily Reflection: ${fields[FORM_KEYS.name]} (${fields[FORM_KEYS.date]})`,
                from_name: "Penticton Robotics Portal",
                botcheck: "",
                ...fields,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.message || "The form service did not accept it.");
    }

    // Best effort: add the row to the marks sheet. The browser is not allowed
    // to read the answer from Google, so this only reports a network failure.
    async function sendToSheet(fields) {
        if (!CONFIG.sheetUrl) return;
        try {
            await fetch(CONFIG.sheetUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ token: CONFIG.sheetToken || "", submittedAt: new Date().toISOString(), fields }),
            });
        } catch (e) {
            console.warn("Marks sheet relay failed", e);
        }
    }

    function resetForm() {
        FIELDS.forEach((k) => { if (k !== "name") fieldEl(k).value = ""; setError(k, ""); });
        fieldEl("name").value = recall("pr-reflection-name");
        fieldEl("date").value = todayLocal();
        rfStatus.textContent = "";
        rfStatus.classList.remove("is-error");
        rfSubmit.disabled = false;
        rfSubmit.textContent = "Submit reflection";
        form.hidden = false;
        rfDone.hidden = true;
    }

    function showReflection(space) {
        showOnly(reflectionView);
        document.title = `Daily Reflection - ${SITE_TITLE}`;
        document.getElementById("reflection-crumb").innerHTML = crumbHtml(space, null, null);
        document.getElementById("rf-back").href = spaceHome(space);
        document.getElementById("rf-back").textContent = `Back to the ${space.title}`;
        if (rfDone.hidden) {
            if (!fieldEl("name").value) fieldEl("name").value = recall("pr-reflection-name");
            if (!fieldEl("date").value) fieldEl("date").value = todayLocal();
        }
        resetScroll();
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (rfSubmit.disabled) return;
        rfStatus.classList.remove("is-error");
        rfStatus.textContent = "";
        if (!validateForm()) return;

        // Hidden trap field: people never see it, so a tick means a bot.
        if (document.getElementById("rf-botcheck").checked) {
            return showDone(collectFields());
        }

        if (!CONFIG.web3formsKey) {
            rfStatus.classList.add("is-error");
            rfStatus.textContent = "This form is not connected yet. Tell a mentor, who can finish the setup.";
            return;
        }

        const fields = collectFields();
        rfSubmit.disabled = true;
        rfSubmit.textContent = "Sending";
        try {
            await sendToWeb3Forms(fields);
        } catch (err) {
            console.error(err);
            rfSubmit.disabled = false;
            rfSubmit.textContent = "Submit reflection";
            rfStatus.classList.add("is-error");
            rfStatus.textContent = "Your reflection did not send. Check your connection and press Submit again. Nothing you typed is lost.";
            return;
        }
        await sendToSheet(fields);
        remember("pr-reflection-name", fields[FORM_KEYS.name]);
        showDone(fields);
    });

    function showDone(fields) {
        form.hidden = true;
        rfDone.hidden = false;
        document.getElementById("rf-done-text").textContent =
            `Thanks, ${fields[FORM_KEYS.name]}. Your reflection for ${fields[FORM_KEYS.date]} is in. A mentor will read it and give you the day's mark after class.`;
        resetScroll();
        rfDone.focus();
    }

    document.getElementById("rf-again").addEventListener("click", () => {
        resetForm();
        fieldEl("q1").focus();
    });

    // ---------- start ----------

    document.getElementById("btn-back-home").addEventListener("click", goLanding);
    document.getElementById("back-to-portal").addEventListener("click", goLanding);
    window.addEventListener("hashchange", render);

    try {
        const [streamsRes, layoutRes] = await Promise.all([
            fetch("/api/streams?site=internal"),
            fetch("/api/layout").catch(() => null),
        ]);
        if (!streamsRes.ok) throw new Error("Failed to load");
        sections = await streamsRes.json();
        if (layoutRes && layoutRes.ok) {
            const loaded = await layoutRes.json();
            if (loaded && Array.isArray(loaded.boxes) && loaded.boxes.length) layout = loaded;
        }
    } catch (err) {
        console.error(err);
        sections = [];
    }

    // Sections hidden in the Admin Panel are not on the site at all.
    const hiddenKeys = new Set();
    layout.boxes.forEach((b) => b.items.forEach((it) => { if (it.hidden) hiddenKeys.add(it.stream); }));
    sections = sections.filter((s) => !hiddenKeys.has(s.key));

    fieldEl("date").value = todayLocal();
    fieldEl("name").value = recall("pr-reflection-name");
    renderHero();
    renderQuickLinks();
    renderLanding();
    render();
});
