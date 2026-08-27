const STREAM_ICONS = { business: "fa-briefcase", build: "fa-hammer", programming: "fa-code" };

// Lessons, Assignments, and Resources are managed with one shared editor —
// this config drives which API endpoint, unit field, and labels apply.
const ITEM_KINDS = {
    lesson: { api: "/api/admin/lessons", field: "lessons", label: "Lesson", newLabel: "New Lesson" },
    assignment: { api: "/api/admin/assignments", field: "assignments", label: "Assignment", newLabel: "New Assignment" },
    resource: { api: "/api/admin/resources", field: "resources", label: "Resource", newLabel: "New Resource" },
};

// Register a custom Quill format so Google Slides / uploaded PowerPoint
// files can be embedded as real inline iframes, not just links. Wrapped in
// try/catch so a problem here can NEVER take down the rest of the panel —
// login, units, and lessons must keep working even if this fails. Worst
// case, presentation embeds fall back to plain links (see iframeEmbedsSupported).
let iframeEmbedsSupported = false;
try {
    const BlockEmbed = Quill.import("blots/block/embed");
    class IframeBlot extends BlockEmbed {
        static create(url) {
            const node = super.create();
            node.setAttribute("src", url);
            node.setAttribute("frameborder", "0");
            node.setAttribute("allowfullscreen", "true");
            node.classList.add("ql-iframe");
            return node;
        }
        static value(node) {
            return node.getAttribute("src");
        }
    }
    IframeBlot.blotName = "iframe";
    IframeBlot.tagName = "iframe";
    Quill.register(IframeBlot);
    iframeEmbedsSupported = true;
} catch (err) {
    console.warn("Presentation embedding unavailable:", err);
}

function insertPresentationEmbed(editor, index, url, label) {
    if (iframeEmbedsSupported) {
        editor.insertEmbed(index, "iframe", url);
    } else {
        editor.insertText(index, label, "link", url);
    }
}

function toSlidesEmbedUrl(rawUrl) {
    const url = rawUrl.trim();
    const match = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (match && !url.includes("/embed")) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return url;
}

