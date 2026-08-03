const state = {
  feedback: [],
  cases: [],
  principles: null,
  tags: [],
  boot: null,
  selectedFeedback: 0,
  selectedCase: 0
};

const routes = new Set(["dashboard", "feedback", "cases", "principles", "boot"]);
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const sidebar = document.querySelector(".sidebar");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  const caseIndex = ["CASE-0001", "CASE-0002"];
  const [feedback, principles, tags, boot, ...cases] = await Promise.all([
    loadJson("./data/episodes/EP-PILOT/feedback.json"),
    loadJson("./data/principles.json"),
    loadJson("./data/feedback-tags.json"),
    loadJson("./data/generated/boot-context.json"),
    ...caseIndex.map((id) => loadJson(`./data/cases/${id}.json`))
  ]);
  Object.assign(state, { feedback, principles, tags: tags.tags, boot, cases });
  document.querySelector("#context-budget").textContent =
    `${boot.representativeCases.length} cases selected`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function header(title, subtitle, actions = "") {
  return `
    <header class="page-header">
      <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
      <div class="actions">${actions}</div>
    </header>`;
}

function dashboardView() {
  const active = state.principles.principles.filter((item) => item.state === "active").length;
  const watch = state.principles.principles.filter((item) => item.state === "watch").length;
  return `
    ${header(
      "Control Room",
      "작품 진행과 성장 증거, 다음 사람 승인을 한 화면에서 관리",
      '<button class="button" data-action="export">Export context</button><button class="button primary" data-route-button="feedback">Review feedback</button>'
    )}
    <div class="page-body grid two">
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2>EP-PILOT 성장 루프</h2><span class="small">G2 · 자기평가 준비</span></div>
          <div class="pipeline">
            <div class="pipeline-item done"><small>G1</small><strong>피드백<br>태깅</strong></div>
            <div class="pipeline-item active"><small>G2</small><strong>자기<br>평가</strong></div>
            <div class="pipeline-item"><small>G3</small><strong>사례<br>등록</strong></div>
            <div class="pipeline-item"><small>G4</small><strong>승격<br>심사</strong></div>
            <div class="pipeline-item"><small>G5</small><strong>시스템<br>개정</strong></div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2>초기 성장 증거</h2><span class="small">Git source of truth</span></div>
          <div class="activity">
            <div class="activity-item"><span class="activity-dot"></span><span>CASE-0001 · 태양 대신 그림자</span><span class="small">대표 사례</span></div>
            <div class="activity-item"><span class="activity-dot"></span><span>CASE-0002 · 빈 의자로 남긴 부재</span><span class="small">대표 사례</span></div>
            <div class="activity-item"><span class="activity-dot"></span><span>EP-PILOT 사람 피드백 2건 구조화</span><span class="small">G1</span></div>
            <div class="activity-item"><span class="activity-dot"></span><span>작가 자기평가와 불확실성 기록</span><span class="small">G2</span></div>
          </div>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2>현재 기준선</h2><span class="small">pilot fixture</span></div>
          <div class="metrics">
            <div class="metric"><strong>${state.feedback.length}</strong><span>피드백</span></div>
            <div class="metric"><strong>${state.cases.length}</strong><span>대표 사례</span></div>
            <div class="metric"><strong>${active + watch}</strong><span>관측 원칙</span></div>
          </div>
        </section>
        <section class="card decision">
          <h3>사람 결정 필요</h3>
          <p>첫 실제 성장 루프에 사용할 승인된 에피소드와 원본·수정본·피드백 출처를 선택해야 합니다.</p>
          <button class="button approve" data-action="decision">Record pilot decision</button>
        </section>
        <section class="card">
          <div class="card-head"><h3>제품 상태</h3><span class="tag active">Phase 2 / 5</span></div>
          <p class="small">데이터 모델, 검증기, 부팅 컨텍스트와 UI 골격이 연결되었습니다. 현재 화면의 데이터는 구조 검증용 EP-PILOT fixture입니다.</p>
        </section>
      </div>
    </div>`;
}

