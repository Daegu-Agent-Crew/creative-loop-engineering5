import { analyzeFeedback } from "./feedback-rules.js";

const STORAGE_KEY = "cle5-workspace-v2";
const routes = new Set(["workspace", "history", "memory", "settings"]);
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const sidebar = document.querySelector(".sidebar");

const stageOrder = ["draft", "review", "revision", "learned"];
const stageLabels = {
  draft: "원본 작성",
  review: "피드백 검토",
  revision: "수정본 비교",
  learned: "학습 완료"
};

let store = loadStore();
let workspaceMode = "original";
let selectedWorkId = store.activeWorkId;
let pendingImport = null;

function initialStore() {
  return {
    version: 2,
    activeWorkId: "WORK-001",
    works: [
      {
        id: "WORK-001",
        title: "EP-PILOT · 남겨진 의자",
        intent: "떠난 사람을 직접 보여주지 않고 남겨진 공간으로 그리움을 전달한다.",
        stage: "draft",
        original: "해가 기울 무렵, 주인공은 빈 의자 앞에 멈춘다.\n\n“저무는 태양처럼 우리도 헤어지는구나.”\n\n탁자 위에는 식어버린 차 한 잔이 남아 있다.",
        revision: "",
        feedback: [],
        proposals: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    memory: [
      {
        id: "MEM-001",
        statement: "감정의 이름보다 몸, 거리, 사물의 변화로 전달한다.",
        source: "기본 철학",
        status: "active",
        createdAt: "2026-08-03T00:00:00Z"
      },
      {
        id: "MEM-002",
        statement: "빈 공간도 사건이다. 부재가 공간을 어떻게 바꿨는지 본다.",
        source: "CASE-0002",
        status: "active",
        createdAt: "2026-08-03T00:00:00Z"
      }
    ]
  };
}

function loadStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialStore();
  } catch {
    return initialStore();
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  updateSidebarStatus();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentWork() {
  return store.works.find((work) => work.id === selectedWorkId) ?? store.works[0];
}

function currentRoute() {
  const route = location.hash.replace("#", "") || "workspace";
  return routes.has(route) ? route : "workspace";
}

function updateSidebarStatus() {
  const work = currentWork();
  document.querySelector("#current-work-label").textContent =
    work?.title ?? "작업 없음";
  document.querySelector("#current-stage-label").textContent =
    work ? stageLabels[work.stage] : "새 작업 필요";
  document.querySelector("#memory-count-label").textContent =
    `${store.memory.filter((item) => item.status === "active").length}개의 기억 적용 중`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2300);
}

function pageHeader(title, subtitle, actions = "") {
  return `
    <header class="page-header">
      <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
      <div class="actions">${actions}</div>
    </header>`;
}

function stageRail(work) {
  const activeIndex = stageOrder.indexOf(work.stage);
  return `
    <ol class="stage-rail" aria-label="작업 단계">
      ${stageOrder.map((stage, index) => `
        <li class="${index < activeIndex ? "done" : ""} ${stage === work.stage ? "active" : ""}">
          <span class="stage-marker">${index < activeIndex ? "✓" : index + 1}</span>
          <div><strong>${stageLabels[stage]}</strong><small>${stageDescription(stage)}</small></div>
        </li>`).join("")}
    </ol>`;
}

function stageDescription(stage) {
  return {
    draft: "의도와 원본을 만든다",
    review: "자연어 피드백을 남긴다",
    revision: "원본과 수정본을 비교한다",
    learned: "다음 작업에 적용할 판단을 승인한다"
  }[stage];
}

function workspaceView() {
  const work = currentWork();
  if (!work) {
    return `${pageHeader("Creative Workspace", "작품을 시작하고 경험을 다음 작업으로 연결합니다.")}
      <div class="page-body"><div class="empty-state"><h2>첫 작업을 시작하세요</h2><p>제목과 창작 의도만 있으면 됩니다.</p><button class="button primary" data-action="new-work">새 작업</button></div></div>`;
  }

  const modeTabs = [
    ["original", "원본"],
    ["revision", "수정본"],
    ["compare", "비교"]
  ];

  return `
    ${pageHeader(
      work.title,
      "한 작품 안에서 작성, 피드백, 수정, 학습 승인을 끝냅니다.",
      '<span class="save-state">이 브라우저에 자동 저장</span><button class="button" data-action="new-work">새 작업</button>'
    )}
    <div class="workspace">
      <aside class="stage-panel">
        <div class="section-label">진행 단계</div>
        ${stageRail(work)}
        <div class="memory-applied">
          <div class="section-label">이번 작업에 적용된 기억</div>
          ${store.memory.filter((item) => item.status === "active").slice(0, 3).map((item) =>
            `<p>${escapeHtml(item.statement)}</p>`
          ).join("")}
        </div>
      </aside>

      <section class="editor-panel">
        <div class="work-fields">
          <label>작업 제목<input id="work-title" value="${escapeHtml(work.title)}"></label>
          <label>이번 작품의 의도<textarea id="work-intent" rows="2">${escapeHtml(work.intent)}</textarea></label>
        </div>
        <div class="editor-toolbar">
          <div class="segmented" role="tablist">
            ${modeTabs.map(([mode, label]) =>
              `<button type="button" class="${workspaceMode === mode ? "active" : ""}" data-mode="${mode}">${label}</button>`
            ).join("")}
          </div>
          <div class="editor-actions">${editorActions(work)}</div>
        </div>
        ${editorContent(work)}
      </section>

      <aside class="feedback-panel">
        ${feedbackPanel(work)}
      </aside>
    </div>`;
}

function editorActions(work) {
  if (workspaceMode === "original") {
    return '<button class="button primary" data-action="request-review">피드백 단계로</button>';
  }
  if (workspaceMode === "revision") {
    return `<button class="button" data-action="copy-original">원본에서 다시 시작</button>
      <button class="button primary" data-action="compare">원본과 비교</button>`;
  }
  return '<button class="button primary" data-action="prepare-learning">배울 내용 검토</button>';
}

function editorContent(work) {
  if (workspaceMode === "compare") {
    return `
      <div class="compare-editor">
        <label><span>원본</span><div class="read-document">${formatDocument(work.original)}</div></label>
        <label><span>수정본</span><div class="read-document revision">${formatDocument(work.revision || "수정본이 아직 없습니다.")}</div></label>
      </div>`;
  }

  const value = workspaceMode === "revision" ? work.revision : work.original;
  const field = workspaceMode === "revision" ? "revision" : "original";
  return `
    <label class="document-editor">
      <span>${workspaceMode === "revision" ? "수정본" : "원본"}</span>
      <textarea id="document-content" data-field="${field}" spellcheck="false">${escapeHtml(value)}</textarea>
    </label>`;
}

function formatDocument(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function feedbackPanel(work) {
  const latestProposal = work.proposals.at(-1);
  return `
    <div class="panel-heading">
      <div><span class="section-label">Review</span><h2>피드백</h2></div>
      <span class="feedback-count">${work.feedback.length}</span>
    </div>
    <p class="panel-help">작품을 보고 느낀 점을 평소 말하듯 입력하세요. 시스템이 원인과 다음 행동을 정리합니다.</p>
    <label class="feedback-input">
      <span>무엇이 좋거나 아쉬웠나요?</span>
      <textarea id="feedback-text" rows="5" placeholder="예: 그림이 이미 말하는데 대사가 다시 설명하는 것 같아."></textarea>
    </label>
    <button class="button primary wide" data-action="add-feedback">피드백 반영</button>
    ${latestProposal ? proposalView(latestProposal, work) : feedbackHistory(work)}
  `;
}

function feedbackHistory(work) {
  if (!work.feedback.length) {
    return '<div class="quiet-empty">아직 피드백이 없습니다.<br>원본을 읽고 첫 인상을 남겨보세요.</div>';
  }
  return `
    <div class="feedback-history">
      <span class="section-label">최근 피드백</span>
      ${work.feedback.slice(-3).reverse().map((item) =>
        `<blockquote>${escapeHtml(item.text)}<footer>${escapeHtml(item.tag)}</footer></blockquote>`
      ).join("")}
    </div>`;
}

function proposalView(proposal, work) {
  const approved = store.memory.some((item) => item.source === proposal.id);
  return `
    <section class="learning-proposal ${approved ? "approved" : ""}">
      <div class="proposal-label">${approved ? "기억에 반영됨" : "배울 내용 제안"}</div>
      <strong>${escapeHtml(proposal.learning)}</strong>
      <dl>
        <div><dt>판단</dt><dd>${escapeHtml(proposal.tag)}</dd></div>
        <div><dt>다음 행동</dt><dd>${escapeHtml(proposal.action)}</dd></div>
      </dl>
      ${approved
        ? '<button class="button wide" data-action="view-memory">기억에서 보기</button>'
        : `<div class="proposal-actions">
            <button class="button" data-action="reject-learning" data-proposal-id="${proposal.id}">거절</button>
            <button class="button approve" data-action="approve-learning" data-proposal-id="${proposal.id}">다음 작업에 적용</button>
          </div>`}
    </section>`;
}

function historyView() {
  const works = [...store.works].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `
    ${pageHeader("작업 이력", "완료 여부보다 어떤 피드백과 수정이 남았는지 확인합니다.", '<button class="button primary" data-action="new-work">새 작업</button>')}
    <div class="page-body history-list">
      ${works.map((work) => `
        <button class="history-row" data-work-id="${work.id}">
          <span class="history-stage">${stageLabels[work.stage]}</span>
          <span class="history-main"><strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.intent || "의도 미작성")}</small></span>
          <span class="history-stats">${work.feedback.length} 피드백<br>${work.proposals.length} 학습 제안</span>
          <span class="row-arrow">→</span>
        </button>`).join("")}
    </div>`;
}