function officeEmbedUrl(absoluteFileUrl) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteFileUrl)}`;
}

let streamsData = [];
let currentStreamId = null;
let currentUnitId = null;
let currentItemKind = "lesson"; // "lesson" | "assignment" | "resource"
let currentItemId = null;       // null while creating a brand-new item
let currentMentorId = null;     // null while creating a brand-new mentor
const quillInstances = {};

const $ = (id) => document.getElementById(id);

// ---------- MODAL (replaces native prompt()/confirm()) ----------

function openModal({ title, message, fields = [], confirmLabel = "OK", danger = false }) {
    return new Promise((resolve) => {
        $("modal-title").textContent = title;
        $("modal-message").textContent = message || "";
        $("modal-message").hidden = !message;

        const fieldsEl = $("modal-fields");
        fieldsEl.innerHTML = "";
        const inputs = fields.map((f) => {
            const label = document.createElement("label");
            label.className = "admin-field";
            label.innerHTML = `<span>${f.label}</span>`;
            const input = document.createElement("input");
            input.type = f.type || "text";
            input.value = f.value || "";
            input.placeholder = f.placeholder || "";
            label.appendChild(input);
            fieldsEl.appendChild(label);
            return input;
        });

        const confirmBtn = $("modal-confirm");
        confirmBtn.textContent = confirmLabel;
        confirmBtn.className = `admin-btn ${danger ? "admin-btn-danger" : "admin-btn-primary"}`;
        const cancelBtn = $("modal-cancel");
        const overlay = $("modal-overlay");

        overlay.hidden = false;
        (inputs[0] || confirmBtn).focus();

        function cleanup(result) {
            overlay.hidden = true;
            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
            overlay.removeEventListener("keydown", onKeydown);
            resolve(result);
        }
        function onConfirm() {
            cleanup(inputs.length ? inputs.map((i) => i.value.trim()) : true);
        }
        function onCancel() {
            cleanup(null);
        }
        function onKeydown(e) {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && inputs.length <= 1) onConfirm();
        }

        confirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
        overlay.addEventListener("keydown", onKeydown);
    });
}

async function api(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (res.status === 401) {
        showLogin();
        throw new Error("Not authenticated");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
}

function showLogin() {
    $("login-screen").hidden = false;
    $("admin-app").hidden = true;
}
function showApp() {
    $("login-screen").hidden = true;
    $("admin-app").hidden = false;
}

function currentStream() {
    return streamsData.find((s) => s.id === currentStreamId) || null;
}
function currentUnit() {
    const stream = currentStream();
    return stream ? stream.units.find((u) => u.id === currentUnitId) || null : null;
}

// ---------- AUTH ----------

async function checkSession() {
    try {
        const session = await api("/api/admin/session");
        $("signed-in-as").textContent = `${session.name} · ${session.email}`;
        showApp();
        await loadStreams();
    } catch {
        showLogin();
    }
}

$("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").hidden = true;
    try {
        const session = await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ email: $("login-email").value, password: $("login-password").value }),
        });
        $("signed-in-as").textContent = `${session.name} · ${session.email}`;
        showApp();
        await loadStreams();
    } catch (err) {
        setStatus($("login-error"), err.message, "error");
        $("login-error").hidden = false;
    }
});

$("btn-logout").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    location.reload();
});

// ---------- NAVIGATION ----------

function showView(viewId) {
    document.querySelectorAll(".admin-view").forEach((v) => v.classList.remove("active-view"));
    $(viewId).classList.add("active-view");
    document.querySelectorAll(".stream-nav-item").forEach((el) => el.classList.remove("active"));
}

$("btn-manage-instructors").addEventListener("click", () => {
    showView("instructors-view");
    loadInstructors();
});

// ---------- STREAMS (fixed — no create/delete) ----------

async function loadStreams() {
    streamsData = await api("/api/admin/streams");
    renderStreamNav();
    if (streamsData.length && !streamsData.some((s) => s.id === currentStreamId)) {
        currentStreamId = streamsData[0].id;
    }
    if (currentStreamId) selectStream(currentStreamId);
}

function renderStreamNav() {
    const nav = $("stream-nav");
    nav.innerHTML = "";
    streamsData.forEach((stream) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stream-nav-item";
        btn.dataset.streamId = stream.id;
        const icon = STREAM_ICONS[stream.stream_key] || "fa-folder";
        btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(stream.name)}`;
        btn.addEventListener("click", () => selectStream(stream.id));
        nav.appendChild(btn);
    });
}

function selectStream(streamId) {
    currentStreamId = streamId;
    showView("units-view");
    document.querySelectorAll(".stream-nav-item").forEach((el) => {
        el.classList.toggle("active", Number(el.dataset.streamId) === streamId);
    });
    renderUnitsList();
}

// ---------- SYLLABUS EDITOR ----------

function ensureQuill(containerId, placeholder) {
    if (!quillInstances[containerId]) {
        quillInstances[containerId] = new Quill(`#${containerId}`, { theme: "snow", placeholder });
    }
    return quillInstances[containerId];
}
function setQuillHtml(containerId, html) {
    const q = quillInstances[containerId];
    q.setContents([]);
    if (html && html.trim()) q.clipboard.dangerouslyPasteHTML(html);
}

$("btn-edit-syllabus").addEventListener("click", () => {
    const stream = currentStream();
    if (!stream) return;

    $("syllabus-name").value = stream.name;
    $("syllabus-description").value = stream.description || "";
    setStatus($("syllabus-status"), "");

    ensureQuill("syllabus-quill-objectives", "What will students learn in this stream?");
    ensureQuill("syllabus-quill-schedule", "How should students pace themselves through this stream?");
    setQuillHtml("syllabus-quill-objectives", stream.objectives_html);
    setQuillHtml("syllabus-quill-schedule", stream.schedule_html);

    renderMentorsList();
    showView("syllabus-view");
});

$("btn-syllabus-back").addEventListener("click", () => selectStream(currentStreamId));

$("btn-save-syllabus").addEventListener("click", async () => {
    const name = $("syllabus-name").value.trim();
    if (!name) {
        setStatus($("syllabus-status"), "Stream name can't be empty.", "error");
        return;
    }
    try {
        await api("/api/admin/streams", {
            method: "PUT",
            body: JSON.stringify({
                id: currentStreamId,
                name,
                description: $("syllabus-description").value,
                objectives_html: quillInstances["syllabus-quill-objectives"].root.innerHTML,
                schedule_html: quillInstances["syllabus-quill-schedule"].root.innerHTML,
            }),
        });
        await loadStreams();
        selectStream(currentStreamId);
    } catch (err) {
        setStatus($("syllabus-status"), err.message, "error");
    }
});

