// Portal layout screen: edit what the internal portal's home page shows.
// It uses the shared helpers in admin.js ($, api, openModal, escapeHtml,
// setStatus, showView, streamsData, ...). The layout itself (heading, buttons,
// boxes and which section sits in which box) is one JSON document saved at
// /api/admin/layout. Groups, pages and section names are saved through the
// same endpoints the rest of the Admin Panel uses.

let layoutData = null;

const LAYOUT_TOOLS = { reflection: "Daily Reflection form" };
const INTERNAL_URL = "https://internal.pentictonrobotics.ca/";

const internalStreams = () => streamsData.filter((s) => s.site === "internal");
const streamByKey = (key) => internalStreams().find((s) => s.stream_key === key) || null;
const sortedUnits = (stream) => [...stream.units].sort((a, b) => a.sort_order - b.sort_order);

function layoutNavButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stream-nav-item";
    btn.id = "nav-layout";
    btn.innerHTML = `<i class="fa-solid fa-table-columns"></i> Portal layout`;
    btn.classList.toggle("active", $("layout-view").classList.contains("active-view"));
    btn.addEventListener("click", showLayout);
    return btn;
}

async function loadLayout() {
    layoutData = await api("/api/admin/layout");
    normalizeLayout();
}

// Make what we show match what the portal shows: items whose section no
// longer exists are dropped, and a section that is not in any box sits at the
// end of the last box (the portal does the same).
function normalizeLayout() {
    const known = new Set(internalStreams().map((s) => s.stream_key));
    layoutData.boxes.forEach((b) => { b.items = b.items.filter((it) => known.has(it.stream)); });
    const placed = new Set();
    layoutData.boxes.forEach((b) => b.items.forEach((it) => placed.add(it.stream)));
    const last = layoutData.boxes[layoutData.boxes.length - 1];
    internalStreams().forEach((s) => {
        if (!placed.has(s.stream_key)) last.items.push({ stream: s.stream_key, inline: false, hidden: false });
    });
}

async function showLayout() {
    showView("layout-view");
    const nav = $("nav-layout");
    if (nav) nav.classList.add("active");
    $("link-view-site").href = INTERNAL_URL;
    setStatus($("layout-status"), "");
    try {
        await refreshStreams();
        await loadLayout();
        renderLayout();
    } catch (err) {
        setStatus($("layout-status"), err.message, "error");
    }
}

function flash(message, tone) {
    setStatus($("layout-status"), message, tone || "success");
}

// Run an action, then redraw. Any error is shown at the top of the screen.
async function layoutAction(fn, doneMessage) {
    try {
        await fn();
        await refreshStreams();
        await loadLayout();
        renderLayout();
        if (doneMessage) flash(doneMessage);
    } catch (err) {
        flash(err.message, "error");
    }
}

async function saveLayoutData() {
    layoutData = await api("/api/admin/layout", { method: "PUT", body: JSON.stringify(layoutData) });
}

// ---------- drawing ----------

function renderLayout() {
    const host = $("layout-boxes");
    host.innerHTML = "";
    layoutData.boxes.forEach((box, boxIndex) => host.appendChild(boxCard(box, boxIndex)));
    renderHeadingCard();
}

function hostStreamOf(box) {
    for (const it of box.items) {
        const s = it.inline ? streamByKey(it.stream) : null;
        if (s) return s;
    }
    return null;
}

