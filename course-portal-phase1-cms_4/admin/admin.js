const STREAM_ICONS = {
    business: "fa-briefcase", build: "fa-hammer", programming: "fa-code",
    roles: "fa-id-badge", parents: "fa-hand-holding-heart", mentors: "fa-chalkboard-user",
    "how-it-runs": "fa-diagram-project", "prep-team": "fa-seedling", "comp-team": "fa-trophy", career: "fa-graduation-cap",
};

// The same Admin Panel edits two sites: the Prep Team learning platform
// ("course") and the internal program portal ("internal"). Everything that
// reads differently between them lives in this table, applied to any
// element tagged data-lbl="key" by applySiteLabels().
const SITE_LABELS = {
    course: {
        editSyllabus: "Edit Syllabus", newUnit: "New Unit", backToUnits: "Back to units",
        streamName: "Stream name", objectives: "Learning Objectives",
        mentorsHeader: "Mentors", addMentor: "Add Mentor",
        mentorsHint: "Shown to students as help contacts for this stream - up to 3 mentors, each with a photo, name, role, and an emailable contact button.",
        unitTitle: "Unit title", lessonsHeader: "Lessons", lessonsEmpty: "No lessons yet.", newLesson: "New Lesson",
        visible: "Published - visible to students",
        unitsEmpty: 'No units yet in this stream. Click "New Unit" to add the first folder.',
    },
    internal: {
        editSyllabus: "Edit Section", newUnit: "New Group", backToUnits: "Back to section",
        streamName: "Section name", objectives: "Overview",
        mentorsHeader: "Help Contacts", addMentor: "Add Contact",
        mentorsHint: "Shown at the bottom of this section's home page - up to 8 people, each with a photo, name, role, and an emailable contact button.",
        unitTitle: "Group title", lessonsHeader: "Pages", lessonsEmpty: "No pages yet.", newLesson: "New Page",
        visible: "Published - visible on the portal",
        unitsEmpty: 'Nothing in this section yet. Click "New Group" to add the first one.',
    },
};
// Roles are the one section where each group is a role with its own handbook,
// so the wording and the starting pages differ.
const ROLE_OVERRIDES = {
    newUnit: "New Role", unitTitle: "Role name", lessonsHeader: "Handbook Pages", lessonsEmpty: "No handbook pages yet.", newLesson: "New Handbook Page",
    unitsEmpty: 'No roles yet. Click "New Role" to add the first one.',
};
const ROLE_STARTER_PAGES = ["Training", "Reports", "Job Description", "Job Duties - Off Season", "Job Duties - Build Season", "Help Contacts"];
const MAX_CONTACTS = { course: 3, internal: 8 };

// Lessons, Assignments, and Resources are managed with one shared editor -
// this config drives which API endpoint, unit field, and labels apply.
const ITEM_KINDS = {
    lesson: { api: "/api/admin/lessons", field: "lessons", label: "Lesson", newLabel: "New Lesson" },
    assignment: { api: "/api/admin/assignments", field: "assignments", label: "Assignment", newLabel: "New Assignment" },
    resource: { api: "/api/admin/resources", field: "resources", label: "Resource", newLabel: "New Resource" },
};

// Register a custom Quill format so Google Slides / uploaded PowerPoint
// files can be embedded as real inline iframes, not just links. Wrapped in
// try/catch so a problem here can NEVER take down the rest of the panel -
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

// Lets mentors resize an embedded image, video, or slideshow after
// inserting it, rather than everything always rendering full-width.
// Lets mentors resize an embedded image, video, or slideshow after
// inserting it, rather than everything always rendering full-width.
// This works directly against the actual DOM node Quill renders for that
// embed (via the documented, stable getLeaf() API) rather than registering
// a custom Quill "format" - that first approach depended on an internal
// Parchment API whose exact shape isn't reliable across Quill versions,
// and it was failing silently. Setting the DOM node's own style directly
// is simpler and shows up correctly whenever the content is saved, since
// saving just reads the live DOM (quill.root.innerHTML).
function setEmbedWidth(editor, width) {
    const range = editor.getSelection();
    if (!range) return false;
    // Clicking an embed in Quill can leave the cursor either on it or just
    // past it, so check both spots.
    for (const idx of [range.index, range.index - 1]) {
        if (idx < 0) continue;
        let leaf;
        try {
            [leaf] = editor.getLeaf(idx);
        } catch {
            continue;
        }
        const node = leaf && leaf.domNode;
        if (node && (node.tagName === "IMG" || node.tagName === "IFRAME")) {
            node.style.width = width;
            node.style.height = node.tagName === "IFRAME" ? "" : "auto";
            return true;
        }
    }
    return false;
}