// ---------- MENTORS ----------

function renderMentorsList() {
    const stream = currentStream();
    if (!stream) return;
    const mentors = [...stream.mentors].sort((a, b) => a.sort_order - b.sort_order);
    const list = $("mentors-list");
    list.innerHTML = "";

    mentors.forEach((mentor, index) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
        li.style.setProperty("--i", index);
        li.innerHTML = `
            <img class="admin-mentor-thumb" src="${mentor.photo_url ? escapeHtml(mentor.photo_url) : "../pr_logo2x.PNG"}" alt="">
            <div class="admin-unit-main">
                <div class="admin-unit-title">${escapeHtml(mentor.name)}</div>
                <div class="admin-muted">${escapeHtml(mentor.title || "")}</div>
            </div>
        `;
        li.querySelector(".admin-unit-main").addEventListener("click", () => openMentor(mentor));
        list.appendChild(li);
    });

    $("btn-new-mentor").hidden = mentors.length >= 3;
}

$("btn-new-mentor").addEventListener("click", () => openMentor(null));
$("btn-mentor-back").addEventListener("click", () => {
    showView("syllabus-view");
    renderMentorsList();
});

function openMentor(mentor) {
    currentMentorId = mentor ? mentor.id : null;
    $("mentor-name-input").value = mentor ? mentor.name : "";
    $("mentor-title-input").value = mentor ? mentor.title : "";
    $("mentor-email-input").value = mentor ? mentor.email : "";
    $("mentor-photo-preview").src = mentor && mentor.photo_url ? mentor.photo_url : "../pr_logo2x.PNG";
    setStatus($("mentor-status"), "");
    $("btn-delete-mentor").hidden = !mentor;
    showView("mentor-view");
}

$("mentor-photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus($("mentor-status"), "Uploading photo...");
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData, credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        $("mentor-photo-preview").src = data.url;
        $("mentor-photo-preview").dataset.url = data.url;
        setStatus($("mentor-status"), "Photo uploaded.", "success");
    } catch (err) {
        setStatus($("mentor-status"), err.message, "error");
    } finally {
        e.target.value = "";
    }
});

$("btn-save-mentor").addEventListener("click", async () => {
    const name = $("mentor-name-input").value.trim();
    if (!name) {
        setStatus($("mentor-status"), "Name is required.", "error");
        return;
    }
    const photoUrl = $("mentor-photo-preview").dataset.url || $("mentor-photo-preview").src;
    const payload = {
        name,
        title: $("mentor-title-input").value.trim(),
        email: $("mentor-email-input").value.trim(),
        photo_url: photoUrl.includes("pr_logo2x.PNG") ? "" : photoUrl,
    };
    try {
        if (currentMentorId) {
            await api("/api/admin/mentors", { method: "PUT", body: JSON.stringify({ id: currentMentorId, ...payload }) });
        } else {
            await api("/api/admin/mentors", { method: "POST", body: JSON.stringify({ stream_id: currentStreamId, ...payload }) });
        }
        await loadStreams();
        showView("syllabus-view");
        renderMentorsList();
    } catch (err) {
        setStatus($("mentor-status"), err.message, "error");
    }
});

$("btn-delete-mentor").addEventListener("click", async () => {
    if (!currentMentorId) return;
    const ok = await openModal({ title: "Delete mentor?", message: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await api("/api/admin/mentors", { method: "DELETE", body: JSON.stringify({ id: currentMentorId }) });
    await loadStreams();
    showView("syllabus-view");
    renderMentorsList();
});

// ---------- UNIT FOLDERS ----------

function renderUnitsList() {
    const stream = currentStream();
    if (!stream) return;

    $("units-stream-name").textContent = stream.name;
    $("units-stream-desc").textContent = stream.description;

    const units = [...stream.units].sort((a, b) => a.sort_order - b.sort_order);
    const list = $("units-list");
    list.innerHTML = "";
    $("units-empty").hidden = units.length > 0;

    units.forEach((unit, index) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
        li.style.setProperty("--i", index);
        li.innerHTML = `
            <div class="admin-unit-reorder">
                <button type="button" data-dir="up" ${index === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
                <button type="button" data-dir="down" ${index === units.length - 1 ? "disabled" : ""} aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="admin-unit-main">
                <span class="admin-tag">${escapeHtml(unit.unit_label)}</span>
                <div class="admin-unit-title">${escapeHtml(unit.title)}</div>
            </div>
            <span class="admin-status ${unit.published ? "is-published" : "is-draft"}">
                <span class="admin-status-dot"></span>${unit.published ? "Published" : "Draft"}
            </span>
        `;
        li.querySelector(".admin-unit-main").addEventListener("click", () => openUnit(unit.id, true));
        li.querySelectorAll("[data-dir]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                reorder("units", units, index, btn.dataset.dir === "up" ? -1 : 1);
            });
        });
        list.appendChild(li);
    });
}

