const STREAM_ICONS = { exploration: "fa-compass", business: "fa-briefcase", build: "fa-hammer", programming: "fa-code" };

// The learning platform lives at /prepteam. A stream is /prepteam/build, a
// unit is /prepteam/build/unit-title, and a page is .../lesson-title (or
// .../assignment/title, .../resource/title). The address bar always carries
// where you are, so the Back button works and any page can be shared.
const BASE_PATH = "/prepteam";
const SITE_TITLE = "Penticton Robotics - Prep Team";

function slugify(text, used) {
    const base = String(text || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    return slug;
}
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
    const mentorSectionHeader = document.getElementById("mentor-section-header");

    // Dynamic Unit View Elements
    const viewChapterNum = document.getElementById("view-chapter-num");
    const viewChapterName = document.getElementById("view-chapter-name");
    const viewChapterDesc = document.getElementById("view-chapter-desc");
    const viewChapterLessons = document.getElementById("view-chapter-lessons");
    const viewChapterLessonsEmpty = document.getElementById("view-chapter-lessons-empty");
    const viewChapterAssignments = document.getElementById("view-chapter-assignments");
    const viewChapterAssignmentsEmpty = document.getElementById("view-chapter-assignments-empty");
    const viewChapterResources = document.getElementById("view-chapter-resources");
    const viewChapterResourcesEmpty = document.getElementById("view-chapter-resources-empty");

    // Item Page Elements (shared by Lessons, Assignments, and Resources)
    const lessonView = document.getElementById("lesson-view");
    const lessonTitle = document.getElementById("lesson-title");
    const lessonContentBody = document.getElementById("lesson-content-body");
    const btnLessonBack = document.getElementById("btn-lesson-back");
    const lessonBackUnitLabel = document.getElementById("lesson-back-unit-label");
    const btnPrevLesson = document.getElementById("btn-prev-lesson");
    const btnNextLesson = document.getElementById("btn-next-lesson");
    const prevLessonPrefix = document.getElementById("prev-lesson-prefix");
    const nextLessonPrefix = document.getElementById("next-lesson-prefix");

    let currentUnitIndex = null; // which unit (within the current stream) is open

    // Changes the address (and tab title) to match the screen. While the app
    // is following the address itself (Back button, a shared link) it only
    // updates the title, so history doesn't get extra entries.
    let following = false;
    function setUrl(path, title) {
        document.title = title ? `${title} - ${SITE_TITLE}` : SITE_TITLE;
        if (!following && location.pathname !== path) history.pushState({}, "", path);
    }

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
        courseStreamsList.forEach((s) => {
            courseStreamsByKey[s.key] = s;
            const units = new Set();
            s.units.forEach((u) => {
                u.slug = slugify(u.title, units);
                ["lessons", "assignments", "resources"].forEach((field) => {
                    const used = new Set();
                    u[field].forEach((item) => { item.slug = slugify(item.title, used); });
                });
            });
        });
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
        resetScroll();
    }

    // Switching between the landing page and the dashboard just toggles
    // which div is displayed - it's not a real page navigation, so the
    // browser doesn't reset scroll position on its own the way it would
    // for an actual page load. Which element actually does the scrolling
    // differs between desktop and mobile (the mobile media queries relax
    // several overflow/height rules), so rather than assume, this resets
    // every plausible scrolling element: the window/document itself, html,
    // body, and the specific internal containers used at various sizes.
    // scrollTo({behavior:"instant"}) guarantees an immediate jump even
    // though the site's CSS applies scroll-behavior:smooth globally.
    function resetScroll() {
        const doReset = () => {
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            document.documentElement.scrollTo({ top: 0, left: 0, behavior: "instant" });
            document.body.scrollTo({ top: 0, left: 0, behavior: "instant" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            document.querySelectorAll(".content-body, .nav-menu, .portal-container, .app-container").forEach((el) => {
                el.scrollTo({ top: 0, left: 0, behavior: "instant" });
                el.scrollTop = 0;
            });
        };
        doReset();
        requestAnimationFrame(() => requestAnimationFrame(doReset));
        setTimeout(doReset, 150);
    }

    function renderPortalCards() {
        const grid = document.getElementById("stream-grid");
        grid.innerHTML = "";
        if (courseStreamsList.length === 0) {
            grid.innerHTML = `<p class="chapter-desc-placeholder" style="color:#999;">No streams yet. Check back soon.</p>`;
            return;
        }
        courseStreamsList.forEach((stream, index) => {
            const btn = document.createElement("button");
            btn.className = "portal-stream-card";
            btn.dataset.selectStream = stream.key;
            btn.style.setProperty("--i", index);
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
        setUrl(BASE_PATH);
        resetScroll();
    };
    btnBackHome.addEventListener("click", returnToPortal);
    logoBackHome.addEventListener("click", returnToPortal);

    // Syllabus Menu Button
    btnDashboard.addEventListener("click", () => {
        showDashboard();
    });

    // A block is only "empty" if it has neither text nor an embedded image/
    // video/slide - otherwise a lesson that's just a photo or a YouTube
    // embed would wrongly get replaced by the "nothing added yet" message.
    function hasRealContent(html) {
        if (!html) return false;
        const hasText = html.replace(/<[^>]*>/g, "").trim().length > 0;
        const hasMedia = /<(img|iframe)\b/i.test(html);
        return hasText || hasMedia;
    }

    // Fills a container with either real content (solid content-box) or a
    // muted placeholder message (dashed placeholder-box), so real instructor
    // content never looks like an empty draft state.
    function fillBox(container, html, emptyMessage) {
        const hasContent = hasRealContent(html);
        container.classList.toggle("content-box", hasContent);
        container.classList.toggle("placeholder-box", !hasContent);
        container.innerHTML = hasContent ? html : `<p>${emptyMessage}</p>`;
    }

    function renderMentors(mentors) {
        mentorColumn.innerHTML = "";
        mentorSectionHeader.hidden = !mentors || mentors.length === 0;
        if (!mentors || mentors.length === 0) return;

        mentors.forEach((mentor, index) => {
            const card = document.createElement("div");
            card.className = "mentor-card";
            card.style.setProperty("--i", index);
            const photo = mentor.photo && mentor.photo.trim() ? mentor.photo : "pr_logo2x.PNG";
            card.innerHTML = `
                <img class="mentor-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(mentor.name)}">
                <div class="mentor-name">${escapeHtml(mentor.name)}</div>
                ${mentor.title ? `<div class="mentor-title">${escapeHtml(mentor.title)}</div>` : ""}
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
        fillBox(homeObjectivesBox, stream.objectives, "Nothing here yet.");
        fillBox(homeScheduleBox, stream.schedule, "Nothing here yet.");
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
            empty.textContent = "No units yet.";
            chaptersNav.appendChild(empty);
        }
    }

    function showDashboard() {
        clearActiveSidebarItems();
        btnDashboard.classList.add("active");

        homeView.classList.add("active-view");
        chapterView.classList.remove("active-view");
        lessonView.classList.remove("active-view");
        const stream = courseStreamsByKey[currentStreamKey];
        if (stream) setUrl(`${BASE_PATH}/${stream.key}`, stream.name);
        resetScroll();
    }

    function showChapter(index) {
        clearActiveSidebarItems();

        const navItems = chaptersNav.querySelectorAll(".nav-item");
        if (navItems[index]) {
            navItems[index].classList.add("active");
        }

        const unit = courseStreamsByKey[currentStreamKey].units[index];
        if (!unit) return;
        currentUnitIndex = index;

        homeView.classList.remove("active-view");
        lessonView.classList.remove("active-view");
        chapterView.classList.add("active-view");
        setUrl(`${BASE_PATH}/${currentStreamKey}/${unit.slug}`, unit.title);

        viewChapterNum.textContent = unit.unit;
        viewChapterName.textContent = unit.title;
        viewChapterDesc.textContent = "";

        renderItemToc(viewChapterLessons, viewChapterLessonsEmpty, unit, "lesson");
        renderItemToc(viewChapterAssignments, viewChapterAssignmentsEmpty, unit, "assignment");
        renderItemToc(viewChapterResources, viewChapterResourcesEmpty, unit, "resource");
        resetScroll();
    }

    // Lessons and Assignments get a "Start" button and Previous/Next
    // navigation between entries; Resources get a "View" button and no
    // navigation, since a resource is a standalone reference rather than
    // something read in sequence.
    const ITEM_KIND_CONFIG = {
        lesson: { field: "lessons", buttonLabel: "Start", showNav: true, kindLabel: "Lesson" },
        assignment: { field: "assignments", buttonLabel: "Start", showNav: true, kindLabel: "Assignment" },
        resource: { field: "resources", buttonLabel: "View", showNav: false, kindLabel: "Resource" },
    };

    // Renders a Lessons/Assignments/Resources list as a table of contents -
    // title plus a button - rather than showing full content inline, since
    // each entry now lives on its own page.
    function renderItemToc(container, emptyEl, unit, kind) {
        const { field, buttonLabel } = ITEM_KIND_CONFIG[kind];
        const items = unit[field];
        container.innerHTML = "";
        emptyEl.hidden = items.length > 0;

        items.forEach((item, itemIndex) => {
            const li = document.createElement("li");
            li.className = "lesson-toc-row";
            li.innerHTML = `
                <span class="lesson-toc-title">${escapeHtml(item.title)}</span>
                <button class="lesson-start-btn" type="button">${buttonLabel} <i class="fa-solid fa-arrow-right"></i></button>
            `;
            li.querySelector(".lesson-start-btn").addEventListener("click", () => showItemPage(kind, currentUnitIndex, itemIndex));
            container.appendChild(li);
        });
    }

    // The dedicated page for one lesson/assignment/resource. Lessons and
    // Assignments show Previous/Next navigation across entries in the same
    // unit; Resources don't, since "View" is meant to go straight to that
    // one resource rather than starting a sequence.
    function showItemPage(kind, unitIndex, itemIndex) {
        const unit = courseStreamsByKey[currentStreamKey].units[unitIndex];
        if (!unit) return;
        const { field, showNav, kindLabel } = ITEM_KIND_CONFIG[kind];
        const items = unit[field];
        const item = items[itemIndex];
        if (!item) return;

        currentUnitIndex = unitIndex;

        homeView.classList.remove("active-view");
        chapterView.classList.remove("active-view");
        lessonView.classList.add("active-view");

        lessonTitle.textContent = item.title;
        lessonBackUnitLabel.textContent = `Back to ${unit.unit}`;
        setUrl(`${BASE_PATH}/${currentStreamKey}/${unit.slug}/${kind === "lesson" ? "" : kind + "/"}${item.slug}`, item.title);

        const hasContent = hasRealContent(item.content);
        lessonContentBody.innerHTML = hasContent ? item.content : "<p>Nothing here yet.</p>";

        const hasPrev = showNav && itemIndex > 0;
        const hasNext = showNav && itemIndex < items.length - 1;

        btnPrevLesson.hidden = !hasPrev;
        if (hasPrev) {
            prevLessonPrefix.textContent = `Previous ${kindLabel}`;
            btnPrevLesson.onclick = () => showItemPage(kind, unitIndex, itemIndex - 1);
        }

        btnNextLesson.hidden = !hasNext;
        if (hasNext) {
            nextLessonPrefix.textContent = `Next ${kindLabel}`;
            btnNextLesson.onclick = () => showItemPage(kind, unitIndex, itemIndex + 1);
        }

        resetScroll();
    }

    btnLessonBack.addEventListener("click", () => showChapter(currentUnitIndex));

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

    // Shows whatever screen the address names. Used on first load and for the
    // browser's Back and Forward buttons.
    function followAddress() {
        following = true;
        try {
            const parts = location.pathname.split("/").filter(Boolean).slice(1);
            const stream = courseStreamsByKey[parts[0]];
            if (!stream) return returnToPortal();
            goToStream(stream.key);
            const unitIndex = stream.units.findIndex((u) => u.slug === parts[1]);
            if (unitIndex < 0) return;
            const kind = parts[2] === "assignment" || parts[2] === "resource" ? parts[2] : "lesson";
            const slug = kind === "lesson" ? parts[2] : parts[3];
            const itemIndex = slug ? stream.units[unitIndex][ITEM_KIND_CONFIG[kind].field].findIndex((i) => i.slug === slug) : -1;
            if (itemIndex < 0) return showChapter(unitIndex);
            showItemPage(kind, unitIndex, itemIndex);
        } finally {
            following = false;
        }
    }
    window.addEventListener("popstate", followAddress);

    await loadCourseData();
    renderPortalCards();
    renderStreamSelector();
    followAddress();
});
