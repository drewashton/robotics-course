const STREAM_ICONS = { business: "fa-briefcase", build: "fa-hammer", programming: "fa-code" };

// Register a custom Quill format so Google Slides / uploaded PowerPoint
// files can be embedded as real inline iframes, not just links.
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

// Turns a normal Google Slides share/edit link into its embeddable form.
// Leaves already-embeddable or unrelated URLs untouched.
function toSlidesEmbedUrl(rawUrl) {
    const url = rawUrl.trim();
    const match = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (match && !url.includes("/embed")) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return url;
}

// Builds a Microsoft Office Online viewer URL for an uploaded .pptx/.ppt
// file, so it renders inline instead of just linking out to a download.
function officeEmbedUrl(absoluteFileUrl) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteFileUrl)}`;
}

let streamsData = [];       // [{ id, stream_key, name, description, objectives_html, schedule_html, units: [{ id, unit_label, title, assignments_html, resources_html, published, lessons: [...] }] }]
let currentStreamId = null;
let currentUnitId = null;
let currentLessonId = null; // null while creating a brand-new lesson
const quillInstances = {};  // keyed by container id

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
        $("login-error").textContent = err.message;
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
    $("syllabus-status").textContent = "";

    ensureQuill("syllabus-quill-objectives", "What will students learn in this stream?");
    ensureQuill("syllabus-quill-schedule", "How should students pace themselves through this stream?");
    setQuillHtml("syllabus-quill-objectives", stream.objectives_html);
    setQuillHtml("syllabus-quill-schedule", stream.schedule_html);

    showView("syllabus-view");
});

$("btn-syllabus-back").addEventListener("click", () => selectStream(currentStreamId));

$("btn-save-syllabus").addEventListener("click", async () => {
    const name = $("syllabus-name").value.trim();
    if (!name) {
        $("syllabus-status").textContent = "Stream name can't be empty.";
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
        $("syllabus-status").textContent = err.message;
    }
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
        li.innerHTML = `
            <div class="admin-unit-reorder">
                <button type="button" data-dir="up" ${index === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
                <button type="button" data-dir="down" ${index === units.length - 1 ? "disabled" : ""} aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="admin-unit-main">
                <div class="admin-unit-label">${escapeHtml(unit.unit_label)}</div>
                <div class="admin-unit-title">${escapeHtml(unit.title)}</div>
            </div>
            <span class="admin-status ${unit.published ? "is-published" : "is-draft"}">
                <span class="admin-status-dot"></span>${unit.published ? "Published" : "Draft"}
            </span>
        `;
        li.querySelector(".admin-unit-main").addEventListener("click", () => openUnit(unit.id));
        li.querySelectorAll("[data-dir]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                reorder("units", units, index, btn.dataset.dir === "up" ? -1 : 1, () => renderUnitsList());
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
    openUnit(created.id);
});

function openUnit(unitId) {
    currentUnitId = unitId;
    const unit = currentUnit();
    if (!unit) return;

    $("unit-label-input").value = unit.unit_label;
    $("unit-title-input").value = unit.title;
    $("unit-published").checked = Boolean(unit.published);
    $("unit-status").textContent = "";
    document.querySelectorAll(".unit-upload-status").forEach((el) => (el.textContent = ""));

    ensureQuill("unit-quill-assignments", "What should students complete for this unit?");
    ensureQuill("unit-quill-resources", "Link or describe any supporting resources.");
    setQuillHtml("unit-quill-assignments", unit.assignments_html);
    setQuillHtml("unit-quill-resources", unit.resources_html);

    renderLessonsList();
    showView("unit-view");
}

$("btn-unit-back").addEventListener("click", () => selectStream(currentStreamId));

$("btn-save-unit").addEventListener("click", async () => {
    const unit_label = $("unit-label-input").value.trim();
    const title = $("unit-title-input").value.trim();
    if (!unit_label || !title) {
        $("unit-status").textContent = "Unit number and title are both required.";
        return;
    }
    try {
        await api("/api/admin/units", {
            method: "PUT",
            body: JSON.stringify({
                id: currentUnitId,
                unit_label,
                title,
                assignments_html: quillInstances["unit-quill-assignments"].root.innerHTML,
                resources_html: quillInstances["unit-quill-resources"].root.innerHTML,
                published: $("unit-published").checked,
            }),
        });
        await loadStreams();
        openUnit(currentUnitId);
    } catch (err) {
        $("unit-status").textContent = err.message;
    }
});

$("btn-delete-unit").addEventListener("click", async () => {
    const unit = currentUnit();
    if (!unit) return;
    const ok = await openModal({
        title: "Delete unit?",
        message: `Delete "${unit.unit_label}: ${unit.title}" and every lesson inside it? This can't be undone.`,
        confirmLabel: "Delete",
        danger: true,
    });
    if (!ok) return;
    await api("/api/admin/units", { method: "DELETE", body: JSON.stringify({ id: unit.id }) });
    currentUnitId = null;
    await loadStreams();
});