$("btn-new-unit").addEventListener("click", async () => {
    const result = await openModal({
        title: "New Unit",
        fields: [
            { label: "Unit number", placeholder: "Unit 1" },
            { label: "Unit title", placeholder: "Intro to FIRST" },
        ],
        confirmLabel: "Create",
    });
    if (!result) return;
    const [unit_label, title] = result;
    if (!unit_label || !title) return;

    const created = await api("/api/admin/units", {
        method: "POST",
        body: JSON.stringify({ stream_id: currentStreamId, unit_label, title }),
    });
    await loadStreams();
    openUnit(created.id, true);
});

function openUnit(unitId, resetTab = false) {
    currentUnitId = unitId;
    const unit = currentUnit();
    if (!unit) return;

    $("unit-label-input").value = unit.unit_label;
    $("unit-title-input").value = unit.title;
    $("unit-published").checked = Boolean(unit.published);
    setStatus($("unit-status"), "");

    renderItemList("lesson");
    renderItemList("assignment");
    renderItemList("resource");

    $("admin-count-lessons").textContent = unit.lessons.length ? `(${unit.lessons.length})` : "";
    $("admin-count-assignments").textContent = unit.assignments.length ? `(${unit.assignments.length})` : "";
    $("admin-count-resources").textContent = unit.resources.length ? `(${unit.resources.length})` : "";

    // Only reset to the Lessons tab when actually navigating to a unit —
    // refreshing the currently-open unit's data after a save/reorder should
    // leave whichever tab the instructor was already working in alone.
    if (resetTab) {
        document.querySelectorAll("#unit-view .chapter-tab").forEach((t) => t.classList.toggle("active", t.dataset.unitTab === "lessons"));
        document.querySelectorAll("#unit-view .chapter-tab-panel").forEach((p) => p.classList.toggle("active", p.id === "unit-panel-lessons"));
    }

    showView("unit-view");
}

document.querySelectorAll("#unit-view .chapter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll("#unit-view .chapter-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll("#unit-view .chapter-tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(`unit-panel-${tab.dataset.unitTab}`).classList.add("active");
    });
});

$("btn-unit-back").addEventListener("click", () => selectStream(currentStreamId));

$("btn-save-unit").addEventListener("click", async () => {
    const unit_label = $("unit-label-input").value.trim();
    const title = $("unit-title-input").value.trim();
    if (!unit_label || !title) {
        setStatus($("unit-status"), "Unit number and title are both required.", "error");
        return;
    }
    try {
        await api("/api/admin/units", {
            method: "PUT",
            body: JSON.stringify({ id: currentUnitId, unit_label, title, published: $("unit-published").checked }),
        });
        await loadStreams();
        openUnit(currentUnitId);
    } catch (err) {
        setStatus($("unit-status"), err.message, "error");
    }
});

$("btn-delete-unit").addEventListener("click", async () => {
    const unit = currentUnit();
    if (!unit) return;
    const ok = await openModal({
        title: "Delete unit?",
        message: `Delete "${unit.unit_label}: ${unit.title}" and everything inside it — lessons, assignments, and resources? This can't be undone.`,
        confirmLabel: "Delete",
        danger: true,
    });
    if (!ok) return;
    await api("/api/admin/units", { method: "DELETE", body: JSON.stringify({ id: unit.id }) });
    currentUnitId = null;
    await loadStreams();
});

// ---------- LESSONS / ASSIGNMENTS / RESOURCES (shared item editor) ----------