function feedbackView() {
  const selected = state.feedback[state.selectedFeedback];
  const selectedTags = new Set(selected.tags);
  return `
    ${header(
      "Feedback Inbox",
      "사람의 언어를 판정 가능한 원인, 근거, 수정 가설로 변환",
      '<button class="button" data-action="save-feedback">Save draft</button><button class="button primary" data-action="queue-case">Add to case queue</button>'
    )}
    <div class="page-body feedback-layout">
      <section class="card">
        <div class="card-head"><h2>EP-PILOT 피드백</h2><span class="small">${state.feedback.length} items</span></div>
        <div class="list">
          ${state.feedback.map((item, index) => `
            <button class="list-button ${index === state.selectedFeedback ? "active" : ""}" data-feedback-index="${index}">
              <strong>${escapeHtml(item.evidence[0].reference)} · ${escapeHtml(item.status)}</strong>
              <span>${escapeHtml(item.quote)}</span>
            </button>`).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${escapeHtml(selected.evidence[0].reference)} · 원인 판정</h2><span class="small">source locked</span></div>
        <div class="quote">“${escapeHtml(selected.quote)}”</div>
        <div class="tags">
          ${state.tags.map((tag) => `
            <button class="tag ${selectedTags.has(tag.label) ? "active" : ""}" data-tag="${escapeHtml(tag.label)}">${escapeHtml(tag.label)}</button>`
          ).join("")}
        </div>
        <div class="evidence-grid">
          <div class="evidence"><strong>판정 근거</strong><p>${escapeHtml(selected.evidence[0].artifact)} · ${escapeHtml(selected.evidence[0].reference)}</p></div>
          <div class="evidence"><strong>수정 가설</strong><p>${escapeHtml(selected.hypothesis)}</p></div>
        </div>
      </section>
    </div>`;
}

function caseArt(after = false) {
  return `<div class="case-art ${after ? "after" : ""}"><span class="sun"></span><span class="figure"></span><span class="shadow"></span><span class="speech">저무는 태양처럼<br>우리도 헤어지는구나.</span></div>`;
}

function casesView() {
  const selected = state.cases[state.selectedCase];
  return `
    ${header(
      "Case Library",
      "철학을 추상 문장이 아니라 판정 가능한 before/after 대조쌍으로 전승",
      '<button class="button">Representative only</button><button class="button primary" data-action="new-case">New case</button>'
    )}
    <div class="page-body case-layout">
      <section class="card case-selector">
        <div class="card-head"><h2>대표 사례</h2><span class="small">${state.cases.length} active</span></div>
        <div class="list">
          ${state.cases.map((item, index) => `
            <button class="list-button ${index === state.selectedCase ? "active" : ""}" data-case-index="${index}">
              <strong>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.tags.join(" · "))}</span>
            </button>`).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>${escapeHtml(selected.id)} · ${escapeHtml(selected.title)}</h2><span class="small">${escapeHtml(selected.tags.join(" · "))}</span></div><span class="tag active">대표 사례</span></div>
        <div class="compare">
          <div class="compare-panel">
            <div class="compare-title"><span>Before · 실패</span><span style="color:var(--coral)">직접 설명</span></div>
            ${caseArt(false)}
            <div class="case-reason">${escapeHtml(selected.before.reason)}</div>
          </div>
          <div class="compare-panel">
            <div class="compare-title"><span>After · 통과</span><span style="color:var(--mint-dark)">감각으로 전달</span></div>
            ${caseArt(true)}
            <div class="case-reason">${escapeHtml(selected.after.reason)}</div>
          </div>
        </div>
        <div class="evidence" style="margin-top:14px"><strong>재사용할 판단</strong><p>${escapeHtml(selected.judgment)}</p></div>
      </section>
    </div>`;
}

function principlesView() {
  const labels = {
    active: "Active",
    watch: "Watch",
    "promotion-candidate": "Promotion",
    retired: "Retired"
  };
  const states = ["active", "watch", "promotion-candidate", "retired"];
  return `
    ${header(
      "Principle Lifecycle",
      "카운트는 후보를 만들고, 미학적 판단은 사례와 사람 승인으로 확정",
      `<button class="button">Thresholds ${state.principles.thresholds.watch} / ${state.principles.thresholds.promotionCandidate} / ${state.principles.thresholds.retirementEpisodes}</button><button class="button primary" data-action="review-principles">Review changes</button>`
    )}
    <div class="page-body">
      <div class="board">
        ${states.map((status) => {
          const items = state.principles.principles.filter((item) => item.state === status);
          return `<section class="column ${status}">
            <div class="column-head"><span>${labels[status]}</span><span class="column-count">${items.length}</span></div>
            ${items.length ? items.map((item) => `
              <article class="ticket">
                <strong>${escapeHtml(item.statement)}</strong>
                <p>${escapeHtml(item.tags.join(" · "))}</p>
                <div class="ticket-meta"><span>${item.caseIds.length} cases</span><span>${escapeHtml(item.humanApproval.status)}</span></div>
              </article>`).join("") : '<div class="empty">현재 항목 없음</div>'}
          </section>`;
        }).join("")}
      </div>
    </div>`;
}