document.querySelectorAll(".unit-file-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        const target = input.dataset.target; // "assignments" | "resources"
        const statusEl = document.querySelector(`.unit-upload-status[data-target="${target}"]`);
        if (!file) return;
        statusEl.textContent = `Uploading ${file.name}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: formData, credentials: "same-origin" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            const editor = quillInstances[`unit-quill-${target}`];
            const range = editor.getSelection(true) || { index: editor.getLength() };
            const isPresentation = /\.(pptx|ppt|key)$/i.test(file.name);

            if (file.type.startsWith("image/")) {
                editor.insertEmbed(range.index, "image", data.url);
            } else if (isPresentation) {
                const absoluteUrl = new URL(data.url, location.origin).href;
                editor.insertEmbed(range.index, "iframe", officeEmbedUrl(absoluteUrl));
            } else {
                editor.insertText(range.index, data.filename, "link", data.url);
            }
            editor.setSelection(range.index + 1);
            statusEl.textContent = `Attached ${data.filename}`;
        } catch (err) {
            statusEl.textContent = err.message;
        } finally {
            e.target.value = "";
        }
    });
});

// ---------- LESSONS ----------

function renderLessonsList() {
    const unit = currentUnit();
    if (!unit) return;

    const lessons = [...unit.lessons].sort((a, b) => a.sort_order - b.sort_order);
    const list = $("lessons-list");
    list.innerHTML = "";
    $("lessons-empty").hidden = lessons.length > 0;

    lessons.forEach((lesson, index) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
        li.innerHTML = `
            <div class="admin-unit-reorder">
                <button type="button" data-dir="up" ${index === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
                <button type="button" data-dir="down" ${index === lessons.length - 1 ? "disabled" : ""} aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="admin-unit-main">
                <div class="admin-unit-title">${escapeHtml(lesson.title)}</div>
            </div>
            <span class="admin-status ${lesson.published ? "is-published" : "is-draft"}">
                <span class="admin-status-dot"></span>${lesson.published ? "Published" : "Draft"}
            </span>
        `;
        li.querySelector(".admin-unit-main").addEventListener("click", () => openLessonEditor(lesson));
        li.querySelectorAll("[data-dir]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                reorder("lessons", lessons, index, btn.dataset.dir === "up" ? -1 : 1, () => renderLessonsList());
            });
        });
        list.appendChild(li);
    });
}

async function reorder(table, list, index, delta, rerender) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await api("/api/admin/reorder", {
        method: "POST",
        body: JSON.stringify({ table, orderedIds: reordered.map((item) => item.id) }),
    });
    await loadStreams();
    if (table === "units") selectStream(currentStreamId);
    else openUnit(currentUnitId);
}

$("btn-new-lesson").addEventListener("click", () => openLessonEditor(null));
$("btn-editor-back").addEventListener("click", () => showView("unit-view"));

function openLessonEditor(lesson) {
    currentLessonId = lesson ? lesson.id : null;
    $("editor-title").value = lesson ? lesson.title : "";
    $("editor-published").checked = lesson ? Boolean(lesson.published) : false;
    $("editor-status").textContent = "";
    $("editor-upload-status").textContent = "";
    $("btn-delete-lesson").hidden = !lesson;

    ensureQuill("editor-quill-content", "Write this lesson's content here...");
    setQuillHtml("editor-quill-content", lesson ? lesson.content_html : "");

    showView("editor-view");
}

$("btn-save-lesson").addEventListener("click", async () => {
    const title = $("editor-title").value.trim();
    if (!title) {
        $("editor-status").textContent = "Lesson title is required.";
        return;
    }
    const published = $("editor-published").checked;
    const content_html = quillInstances["editor-quill-content"].root.innerHTML;

    try {
        if (currentLessonId) {
            await api("/api/admin/lessons", {
                method: "PUT",
                body: JSON.stringify({ id: currentLessonId, title, published, content_html }),
            });
        } else {
            const created = await api("/api/admin/lessons", {
                method: "POST",
                body: JSON.stringify({ unit_id: currentUnitId, title }),
            });
            currentLessonId = created.id;
            await api("/api/admin/lessons", {
                method: "PUT",
                body: JSON.stringify({ id: currentLessonId, published, content_html }),
            });
        }
        await loadStreams();
        openUnit(currentUnitId);
    } catch (err) {
        $("editor-status").textContent = err.message;
    }
});

$("btn-delete-lesson").addEventListener("click", async () => {
    if (!currentLessonId) return;
    const ok = await openModal({
        title: "Delete lesson?",
        message: "This can't be undone.",
        confirmLabel: "Delete",
        danger: true,
    });
    if (!ok) return;
    await api("/api/admin/lessons", { method: "DELETE", body: JSON.stringify({ id: currentLessonId }) });
    await loadStreams();
    openUnit(currentUnitId);
});

$("editor-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $("editor-upload-status").textContent = `Uploading ${file.name}...`;

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
            editor.insertEmbed(range.index, "iframe", officeEmbedUrl(absoluteUrl));
        } else {
            editor.insertText(range.index, data.filename, "link", data.url);
        }
        editor.setSelection(range.index + 1);
        $("editor-upload-status").textContent = `Attached ${data.filename}`;
    } catch (err) {
        $("editor-upload-status").textContent = err.message;
    } finally {
        e.target.value = "";
    }
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
    editor.insertEmbed(range.index, "iframe", toSlidesEmbedUrl(rawUrl));
    editor.setSelection(range.index + 1);
    $("editor-upload-status").textContent = "Slides embedded.";
});

// ---------- INSTRUCTORS ----------

async function loadInstructors() {
    const instructors = await api("/api/admin/instructors");
    const list = $("instructors-list");
    list.innerHTML = "";
    instructors.forEach((person) => {
        const li = document.createElement("li");
        li.className = "admin-unit-row";
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
    $("instructor-status").textContent = "";
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
        $("instructor-status").textContent = err.message;
    }
});

// ---------- UTIL ----------

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

checkSession();