function memoryView() {
  const active = store.memory.filter((item) => item.status === "active");
  const rejected = store.memory.filter((item) => item.status === "rejected");
  return `
    ${pageHeader("기억", "승인된 판단만 다음 작품을 시작할 때 자동으로 적용됩니다.", '<button class="button" data-action="export-data">전체 작업 내보내기</button>')}
    <div class="page-body memory-layout">
      <section>
        <div class="memory-header"><div><span class="section-label">Active memory</span><h2>다음 작업에 적용</h2></div><strong>${active.length}</strong></div>
        <div class="memory-list">
          ${active.map((item, index) => `
            <article class="memory-row">
              <span class="memory-index">${String(index + 1).padStart(2, "0")}</span>
              <div><strong>${escapeHtml(item.statement)}</strong><small>${escapeHtml(item.source)}</small></div>
              <button class="icon-button" title="기억 비활성화" aria-label="기억 비활성화" data-action="retire-memory" data-memory-id="${item.id}">×</button>
            </article>`).join("")}
        </div>
      </section>
      <aside class="memory-guide">
        <span class="section-label">원칙</span>
        <h3>기억은 사용자가 승인해야 생깁니다.</h3>
        <p>피드백을 많이 남겼다는 이유만으로 원칙이 자동 생성되지 않습니다. 수정 전후를 비교하고 다음 작업에도 쓸 판단인지 승인한 것만 기억합니다.</p>
        <dl>
          <div><dt>승인된 기억</dt><dd>${active.length}</dd></div>
          <div><dt>거절·비활성</dt><dd>${rejected.length}</dd></div>
          <div><dt>저장 위치</dt><dd>이 브라우저</dd></div>
        </dl>
      </aside>
    </div>`;
}