// What happens to a file attached through "Attach file": images are placed in
// the content, PowerPoint files become an inline slideshow, and PDFs (the
// designed handbooks) become an inline PDF viewer. The viewer also gets an
// "Open PDF" link on the public site, since phones often show only the first
// page of an embedded PDF. Anything else becomes a download link.
function insertUploadedFile(editor, index, file, data) {
    const isPresentation = /\.(pptx|ppt|key)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (file.type.startsWith("image/")) {
        editor.insertEmbed(index, "image", data.url);
    } else if (isPresentation) {
        const absoluteUrl = new URL(data.url, location.origin).href;
        insertPresentationEmbed(editor, index, officeEmbedUrl(absoluteUrl), file.name);
    } else if (isPdf) {
        insertPresentationEmbed(editor, index, `${data.url}#view=FitH`, data.filename);
    } else {
        editor.insertText(index, data.filename, "link", data.url);
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
let cameFromLayout = false;     // true when a group was opened from the Portal layout screen
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
            let input;
            if (f.options) {
                input = document.createElement("select");
                f.options.forEach((o) => {
                    const opt = document.createElement("option");
                    opt.value = o.value;
                    opt.textContent = o.label;
                    input.appendChild(opt);
                });
                if (f.value) input.value = f.value;
            } else {
                input = document.createElement("input");
                input.type = f.type || "text";
                input.value = f.value || "";
                input.placeholder = f.placeholder || "";
            }
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

// Pasting an image directly into the editor (e.g. Ctrl+V on a screenshot)
// embeds it as raw image data right in the content, rather than uploading
// it - this can get large enough to silently break the save request, which
// otherwise just looks like an unexplained "Something went wrong". Catching
// it here means the mentor gets a clear, actionable message pointing at the
// actual cause and fix instead.
function findPastedImageError(html) {
    if (/<img[^>]+src=["']data:/i.test(html)) {
        return "This content has a pasted-in image (not uploaded through \"Attach file\"), which is too large to save. Remove it, then re-add it using the \"Attach file\" button instead.";
    }
    return null;
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
function currentSite() {
    const stream = currentStream();
    return stream && stream.site === "internal" ? "internal" : "course";
}
function isRolesSection() {
    const stream = currentStream();
    return Boolean(stream && stream.stream_key === "roles");
}
function siteLabel(key) {
    if (currentSite() === "internal" && isRolesSection() && ROLE_OVERRIDES[key]) return ROLE_OVERRIDES[key];
    return SITE_LABELS[currentSite()][key];
}
// "Lesson" on the course site is a "Page" on the internal portal.
function itemLabel(kind) {
    if (kind === "lesson" && currentSite() === "internal") return "Page";
    return ITEM_KINDS[kind].label;
}
function applySiteLabels() {
    document.querySelectorAll("[data-lbl]").forEach((el) => {
        const text = siteLabel(el.dataset.lbl);
        if (text !== undefined) el.textContent = text;
    });
    const internal = currentSite() === "internal";
    // Internal sections have no recommended schedule, no assignments, and
    // their groups have no "Unit 1" style number.
    $("schedule-section").hidden = internal;
    $("assignments-section").hidden = internal;
    $("unit-label-field").hidden = internal;
    $("link-view-site").href = internal ? "https://internal.pentictonrobotics.ca/" : "https://course.pentictonrobotics.ca/";
}

// ---------- AUTH ----------

const OWNER_EMAIL = "drew@dashdigital.ca";
let isOwner = false;
let currentUserId = null;

function applySessionUI(session) {
    $("signed-in-as").innerHTML = `<span class="signed-in-name">${escapeHtml(session.name)}</span><span class="signed-in-email">${escapeHtml(session.email)}</span>`;
    isOwner = session.email.toLowerCase().trim() === OWNER_EMAIL;
    currentUserId = session.id;
    $("new-instructor-form").hidden = !isOwner;
}

async function checkSession() {
    try {
        const session = await api("/api/admin/session");
        applySessionUI(session);
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
        applySessionUI(session);
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

$("btn-change-password").addEventListener("click", () => {
    $("change-password-form").reset();
    setStatus($("password-status"), "");
    showView("password-view");
});

$("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current_password = $("current-password-input").value;
    const new_password = $("new-password-input").value;
    try {
        await api("/api/admin/password", {
            method: "PUT",
            body: JSON.stringify({ current_password, new_password }),
        });
        e.target.reset();
        setStatus($("password-status"), "Password updated.", "success");
    } catch (err) {
        setStatus($("password-status"), err.message, "error");
    }
});

// ---------- STREAMS (fixed - no create/delete) ----------

async function loadStreams() {
    streamsData = await api("/api/admin/streams");
    renderStreamNav();
    if (streamsData.length && !streamsData.some((s) => s.id === currentStreamId)) {
        currentStreamId = streamsData[0].id;
    }
    if (currentStreamId) selectStream(currentStreamId);
}

// Reload the sections without changing which screen is showing.
async function refreshStreams() {
    streamsData = await api("/api/admin/streams");
    renderStreamNav();
}

function renderStreamNav() {
    const nav = $("stream-nav");
    nav.innerHTML = "";
    let lastSite = null;
    streamsData.forEach((stream) => {
        if (stream.site !== lastSite) {
            lastSite = stream.site;
            const heading = document.createElement("div");
            heading.className = "stream-nav-heading";
            heading.textContent = stream.site === "internal" ? "Internal Portal" : "Learning Platform";
            nav.appendChild(heading);
            if (stream.site === "internal") nav.appendChild(layoutNavButton());
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stream-nav-item";
        btn.dataset.streamId = stream.id;
        const icon = STREAM_ICONS[stream.stream_key] || "fa-folder";
        btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(stream.name)}`;
        btn.addEventListener("click", () => { cameFromLayout = false; selectStream(stream.id); });
        nav.appendChild(btn);
    });
}

function selectStream(streamId) {
    currentStreamId = streamId;
    showView("units-view");
    document.querySelectorAll(".stream-nav-item").forEach((el) => {
        el.classList.toggle("active", Number(el.dataset.streamId) === streamId);
    });
    applySiteLabels();
    renderUnitsList();
}

// ---------- SYLLABUS EDITOR ----------

// A full toolbar so mentors have real layout/formatting flexibility in
// every rich text area - headings, colors, alignment, lists, quotes, code,
// links, images, and native video embedding (paste a YouTube or Vimeo
// link into the video button's prompt and Quill embeds it directly).
const QUILL_TOOLBAR = [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
    ["blockquote", "code-block"],
    ["link", "image", "video"],
    ["clean"],
];

function ensureQuill(containerId, placeholder) {
    if (!quillInstances[containerId]) {
        quillInstances[containerId] = new Quill(`#${containerId}`, {
            theme: "snow",
            placeholder,
            modules: { toolbar: QUILL_TOOLBAR },
        });
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
    applySiteLabels();
    setQuillHtml("syllabus-quill-objectives", stream.objectives_html);
    setQuillHtml("syllabus-quill-schedule", stream.schedule_html);

    renderMentorsList();
    showView("syllabus-view");
});

$("btn-syllabus-back").addEventListener("click", () => selectStream(currentStreamId));

$("btn-save-syllabus").addEventListener("click", async () => {
    const name = $("syllabus-name").value.trim();
    if (!name) {
        setStatus($("syllabus-status"), `${siteLabel("streamName")} can't be empty.`, "error");
        return;
    }
    const objectives_html = quillInstances["syllabus-quill-objectives"].root.innerHTML;
    const schedule_html = quillInstances["syllabus-quill-schedule"].root.innerHTML;

    const pasteError = findPastedImageError(objectives_html) || findPastedImageError(schedule_html);
    if (pasteError) {
        setStatus($("syllabus-status"), pasteError, "error");
        return;
    }

    try {
        await api("/api/admin/streams", {
            method: "PUT",
            body: JSON.stringify({
                id: currentStreamId,
                name,
                description: $("syllabus-description").value,
                objectives_html,
                schedule_html,
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

    $("btn-new-mentor").hidden = mentors.length >= MAX_CONTACTS[currentSite()];
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
                ${unit.unit_label ? `<span class="admin-tag">${escapeHtml(unit.unit_label)}</span>` : ""}
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
                reorder("units", units, index, btn.dataset.dir === "up" ? -1 : 1);
            });
        });
        list.appendChild(li);
    });
}

$("btn-new-unit").addEventListener("click", async () => {
    if (currentSite() === "internal") {
        const roles = isRolesSection();
        const named = await openModal({
            title: siteLabel("newUnit"),
            message: roles ? "A starter set of draft handbook pages (Training, Reports, Job Description, Job Duties, Help Contacts) is added automatically." : "",
            fields: [{ label: siteLabel("unitTitle"), placeholder: "" }],
            confirmLabel: "Create",
        });
        if (!named || !named[0]) return;
        const created = await api("/api/admin/units", {
            method: "POST",
            body: JSON.stringify({ stream_id: currentStreamId, unit_label: "", title: named[0] }),
        });
        if (roles) {
            for (const title of ROLE_STARTER_PAGES) {
                await api("/api/admin/lessons", { method: "POST", body: JSON.stringify({ unit_id: created.id, title }) });
            }
        }
        await loadStreams();
        openUnit(created.id);
        return;
    }
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

    applySiteLabels();
    $("unit-label-input").value = unit.unit_label;
    $("unit-title-input").value = unit.title;
    $("unit-published").checked = Boolean(unit.published);
    setStatus($("unit-status"), "");

    renderItemList("lesson");
    renderItemList("assignment");
    renderItemList("resource");
    showView("unit-view");
}

$("btn-unit-back").addEventListener("click", () => {
    if (cameFromLayout) {
        cameFromLayout = false;
        showLayout();
    } else {
        selectStream(currentStreamId);
    }
});

$("btn-save-unit").addEventListener("click", async () => {
    const unit_label = $("unit-label-input").value.trim();
    const title = $("unit-title-input").value.trim();
    const needsLabel = currentSite() === "course";
    if ((needsLabel && !unit_label) || !title) {
        setStatus($("unit-status"), needsLabel ? "Unit number and title are both required." : "A title is required.", "error");
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
        message: currentSite() === "internal"
            ? `Delete "${unit.title}" and everything inside it - pages and resources? This can't be undone.`
            : `Delete "${unit.unit_label}: ${unit.title}" and everything inside it - lessons, assignments, and resources? This can't be undone.`,
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
    const label = itemLabel(kind);

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

    const pasteError = findPastedImageError(content_html);
    if (pasteError) {
        setStatus($("editor-status"), pasteError, "error");
        return;
    }

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
    const { api: apiPath } = ITEM_KINDS[currentItemKind];
    const label = itemLabel(currentItemKind);
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

        insertUploadedFile(editor, range.index, file, data);
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
    
            insertUploadedFile(editor, range.index, file, data);
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
        message: "Paste the share link from Google Slides - it'll be converted to an embeddable presentation automatically.",
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
        const canDelete = isOwner && person.id !== currentUserId;
        li.innerHTML = `
            <div class="admin-unit-main" style="cursor:default;">
                <div class="admin-unit-title">${escapeHtml(person.name)}</div>
                <div class="admin-muted">${escapeHtml(person.email)}</div>
            </div>
            ${canDelete ? `<button class="admin-btn admin-btn-danger admin-btn-icon-only" data-delete-instructor="${person.id}" type="button" aria-label="Remove ${escapeHtml(person.name)}"><i class="fa-solid fa-trash"></i></button>` : ""}
        `;
        if (canDelete) {
            li.querySelector("[data-delete-instructor]").addEventListener("click", () => deleteInstructor(person));
        }
        list.appendChild(li);
    });
}

async function deleteInstructor(person) {
    const ok = await openModal({
        title: "Remove instructor?",
        message: `Remove ${person.name} (${person.email})? They'll no longer be able to log in.`,
        confirmLabel: "Remove",
        danger: true,
    });
    if (!ok) return;
    try {
        await api("/api/admin/instructors", { method: "DELETE", body: JSON.stringify({ id: person.id }) });
        await loadInstructors();
    } catch (err) {
        setStatus($("instructor-status"), err.message, "error");
    }
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

// Resize controls: each row is tagged with which Quill instance it
// controls, so one handler covers the lesson editor and both syllabus
// editors without duplicating this logic three times.
document.querySelectorAll(".admin-resize-row").forEach((row) => {
    const containerId = row.dataset.resizeFor;
    row.querySelectorAll(".admin-resize-btn").forEach((btn) => {
        // Clicking any button outside the editor normally steals focus
        // away from it first, which clears whatever was selected inside -
        // so by the time a plain "click" handler ran, the photo/video the
        // mentor had just clicked on was no longer selected at all. Blocking
        // the default behavior on mousedown (before that focus shift
        // happens) keeps the editor's selection intact.
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", () => {
            const editor = quillInstances[containerId];
            if (!editor) return;
            const applied = setEmbedWidth(editor, btn.dataset.width);
            if (!applied) {
                alert("Click directly on the photo, video, or slideshow first, then choose a size.");
            }
        });
    });
});