function boxCard(box, boxIndex) {
    const card = document.createElement("section");
    card.className = "layout-box";

    const rows = [];
    box.tools.forEach((t) => rows.push({ kind: "tool", tool: t }));
    box.items.forEach((item, itemIndex) => {
        const stream = streamByKey(item.stream);
        if (!stream) return;
        if (item.inline) {
            const units = sortedUnits(stream);
            units.forEach((unit, i) => rows.push({ kind: "unit", unit, stream, units, index: i }));
        } else {
            rows.push({ kind: "stream", item, itemIndex, stream });
        }
    });

    const head = document.createElement("header");
    head.className = "layout-box-head";
    head.innerHTML = `
        <div class="layout-box-titles">
            <h3></h3>
            <p class="admin-muted"></p>
        </div>
        <div class="layout-box-actions">
            <button type="button" class="layout-act" data-box="up" ${boxIndex === 0 ? "disabled" : ""}>Move box up</button>
            <button type="button" class="layout-act" data-box="down" ${boxIndex === layoutData.boxes.length - 1 ? "disabled" : ""}>Move box down</button>
            <button type="button" class="layout-act" data-box="edit">Rename box</button>
            <button type="button" class="layout-act is-danger" data-box="delete">Delete box</button>
        </div>`;
    head.querySelector("h3").textContent = box.title;
    head.querySelector("p").textContent = box.blurb || "No description";
    head.querySelector('[data-box="up"]').addEventListener("click", () => moveBox(boxIndex, -1));
    head.querySelector('[data-box="down"]').addEventListener("click", () => moveBox(boxIndex, 1));
    head.querySelector('[data-box="edit"]').addEventListener("click", () => editBox(box));
    head.querySelector('[data-box="delete"]').addEventListener("click", () => deleteBox(box, rows.length));
    card.appendChild(head);

    const list = document.createElement("ul");
    list.className = "admin-units-list layout-rows";
    rows.forEach((row, i) => list.appendChild(rowItem(row, box, i)));
    card.appendChild(list);
    if (rows.length === 0) {
        const empty = document.createElement("p");
        empty.className = "admin-muted layout-empty";
        empty.textContent = "Nothing in this box yet.";
        card.appendChild(empty);
    }

    const foot = document.createElement("div");
    foot.className = "layout-box-foot";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "admin-btn admin-btn-dashed";
    add.innerHTML = `<i class="fa-solid fa-plus"></i> Add a section`;
    add.addEventListener("click", () => addSection(box));
    foot.appendChild(add);

    Object.keys(LAYOUT_TOOLS).forEach((t) => {
        const placed = layoutData.boxes.some((b) => b.tools.includes(t));
        if (placed) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "admin-btn admin-btn-secondary";
        b.textContent = `Add the ${LAYOUT_TOOLS[t]}`;
        b.addEventListener("click", () => layoutAction(async () => {
            box.tools.push(t);
            await saveLayoutData();
        }, `Added the ${LAYOUT_TOOLS[t]} to ${box.title}.`));
        foot.appendChild(b);
    });
    card.appendChild(foot);
    return card;
}

function actionButton(label, onClick, extra) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "layout-act" + (extra && extra.danger ? " is-danger" : "");
    b.textContent = label;
    if (extra && extra.disabled) b.disabled = true;
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return b;
}

