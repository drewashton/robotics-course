const STREAM_ICONS = { business: "fa-briefcase", build: "fa-hammer", programming: "fa-code" };
const DEFAULT_ICON = "fa-folder-open";

let courseStreamsList = [];      // ordered array of streams
let courseStreamsByKey = {};      // lookup by stream key
let currentStreamKey = null;
let dataLoaded = false;

document.addEventListener("DOMContentLoaded", async () => {
    // Top-level Navigation Screens
    const portalScreen = document.getElementById("portal-screen");
    const appInterface = document.getElementById("app-interface");

    // Menu Controls
    const btnBackHome = document.getElementById("btn-back-home");
    const logoBackHome = document.getElementById("back-to-portal");
    const chaptersNav = document.getElementById("chapters-nav");
    const btnDashboard = document.getElementById("btn-dashboard");

    // View Panels
    const homeView = document.getElementById("home-view");
    const chapterView = document.getElementById("chapter-view");

    // Homepage Elements
    const homeStreamTitle = document.getElementById("home-stream-title");
    const homeDescriptionContainer = document.getElementById("home-description-container");
    const homeObjectivesBox = document.getElementById("home-objectives-box");
    const homeScheduleBox = document.getElementById("home-schedule-box");
    const mentorColumn = document.getElementById("mentor-column");

    // Dynamic Unit View Elements
    const viewChapterNum = document.getElementById("view-chapter-num");
    const viewChapterName = document.getElementById("view-chapter-name");
    const viewChapterDesc = document.getElementById("view-chapter-desc");
    const viewChapterLessons = document.getElementById("view-chapter-lessons");
    const viewChapterAssignments = document.getElementById("view-chapter-assignments");
    const viewChapterResources = document.getElementById("view-chapter-resources");

    // Fetch every stream (with its published units, lessons, assignments,
    // resources, and mentors) from the CMS backend
    async function loadCourseData() {
        try {
            const res = await fetch("/api/streams");
            if (!res.ok) throw new Error("Failed to load course data");
            courseStreamsList = await res.json();
        } catch (err) {
            console.error(err);
            courseStreamsList = [];
        }
        courseStreamsByKey = {};
        courseStreamsList.forEach((s) => (courseStreamsByKey[s.key] = s));
        dataLoaded = true;
    }

    function streamIcon(key) {
        return STREAM_ICONS[key] || DEFAULT_ICON;
    }

    function goToStream(key) {
        currentStreamKey = key;
        syncActiveStreamButtons();
        loadStream(key);
        portalScreen.style.display = "none";
        appInterface.style.display = "flex";
        showDashboard();
    }

    function renderPortalCards() {
        const grid = document.getElementById("stream-grid");
        grid.innerHTML = "";
        if (courseStreamsList.length === 0) {
            grid.innerHTML = `<p class="chapter-desc-placeholder" style="color:#999;">No streams available yet. Check back soon.</p>`;
            return;
        }
        courseStreamsList.forEach((stream) => {
            const btn = document.createElement("button");
            btn.className = "portal-stream-card";
            btn.dataset.selectStream = stream.key;
            btn.innerHTML = `
                <div class="stream-icon"><i class="fa-solid ${streamIcon(stream.key)}"></i></div>
                <h3>${escapeHtml(stream.name)}</h3>
                <span class="stream-action">Launch Stream &rarr;</span>
            `;
            btn.addEventListener("click", () => goToStream(stream.key));
            grid.appendChild(btn);
        });
    }

    function renderStreamSelector() {
        const selector = document.getElementById("stream-selector");
        selector.innerHTML = "";
        courseStreamsList.forEach((stream) => {
            const btn = document.createElement("button");
            btn.className = "stream-btn";
            btn.dataset.stream = stream.key;
            btn.textContent = stream.name;
            btn.addEventListener("click", () => goToStream(stream.key));
            selector.appendChild(btn);
        });
    }

    function syncActiveStreamButtons() {
        document.querySelectorAll(".stream-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.stream === currentStreamKey);
        });
    }

    // 2. Return to Main Selection Menu
    const returnToPortal = () => {
        appInterface.style.display = "none";
        portalScreen.style.display = "flex";
    };
    btnBackHome.addEventListener("click", returnToPortal);
    logoBackHome.addEventListener("click", returnToPortal);

    // Syllabus Menu Button
    btnDashboard.addEventListener("click", () => {
        showDashboard();
    });

    // Fills a container with either real content (solid content-box) or a
    // muted placeholder message (dashed placeholder-box), so real instructor
    // content never looks like an empty draft state.
    function fillBox(container, html, emptyMessage) {
        const hasContent = html && html.replace(/<[^>]*>/g, "").trim().length > 0;
        container.classList.toggle("content-box", hasContent);
        container.classList.toggle("placeholder-box", !hasContent);
        container.innerHTML = hasContent ? html : `<p>${emptyMessage}</p>`;
    }

    // Renders a container as a stack of titled entries (used for Lessons,
    // Assignments, and Resources — all the same shape now).
    function fillEntryList(container, entries, emptyMessage) {
        if (!entries || entries.length === 0) {
            container.classList.remove("content-box");
            container.classList.add("placeholder-box");
            container.innerHTML = `<p>${emptyMessage}</p>`;
            return;
        }
        container.classList.remove("placeholder-box");
        container.classList.add("content-box");
        container.innerHTML = entries
            .map(
                (entry) => `
                    <div class="lesson-block">
                        <h4>${escapeHtml(entry.title)}</h4>
                        ${entry.content && entry.content.trim() ? entry.content : "<p><em>No content added yet.</em></p>"}
                    </div>
                `
            )
            .join("");
    }

    function renderMentors(mentors) {
        mentorColumn.innerHTML = "";
        if (!mentors || mentors.length === 0) return;

        const header = document.createElement("div");
        header.className = "card-header mentor-column-header";
        header.innerHTML = `<i class="fa-solid fa-user-graduate"></i> Mentor Help Contacts`;
        mentorColumn.appendChild(header);

        mentors.forEach((mentor, index) => {
            const card = document.createElement("div");
            card.className = "mentor-card";
            card.style.setProperty("--i", index);
            const photo = mentor.photo && mentor.photo.trim() ? mentor.photo : "pr_logo2x.PNG";
            card.innerHTML = `
                <img class="mentor-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(mentor.name)}">
                <div class="mentor-name">${escapeHtml(mentor.name)}</div>
                ${mentor.title ? `<div class="mentor-title">${escapeHtml(mentor.title)}</div>` : ""}
                ${mentor.description ? `<p class="mentor-desc">${escapeHtml(mentor.description)}</p>` : ""}
                ${mentor.email ? `<a class="mentor-email-btn" href="mailto:${escapeHtml(mentor.email)}"><i class="fa-solid fa-envelope"></i> Email</a>` : ""}
            `;
            mentorColumn.appendChild(card);
        });
    }

    // Load Stream Data to Workspace
    function loadStream(streamKey) {
        const stream = courseStreamsByKey[streamKey];
        if (!stream) return;

        homeStreamTitle.textContent = stream.name;
        homeDescriptionContainer.innerHTML = `<p>${stream.description || ""}</p>`;
        fillBox(homeObjectivesBox, stream.objectives, "Learning objectives haven't been added yet.");
        fillBox(homeScheduleBox, stream.schedule, "A recommended schedule hasn't been added yet.");
        renderMentors(stream.mentors);

        // Populate Left-hand Units list
        chaptersNav.innerHTML = "";
        stream.units.forEach((unit, index) => {
            const button = document.createElement("button");
            button.className = "nav-item";
            button.innerHTML = `<i class="fa-solid fa-folder"></i> ${escapeHtml(unit.unit)}: ${escapeHtml(unit.title)}`;
            button.addEventListener("click", () => showChapter(index));
            chaptersNav.appendChild(button);
        });

        if (stream.units.length === 0) {
            const empty = document.createElement("p");
            empty.className = "chapter-desc-placeholder";
            empty.style.padding = "12px";
            empty.textContent = "No units published yet.";
            chaptersNav.appendChild(empty);
        }
    }

    function showDashboard() {
        clearActiveSidebarItems();
        btnDashboard.classList.add("active");

        homeView.classList.add("active-view");
        chapterView.classList.remove("active-view");
    }

    function showChapter(index) {
        clearActiveSidebarItems();

        const navItems = chaptersNav.querySelectorAll(".nav-item");
        if (navItems[index]) {
            navItems[index].classList.add("active");
        }

        const unit = courseStreamsByKey[currentStreamKey].units[index];
        if (!unit) return;

        homeView.classList.remove("active-view");
        chapterView.classList.add("active-view");

        viewChapterNum.textContent = unit.unit;
        viewChapterName.textContent = unit.title;
        viewChapterDesc.textContent = "";

        fillEntryList(viewChapterLessons, unit.lessons, "No lessons added yet.");
        fillEntryList(viewChapterAssignments, unit.assignments, "No assignments added yet.");
        fillEntryList(viewChapterResources, unit.resources, "No resources added yet.");
    }

    function clearActiveSidebarItems() {
        btnDashboard.classList.remove("active");
        const navItems = chaptersNav.querySelectorAll(".nav-item");
        navItems.forEach(item => item.classList.remove("active"));
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    await loadCourseData();
    renderPortalCards();
    renderStreamSelector();
});