function renderItemList(kind) {
    const unit = currentUnit();
    if (!unit) return;
    const { field } = ITEM_KINDS[kind];
    const items = [...unit[field]].sort((a, b) => a.sort_order - b.sort_order);
    const list = $(`${kind}s-list`);
    list.innerHTML = "";
    $(`${kind}s-empty`).hidden = items.length > 0;

    items.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
        li.style.setProperty("--i", index);
        li.innerHTML = `
            <div class="admin-unit-reorder">
                <button type="button" data-dir="up" ${index === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
                <button type="button" data-dir="down" ${index === items.length - 1 ? "disabled" : ""} aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="admin-unit-main">
                <div class="admin-unit-title">${escapeHtml(item.title)}</div>
            </div>
            <span class="admin-status ${item.published ? "is-published" : "is-draft"}">
                <span class="admin-status-dot"></span>${item.published ? "Published" : "Draft"}
            </span>
        `;
        li.querySelector(".admin-unit-main").addEventListener("click", () => openItemEditor(kind, item));
        li.querySelectorAll("[data-dir]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                reorderItems(kind, items, index, btn.dataset.dir === "up" ? -1 : 1);
            });
        });
        list.appendChild(li);
    });
}

async function reorder(table, list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await api("/api/admin/reorder", { method: "POST", body: JSON.stringify({ table, orderedIds: reordered.map((i) => i.id) }) });
    await loadStreams();
    selectStream(currentStreamId);
}

async function reorderItems(kind, list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await api("/api/admin/reorder", {
        method: "POST",
        body: JSON.stringify({ table: `${kind}s`, orderedIds: reordered.map((i) => i.id) }),
    });
    await loadStreams();
    openUnit(currentUnitId);
}

$("btn-new-lesson").addEventListener("click", () => openItemEditor("lesson", null));
$("btn-new-assignment").addEventListener("click", () => openItemEditor("assignment", null));
$("btn-new-resource").addEventListener("click", () => openItemEditor("resource", null));
$("btn-editor-back").addEventListener("click", () => {
    showView("unit-view");
});

function openItemEditor(kind, item) {
    currentItemKind = kind;
    currentItemId = item ? item.id : null;
    const { label } = ITEM_KINDS[kind];

    $("editor-title-label").textContent = `${label} title`;
    $("editor-title").value = item ? item.title : "";
    $("editor-published").checked = item ? Boolean(item.published) : false;
    setStatus($("editor-status"), "");
    setStatus($("editor-upload-status"), "");
    $("btn-delete-lesson").hidden = !item;

    ensureQuill("editor-quill-content", `Write this ${label.toLowerCase()}'s content here...`);
    setQuillHtml("editor-quill-content", item ? item.content_html : "");

    showView("editor-view");
}

$("btn-save-lesson").addEventListener("click", async () => {
    const title = $("editor-title").value.trim();
    if (!title) {
        setStatus($("editor-status"), "Title is required.", "error");
        return;
    }
    const { api: apiPath } = ITEM_KINDS[currentItemKind];
    const published = $("editor-published").checked;
    const content_html = quillInstances["editor-quill-content"].root.innerHTML;

    try {
        if (currentItemId) {
            await api(apiPath, { method: "PUT", body: JSON.stringify({ id: currentItemId, title, published, content_html }) });
        } else {
            const created = await api(apiPath, { method: "POST", body: JSON.stringify({ unit_id: currentUnitId, title }) });
            currentItemId = created.id;
            await api(apiPath, { method: "PUT", body: JSON.stringify({ id: currentItemId, published, content_html }) });
        }
        await loadStreams();
        openUnit(currentUnitId);
    } catch (err) {
        setStatus($("editor-status"), err.message, "error");
    }
});