function rowItem(row, box, index) {
    const li = document.createElement("li");
    li.className = "admin-unit-row layout-row";
    li.style.setProperty("--i", index);

    let title, tag = "", shown = true, canUp = false, canDown = false;
    if (row.kind === "tool") {
        title = LAYOUT_TOOLS[row.tool];
        tag = "Built in";
    } else if (row.kind === "unit") {
        title = row.unit.title;
        shown = Boolean(row.unit.published);
        canUp = row.index > 0;
        canDown = row.index < row.units.length - 1;
    } else {
        title = row.stream.name;
        tag = "Handbook";
        shown = !row.item.hidden;
        canUp = row.itemIndex > 0;
        canDown = row.itemIndex < box.items.length - 1;
    }

    const reorder = document.createElement("div");
    reorder.className = "admin-unit-reorder";
    reorder.innerHTML = `
        <button type="button" data-dir="up" ${canUp ? "" : "disabled"} aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" data-dir="down" ${canDown ? "" : "disabled"} aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>`;
    reorder.hidden = row.kind === "tool";
    reorder.querySelectorAll("[data-dir]").forEach((b) => b.addEventListener("click", () => moveRow(row, box, b.dataset.dir === "up" ? -1 : 1)));
    li.appendChild(reorder);

    const main = document.createElement("div");
    main.className = "admin-unit-main";
    main.innerHTML = `${tag ? `<span class="admin-tag">${escapeHtml(tag)}</span>` : ""}<div class="admin-unit-title"></div>`;
    main.querySelector(".admin-unit-title").textContent = title;
    if (row.kind !== "tool") main.addEventListener("click", () => openRow(row));
    li.appendChild(main);

    if (row.kind !== "tool") {
        const status = document.createElement("span");
        status.className = `admin-status ${shown ? "is-published" : "is-draft"}`;
        status.innerHTML = `<span class="admin-status-dot"></span>${shown ? "Shown" : "Hidden"}`;
        li.appendChild(status);
    }

    const acts = document.createElement("div");
    acts.className = "layout-row-actions";
    if (row.kind === "tool") {
        acts.appendChild(actionButton("Move", () => moveRowToBox(row, box)));
        acts.appendChild(actionButton("Take out", () => layoutAction(async () => {
            box.tools = box.tools.filter((t) => t !== row.tool);
            await saveLayoutData();
        }, `Took the ${title} out of ${box.title}.`)));
    } else {
        acts.appendChild(actionButton(row.kind === "unit" ? "Edit pages" : "Open", () => openRow(row)));
        acts.appendChild(actionButton("Rename", () => renameRow(row)));
        acts.appendChild(actionButton(shown ? "Hide" : "Show", () => toggleRow(row, shown)));
        acts.appendChild(actionButton("Move", () => moveRowToBox(row, box)));
        acts.appendChild(actionButton("Delete", () => deleteRow(row), { danger: true }));
    }
    li.appendChild(acts);
    return li;
}

// ---------- row actions ----------

function openRow(row) {
    if (row.kind === "unit") {
        cameFromLayout = true;
        currentStreamId = row.stream.id;
        openUnit(row.unit.id);
    } else if (row.kind === "stream") {
        cameFromLayout = false;
        selectStream(row.stream.id);
    }
}

async function renameRow(row) {
    const current = row.kind === "unit" ? row.unit.title : row.stream.name;
    const res = await openModal({
        title: "Rename",
        fields: [{ label: "Name", value: current }],
        confirmLabel: "Save",
    });
    if (!res || !res[0] || res[0] === current) return;
    await layoutAction(async () => {
        if (row.kind === "unit") await api("/api/admin/units", { method: "PUT", body: JSON.stringify({ id: row.unit.id, title: res[0] }) });
        else await api("/api/admin/streams", { method: "PUT", body: JSON.stringify({ id: row.stream.id, name: res[0] }) });
    }, "Renamed.");
}

async function toggleRow(row, shown) {
    await layoutAction(async () => {
        if (row.kind === "unit") {
            await api("/api/admin/units", { method: "PUT", body: JSON.stringify({ id: row.unit.id, published: !shown }) });
        } else {
            row.item.hidden = shown;
            await saveLayoutData();
        }
    }, shown ? "Hidden. It no longer shows on the portal." : "Shown on the portal.");
}

async function deleteRow(row) {
    const name = row.kind === "unit" ? row.unit.title : row.stream.name;
    const ok = await openModal({
        title: "Delete this section?",
        message: row.kind === "unit"
            ? `Delete "${name}" and every page and resource inside it? This can't be undone.`
            : `Delete the handbook "${name}" with every group, page, resource and contact inside it? This can't be undone.`,
        confirmLabel: "Delete",
        danger: true,
    });
    if (!ok) return;
    await layoutAction(async () => {
        if (row.kind === "unit") {
            await api("/api/admin/units", { method: "DELETE", body: JSON.stringify({ id: row.unit.id }) });
        } else {
            await api("/api/admin/streams", { method: "DELETE", body: JSON.stringify({ id: row.stream.id }) });
            if (currentStreamId === row.stream.id) currentStreamId = null;
        }
    }, `Deleted "${name}".`);
}