function settingsView() {
  return `
    ${pageHeader("설정", "계정이나 서버 없이 이 브라우저에서 작업을 보관합니다.")}
    <div class="page-body settings-layout">
      <section class="settings-section">
        <div><h2>데이터 보관</h2><p>현재 작업은 이 브라우저에 자동 저장됩니다. 다른 기기로 옮길 때 파일로 내보내세요.</p></div>
        <div class="settings-actions">
          <button class="button" data-action="export-data">작업 내보내기</button>
          <label class="button file-button">작업 가져오기<input type="file" id="import-file" accept="application/json"></label>
        </div>
      </section>
      <section class="settings-section">
        <div><h2>공개 범위</h2><p>브라우저에 입력한 작품과 피드백은 자동으로 GitHub Pages에 올라가지 않습니다.</p></div>
        <span class="privacy-state">로컬 전용</span>
      </section>
      <section class="settings-section danger-zone">
        <div><h2>초기화</h2><p>현재 브라우저의 작업, 피드백, 승인된 기억을 기본 예제로 되돌립니다.</p></div>
        <button class="button danger" data-action="reset-data">기본 예제로 초기화</button>
      </section>
      ${pendingImport ? '<div class="import-preview">가져올 파일을 확인했습니다. <button class="button primary" data-action="confirm-import">가져오기 확정</button></div>' : ""}
    </div>`;
}

function render() {
  const route = currentRoute();
  const views = {
    workspace: workspaceView,
    history: historyView,
    memory: memoryView,
    settings: settingsView
  };
  app.innerHTML = views[route]();
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
  sidebar.classList.remove("open");
  updateSidebarStatus();
}

function updateWork(field, value) {
  const work = currentWork();
  if (!work) return;
  work[field] = value;
  work.updatedAt = new Date().toISOString();
  saveStore();
}

