(function () {
  const config = window.APP_CONFIG || {};
  const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = hasSupabase
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
  const fallbackStore = createFallbackStore();

  const state = {
    route: "home",
    routeId: null,
    search: "",
    authMode: "login",
    user: null,
    profile: null,
    data: {
      profiles: [],
      courses: [],
      sections: [],
      lessons: [],
      enrollments: [],
      posts: [],
      comments: [],
      supportMessages: []
    },
    busy: false
  };

  const app = document.getElementById("app");

  document.addEventListener("DOMContentLoaded", boot);
  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".video-protected")) event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (event.target.closest("input, textarea")) return;
    if (key === "printscreen" || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key))) {
      event.preventDefault();
      toast("ØªÙ… ØªÙØ¹ÙŠÙ„ Ø­Ù…Ø§ÙŠØ© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ. Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ø£Ùˆ Ø§Ù„ØªØµÙˆÙŠØ± ØºÙŠØ± Ù…Ø³Ù…ÙˆØ­.");
    }
  });
  window.addEventListener("blur", () => document.body.classList.add("privacy-blur"));
  window.addEventListener("focus", () => document.body.classList.remove("privacy-blur"));
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("privacy-blur", document.hidden);
  });

  async function boot() {
    renderSplash();
    await loadSession();
    await loadData();
    setTimeout(() => {
      const splash = document.querySelector(".splash");
      if (splash) splash.classList.add("hide");
    }, 900);
    render();
  }

  async function loadSession() {
    if (!hasSupabase) {
      return;
    }

    const { data } = await client.auth.getSession();
    if (!data.session) return;
    state.user = data.session.user;
    state.profile = await getOrCreateProfile(data.session.user);
  }

  async function loadData() {
    state.data = hasSupabase ? await loadSupabaseData() : emptyData();
  }

  function emptyData() {
    return {
      profiles: [],
      courses: [],
      sections: [],
      lessons: [],
      enrollments: [],
      posts: [],
      comments: [],
      supportMessages: []
    };
  }

  async function loadSupabaseData() {
    const [
      profiles,
      courses,
      sections,
      lessons,
      enrollments,
      posts,
      comments,
      supportMessages
    ] = await Promise.all([
      selectTable("profiles"),
      selectTable("courses"),
      selectTable("course_sections"),
      selectTable("lessons"),
      selectTable("enrollments"),
      selectTable("posts"),
      selectTable("comments"),
      selectTable("support_messages")
    ]);

    return {
      profiles,
      courses,
      sections: sections.map(mapSection),
      lessons: lessons.map(mapLesson),
      enrollments,
      posts,
      comments,
      supportMessages
    };
  }

  async function selectTable(table) {
    const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
    if (error) {
      console.warn(error);
      return [];
    }
    return data || [];
  }

  function mapSection(section) {
    return {
      id: section.id,
      courseId: section.course_id,
      title: section.title,
      imageUrl: section.image_url || "",
      sortOrder: section.sort_order || 0
    };
  }

  function mapLesson(lesson) {
    return {
      id: lesson.id,
      sectionId: lesson.section_id,
      title: lesson.title,
      videoUrl: lesson.video_url,
      thumbnailUrl: lesson.thumbnail_url,
      attachments: lesson.attachments || [],
      externalLinks: lesson.external_links || [],
      sortOrder: lesson.sort_order || 0
    };
  }

  function renderSplash() {
    app.innerHTML = `
      <div class="splash">
        <div>
          ${logoSvg("brand-mark")}
          <h1>Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</h1>
          <p>ØªØ§Ø±ÙŠØ® ÙˆØ¬ØºØ±Ø§ÙÙŠØ§ Ø¨Ø´ÙƒÙ„ Ø£ÙˆØ¶Ø­</p>
        </div>
      </div>
    `;
    repairArabicText(app);
  }

  function render() {
    if (!state.user) {
      app.innerHTML = hasSupabase ? renderAuth() : renderSetupRequired();
      repairArabicText(app);
      bindAuth();
      return;
    }

    app.innerHTML = `
      <div class="layout">
        ${renderSidebar()}
        <div>
          ${renderTopbar()}
          <main class="main">${renderRoute()}</main>
          ${renderMobileNav()}
        </div>
      </div>
    `;
    repairArabicText(app);
    bindGlobal();
    bindRoute();
  }

  function renderAuth() {
    const isLogin = state.authMode === "login";
    return `
      <div class="auth-wrap">
        <section class="auth-card">
          <div class="brand">
            ${logoSvg("brand-mark")}
            <div>
              <h1>Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</h1>
              <p>Ù…Ù†ØµØ© Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§</p>
            </div>
          </div>
          <div class="tabs">
            <button class="${isLogin ? "active" : ""}" data-auth-tab="login">ØªØ³Ø¬ÙŠÙ„ Ø¯Ø®ÙˆÙ„</button>
            <button class="${!isLogin ? "active" : ""}" data-auth-tab="signup">Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨</button>
          </div>
          <form class="form" data-auth-form>
            ${!isLogin ? `<label>Ø§Ù„Ø§Ø³Ù…<input class="field" name="name" required placeholder="Ø§ÙƒØªØ¨ Ø§Ø³Ù…Ùƒ" /></label>` : ""}
            <label>Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ<input class="field" name="email" type="email" required placeholder="name@example.com" /></label>
            <label>ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±<input class="field" name="password" type="password" required minlength="6" placeholder="******" /></label>
            <button class="btn gold" type="submit">${isLogin ? "Ø¯Ø®ÙˆÙ„" : "ØªØ³Ø¬ÙŠÙ„"}</button>
          </form>
        </section>
      </div>
    `;
  }

  function renderSetupRequired() {
    return `
      <div class="auth-wrap">
        <section class="auth-card">
          <div class="brand">
            ${logoSvg("brand-mark")}
            <div>
              <h1>Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</h1>
              <p>Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ù…Ù†ØµØ© Ù…Ø·Ù„ÙˆØ¨</p>
            </div>
          </div>
          <h2>Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠØ© Ù„Ø§ ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¬Ø±ÙŠØ¨ÙŠØ©</h2>
          <p class="muted">Ø¶Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª Supabase ÙÙŠ Ù…Ù„Ù config.js Ø«Ù… Ø´ØºÙ„ SQL Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ supabase/schema.sql. Ø¨Ø¹Ø¯ Ø°Ù„Ùƒ Ø£Ù†Ø´Ø¦ Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¯Ø±Ø³ Ù…Ù† Supabase Auth Ø¨Ù†ÙØ³ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ù…Ø­Ø¯Ø¯ ÙÙŠ app_settings.</p>
        </section>
      </div>
    `;
  }

  function renderSidebar() {
    return `
      <aside class="sidebar">
        <div class="brand">
          ${logoSvg("brand-mark")}
          <div>
            <h2>Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</h2>
            <p>ØªØ§Ø±ÙŠØ® ÙˆØ¬ØºØ±Ø§ÙÙŠØ§</p>
          </div>
        </div>
        ${renderMainNav("nav")}
        <div class="user-card">
          <strong>${escapeHtml(state.profile.full_name)}</strong>
          <span class="muted">${escapeHtml(state.profile.email)}</span>
          <div style="margin-top:10px">${isAdmin() ? `<span class="pill gold">ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø¯Ø±Ø³</span>` : `<span class="pill">Ø·Ø§Ù„Ø¨</span>`}</div>
        </div>
      </aside>
    `;
  }

  function renderTopbar() {
    return `
      <header class="topbar">
        <div class="brand">
          ${logoSvg("brand-mark")}
          <div>
            <h2>Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</h2>
            <p>${isAdmin() ? "ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø¯Ø±Ø³" : "ØªØ§Ø±ÙŠØ® ÙˆØ¬ØºØ±Ø§ÙÙŠØ§"}</p>
          </div>
        </div>
        <button class="btn ghost" data-logout>Ø®Ø±ÙˆØ¬</button>
      </header>
    `;
  }

  function renderMobileNav() {
    return renderMainNav("mobile-nav");
  }

  function renderMainNav(className) {
    const items = [
      ["home", "home", "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"],
      ["courses", "courses", "Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª"],
      ["posts", "posts", "Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª"],
      ["support", "support", "Ø§Ù„Ø¯Ø¹Ù…"],
      ...(isAdmin() ? [["students", "students", "Ø§Ù„Ø·Ù„Ø§Ø¨"]] : []),
      ["more", "more", "Ø§Ù„Ù…Ø²ÙŠØ¯"]
    ];
    return `
      <nav class="${className}">
        ${items
          .map(([route, icon, label]) => `
            <button class="${state.route === route ? "active" : ""}" data-route="${route}">
              ${iconSvg(icon)}<span>${label}</span>
            </button>
          `)
          .join("")}
      </nav>
    `;
  }

  function renderNav(className) {
    const items = [
      ["home", "âŒ‚", "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"],
      ["courses", "â–¦", "Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª"],
      ["posts", "â—«", "Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª"],
      ["support", "âœ‰", "Ø§Ù„Ø¯Ø¹Ù…"],
      ["more", "â˜°", "Ø§Ù„Ù…Ø²ÙŠØ¯"]
    ];
    return `
      <nav class="${className}">
        ${items
          .map(([route, icon, label]) => `
            <button class="${state.route === route ? "active" : ""}" data-route="${route}">
              <span>${icon}</span><span>${label}</span>
            </button>
          `)
          .join("")}
      </nav>
    `;
  }

  function renderRoute() {
    if (state.route === "courses") return renderCourses();
    if (state.route === "course") return renderCourseDetails(state.routeId);
    if (state.route === "lesson") return renderLesson(state.routeId);
    if (state.route === "posts") return renderPosts();
    if (state.route === "support") return renderSupport();
    if (state.route === "students") return renderStudentsAdmin();
    if (state.route === "more") return renderMore();
    return renderHome();
  }

  function renderHome() {
    const activeEnrollments = state.data.enrollments.filter((e) => e.status === "active").length;
    return `
      <section class="hero">
        <div class="hero-panel">
          <span class="pill gold">Ù…Ù†ØµØ© ØªØ§Ø±ÙŠØ® ÙˆØ¬ØºØ±Ø§ÙÙŠØ§</span>
          <h2>Ø§ÙÙ‡Ù… Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§ Ù…Ù† ØºÙŠØ± Ø­ÙØ¸ Ø£Ø¹Ù…Ù‰.</h2>
          <p>ÙƒÙˆØ±Ø³Ø§Øª Ù…Ù†Ø¸Ù…Ø©ØŒ ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª Ù…Ø±ØªØ¨Ø© Ø­Ø³Ø¨ Ø§Ù„Ø£Ù‚Ø³Ø§Ù…ØŒ ÙˆÙ…ØªØ§Ø¨Ø¹Ø© Ù…Ù† Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ Ù„Ù„Ø·Ù„Ø§Ø¨ Ø®Ø·ÙˆØ© Ø¨Ø®Ø·ÙˆØ©.</p>
          <div class="hero-actions">
            <button class="btn gold" data-route="courses">ØªØµÙØ­ Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª</button>
            <button class="btn secondary" data-route="support">ØªÙˆØ§ØµÙ„ Ù…Ø¹Ø§Ù†Ø§</button>
          </div>
        </div>
        <aside class="side-panel card">
          <h3>Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ù†ØµØ©</h3>
          <div class="kpi-grid">
            <div class="stat-card"><span>Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª</span><strong>${visibleCourses().length}</strong></div>
            <div class="stat-card"><span>Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª</span><strong>${state.data.lessons.length}</strong></div>
            <div class="stat-card"><span>Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ù…ÙØ¹Ù„Ø©</span><strong>${activeEnrollments}</strong></div>
          </div>
        </aside>
      </section>
      <section class="section">
        <div class="section-title">
          <h2>Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ø£Ù‡Ù…ÙŠØ©</h2>
          <button class="btn ghost" data-route="courses">Ø¹Ø±Ø¶ Ø§Ù„ÙƒÙ„</button>
        </div>
        ${renderCourseStrip(visibleCourses().slice(0, 6))}
      </section>
      <section class="section">
        <div class="section-title">
          <h2>Ø¢Ø®Ø± Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª</h2>
          <button class="btn ghost" data-route="posts">ÙƒÙ„ Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª</button>
        </div>
        <div class="grid two">${visiblePosts().slice(0, 2).map(renderPostCard).join("")}</div>
      </section>
      ${isAdmin() ? renderAdminQuick() : ""}
    `;
  }

  function renderCourses() {
    const courses = filterBySearch(visibleCourses(), ["title", "grade", "description"]);
    return `
      <section>
        <div class="section-title">
          <h2>Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©</h2>
          <input class="search" data-search placeholder="Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„ÙƒÙˆØ±Ø³ Ø£Ùˆ Ø§Ù„ØµÙ" value="${escapeAttr(state.search)}" />
        </div>
        ${isAdmin() ? renderCourseEditor() : ""}
        ${renderCourseStrip(courses)}
      </section>
    `;
  }

  function renderCourseStrip(courses) {
    return `
      <div class="course-carousel">
        <button class="strip-btn strip-btn-right" data-course-scroll="back" type="button" aria-label="Ø§Ù„Ø³Ø§Ø¨Ù‚">
          ${iconSvg("chevronRight")}
        </button>
        <div class="course-strip" data-course-strip>
          ${courses.map(renderCourseCard).join("") || empty("Ù„Ø§ ØªÙˆØ¬Ø¯ ÙƒÙˆØ±Ø³Ø§Øª Ù…Ø·Ø§Ø¨Ù‚Ø©.")}
        </div>
        <button class="strip-btn strip-btn-left" data-course-scroll="next" type="button" aria-label="Ø§Ù„ØªØ§Ù„ÙŠ">
          ${iconSvg("chevronLeft")}
        </button>
      </div>
    `;
  }

  function renderCourseCard(course) {
    const enrollment = getEnrollment(course.id);
    const status = enrollment ? statusLabel(enrollment.status) : "ØºÙŠØ± Ù…Ø´ØªØ±Ùƒ";
    return `
      <article class="course-card">
        <div class="course-image" style="${bg(course.image_url)}"></div>
        <div class="course-body">
          <span class="pill">${escapeHtml(course.grade)}</span>
          <h3>${escapeHtml(course.title)}</h3>
          <p class="muted">${escapeHtml(course.description)}</p>
          <p class="price">${priceText(course)}</p>
          <div class="row">
            <span class="pill ${enrollment?.status === "active" ? "" : "gold"}">${status}</span>
            <span class="muted">${countLessons(course.id)} ÙÙŠØ¯ÙŠÙˆ</span>
          </div>
          <div class="card-actions">
            <button class="btn" data-open-course="${course.id}">Ø£Ù‚Ø³Ø§Ù… Ø§Ù„ÙƒÙˆØ±Ø³</button>
            ${renderBuyButton(course)}
          </div>
          ${isAdmin() ? renderCourseAdminActions(course) : ""}
        </div>
      </article>
    `;
  }

  function renderCourseAdminActions(course) {
    return `
      <div class="card-actions" style="margin-top:10px">
        <button class="btn ghost" data-edit-course="${course.id}">ØªØ¹Ø¯ÙŠÙ„ Ø³Ø±ÙŠØ¹</button>
        <button class="btn ghost" data-toggle-course="${course.id}">${course.is_published === false ? "Ù†Ø´Ø±" : "Ø¥Ø®ÙØ§Ø¡"}</button>
        <button class="btn danger" data-delete-course="${course.id}">Ø­Ø°Ù</button>
      </div>
    `;
  }

  function renderBuyButton(course) {
    if (isAdmin()) return "";
    const enrollment = getEnrollment(course.id);
    if (enrollment?.status === "active") return "";
    if (Number(course.price) <= 0) return `<button class="btn gold" data-free-course="${course.id}">Ø§Ø¨Ø¯Ø£ Ø§Ù„ÙƒÙˆØ±Ø³ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠ</button>`;
    return `<button class="btn whatsapp" data-buy-course="${course.id}">Ø´Ø±Ø§Ø¡ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨</button>`;
  }

  function renderCourseDetails(courseId) {
    const course = state.data.courses.find((item) => item.id === courseId);
    if (!course) return empty("Ø§Ù„ÙƒÙˆØ±Ø³ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯.");
    const sections = state.data.sections
      .filter((section) => section.courseId === course.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const canWatch = canAccessCourse(course.id);
    return `
      <section>
        <div class="section-title">
          <div>
            <button class="btn ghost" data-route="courses">Ø±Ø¬ÙˆØ¹ Ù„Ù„ÙƒÙˆØ±Ø³Ø§Øª</button>
            <h2>${escapeHtml(course.title)}</h2>
            <p class="muted">${escapeHtml(course.description)}</p>
          </div>
          <div class="row">
            <span class="pill gold">${course.price} Ø¬Ù†ÙŠÙ‡</span>
            <span class="pill gold">${priceText(course)}</span>
            ${renderBuyButton(course)}
          </div>
        </div>
        ${!canWatch ? `<div class="locked"><div><h3>Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª Ù…Ù‚ÙÙˆÙ„Ø©</h3><p>Ø§Ø´ØªØ± Ø§Ù„ÙƒÙˆØ±Ø³ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨ØŒ ÙˆØ¨Ø¹Ø¯ Ø§Ù„ØªÙØ¹ÙŠÙ„ Ù‡ØªØ¸Ù‡Ø± Ù„Ùƒ Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª.</p></div></div>` : ""}
        ${isAdmin() ? renderSectionEditor(course.id) : ""}
        <div class="list">
          ${sections
            .map((section) => renderSectionBlock(section, canWatch))
            .join("") || empty("Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£Ù‚Ø³Ø§Ù… ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙƒÙˆØ±Ø³ Ø¨Ø¹Ø¯.")}
        </div>
        ${renderCourseAttachments(course)}
      </section>
    `;
  }

  function renderCourseAttachments(course) {
    const attachments = course.attachments || [];
    if (!attachments.length && !isAdmin()) return "";
    return `
      <section class="section card">
        <div class="section-title">
          <h2>Ù…Ø±ÙÙ‚Ø§Øª Ø§Ù„ÙƒÙˆØ±Ø³</h2>
          <span class="pill">${attachments.length} Ù…Ù„Ù</span>
        </div>
        ${renderLinks("Ù…Ù„ÙØ§Øª Ø§Ù„Ø´Ø±Ø­ ÙˆØ§Ù„Ø£Ø³Ø¦Ù„Ø©", attachments)}
      </section>
    `;
  }

  function renderSectionBlock(section, canWatch) {
    const lessons = state.data.lessons
      .filter((lesson) => lesson.sectionId === section.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return `
      <article class="card">
        ${section.imageUrl ? `<div class="section-cover" style="${bg(section.imageUrl)}"></div>` : ""}
        <div class="section-title">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <span class="pill">${lessons.length} ÙÙŠØ¯ÙŠÙˆ</span>
          </div>
          ${isAdmin() ? `
            <div class="row">
              <button class="btn ghost" data-edit-section="${section.id}">ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù‚Ø³Ù…</button>
              <label class="btn ghost file-btn">ØªØºÙŠÙŠØ± Ø§Ù„ØµÙˆØ±Ø©<input type="file" accept="image/*" data-section-image="${section.id}" /></label>
              <button class="btn danger" data-delete-section="${section.id}">Ø­Ø°Ù Ø§Ù„Ù‚Ø³Ù…</button>
            </div>
          ` : ""}
        </div>
        ${isAdmin() ? renderLessonEditor(section.id) : ""}
        <div class="grid two">
          ${lessons
            .map((lesson) => `
              <article class="lesson-card">
                <div class="lesson-thumb" style="${bg(lesson.thumbnailUrl)}"></div>
                <div class="lesson-body">
                  <h3>${escapeHtml(lesson.title)}</h3>
                  <button class="btn ${canWatch ? "" : "ghost"}" ${canWatch ? `data-open-lesson="${lesson.id}"` : "disabled"}>
                    ${canWatch ? "Ø§ÙØªØ­ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ" : "Ù…ØºÙ„Ù‚ Ù„Ø­ÙŠÙ† Ø§Ù„ØªÙØ¹ÙŠÙ„"}
                  </button>
                  ${isAdmin() ? `
                    <div class="card-actions" style="margin-top:10px">
                      <button class="btn ghost" data-edit-lesson="${lesson.id}">ØªØ¹Ø¯ÙŠÙ„</button>
                      <label class="btn ghost file-btn">ØµÙˆØ±Ø© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ<input type="file" accept="image/*" data-lesson-image="${lesson.id}" /></label>
                      <button class="btn danger" data-delete-lesson="${lesson.id}">Ø­Ø°Ù</button>
                    </div>
                  ` : ""}
                </div>
              </article>
            `)
            .join("") || empty("Ù„Ø§ ØªÙˆØ¬Ø¯ ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù‚Ø³Ù….")}
        </div>
      </article>
    `;
  }

  function renderLesson(lessonId) {
    const lesson = state.data.lessons.find((item) => item.id === lessonId);
    if (!lesson) return empty("Ø§Ù„ÙÙŠØ¯ÙŠÙˆ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯.");
    const section = state.data.sections.find((item) => item.id === lesson.sectionId);
    const course = state.data.courses.find((item) => item.id === section?.courseId);
    const canWatch = course && canAccessCourse(course.id);
    const comments = state.data.comments.filter((comment) => comment.lesson_id === lesson.id || comment.lessonId === lesson.id);
    return `
      <section>
        <div class="section-title">
          <div>
            <button class="btn ghost" data-open-course="${course?.id || ""}">Ø±Ø¬ÙˆØ¹ Ù„Ù„ÙƒÙˆØ±Ø³</button>
            <h2>${escapeHtml(lesson.title)}</h2>
          </div>
        </div>
        ${
          canWatch
            ? renderVideoPlayer(lesson)
            : `<div class="locked"><div><h3>Ù‡Ø°Ø§ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù„Ù„Ù…Ø´ØªØ±ÙƒÙŠÙ† ÙÙ‚Ø·</h3><p>ÙŠØ¬Ø¨ ØªÙØ¹ÙŠÙ„ Ø§Ø´ØªØ±Ø§ÙƒÙƒ ÙÙŠ Ø§Ù„ÙƒÙˆØ±Ø³ Ø£ÙˆÙ„Ù‹Ø§.</p></div></div>`
        }
        <div class="grid two section">
          <div class="card">
            <h3>Ø§Ù„Ù…Ø±ÙÙ‚Ø§Øª ÙˆØ§Ù„Ø±ÙˆØ§Ø¨Ø·</h3>
            ${renderLinks("Ø§Ù„Ù…Ø±ÙÙ‚Ø§Øª", lesson.attachments)}
            ${renderLinks("Ø±ÙˆØ§Ø¨Ø· Ø®Ø§Ø±Ø¬ÙŠØ©", lesson.externalLinks)}
          </div>
          <div class="card">
            <h3>Ø§Ù„ØªØ¹Ù„ÙŠÙ‚Ø§Øª</h3>
            <form class="form" data-comment-form="${lesson.id}">
              <textarea class="textarea" name="body" placeholder="Ø§ÙƒØªØ¨ ØªØ¹Ù„ÙŠÙ‚Ùƒ"></textarea>
              <button class="btn" type="submit">Ø¥Ø±Ø³Ø§Ù„ ØªØ¹Ù„ÙŠÙ‚</button>
            </form>
            <div class="list" style="margin-top:12px">
              ${comments.map(renderComment).join("") || `<p class="muted">Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ¹Ù„ÙŠÙ‚Ø§Øª Ø¨Ø¹Ø¯.</p>`}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderPosts() {
    const posts = filterBySearch(visiblePosts(), ["title", "body"]);
    return `
      <section>
        <div class="section-title">
          <h2>Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª</h2>
          <input class="search" data-search placeholder="Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª" value="${escapeAttr(state.search)}" />
        </div>
        ${isAdmin() ? renderPostComposer() : ""}
        <div class="grid two">${posts.map(renderPostCard).join("") || empty("Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù†Ø´ÙˆØ±Ø§Øª Ù…Ø·Ø§Ø¨Ù‚Ø©.")}</div>
      </section>
    `;
  }

  function renderPostCard(post) {
    const comments = state.data.comments.filter((comment) => comment.post_id === post.id || comment.postId === post.id);
    return `
      <article class="post-card">
        ${post.image_url ? `<div class="post-image" style="${bg(post.image_url)}"></div>` : ""}
        <div class="post-body">
          <span class="pill gold">Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ</span>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.body)}</p>
          <div class="row">
            <span class="muted">${comments.length} ØªØ¹Ù„ÙŠÙ‚</span>
            <span class="muted">${formatDate(post.created_at)}</span>
          </div>
          <form class="form" data-post-comment-form="${post.id}" style="margin-top:12px">
            <input class="field" name="body" placeholder="Ø§ÙƒØªØ¨ ØªØ¹Ù„ÙŠÙ‚ Ø¹Ù„Ù‰ Ø§Ù„Ù…Ù†Ø´ÙˆØ±" />
            <button class="btn ghost" type="submit">ØªØ¹Ù„ÙŠÙ‚</button>
          </form>
          ${isAdmin() ? renderPostAdminActions(post) : ""}
        </div>
      </article>
    `;
  }

  function renderPostAdminActions(post) {
    return `
      <div class="card-actions" style="margin-top:10px">
        <button class="btn ghost" data-edit-post="${post.id}">ØªØ¹Ø¯ÙŠÙ„ Ø³Ø±ÙŠØ¹</button>
        <button class="btn ghost" data-toggle-post="${post.id}">${post.is_published === false ? "Ù†Ø´Ø±" : "Ø¥Ø®ÙØ§Ø¡"}</button>
        <button class="btn danger" data-delete-post="${post.id}">Ø­Ø°Ù</button>
      </div>
    `;
  }

  function renderSupport() {
    return `
      <section>
        <div class="section-title">
          <div>
            <h2>Ø§Ù„Ø´ÙƒØ§ÙˆÙ‰ ÙˆØ§Ù„Ø¯Ø¹Ù…</h2>
            <p class="muted">Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„ØªÙƒ ÙˆØ³ÙŠØªÙ… Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹Ùƒ ÙÙŠ Ø£Ù‚Ø±Ø¨ ÙˆÙ‚Øª.</p>
          </div>
        </div>
        <div class="grid two">
          <form class="card form" data-support-form>
            <label>Ø§Ù„Ø§Ø³Ù…<input class="field" name="name" required value="${escapeAttr(state.profile.full_name)}" /></label>
            <label>Ø§Ù„Ø¨Ø±ÙŠØ¯<input class="field" name="email" type="email" required value="${escapeAttr(state.profile.email)}" /></label>
            <label>Ø±Ø³Ø§Ù„ØªÙƒ<textarea class="textarea" name="message" required></textarea></label>
            <button class="btn gold" type="submit">Ø¥Ø±Ø³Ø§Ù„</button>
          </form>
          <div class="card">
            <h3>ÙˆØ³Ø§Ø¦Ù„ Ø§Ù„ØªÙˆØ§ØµÙ„</h3>
            <p class="muted">Ù„Ø´Ø±Ø§Ø¡ Ø§Ù„ÙƒÙˆØ±Ø³Ø§Øª Ø£Ùˆ Ø§Ù„Ø§Ø³ØªÙØ³Ø§Ø± Ø§Ù„Ø³Ø±ÙŠØ¹ Ø§Ø³ØªØ®Ø¯Ù… ÙˆØ§ØªØ³Ø§Ø¨.</p>
            <a class="btn whatsapp" href="${whatsappGeneralLink()}" target="_blank" rel="noreferrer">ÙØªØ­ ÙˆØ§ØªØ³Ø§Ø¨</a>
          </div>
        </div>
        ${isAdmin() ? renderSupportInbox() : ""}
      </section>
    `;
  }

  function renderMore() {
    return `
      <section>
        <div class="section-title">
          <h2>Ø§Ù„Ù…Ø²ÙŠØ¯</h2>
          <button class="btn danger" data-logout>ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬</button>
        </div>
        <div class="grid two">
          <div class="card">
            <h3>Ù…ÙƒØªØ¨ØªÙŠ</h3>
            <div class="list" style="margin-top:12px">
              ${state.data.enrollments
                .filter((enrollment) => enrollment.user_id === state.user.id || enrollment.userId === state.user.id)
                .map((enrollment) => {
                  const course = state.data.courses.find((item) => item.id === (enrollment.course_id || enrollment.courseId));
                  return course
                    ? `<div class="list-item"><strong>${escapeHtml(course.title)}</strong><span class="pill">${statusLabel(enrollment.status)}</span></div>`
                    : "";
                })
                .join("") || empty("Ù„Ø§ ØªÙˆØ¬Ø¯ ÙƒÙˆØ±Ø³Ø§Øª ÙÙŠ Ù…ÙƒØªØ¨ØªÙƒ Ø¨Ø¹Ø¯.")}
            </div>
          </div>
          <div class="card">
            <h3>ÙˆØµÙ Ø§Ù„Ù…Ù†ØµØ©</h3>
            <p>Ù…Ù†ØµØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ Ù„Ø´Ø±Ø­ Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§ Ø¨Ø£Ø³Ù„ÙˆØ¨ Ù…Ù†Ø¸Ù… ÙˆØ³Ù‡Ù„ØŒ Ù…Ø¹ ÙƒÙˆØ±Ø³Ø§Øª Ù…Ø¯ÙÙˆØ¹Ø© ÙŠØªÙ… ØªÙØ¹ÙŠÙ„Ù‡Ø§ ÙŠØ¯ÙˆÙŠÙ‹Ø§ Ø¨Ø¹Ø¯ Ø§Ù„ØªÙˆØ§ØµÙ„.</p>
            <button class="btn ghost" data-share>Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ù…ÙˆÙ‚Ø¹</button>
          </div>
        </div>
        ${isAdmin() ? renderAdminSettings() : ""}
      </section>
    `;
  }

  function renderAdminQuick() {
    return `
      <section class="section admin-box">
        <div class="section-title">
          <h2>Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ù…Ø¯Ø±Ø³ Ø§Ù„Ø³Ø±ÙŠØ¹Ø©</h2>
          <span class="pill gold">ØªØ¸Ù‡Ø± Ù„Ù„Ù…Ø¯Ø±Ø³ ÙÙ‚Ø·</span>
        </div>
        <div class="grid two">
          ${renderEnrollmentManager()}
          ${renderSupportInbox(true)}
        </div>
      </section>
    `;
  }

  function renderCourseEditor() {
    return `
      <div class="admin-box course-composer">
        <div class="section-title">
          <div>
            <h3>Ø¥Ø¶Ø§ÙØ© ÙƒÙˆØ±Ø³ Ø¬Ø¯ÙŠØ¯</h3>
            <p class="muted">Ø§Ù…Ù„Ø£ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙƒÙˆØ±Ø³ØŒ ÙˆÙ„Ùˆ Ø£Ø¶ÙØª Ø±Ø§Ø¨Ø· ÙÙŠØ¯ÙŠÙˆ Ø³ÙŠØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ù‚Ø³Ù… ÙˆÙÙŠØ¯ÙŠÙˆ Ø£ÙˆÙ„ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ø¯Ø§Ø®Ù„ Ø§Ù„ÙƒÙˆØ±Ø³.</p>
          </div>
        </div>
        <form class="form" data-course-form>
          <div class="admin-grid">
            <label>Ø§Ø³Ù… Ø§Ù„ÙƒÙˆØ±Ø³<input class="field" name="title" required placeholder="Ù…Ø«Ø§Ù„: ØªØ§Ø±ÙŠØ® Ø§Ù„ØµÙ Ø§Ù„Ø«Ø§Ù„Ø« Ø§Ù„Ø«Ø§Ù†ÙˆÙŠ" /></label>
            <label>Ø§Ù„ØµÙ Ø§Ù„Ø¯Ø±Ø§Ø³ÙŠ Ø§Ø®ØªÙŠØ§Ø±ÙŠ<input class="field" name="grade" placeholder="Ù…Ø«Ø§Ù„: Ø§Ù„Ø«Ø§Ù„Ø« Ø§Ù„Ø«Ø§Ù†ÙˆÙŠ" /></label>
            <label>Ù†ÙˆØ¹ Ø§Ù„ÙƒÙˆØ±Ø³
              <select class="select" name="accessType" data-access-type>
                <option value="free">Ù…Ø¬Ø§Ù†ÙŠ</option>
                <option value="paid">Ù…Ø¯ÙÙˆØ¹</option>
              </select>
            </label>
            <label data-price-field>Ø§Ù„Ø³Ø¹Ø± Ø¨Ø§Ù„Ø¬Ù†ÙŠÙ‡<input class="field" name="price" type="number" min="0" placeholder="Ù…Ø«Ø§Ù„: 500" /></label>
          </div>
          <label>ÙˆØµÙ Ø§Ù„ÙƒÙˆØ±Ø³<textarea class="textarea" name="description" required placeholder="Ø§ÙƒØªØ¨ ÙˆØµÙ Ù…Ø®ØªØµØ± Ù„Ù„Ø·Ù„Ø§Ø¨"></textarea></label>
          <div class="admin-grid">
            <label>Ø±Ø§Ø¨Ø· ÙÙŠØ¯ÙŠÙˆ Ø§Ù„ÙƒÙˆØ±Ø³<input class="field" name="courseUrl" placeholder="YouTube Ø£Ùˆ Vimeo" /></label>
            <label>ØµÙˆØ±Ø© ØºÙ„Ø§Ù Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø²<input class="field" name="imageFile" type="file" accept="image/*" /></label>
            <label>Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© ØºÙ„Ø§Ù Ø§Ø®ØªÙŠØ§Ø±ÙŠ<input class="field" name="imageUrl" placeholder="https://..." /></label>
          </div>
          <div class="admin-grid">
            <label>Ù…Ù„Ù Ø´Ø±Ø­ PDF<input class="field" name="explanationFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" /></label>
            <label>Ù…Ù„Ù Ø£Ø³Ø¦Ù„Ø© Ø£Ùˆ ÙˆØ§Ø¬Ø¨<input class="field" name="questionsFile" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" /></label>
          </div>
          <button class="btn gold" type="submit">Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙƒÙˆØ±Ø³</button>
        </form>
      </div>
    `;
  }

  function renderSectionEditor(courseId) {
    return `
      <div class="admin-box">
        <h3>Ø¥Ø¶Ø§ÙØ© Ù‚Ø³Ù… Ù„Ù„ÙƒÙˆØ±Ø³</h3>
        <form class="form admin-grid" data-section-form="${courseId}">
          <label>Ø§Ø³Ù… Ø§Ù„Ù‚Ø³Ù…<input class="field" name="title" required placeholder="Ù…Ø«Ø§Ù„: Ø§Ù„ÙØµÙ„ Ø§Ù„Ø£ÙˆÙ„" /></label>
          <label>ØµÙˆØ±Ø© Ø§Ù„Ù‚Ø³Ù… Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø²<input class="field" name="imageFile" type="file" accept="image/*" /></label>
          <button class="btn gold" type="submit">Ø¥Ø¶Ø§ÙØ© Ù‚Ø³Ù…</button>
        </form>
      </div>
    `;
  }

  function renderLessonEditor(sectionId) {
    return `
      <div class="admin-box">
        <h3>Ø¥Ø¶Ø§ÙØ© ÙÙŠØ¯ÙŠÙˆ</h3>
        <form class="form admin-grid" data-lesson-form="${sectionId}">
          <input class="field" name="title" required placeholder="Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ÙÙŠØ¯ÙŠÙˆ" />
          <input class="field" name="videoUrl" required placeholder="Ø±Ø§Ø¨Ø· YouTube Ø£Ùˆ Vimeo" />
          <label>ØµÙˆØ±Ø© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø²<input class="field" name="thumbnailFile" type="file" accept="image/*" /></label>
          <input class="field" name="thumbnailUrl" placeholder="Ø£Ùˆ Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© Ù…ØµØºØ±Ø©" />
          <input class="field" name="externalLink" placeholder="Ø±Ø§Ø¨Ø· Ø®Ø§Ø±Ø¬ÙŠ Ø§Ø®ØªÙŠØ§Ø±ÙŠ" />
          <button class="btn gold" type="submit">Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ</button>
        </form>
      </div>
    `;
  }

  function renderPostEditor() {
    return `
      <div class="admin-box">
        <h3>Ø¥Ø¶Ø§ÙØ© Ù…Ù†Ø´ÙˆØ±</h3>
        <form class="form admin-grid" data-post-form>
          <input class="field" name="title" required placeholder="Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…Ù†Ø´ÙˆØ±" />
          <input class="field" name="imageUrl" placeholder="Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø©" />
          <textarea class="textarea" name="body" required placeholder="Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ù…Ù†Ø´ÙˆØ±"></textarea>
          <button class="btn gold" type="submit">Ù†Ø´Ø±</button>
        </form>
      </div>
    `;
  }

  function renderPostComposer() {
    return `
      <div class="admin-box post-composer">
        <div class="post-header">
          <div class="avatar">${logoSvg("avatar-logo")}</div>
          <div>
            <h3>Ø§ÙƒØªØ¨ Ø¨ÙˆØ³Øª Ø¬Ø¯ÙŠØ¯</h3>
            <span class="muted">Ø§ÙƒØªØ¨ Ù…Ù†Ø´ÙˆØ± ÙˆØ§Ø±ÙØ¹ ØµÙˆØ±Ø© Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø² Ø£Ùˆ Ø§Ø³ØªØ®Ø¯Ù… Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø©.</span>
          </div>
        </div>
        <form class="form" data-post-form>
          <input class="field" name="title" required placeholder="Ø¹Ù†ÙˆØ§Ù† Ù…Ø®ØªØµØ± Ù„Ù„Ø¨ÙˆØ³Øª" />
          <textarea class="textarea" name="body" required placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ù…Ù†Ø´ÙˆØ± Ù‡Ù†Ø§..."></textarea>
          <div class="admin-grid">
            <label>ØµÙˆØ±Ø© Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø²<input class="field" name="imageFile" type="file" accept="image/*" /></label>
            <label>Ø£Ùˆ Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø©<input class="field" name="imageUrl" placeholder="https://..." /></label>
          </div>
          <button class="btn gold" type="submit">Ù†Ø´Ø± Ø§Ù„Ø¨ÙˆØ³Øª</button>
        </form>
      </div>
    `;
  }

  function renderEnrollmentManager() {
    const pending = state.data.enrollments.filter((item) => item.status === "pending");
    return `
      <div class="card">
        <h3>Ø·Ù„Ø¨Ø§Øª Ø§Ù„ØªÙØ¹ÙŠÙ„</h3>
        <div class="list" style="margin-top:12px">
          ${pending
            .map((item) => {
              const profile = findProfile(item.user_id || item.userId);
              const course = state.data.courses.find((courseItem) => courseItem.id === (item.course_id || item.courseId));
              return `
                <div class="list-item">
                  <div>
                    <strong>${escapeHtml(profile?.full_name || "Ø·Ø§Ù„Ø¨")}</strong>
                    <span class="muted">${escapeHtml(course?.title || "ÙƒÙˆØ±Ø³")}</span>
                  </div>
                  <div class="row">
                    <button class="btn" data-enroll-status="${item.id}:active">ØªÙØ¹ÙŠÙ„</button>
                    <button class="btn danger" data-enroll-status="${item.id}:rejected">Ø±ÙØ¶</button>
                  </div>
                </div>
              `;
            })
            .join("") || `<p class="muted">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø·Ù„Ø¨Ø§Øª Ø­Ø§Ù„ÙŠØ©.</p>`}
        </div>
      </div>
    `;
  }

  function renderStudentsAdmin() {
    if (!isAdmin()) return empty("Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø© Ù…Ø®ØµØµØ© Ù„Ù„Ù…Ø¯Ø±Ø³ ÙÙ‚Ø·.");
    const students = state.data.profiles.filter((profile) => profile.role !== "admin");
    return `
      <section>
        <div class="section-title">
          <div>
            <h2>Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø§Ø¨ ÙˆØ§Ù„Ø­Ø³Ø§Ø¨Ø§Øª</h2>
            <p class="muted">Ø¨Ø¹Ø¯ Ù…Ø§ Ø§Ù„Ø·Ø§Ù„Ø¨ ÙŠØ¯ÙØ¹ØŒ Ø§Ø®ØªØ§Ø± Ø§Ø³Ù…Ù‡ ÙˆØ§Ù„ÙƒÙˆØ±Ø³ ÙˆØ§Ø¶ØºØ· Ø­ÙØ¸ Ø¨Ø­Ø§Ù„Ø© Ù…ÙØ¹Ù„.</p>
          </div>
        </div>
        <div class="grid two">
          <form class="card form" data-manual-enrollment-form>
            <h3>ØªÙØ¹ÙŠÙ„ ÙƒÙˆØ±Ø³ Ù„Ø·Ø§Ù„Ø¨</h3>
            <label>Ø§Ù„Ø·Ø§Ù„Ø¨
              <select class="select" name="userId" required>
                <option value="">Ø§Ø®ØªØ± Ø§Ù„Ø·Ø§Ù„Ø¨</option>
                ${students.map((student) => `<option value="${student.id}">${escapeHtml(student.full_name)} - ${escapeHtml(student.email)}</option>`).join("")}
              </select>
            </label>
            <label>Ø§Ù„ÙƒÙˆØ±Ø³
              <select class="select" name="courseId" required>
                <option value="">Ø§Ø®ØªØ± Ø§Ù„ÙƒÙˆØ±Ø³</option>
                ${state.data.courses.map((course) => `<option value="${course.id}">${escapeHtml(course.title)} - ${priceText(course)}</option>`).join("")}
              </select>
            </label>
            <label>Ø§Ù„Ø­Ø§Ù„Ø©
              <select class="select" name="status" required>
                <option value="active">Ù…ÙØ¹Ù„</option>
                <option value="pending">Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø¯ÙØ¹</option>
                <option value="rejected">Ù…Ø±ÙÙˆØ¶</option>
              </select>
            </label>
            <button class="btn gold" type="submit">Ø­ÙØ¸ Ø­Ø§Ù„Ø© Ø§Ù„ÙƒÙˆØ±Ø³</button>
          </form>
          ${renderEnrollmentManager()}
        </div>
        <section class="section">
          <div class="section-title">
            <h2>ÙƒÙ„ Ø§Ù„Ø·Ù„Ø§Ø¨</h2>
            <span class="pill">${students.length} Ø·Ø§Ù„Ø¨</span>
          </div>
          <div class="list">
            ${students.map(renderStudentRow).join("") || empty("Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø·Ù„Ø§Ø¨ Ø¨Ø¹Ø¯.")}
          </div>
        </section>
      </section>
    `;
  }

  function renderStudentRow(student) {
    const enrollments = state.data.enrollments.filter((item) => (item.user_id || item.userId) === student.id);
    const passwordText = student.login_password || "ØºÙŠØ± Ù…Ø³Ø¬Ù„ - Ø§Ø¹Ù…Ù„ Reset Password";
    return `
      <div class="list-item student-row">
        <div class="student-info">
          <strong>${escapeHtml(student.full_name)}</strong>
          <span class="muted">Ø§Ù„ÙŠÙˆØ²Ø±: ${escapeHtml(student.email)}</span>
          <span class="muted">ID: ${escapeHtml(student.id)}</span>
          <span class="pill gold">Ø§Ù„Ø¨Ø§Ø³ÙˆØ±Ø¯: ${escapeHtml(passwordText)}</span>
        </div>
        <div class="student-courses">
          ${enrollments
            .map((enrollment) => {
              const course = state.data.courses.find((item) => item.id === (enrollment.course_id || enrollment.courseId));
              return `<span class="pill ${enrollment.status === "active" ? "" : "gold"}">${escapeHtml(course?.title || "ÙƒÙˆØ±Ø³")} - ${statusLabel(enrollment.status)}</span>`;
            })
            .join("") || `<span class="muted">Ù„Ø§ ØªÙˆØ¬Ø¯ ÙƒÙˆØ±Ø³Ø§Øª Ù„Ù‡Ø°Ø§ Ø§Ù„Ø·Ø§Ù„Ø¨.</span>`}
        </div>
      </div>
    `;
  }

  function renderSupportInbox(compact = false) {
    const messages = compact ? state.data.supportMessages.slice(0, 3) : state.data.supportMessages;
    return `
      <div class="${compact ? "card" : "admin-box section"}">
        <h3>Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„Ø¯Ø¹Ù…</h3>
        <div class="list" style="margin-top:12px">
          ${messages
            .map((message) => `
              <div class="list-item">
                <div>
                  <strong>${escapeHtml(message.name)}</strong>
                  <p class="muted">${escapeHtml(message.message)}</p>
                </div>
                <span class="pill ${message.status === "closed" ? "" : "gold"}">${message.status === "closed" ? "Ù…ØºÙ„Ù‚Ø©" : "Ù…ÙØªÙˆØ­Ø©"}</span>
              </div>
            `)
            .join("") || `<p class="muted">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø³Ø§Ø¦Ù„ Ø¯Ø¹Ù….</p>`}
        </div>
      </div>
    `;
  }

  function renderAdminSettings() {
    return `
      <section class="section admin-box">
        <div class="section-title">
          <h2>Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø¯Ø±Ø³</h2>
          <span class="pill gold">ØªØºÙŠÙŠØ± Ø­Ø³Ø§Ø¨ Ø§Ù„Ø£Ø¯Ù…Ù†</span>
        </div>
        <div class="grid two">
          <form class="form card" data-admin-promote-form>
            <h3>ØªØ±Ù‚ÙŠØ© Ù…Ø³ØªØ®Ø¯Ù… Ø¥Ù„Ù‰ Ù…Ø¯Ø±Ø³</h3>
            <input class="field" name="email" type="email" required placeholder="Ø¨Ø±ÙŠØ¯ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…" />
            <button class="btn gold" type="submit">ØªØ¹ÙŠÙŠÙ† ÙƒÙ€ admin</button>
          </form>
          <form class="form card" data-admin-demote-form>
            <h3>Ø¥Ø²Ø§Ù„Ø© ØµÙ„Ø§Ø­ÙŠØ© Ù…Ø¯Ø±Ø³</h3>
            <input class="field" name="email" type="email" required placeholder="Ø¨Ø±ÙŠØ¯ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…" />
            <button class="btn danger" type="submit">Ø¥Ø²Ø§Ù„Ø© Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©</button>
            <p class="muted">Ù„Ù† ÙŠØ³Ù…Ø­ Ø§Ù„Ù†Ø¸Ø§Ù… Ø¨Ø¥Ø²Ø§Ù„Ø© Ø¢Ø®Ø± Ø­Ø³Ø§Ø¨ admin.</p>
          </form>
        </div>
      </section>
    `;
  }

  function renderLinks(title, links) {
    if (!links || !links.length) return `<p class="muted">${title}: Ù„Ø§ ÙŠÙˆØ¬Ø¯</p>`;
    return `
      <h4>${title}</h4>
      <div class="list">
        ${links
          .map((link) => `<a class="btn ghost" href="${escapeAttr(link.url || link)}" target="_blank" rel="noreferrer">${escapeHtml(link.label || "ÙØªØ­ Ø§Ù„Ø±Ø§Ø¨Ø·")}</a>`)
          .join("")}
      </div>
    `;
  }

  function renderVideoPlayer(lesson) {
    if (location.protocol === "file:" && youtubeIdFromUrl(lesson.videoUrl)) {
      return `
        <div class="video-box video-protected video-message">
          <div>
            <h3>Ø§Ù„ÙÙŠØ¯ÙŠÙˆ ÙŠØ­ØªØ§Ø¬ ØªØ´ØºÙŠÙ„ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ù…Ù† Ø±Ø§Ø¨Ø· Ù…Ø­Ù„ÙŠ</h3>
            <p>ÙŠÙˆØªÙŠÙˆØ¨ ÙŠØ±ÙØ¶ Ø£Ø­ÙŠØ§Ù†Ù‹Ø§ ØªØ´ØºÙŠÙ„ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ø¯Ø§Ø®Ù„ iframe Ø¹Ù†Ø¯Ù…Ø§ ÙŠÙƒÙˆÙ† Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ù…ÙØªÙˆØ­Ù‹Ø§ ÙƒÙ…Ù„Ù file://ØŒ Ù„Ø°Ù„Ùƒ ÙŠØ¸Ù‡Ø± Error 153. Ø§ÙØªØ­ Ø±Ø§Ø¨Ø· Ø§Ù„Ø³ÙŠØ±ÙØ± Ø§Ù„Ù…Ø­Ù„ÙŠ Ø§Ù„Ø°ÙŠ Ø³Ø£Ø¹Ø·ÙŠÙ‡ Ù„Ùƒ Ø¨Ø¯Ù„ ÙØªØ­ index.html Ù…Ø¨Ø§Ø´Ø±Ø©.</p>
          </div>
          <span class="video-watermark">${escapeHtml(state.profile.full_name)} - ${escapeHtml(state.profile.email)}</span>
        </div>
        <p class="muted protection-note">Ø¹Ù†Ø¯ Ø±ÙØ¹ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø¹Ù„Ù‰ Netlify Ø£Ùˆ ÙØªØ­Ù‡ Ø¹Ø¨Ø± http://localhost Ø³ÙŠØ¹Ù…Ù„ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ù†ØµØ©.</p>
      `;
    }

    return `
      <div class="video-box video-protected">
        <iframe src="${embedUrl(lesson.videoUrl)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen title="${escapeAttr(lesson.title)}"></iframe>
        <span class="video-watermark">${escapeHtml(state.profile.full_name)} - ${escapeHtml(state.profile.email)}</span>
      </div>
      <p class="muted protection-note">Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ø¹Ù„ÙŠÙ‡ Ø¹Ù„Ø§Ù…Ø© Ù…Ø§Ø¦ÙŠØ© Ø¨Ø§Ø³Ù… Ø§Ù„Ø­Ø³Ø§Ø¨. Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¶Ù…Ø§Ù† Ù…Ù†Ø¹ ØªØµÙˆÙŠØ± Ø§Ù„Ø´Ø§Ø´Ø© 100% Ù…Ù† Ø§Ù„Ù…ØªØµÙØ­ØŒ Ù„ÙƒÙ† Ø£ÙŠ Ù…Ø´Ø§Ø±ÙƒØ© ØºÙŠØ± Ù…ØµØ±Ø­ Ø¨Ù‡Ø§ Ø³ØªÙƒÙˆÙ† ÙˆØ§Ø¶Ø­Ø© Ù…Ù† Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨.</p>
    `;
  }

  function renderComment(comment) {
    const profile = findProfile(comment.user_id || comment.userId);
    return `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(profile?.full_name || "Ø·Ø§Ù„Ø¨")}</strong>
          <p>${escapeHtml(comment.body)}</p>
        </div>
      </div>
    `;
  }

  function bindAuth() {
    if (!hasSupabase) return;
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = button.dataset.authTab;
        render();
      });
    });
    document.querySelector("[data-auth-form]").addEventListener("submit", handleAuthSubmit);
  }

  function bindGlobal() {
    document.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", logout);
    });
  }

  function bindRoute() {
    const search = document.querySelector("[data-search]");
    if (search) {
      search.addEventListener("input", (event) => {
        state.search = event.target.value;
        render();
      });
    }

    bindClicks("[data-open-course]", (node) => navigate("course", node.dataset.openCourse));
    bindClicks("[data-open-lesson]", (node) => navigate("lesson", node.dataset.openLesson));
    bindClicks("[data-buy-course]", (node) => buyCourse(node.dataset.buyCourse));
    bindClicks("[data-free-course]", (node) => activateFreeCourse(node.dataset.freeCourse));
    bindClicks("[data-edit-course]", (node) => editCourse(node.dataset.editCourse));
    bindClicks("[data-toggle-course]", (node) => toggleCourse(node.dataset.toggleCourse));
    bindClicks("[data-delete-course]", (node) => deleteCourse(node.dataset.deleteCourse));
    bindClicks("[data-edit-section]", (node) => editSection(node.dataset.editSection));
    bindClicks("[data-delete-section]", (node) => deleteSection(node.dataset.deleteSection));
    bindClicks("[data-edit-lesson]", (node) => editLesson(node.dataset.editLesson));
    bindClicks("[data-delete-lesson]", (node) => deleteLesson(node.dataset.deleteLesson));
    bindImageInputs("[data-section-image]", updateSectionImage);
    bindImageInputs("[data-lesson-image]", updateLessonImage);
    bindClicks("[data-edit-post]", (node) => editPost(node.dataset.editPost));
    bindClicks("[data-toggle-post]", (node) => togglePost(node.dataset.togglePost));
    bindClicks("[data-delete-post]", (node) => deletePost(node.dataset.deletePost));
    bindClicks("[data-course-scroll]", (node) => scrollCourses(node));
    bindClicks("[data-enroll-status]", (node) => {
      const [id, status] = node.dataset.enrollStatus.split(":");
      updateEnrollment(id, status);
    });

    bindForm("[data-course-form]", addCourse);
    const accessType = document.querySelector("[data-access-type]");
    if (accessType) {
      const priceField = document.querySelector("[data-price-field]");
      const syncPrice = () => {
        if (!priceField) return;
        priceField.style.display = accessType.value === "paid" ? "grid" : "none";
      };
      accessType.addEventListener("change", syncPrice);
      syncPrice();
    }
    bindForms("[data-section-form]", (form) => addSection(form.dataset.sectionForm, form));
    bindForms("[data-lesson-form]", (form) => addLesson(form.dataset.lessonForm, form));
    bindForm("[data-post-form]", addPost);
    bindForm("[data-support-form]", addSupportMessage);
    bindForm("[data-manual-enrollment-form]", saveManualEnrollment);
    bindForms("[data-comment-form]", (form) => addLessonComment(form.dataset.commentForm, form));
    bindForms("[data-post-comment-form]", (form) => addPostComment(form.dataset.postCommentForm, form));
    bindForm("[data-admin-promote-form]", (form) => changeAdmin(form, true));
    bindForm("[data-admin-demote-form]", (form) => changeAdmin(form, false));

    const share = document.querySelector("[data-share]");
    if (share) share.addEventListener("click", shareSite);
    bindCourseWheel();
  }

  function scrollCourses(button) {
    const strip = button.closest(".course-carousel")?.querySelector("[data-course-strip]");
    if (!strip) return;
    const amount = Math.min(380, Math.max(280, strip.clientWidth * 0.72));
    const direction = button.dataset.courseScroll === "next" ? 1 : -1;
    strip.scrollBy({ left: amount * direction, behavior: "smooth" });
  }

  function bindCourseWheel() {
    document.querySelectorAll("[data-course-strip]").forEach((strip) => {
      strip.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        strip.scrollLeft += event.deltaY;
      }, { passive: false });
    });
  }

  function bindClicks(selector, handler) {
    document.querySelectorAll(selector).forEach((node) => node.addEventListener("click", () => handler(node)));
  }

  function bindForm(selector, handler) {
    const form = document.querySelector(selector);
    if (form) form.addEventListener("submit", (event) => {
      event.preventDefault();
      handler(form);
    });
  }

  function bindForms(selector, handler) {
    document.querySelectorAll(selector).forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        handler(form);
      });
    });
  }

  function bindImageInputs(selector, handler) {
    document.querySelectorAll(selector).forEach((input) => {
      input.addEventListener("change", () => handler(input));
    });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formValues(form);
    if (!hasSupabase) {
      toast("Ø§Ø¶Ø¨Ø· Supabase Ø£ÙˆÙ„Ù‹Ø§ Ù…Ù† config.js.");
      return;
    }

    if (state.authMode === "signup") {
      const { data, error } = await client.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.name, login_password: values.password } }
      });
      if (error) return toast(error.message);
      state.user = data.user;
      state.profile = await getOrCreateProfile(data.user, values.name);
    } else {
      const { data, error } = await client.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      if (error) return toast(error.message);
      state.user = data.user;
      state.profile = await getOrCreateProfile(data.user);
    }

    await loadData();
    render();
  }

  async function getOrCreateProfile(user, name = "") {
    const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) return data;
    const profile = {
      id: user.id,
      full_name: name || user.user_metadata?.full_name || user.email.split("@")[0],
      email: user.email,
      role: "student",
      login_password: user.user_metadata?.login_password || ""
    };
    const { error } = await client.from("profiles").insert(profile);
    if (error) console.warn(error);
    return profile;
  }

  async function logout() {
    if (hasSupabase) await client.auth.signOut();
    state.user = null;
    state.profile = null;
    state.route = "home";
    render();
  }

  async function addCourse(form) {
    const values = formValues(form);
    const imageFile = form.elements.imageFile?.files?.[0];
    const uploadedImage = imageFile ? await fileToDataUrl(imageFile) : "";
    const attachments = await collectCourseAttachments(form);
    const videoThumbnail = youtubeThumbnail(values.courseUrl);
    const isFree = values.accessType !== "paid";
    const price = isFree ? 0 : Number(values.price || 0);
    const record = {
      title: values.title,
      grade: values.grade || "Ø¹Ø§Ù…",
      price,
      description: values.description,
      image_url: uploadedImage || values.imageUrl || videoThumbnail,
      attachments,
      teacher_name: "Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ",
      is_published: true
    };
    let courseId = "";
    if (hasSupabase) {
      const { data, error } = await client.from("courses").insert(record).select("id").single();
      if (error) return toast(error.message);
      courseId = data.id;
    } else {
      courseId = fallbackStore.addCourse(record);
    }

    if (values.courseUrl && courseId) {
      let sectionId = "";
      const sectionRecord = { course_id: courseId, title: "Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª", image_url: uploadedImage || values.imageUrl || videoThumbnail, sort_order: 1 };
      if (hasSupabase) {
        const { data, error } = await client.from("course_sections").insert(sectionRecord).select("id").single();
        if (error) return toast(error.message);
        sectionId = data.id;
      } else {
        sectionId = fallbackStore.addSection({ courseId, title: "Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª", imageUrl: uploadedImage || values.imageUrl || videoThumbnail, sortOrder: 1 });
      }

      const lessonRecord = {
        section_id: sectionId,
        title: values.title,
        video_url: values.courseUrl,
        thumbnail_url: uploadedImage || values.imageUrl || videoThumbnail,
        external_links: [],
        attachments,
        sort_order: 1
      };
      if (hasSupabase) {
        const { error } = await client.from("lessons").insert(lessonRecord);
        if (error) return toast(error.message);
      } else {
        fallbackStore.addLesson({
          sectionId,
          title: values.title,
          videoUrl: values.courseUrl,
          thumbnailUrl: uploadedImage || values.imageUrl || videoThumbnail,
          externalLinks: [],
          attachments,
          sortOrder: 1
        });
      }
    }
    await reload("ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙƒÙˆØ±Ø³.");
  }

  async function addSection(courseId, form) {
    const values = formValues(form);
    const imageFile = form.elements.imageFile?.files?.[0];
    const imageUrl = imageFile ? await fileToDataUrl(imageFile) : "";
    const record = { course_id: courseId, title: values.title, image_url: imageUrl, sort_order: countSections(courseId) + 1 };
    if (hasSupabase) {
      const { error } = await client.from("course_sections").insert(record);
      if (error) return toast(error.message);
    } else {
      fallbackStore.addSection({ courseId, title: values.title, imageUrl, sortOrder: countSections(courseId) + 1 });
    }
    await reload("ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù‚Ø³Ù….");
  }

  async function addLesson(sectionId, form) {
    const values = formValues(form);
    const thumbnailFile = form.elements.thumbnailFile?.files?.[0];
    const uploadedThumbnail = thumbnailFile ? await fileToDataUrl(thumbnailFile) : "";
    const videoThumbnail = youtubeThumbnail(values.videoUrl);
    const record = {
      section_id: sectionId,
      title: values.title,
      video_url: values.videoUrl,
      thumbnail_url: uploadedThumbnail || values.thumbnailUrl || videoThumbnail,
      external_links: values.externalLink ? [{ label: "Ø±Ø§Ø¨Ø· Ø®Ø§Ø±Ø¬ÙŠ", url: values.externalLink }] : [],
      attachments: [],
      sort_order: state.data.lessons.filter((lesson) => lesson.sectionId === sectionId).length + 1
    };
    if (hasSupabase) {
      const { error } = await client.from("lessons").insert(record);
      if (error) return toast(error.message);
    } else {
      fallbackStore.addLesson({
        sectionId,
        title: values.title,
        videoUrl: values.videoUrl,
        thumbnailUrl: uploadedThumbnail || values.thumbnailUrl || videoThumbnail,
        externalLinks: record.external_links,
        attachments: [],
        sortOrder: record.sort_order
      });
    }
    await reload("ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ.");
  }

  async function addPost(form) {
    const values = formValues(form);
    const imageFile = form.elements.imageFile?.files?.[0];
    const uploadedImage = imageFile ? await fileToDataUrl(imageFile) : "";
    const record = {
      author_id: state.user.id,
      title: values.title,
      body: values.body,
      image_url: uploadedImage || values.imageUrl,
      is_published: true
    };
    if (hasSupabase) {
      const { error } = await client.from("posts").insert(record);
      if (error) return toast(error.message);
    } else {
      fallbackStore.addPost(record);
    }
    await reload("ØªÙ… Ù†Ø´Ø± Ø§Ù„Ù…Ù†Ø´ÙˆØ±.");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function collectCourseAttachments(form) {
    const pairs = [
      ["explanationFile", "Ù…Ù„Ù Ø§Ù„Ø´Ø±Ø­"],
      ["questionsFile", "Ù…Ù„Ù Ø§Ù„Ø£Ø³Ø¦Ù„Ø©"]
    ];
    const attachments = [];
    for (const [fieldName, fallbackLabel] of pairs) {
      const file = form.elements[fieldName]?.files?.[0];
      if (!file) continue;
      attachments.push({
        label: `${fallbackLabel} - ${file.name}`,
        url: await fileToDataUrl(file),
        type: file.type || "application/octet-stream"
      });
    }
    return attachments;
  }

  async function editCourse(courseId) {
    const course = state.data.courses.find((item) => item.id === courseId);
    if (!course) return;
    const title = window.prompt("Ø§Ø³Ù… Ø§Ù„ÙƒÙˆØ±Ø³", course.title);
    if (!title) return;
    const price = window.prompt("Ø§Ù„Ø³Ø¹Ø±", course.price);
    if (price === null) return;
    const description = window.prompt("ÙˆØµÙ Ù…Ø®ØªØµØ±", course.description);
    if (description === null) return;
    const patch = { title, price: Number(price || 0), description };
    if (hasSupabase) {
      const { error } = await client.from("courses").update(patch).eq("id", courseId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateCourse(courseId, patch);
    }
    await reload("ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ÙƒÙˆØ±Ø³.");
  }

  async function toggleCourse(courseId) {
    const course = state.data.courses.find((item) => item.id === courseId);
    if (!course) return;
    const patch = { is_published: course.is_published === false };
    if (hasSupabase) {
      const { error } = await client.from("courses").update(patch).eq("id", courseId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateCourse(courseId, patch);
    }
    await reload(patch.is_published ? "ØªÙ… Ù†Ø´Ø± Ø§Ù„ÙƒÙˆØ±Ø³." : "ØªÙ… Ø¥Ø®ÙØ§Ø¡ Ø§Ù„ÙƒÙˆØ±Ø³.");
  }

  async function deleteCourse(courseId) {
    if (!window.confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø­Ø°Ù Ø§Ù„ÙƒÙˆØ±Ø³ ÙˆÙƒÙ„ Ø£Ù‚Ø³Ø§Ù…Ù‡ ÙˆÙÙŠØ¯ÙŠÙˆÙ‡Ø§ØªÙ‡ØŸ")) return;
    if (hasSupabase) {
      const { error } = await client.from("courses").delete().eq("id", courseId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.deleteCourse(courseId);
    }
    await reload("ØªÙ… Ø­Ø°Ù Ø§Ù„ÙƒÙˆØ±Ø³.");
  }

  async function editSection(sectionId) {
    const section = state.data.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const title = window.prompt("Ø§Ø³Ù… Ø§Ù„Ù‚Ø³Ù…", section.title);
    if (!title) return;
    const patch = hasSupabase ? { title } : { title };
    if (hasSupabase) {
      const { error } = await client.from("course_sections").update(patch).eq("id", sectionId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateSection(sectionId, patch);
    }
    await reload("ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù‚Ø³Ù….");
  }

  async function deleteSection(sectionId) {
    if (!window.confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø­Ø°Ù Ø§Ù„Ù‚Ø³Ù… ÙˆÙƒÙ„ Ø§Ù„ÙÙŠØ¯ÙŠÙˆÙ‡Ø§Øª Ø¯Ø§Ø®Ù„Ù‡ØŸ")) return;
    if (hasSupabase) {
      const { error } = await client.from("course_sections").delete().eq("id", sectionId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.deleteSection(sectionId);
    }
    await reload("ØªÙ… Ø­Ø°Ù Ø§Ù„Ù‚Ø³Ù….");
  }

  async function updateSectionImage(input) {
    const file = input.files?.[0];
    if (!file) return;
    const imageUrl = await fileToDataUrl(file);
    const sectionId = input.dataset.sectionImage;
    if (hasSupabase) {
      const { error } = await client.from("course_sections").update({ image_url: imageUrl }).eq("id", sectionId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateSection(sectionId, { imageUrl });
    }
    await reload("ØªÙ… ØªØ­Ø¯ÙŠØ« ØµÙˆØ±Ø© Ø§Ù„Ù‚Ø³Ù….");
  }

  async function editLesson(lessonId) {
    const lesson = state.data.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    const title = window.prompt("Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ÙÙŠØ¯ÙŠÙˆ", lesson.title);
    if (!title) return;
    const videoUrl = window.prompt("Ø±Ø§Ø¨Ø· Ø§Ù„ÙÙŠØ¯ÙŠÙˆ", lesson.videoUrl);
    if (!videoUrl) return;
    const thumbnailUrl = window.prompt("Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© Ù…ØµØºØ±Ø© Ø§Ø®ØªÙŠØ§Ø±ÙŠ", lesson.thumbnailUrl || youtubeThumbnail(videoUrl));
    if (thumbnailUrl === null) return;
    const patch = hasSupabase
      ? { title, video_url: videoUrl, thumbnail_url: thumbnailUrl || youtubeThumbnail(videoUrl) }
      : { title, videoUrl, thumbnailUrl: thumbnailUrl || youtubeThumbnail(videoUrl) };
    if (hasSupabase) {
      const { error } = await client.from("lessons").update(patch).eq("id", lessonId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateLesson(lessonId, patch);
    }
    await reload("ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ.");
  }

  async function deleteLesson(lessonId) {
    if (!window.confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø­Ø°Ù Ù‡Ø°Ø§ Ø§Ù„ÙÙŠØ¯ÙŠÙˆØŸ")) return;
    if (hasSupabase) {
      const { error } = await client.from("lessons").delete().eq("id", lessonId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.deleteLesson(lessonId);
    }
    await reload("ØªÙ… Ø­Ø°Ù Ø§Ù„ÙÙŠØ¯ÙŠÙˆ.");
  }

  async function updateLessonImage(input) {
    const file = input.files?.[0];
    if (!file) return;
    const thumbnailUrl = await fileToDataUrl(file);
    const lessonId = input.dataset.lessonImage;
    if (hasSupabase) {
      const { error } = await client.from("lessons").update({ thumbnail_url: thumbnailUrl }).eq("id", lessonId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateLesson(lessonId, { thumbnailUrl });
    }
    await reload("ØªÙ… ØªØ­Ø¯ÙŠØ« ØµÙˆØ±Ø© Ø§Ù„ÙÙŠØ¯ÙŠÙˆ.");
  }

  async function editPost(postId) {
    const post = state.data.posts.find((item) => item.id === postId);
    if (!post) return;
    const title = window.prompt("Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…Ù†Ø´ÙˆØ±", post.title);
    if (!title) return;
    const body = window.prompt("Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ù…Ù†Ø´ÙˆØ±", post.body);
    if (!body) return;
    const patch = { title, body };
    if (hasSupabase) {
      const { error } = await client.from("posts").update(patch).eq("id", postId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updatePost(postId, patch);
    }
    await reload("ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ù†Ø´ÙˆØ±.");
  }

  async function togglePost(postId) {
    const post = state.data.posts.find((item) => item.id === postId);
    if (!post) return;
    const patch = { is_published: post.is_published === false };
    if (hasSupabase) {
      const { error } = await client.from("posts").update(patch).eq("id", postId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updatePost(postId, patch);
    }
    await reload(patch.is_published ? "ØªÙ… Ù†Ø´Ø± Ø§Ù„Ù…Ù†Ø´ÙˆØ±." : "ØªÙ… Ø¥Ø®ÙØ§Ø¡ Ø§Ù„Ù…Ù†Ø´ÙˆØ±.");
  }

  async function deletePost(postId) {
    if (!window.confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø­Ø°Ù Ø§Ù„Ù…Ù†Ø´ÙˆØ±ØŸ")) return;
    if (hasSupabase) {
      const { error } = await client.from("posts").delete().eq("id", postId);
      if (error) return toast(error.message);
    } else {
      fallbackStore.deletePost(postId);
    }
    await reload("ØªÙ… Ø­Ø°Ù Ø§Ù„Ù…Ù†Ø´ÙˆØ±.");
  }

  async function addSupportMessage(form) {
    const values = formValues(form);
    const record = {
      user_id: state.user.id,
      name: values.name,
      email: values.email,
      message: values.message,
      status: "open"
    };
    if (hasSupabase) {
      const { error } = await client.from("support_messages").insert(record);
      if (error) return toast(error.message);
    } else {
      fallbackStore.addSupport(record);
    }
    await reload("ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©.");
  }

  async function addLessonComment(lessonId, form) {
    await addComment({ lesson_id: lessonId, body: formValues(form).body });
  }

  async function addPostComment(postId, form) {
    await addComment({ post_id: postId, body: formValues(form).body });
  }

  async function addComment(record) {
    if (!record.body) return;
    const payload = { ...record, user_id: state.user.id };
    if (hasSupabase) {
      const { error } = await client.from("comments").insert(payload);
      if (error) return toast(error.message);
    } else {
      fallbackStore.addComment({
        userId: state.user.id,
        lessonId: payload.lesson_id,
        postId: payload.post_id,
        body: payload.body
      });
    }
    await reload("ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ØªØ¹Ù„ÙŠÙ‚.");
  }

  async function buyCourse(courseId) {
    const course = state.data.courses.find((item) => item.id === courseId);
    if (!course) return;
    const current = getEnrollment(courseId);
    if (!current) {
      if (hasSupabase) {
        const { error } = await client.from("enrollments").insert({
          user_id: state.user.id,
          course_id: courseId,
          status: "pending"
        });
        if (error) toast(error.message);
      } else {
        fallbackStore.addEnrollment({ userId: state.user.id, courseId, status: "pending" });
      }
      await loadData();
    }
    window.open(whatsappCourseLink(course), "_blank", "noopener,noreferrer");
    toast("ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨ÙƒØŒ ÙˆØ³ÙŠØªÙ… ÙØªØ­ ÙˆØ§ØªØ³Ø§Ø¨ Ù„Ø¥Ø±Ø³Ø§Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø±Ø§Ø¡.");
    render();
  }

  async function activateFreeCourse(courseId) {
    await saveEnrollment(state.user.id, courseId, "active");
    await reload("ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙƒÙˆØ±Ø³ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠ Ø¥Ù„Ù‰ Ù…ÙƒØªØ¨ØªÙƒ.");
    navigate("course", courseId);
  }

  async function saveEnrollment(userId, courseId, status) {
    const existing = state.data.enrollments.find((item) => {
      return (item.user_id || item.userId) === userId && (item.course_id || item.courseId) === courseId;
    });
    if (hasSupabase) {
      if (existing) {
        const { error } = await client.from("enrollments").update({ status }).eq("id", existing.id);
        if (error) return toast(error.message);
      } else {
        const { error } = await client.from("enrollments").insert({ user_id: userId, course_id: courseId, status });
        if (error) return toast(error.message);
      }
    } else if (existing) {
      fallbackStore.updateEnrollment(existing.id, status);
    } else {
      fallbackStore.addEnrollment({ userId, courseId, status });
    }
  }

  async function updateEnrollment(id, status) {
    if (hasSupabase) {
      const { error } = await client.from("enrollments").update({ status }).eq("id", id);
      if (error) return toast(error.message);
    } else {
      fallbackStore.updateEnrollment(id, status);
    }
    await reload("ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ.");
  }

  async function saveManualEnrollment(form) {
    const values = formValues(form);
    await saveEnrollment(values.userId, values.courseId, values.status);
    await reload("ØªÙ… Ø­ÙØ¸ ØªÙØ¹ÙŠÙ„ Ø§Ù„ÙƒÙˆØ±Ø³ Ù„Ù„Ø·Ø§Ù„Ø¨.");
  }

  async function changeAdmin(form, promote) {
    const email = formValues(form).email.toLowerCase();
    const target = state.data.profiles.find((profile) => profile.email.toLowerCase() === email);
    if (!target) return toast("Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù….");
    const admins = state.data.profiles.filter((profile) => profile.role === "admin");
    if (!promote && admins.length <= 1 && target.role === "admin") {
      return toast("Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø²Ø§Ù„Ø© Ø¢Ø®Ø± Ø­Ø³Ø§Ø¨ Ù…Ø¯Ø±Ø³.");
    }
    const role = promote ? "admin" : "student";
    if (hasSupabase) {
      const { error } = await client.from("profiles").update({ role }).eq("id", target.id);
      if (error) return toast(error.message);
    } else {
      fallbackStore.setRole(target.id, role);
    }
    if (target.id === state.profile.id) state.profile.role = role;
    await reload("ØªÙ… ØªØ­Ø¯ÙŠØ« ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù….");
  }

  async function reload(message) {
    await loadData();
    toast(message);
    render();
  }

  function navigate(route, id = null) {
    state.route = route;
    state.routeId = id;
    state.search = "";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function filterBySearch(items, keys) {
    const q = state.search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => keys.some((key) => String(item[key] || "").toLowerCase().includes(q)));
  }

  function visibleCourses() {
    return state.data.courses.filter((course) => isAdmin() || course.is_published !== false);
  }

  function visiblePosts() {
    return state.data.posts.filter((post) => isAdmin() || post.is_published !== false);
  }

  function isAdmin() {
    return state.profile?.role === "admin";
  }

  function canAccessCourse(courseId) {
    const course = state.data.courses.find((item) => item.id === courseId);
    return isAdmin() || Number(course?.price) <= 0 || getEnrollment(courseId)?.status === "active";
  }

  function getEnrollment(courseId) {
    return state.data.enrollments.find((enrollment) => {
      const enrollmentCourseId = enrollment.course_id || enrollment.courseId;
      const enrollmentUserId = enrollment.user_id || enrollment.userId;
      return enrollmentCourseId === courseId && enrollmentUserId === state.user.id;
    });
  }

  function countLessons(courseId) {
    const sectionIds = state.data.sections.filter((section) => section.courseId === courseId).map((section) => section.id);
    return state.data.lessons.filter((lesson) => sectionIds.includes(lesson.sectionId)).length;
  }

  function countSections(courseId) {
    return state.data.sections.filter((section) => section.courseId === courseId).length;
  }

  function findProfile(userId) {
    return state.data.profiles.find((profile) => profile.id === userId);
  }

  function statusLabel(status) {
    return { pending: "Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„ØªÙØ¹ÙŠÙ„", active: "Ù…ÙØ¹Ù„", rejected: "Ù…Ø±ÙÙˆØ¶" }[status] || status;
  }

  function priceText(course) {
    return Number(course.price) <= 0 ? "Ù…Ø¬Ø§Ù†ÙŠ" : `${course.price} Ø¬Ù†ÙŠÙ‡ / Ø§Ù„ÙƒÙˆØ±Ø³`;
  }

  function whatsappCourseLink(course) {
    const message = [
      "Ø·Ù„Ø¨ Ø´Ø±Ø§Ø¡ ÙƒÙˆØ±Ø³",
      `ID: ${state.user.id}`,
      `Name: ${state.profile.full_name}`,
      `Course: ${course.title}`,
      `Price: ${course.price} EGP`
    ].join("\n");
    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function whatsappGeneralLink() {
    const message = `Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø±ÙŠØ¯ Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ù…Ù†ØµØ© Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ. Ø§Ù„Ø§Ø³Ù…: ${state.profile.full_name}`;
    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function shareSite() {
    const data = { title: "Ù…Ù†ØµØ© Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ", text: "Ù…Ù†ØµØ© Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§", url: location.href };
    if (navigator.share) navigator.share(data);
    else navigator.clipboard.writeText(location.href).then(() => toast("ØªÙ… Ù†Ø³Ø® Ø±Ø§Ø¨Ø· Ø§Ù„Ù…ÙˆÙ‚Ø¹."));
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function embedUrl(url) {
    if (!url) return "";
    const params = "rel=0&modestbranding=1&playsinline=1&iv_load_policy=3";
    const youtubeId = youtubeIdFromUrl(url);
    if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?${params}`;
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1].split(/[?#]/)[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  }

  function youtubeIdFromUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("/")[0];
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
        if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/embed/")[1].split("/")[0];
        if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1].split("/")[0];
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function youtubeThumbnail(url) {
    const id = youtubeIdFromUrl(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
  }

  function bg(url) {
    return url ? `--image:url('${escapeAttr(url)}')` : "";
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(value));
  }

  function empty(message) {
    return `<div class="empty">${message}</div>`;
  }

  function toast(message) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = fixMojibake(message);
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function repairArabicText(root) {
    document.title = fixMojibake(document.title);
    document.querySelectorAll("meta[name='description']").forEach((meta) => {
      meta.setAttribute("content", fixMojibake(meta.getAttribute("content") || ""));
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.nodeValue = fixMojibake(node.nodeValue);
    });

    root.querySelectorAll("*").forEach((element) => {
      ["placeholder", "title", "aria-label", "alt"].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(attribute, fixMojibake(element.getAttribute(attribute) || ""));
        }
      });
    });
  }

  function fixMojibake(value) {
    if (typeof value !== "string" || !/[ÃÂØÙ]/.test(value)) return value;
    const bytes = [];
    for (const char of value) {
      const byte = windows1252Byte(char);
      if (byte === null) return value;
      bytes.push(byte);
    }
    try {
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    } catch (error) {
      return value;
    }
  }

  function windows1252Byte(char) {
    const code = char.charCodeAt(0);
    if (code <= 255) return code;
    const map = {
      0x20ac: 0x80,
      0x201a: 0x82,
      0x0192: 0x83,
      0x201e: 0x84,
      0x2026: 0x85,
      0x2020: 0x86,
      0x2021: 0x87,
      0x02c6: 0x88,
      0x2030: 0x89,
      0x0160: 0x8a,
      0x2039: 0x8b,
      0x0152: 0x8c,
      0x017d: 0x8e,
      0x2018: 0x91,
      0x2019: 0x92,
      0x201c: 0x93,
      0x201d: 0x94,
      0x2022: 0x95,
      0x2013: 0x96,
      0x2014: 0x97,
      0x02dc: 0x98,
      0x2122: 0x99,
      0x0161: 0x9a,
      0x203a: 0x9b,
      0x0153: 0x9c,
      0x017e: 0x9e,
      0x0178: 0x9f
    };
    return map[code] ?? null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function iconSvg(name) {
    const paths = {
      home: `<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>`,
      courses: `<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v16"/><path d="M11 8h5M11 12h4"/>`,
      posts: `<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>`,
      support: `<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>`,
      students: `<path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2.5 21a5.5 5.5 0 0 1 11 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M15.5 15.5A4.5 4.5 0 0 1 21.5 20"/>`,
      more: `<path d="M5 7h14M5 12h14M5 17h14"/>`,
      chevronLeft: `<path d="m15 18-6-6 6-6"/>`,
      chevronRight: `<path d="m9 18 6-6-6-6"/>`
    };
    return `
      <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${paths[name] || paths.more}
        </g>
      </svg>
    `;
  }

  function logoSvg(className) {
    return `
      <svg class="${className}" viewBox="0 0 120 120" role="img" aria-label="Ø´Ø¹Ø§Ø± Ù…Ø³ØªØ± Ø¹Ù…Ø§Ø¯ Ø­Ù…Ø¯ÙŠ">
        <defs>
          <linearGradient id="logoGold" x1="20" x2="95" y1="15" y2="110" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f3d27a"/>
            <stop offset="1" stop-color="#c89436"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="54" fill="#2f5d50"/>
        <circle cx="60" cy="60" r="45" fill="#f4ecd8"/>
        <path d="M28 78c15-11 45-11 64 0V35c-17-9-46-9-64 0v43Z" fill="url(#logoGold)" stroke="#8b5f35" stroke-width="3" stroke-linejoin="round"/>
        <path d="M34 41c14-6 35-6 52 0M34 52c15-6 37-6 52 0M34 63c15-6 37-6 52 0" fill="none" stroke="#23312d" stroke-linecap="round" stroke-width="3"/>
        <circle cx="60" cy="58" r="17" fill="none" stroke="#2f5d50" stroke-width="4"/>
        <path d="M60 37v42M39 58h42M48 46c8 8 17 8 24 0M48 70c8-8 17-8 24 0" fill="none" stroke="#2f5d50" stroke-linecap="round" stroke-width="3"/>
        <path d="M60 47l6 11-6 13-6-13 6-11Z" fill="#8b5f35"/>
      </svg>
    `;
  }

  function createFallbackStore() {
    const empty = emptyData();
    return {
      snapshot: () => empty,
      upsertProfile: () => {},
      addCourse: () => "",
      addSection: () => "",
      addLesson: () => {},
      addPost: () => {},
      addSupport: () => {},
      addComment: () => {},
      addEnrollment: () => {},
      updateEnrollment: () => {},
      updateCourse: () => {},
      updateSection: () => {},
      updateLesson: () => {},
      deleteCourse: () => {},
      deleteSection: () => {},
      deleteLesson: () => {},
      updatePost: () => {},
      deletePost: () => {},
      setRole: () => {}
    };
  }
})();