async function moveRow(row, box, delta) {
    await layoutAction(async () => {
        if (row.kind === "unit") {
            const target = row.index + delta;
            const ids = row.units.map((u) => u.id);
            [ids[row.index], ids[target]] = [ids[target], ids[row.index]];
            await api("/api/admin/reorder", { method: "POST", body: JSON.stringify({ table: "units", orderedIds: ids }) });
        } else {
            const target = row.itemIndex + delta;
            [box.items[row.itemIndex], box.items[target]] = [box.items[target], box.items[row.itemIndex]];
            await saveLayoutData();
        }
    });
}

// A group needs a section in the target box to live in. If the box has none
// that lists its groups directly, one is made with the box's name.
async function ensureHost(box) {
    const existing = hostStreamOf(box);
    if (existing) return existing;
    const made = await api("/api/admin/streams", { method: "POST", body: JSON.stringify({ name: box.title, box: box.key, inline: true }) });
    await refreshStreams();
    await loadLayout();
    const fresh = layoutData.boxes.find((b) => b.key === box.key);
    const item = fresh.items.find((it) => it.stream === made.key);
    item.hidden = false;
    await saveLayoutData();
    return streamByKey(made.key);
}

async function moveRowToBox(row, box) {
    const others = layoutData.boxes.filter((b) => b.key !== box.key);
    if (others.length === 0) return flash("There is only one box.", "error");
    const res = await openModal({
        title: "Move to another box",
        fields: [{ label: "Move to", options: others.map((b) => ({ value: b.key, label: b.title })) }],
        confirmLabel: "Move",
    });
    if (!res) return;
    const target = layoutData.boxes.find((b) => b.key === res[0]);
    if (!target) return;
    await layoutAction(async () => {
        if (row.kind === "unit") {
            const host = await ensureHost(target);
            await api("/api/admin/units", { method: "PUT", body: JSON.stringify({ id: row.unit.id, stream_id: host.id }) });
        } else if (row.kind === "stream") {
            box.items = box.items.filter((it) => it.stream !== row.item.stream);
            target.items.push(row.item);
            await saveLayoutData();
        } else {
            box.tools = box.tools.filter((t) => t !== row.tool);
            if (!target.tools.includes(row.tool)) target.tools.push(row.tool);
            await saveLayoutData();
        }
    }, `Moved to ${target.title}.`);
}

async function addSection(box) {
    const res = await openModal({
        title: `Add a section to ${box.title}`,
        message: "It stays hidden on the portal until you click Show.",
        fields: [
            { label: "Section name", placeholder: "" },
            {
                label: "What is it?",
                options: [
                    { value: "group", label: "A section with pages (one row that opens its pages)" },
                    { value: "handbook", label: "A handbook with groups (one row that opens a page of groups)" },
                ],
            },
        ],
        confirmLabel: "Add",
    });
    if (!res || !res[0]) return;
    await layoutAction(async () => {
        if (res[1] === "handbook") {
            await api("/api/admin/streams", { method: "POST", body: JSON.stringify({ name: res[0], box: box.key, inline: false }) });
        } else {
            const host = await ensureHost(box);
            await api("/api/admin/units", { method: "POST", body: JSON.stringify({ stream_id: host.id, unit_label: "", title: res[0] }) });
        }
    }, `Added "${res[0]}". It is hidden until you click Show. Click its name to add pages.`);
}

// ---------- boxes ----------

async function moveBox(index, delta) {
    await layoutAction(async () => {
        const boxes = layoutData.boxes;
        [boxes[index], boxes[index + delta]] = [boxes[index + delta], boxes[index]];
        await saveLayoutData();
    });
}

async function editBox(box) {
    const res = await openModal({
        title: "Rename box",
        fields: [
            { label: "Box name", value: box.title },
            { label: "Short description under the name", value: box.blurb },
        ],
        confirmLabel: "Save",
    });
    if (!res || !res[0]) return;
    await layoutAction(async () => {
        box.title = res[0];
        box.blurb = res[1];
        await saveLayoutData();
    }, "Saved.");
}