function createWork() {
  const sequence = Math.max(0, ...store.works.map((work) => Number(work.id.split("-")[1]))) + 1;
  const work = {
    id: `WORK-${String(sequence).padStart(3, "0")}`,
    title: `새 작업 ${sequence}`,
    intent: "",
    stage: "draft",
    original: "",
    revision: "",
    feedback: [],
    proposals: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.works.push(work);
  store.activeWorkId = work.id;
  selectedWorkId = work.id;
  workspaceMode = "original";
  saveStore();
  location.hash = "workspace";
  render();
  requestAnimationFrame(() => document.querySelector("#work-title")?.select());
}

function addFeedback() {
  const input = document.querySelector("#feedback-text");
  const text = input?.value.trim();
  if (!text) {
    showToast("먼저 작품에 대한 피드백을 입력하세요.");
    input?.focus();
    return;
  }
  const work = currentWork();
  const analysis = analyzeFeedback(text);
  const feedbackId = `FB-${Date.now()}`;
  work.feedback.push({
    id: feedbackId,
    text,
    tag: analysis.tag,
    createdAt: new Date().toISOString()
  });
  work.proposals.push({
    id: `PROPOSAL-${Date.now()}`,
    feedbackId,
    tag: analysis.tag,
    learning: analysis.learning,
    action: analysis.action,
    status: "pending"
  });
  work.stage = "review";
  work.updatedAt = new Date().toISOString();
  saveStore();
  render();
  showToast("피드백을 정리했습니다. 수정본에 반영해보세요.");
}

function approveLearning(proposalId) {
  const work = currentWork();
  const proposal = work.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  proposal.status = "approved";
  store.memory.push({
    id: `MEM-${Date.now()}`,
    statement: proposal.learning,
    source: proposal.id,
    status: "active",
    createdAt: new Date().toISOString()
  });
  work.stage = "learned";
  work.updatedAt = new Date().toISOString();
  saveStore();
  render();
  showToast("승인한 판단을 다음 작업의 기억에 반영했습니다.");
}

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cle5-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("현재 작업과 기억을 파일로 내보냈습니다.");
}

document.addEventListener("input", (event) => {
  if (event.target.id === "work-title") updateWork("title", event.target.value);
  if (event.target.id === "work-intent") updateWork("intent", event.target.value);
  if (event.target.id === "document-content") {
    updateWork(event.target.dataset.field, event.target.value);
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id !== "import-file") return;
  try {
    pendingImport = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(pendingImport.works) || !Array.isArray(pendingImport.memory)) {
      throw new Error("invalid workspace");
    }
    render();
  } catch {
    pendingImport = null;
    showToast("CLE5 작업 파일 형식이 아닙니다.");
  }
});

document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    workspaceMode = modeButton.dataset.mode;
    render();
    return;
  }

  const workButton = event.target.closest("[data-work-id]");
  if (workButton) {
    selectedWorkId = workButton.dataset.workId;
    store.activeWorkId = selectedWorkId;
    workspaceMode = "original";
    saveStore();
    location.hash = "workspace";
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  const action = actionButton?.dataset.action;
  if (!action) return;

  const work = currentWork();
  if (action === "new-work") {
    createWork();
  } else if (action === "request-review") {
    work.stage = "review";
    saveStore();
    render();
    requestAnimationFrame(() => document.querySelector("#feedback-text")?.focus());
  } else if (action === "add-feedback") {
    addFeedback();
  } else if (action === "copy-original") {
    work.revision = work.original;
    work.stage = "revision";
    workspaceMode = "revision";
    saveStore();
    render();
  } else if (action === "compare") {
    if (!work.revision.trim()) {
      showToast("수정본을 먼저 작성하세요.");
      return;
    }
    work.stage = "revision";
    workspaceMode = "compare";
    saveStore();
    render();
  } else if (action === "prepare-learning") {
    if (!work.proposals.length) {
      showToast("먼저 피드백을 남겨 배울 내용을 찾으세요.");
      return;
    }
    render();
  } else if (action === "approve-learning") {
    approveLearning(actionButton.dataset.proposalId);
  } else if (action === "reject-learning") {
    const proposal = work.proposals.find((item) => item.id === actionButton.dataset.proposalId);
    if (proposal) proposal.status = "rejected";
    saveStore();
    render();
    showToast("이 판단은 다음 작업에 적용하지 않습니다.");
  } else if (action === "view-memory") {
    location.hash = "memory";
  } else if (action === "retire-memory") {
    const memory = store.memory.find((item) => item.id === actionButton.dataset.memoryId);
    if (memory) memory.status = "rejected";
    saveStore();
    render();
  } else if (action === "export-data") {
    exportData();
  } else if (action === "confirm-import") {
    store = pendingImport;
    selectedWorkId = store.activeWorkId;
    pendingImport = null;
    saveStore();
    location.hash = "workspace";
    render();
    showToast("작업과 기억을 가져왔습니다.");
  } else if (action === "reset-data") {
    if (window.confirm("이 브라우저의 CLE5 작업을 기본 예제로 초기화할까요?")) {
      store = initialStore();
      selectedWorkId = store.activeWorkId;
      workspaceMode = "original";
      saveStore();
      location.hash = "workspace";
      render();
    }
  }
});

document.querySelector("#menu-button").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

window.addEventListener("hashchange", render);
render();