function bootView() {
  return `
    ${header(
      "Session Boot",
      "새 세션에 필요한 기억만 조립하고 작가와 비평가의 입력을 분리",
      '<button class="button" data-action="copy-boot">Copy JSON</button><button class="button primary" data-action="start-session">Start session</button>'
    )}
    <div class="page-body boot-layout">
      <section class="card">
        <div class="card-head"><h2>Selected context</h2><span class="small">${state.boot.representativeCases.length} representative cases</span></div>
        <pre class="code">${escapeHtml(JSON.stringify(state.boot, null, 2))}</pre>
      </section>
      <div class="stack">
        <section class="card agent">
          <h3>Writer Agent · 창작</h3>
          <ul>
            <li>철학, 현재 에피소드, 활성 원칙을 읽는다.</li>
            <li>대표 사례는 참고하되 복제하지 않는다.</li>
            <li>설계 의도와 선택 근거를 별도 기록한다.</li>
          </ul>
        </section>
        <section class="card agent critic">
          <h3>Critic Agent · 독립 판정</h3>
          <ul>
            <li>작가의 설계 의도와 내부 추론은 보지 않는다.</li>
            <li>결과물, 사례, 판정 기준만 읽는다.</li>
            <li>불확실성과 근거 패널을 함께 반환한다.</li>
          </ul>
        </section>
        <section class="card decision">
          <h3>컨텍스트 원칙</h3>
          <p>전체 아카이브는 제외합니다. 현재 WATCH 항목과 대표 사례만 예산 안에서 상속합니다.</p>
        </section>
      </div>
    </div>`;
}

function currentRoute() {
  const route = location.hash.replace("#", "") || "dashboard";
  return routes.has(route) ? route : "dashboard";
}

function render() {
  const route = currentRoute();
  const views = {
    dashboard: dashboardView,
    feedback: feedbackView,
    cases: casesView,
    principles: principlesView,
    boot: bootView
  };
  app.innerHTML = views[route]();
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
  sidebar.classList.remove("open");
}

document.addEventListener("click", async (event) => {
  const routeButton = event.target.closest("[data-route-button]");
  if (routeButton) {
    location.hash = routeButton.dataset.routeButton;
    return;
  }

  const feedbackButton = event.target.closest("[data-feedback-index]");
  if (feedbackButton) {
    state.selectedFeedback = Number(feedbackButton.dataset.feedbackIndex);
    render();
    return;
  }

  const caseButton = event.target.closest("[data-case-index]");
  if (caseButton) {
    state.selectedCase = Number(caseButton.dataset.caseIndex);
    render();
    return;
  }

  const tagButton = event.target.closest("[data-tag]");
  if (tagButton) {
    const selected = state.feedback[state.selectedFeedback];
    selected.tags = selected.tags.includes(tagButton.dataset.tag)
      ? selected.tags.filter((tag) => tag !== tagButton.dataset.tag)
      : [...selected.tags, tagButton.dataset.tag];
    render();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "copy-boot" || action === "export") {
    await navigator.clipboard?.writeText(JSON.stringify(state.boot, null, 2));
    showToast("부팅 컨텍스트를 클립보드에 복사했습니다.");
  } else if (action === "queue-case") {
    localStorage.setItem(
      "cle5-case-queue",
      state.feedback[state.selectedFeedback].id
    );
    showToast("사례 후보로 표시했습니다. 영구 반영은 PR 승인이 필요합니다.");
  } else if (action === "save-feedback") {
    showToast("로컬 초안을 저장했습니다. 원본 데이터는 변경되지 않았습니다.");
  } else if (action === "decision") {
    showToast("결정 기록은 DECISIONS.md PR로 확정됩니다.");
  } else if (action === "review-principles") {
    showToast("현재 승격 후보가 없습니다. WATCH 사례를 더 수집해야 합니다.");
  } else if (action === "new-case") {
    showToast("CASE 템플릿 생성은 Growth Runner 다음 단계에서 연결됩니다.");
  } else if (action === "start-session") {
    showToast("EP-NEXT 부팅 컨텍스트가 준비되었습니다.");
  }
});

document.querySelector("#menu-button").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

window.addEventListener("hashchange", render);

try {
  await loadData();
  render();
} catch (error) {
  console.error(error);
  app.innerHTML = `
    <div class="loading">
      데이터를 불러오지 못했습니다. <code>npm run build</code> 후 웹 서버에서 열어주세요.
    </div>`;
}