$("btn-delete-lesson").addEventListener("click", async () => {
    if (!currentItemId) return;
    const { api: apiPath, label } = ITEM_KINDS[currentItemKind];
    const ok = await openModal({ title: `Delete ${label.toLowerCase()}?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await api(apiPath, { method: "DELETE", body: JSON.stringify({ id: currentItemId }) });
    await loadStreams();
    openUnit(currentUnitId);
});

$("editor-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus($("editor-upload-status"), `Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData, credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        const editor = quillInstances["editor-quill-content"];
        const range = editor.getSelection(true) || { index: editor.getLength() };
        const isPresentation = /\.(pptx|ppt|key)$/i.test(file.name);

        if (file.type.startsWith("image/")) {
            editor.insertEmbed(range.index, "image", data.url);
        } else if (isPresentation) {
            const absoluteUrl = new URL(data.url, location.origin).href;
            insertPresentationEmbed(editor, range.index, officeEmbedUrl(absoluteUrl), file.name);
        } else {
            editor.insertText(range.index, data.filename, "link", data.url);
        }
        editor.setSelection(range.index + 1);
        setStatus($("editor-upload-status"), `Attached ${data.filename}`, "success");
    } catch (err) {
        setStatus($("editor-upload-status"), err.message, "error");
    } finally {
        e.target.value = "";
    }
});

document.querySelectorAll(".syllabus-file-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        const target = input.dataset.target; // "objectives" | "schedule"
        const statusEl = document.querySelector(`.syllabus-upload-status[data-target="${target}"]`);
        if (!file) return;
        setStatus(statusEl, `Uploading ${file.name}...`);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: formData, credentials: "same-origin" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            const editor = quillInstances[`syllabus-quill-${target}`];
            const range = editor.getSelection(true) || { index: editor.getLength() };
            const isPresentation = /\.(pptx|ppt|key)$/i.test(file.name);

            if (file.type.startsWith("image/")) {
                editor.insertEmbed(range.index, "image", data.url);
            } else if (isPresentation) {
                const absoluteUrl = new URL(data.url, location.origin).href;
                insertPresentationEmbed(editor, range.index, officeEmbedUrl(absoluteUrl), file.name);
            } else {
                editor.insertText(range.index, data.filename, "link", data.url);
            }
            editor.setSelection(range.index + 1);
            setStatus(statusEl, `Attached ${data.filename}`, "success");
        } catch (err) {
            setStatus(statusEl, err.message, "error");
        } finally {
            e.target.value = "";
        }
    });
});

$("btn-embed-slides").addEventListener("click", async () => {
    const result = await openModal({
        title: "Embed Google Slides",
        message: "Paste the share link from Google Slides — it'll be converted to an embeddable presentation automatically.",
        fields: [{ label: "Slides link", placeholder: "https://docs.google.com/presentation/d/..." }],
        confirmLabel: "Embed",
    });
    if (!result) return;
    const [rawUrl] = result;
    if (!rawUrl) return;

    const editor = quillInstances["editor-quill-content"];
    const range = editor.getSelection(true) || { index: editor.getLength() };
    insertPresentationEmbed(editor, range.index, toSlidesEmbedUrl(rawUrl), "Slides presentation");
    editor.setSelection(range.index + 1);
    setStatus($("editor-upload-status"), iframeEmbedsSupported ? "Slides embedded." : "Slides link added.", "success");
});

// ---------- INSTRUCTORS ----------

async function loadInstructors() {
    const instructors = await api("/api/admin/instructors");
    const list = $("instructors-list");
    list.innerHTML = "";
    instructors.forEach((person, index) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
        li.style.setProperty("--i", index);
        li.innerHTML = `
            <div class="admin-unit-main" style="cursor:default;">
                <div class="admin-unit-title">${escapeHtml(person.name)}</div>
                <div class="admin-muted">${escapeHtml(person.email)}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

$("new-instructor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus($("instructor-status"), "");
    try {
        await api("/api/admin/instructors", {
            method: "POST",
            body: JSON.stringify({
                name: $("new-instructor-name").value.trim(),
                email: $("new-instructor-email").value.trim(),
                password: $("new-instructor-password").value,
            }),
        });
        e.target.reset();
        await loadInstructors();
    } catch (err) {
        setStatus($("instructor-status"), err.message, "error");
    }
});

// ---------- UTIL ----------

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Central helper so every status message looks consistent: errors turn red
// and briefly flash, confirmations turn green, everything else stays muted.
function setStatus(el, message, tone) {
    el.textContent = message;
    el.classList.remove("is-error", "is-success", "status-flash");
    if (tone) el.classList.add(tone === "error" ? "is-error" : "is-success");
    if (tone) {
        void el.offsetWidth; // restart the animation if it's already mid-flash
        el.classList.add("status-flash");
    }
}

checkSession();