async function deleteBox(box, rowCount) {
    if (rowCount > 0) {
        flash("Move or delete everything in this box first, then delete the box.", "error");
        return;
    }
    if (layoutData.boxes.length === 1) {
        flash("The portal needs at least one box.", "error");
        return;
    }
    const ok = await openModal({ title: "Delete this box?", message: `"${box.title}" is empty. Delete it?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await layoutAction(async () => {
        layoutData.boxes = layoutData.boxes.filter((b) => b.key !== box.key);
        await saveLayoutData();
    }, "Box deleted.");
}

$("btn-add-box").addEventListener("click", async () => {
    const res = await openModal({
        title: "Add a box",
        fields: [{ label: "Box name" }, { label: "Short description under the name" }],
        confirmLabel: "Add",
    });
    if (!res || !res[0]) return;
    const taken = new Set(layoutData.boxes.map((b) => b.key));
    const base = res[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "box";
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    await layoutAction(async () => {
        layoutData.boxes.push({ key, title: res[0], blurb: res[1], tools: [], items: [] });
        await saveLayoutData();
    }, `Added the box "${res[0]}".`);
});

// ---------- heading and buttons ----------

function renderHeadingCard() {
    const h = layoutData.hero;
    $("layout-line1").value = h.line1;
    $("layout-line2").value = h.line2;
    $("layout-tagline").value = h.tagline;
    setStatus($("layout-heading-status"), "");
    const ul = $("layout-links");
    ul.innerHTML = "";
    layoutData.quickLinks.forEach((l) => ul.appendChild(linkRow(l)));
    $("btn-add-link").disabled = ul.children.length >= 6;
}

function linkRow(link) {
    const li = document.createElement("li");
    li.className = "layout-link-row";
    li.innerHTML = `
        <label class="admin-field"><span>Button text</span><input type="text" class="lk-label" maxlength="40"></label>
        <label class="admin-field"><span>Where it goes</span><input type="text" class="lk-url" maxlength="300" placeholder="https://..."></label>
        <label class="layout-check"><input type="checkbox" class="lk-primary"> Highlight</label>
        <button type="button" class="layout-act is-danger">Remove</button>`;
    li.querySelector(".lk-label").value = link.label;
    li.querySelector(".lk-url").value = link.url;
    li.querySelector(".lk-primary").checked = Boolean(link.primary);
    li.querySelector("button").addEventListener("click", () => {
        li.remove();
        $("btn-add-link").disabled = $("layout-links").children.length >= 6;
    });
    return li;
}

$("btn-add-link").addEventListener("click", () => {
    $("layout-links").appendChild(linkRow({ label: "", url: "", primary: false }));
    $("btn-add-link").disabled = $("layout-links").children.length >= 6;
});

$("btn-save-heading").addEventListener("click", async () => {
    const status = $("layout-heading-status");
    const links = [...$("layout-links").children].map((li) => ({
        label: li.querySelector(".lk-label").value.trim(),
        url: li.querySelector(".lk-url").value.trim(),
        primary: li.querySelector(".lk-primary").checked,
    })).filter((l) => l.label || l.url);

    const bad = links.find((l) => !l.label || !/^(#\/|\/|https?:\/\/|mailto:)/i.test(l.url));
    if (bad) {
        setStatus(status, `Each button needs text and a link that starts with https:// (or #/ for a page inside the portal).${bad.label ? ` Check "${bad.label}".` : ""}`, "error");
        return;
    }
    if (!$("layout-line1").value.trim()) {
        setStatus(status, "The heading needs a first line.", "error");
        return;
    }
    try {
        layoutData.hero = {
            line1: $("layout-line1").value.trim(),
            line2: $("layout-line2").value.trim(),
            tagline: $("layout-tagline").value.trim(),
        };
        layoutData.quickLinks = links;
        await saveLayoutData();
        normalizeLayout();
        renderHeadingCard();
        setStatus($("layout-heading-status"), "Saved.", "success");
    } catch (err) {
        setStatus(status, err.message, "error");
    }
});
