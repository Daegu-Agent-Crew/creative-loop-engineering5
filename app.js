import { analyzeFeedback } from "./feedback-rules.js";

const STORAGE_KEY = "cle5-workspace-v2";
const routes = new Set(["workspace", "history", "memory", "settings", "agent"]);
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const sidebar = document.querySelector(".sidebar");
const modalRoot = document.querySelector("#modal-root");

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
  const hash = location.hash.replace("#", "") || "workspace";
  const route = hash.startsWith("agent/") ? "agent" : hash;
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
      '<span class="save-state">이 브라우저에 자동 저장</span><button class="button" data-action="import-agent-result">AI 결과 붙여넣기</button><button class="button primary" data-action="open-handoff">AI 에이전트에게 맡기기</button><button class="button" data-action="new-work">새 작업</button>'
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

function encodePacket(packet) {
  const bytes = new TextEncoder().encode(JSON.stringify(packet));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodePacket(encoded) {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function handoffPacket(task, request) {
  const work = currentWork();
  return {
    protocol: "CLE5_AGENT_HANDOFF_V1",
    task,
    request,
    productPurpose:
      "이전 작업의 경험을 기억해 같은 실패를 줄이는 창작 작업실",
    agentRole:
      "당신은 관리자가 아니라 창작자다. 작품을 실제로 쓰고 고치며, 판단 근거를 간결하게 남긴다.",
    work: {
      id: work.id,
      title: work.title,
      intent: work.intent,
      stage: work.stage,
      original: work.original,
      revision: work.revision,
      feedback: work.feedback,
      proposals: work.proposals
    },
    approvedMemory: store.memory
      .filter((item) => item.status === "active")
      .map(({ statement, source }) => ({ statement, source })),
    operatingRules: [
      "승인된 기억은 제약이 아니라 현재 작품을 더 정확히 만들기 위한 경험으로 사용한다.",
      "기존 문장을 기계적으로 복제하지 않는다.",
      "피드백과 창작 의도가 충돌하면 충돌을 명시하고 작품의 가치를 우선해 판단한다.",
      "결과물은 아래 CLE5 반환 형식으로 끝낸다."
    ],
    returnFormat: {
      contentStart: "---CLE5-CONTENT-START---",
      contentEnd: "---CLE5-CONTENT-END---",
      noteStart: "---CLE5-NOTE-START---",
      noteEnd: "---CLE5-NOTE-END---",
      memoryStart: "---CLE5-MEMORY-START---",
      memoryEnd: "---CLE5-MEMORY-END---"
    }
  };
}

function openHandoffModal() {
  const work = currentWork();
  const suggestedTask = !work.original.trim()
    ? "초안 작성"
    : work.feedback.length
      ? "피드백을 반영한 수정본 작성"
      : "작품 검토와 개선";
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
        <div class="modal-head">
          <div><span class="section-label">Agent handoff</span><h2 id="handoff-title">AI 에이전트에게 창작 맡기기</h2></div>
          <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
        </div>
        <p class="modal-help">Codex, Claude, OpenClaw 등 브라우저나 URL을 읽을 수 있는 에이전트에게 아래 링크를 전달하세요. 작품과 승인된 기억은 링크 안에 포함되며 서버에 저장되지 않습니다.</p>
        <label>맡길 작업
          <select id="handoff-task">
            ${["초안 작성", "피드백을 반영한 수정본 작성", "작품 검토와 개선", "자유 창작"].map((task) =>
              `<option ${task === suggestedTask ? "selected" : ""}>${task}</option>`
            ).join("")}
          </select>
        </label>
        <label>추가 요청
          <textarea id="handoff-request" rows="4" placeholder="예: 마지막 장면의 여운을 더 길게 만들되 설명 대사는 쓰지 마."></textarea>
        </label>
        <div class="handoff-summary">
          <span>${escapeHtml(work.title)}</span>
          <span>${store.memory.filter((item) => item.status === "active").length}개 기억</span>
          <span>${work.feedback.length}개 피드백</span>
        </div>
        <div id="handoff-link-area"></div>
        <div class="modal-actions">
          <button class="button" data-action="close-modal">취소</button>
          <button class="button primary" data-action="create-handoff-link">공유 링크 만들기</button>
        </div>
      </section>
    </div>`;
}

function createHandoffLink() {
  const task = document.querySelector("#handoff-task").value;
  const request = document.querySelector("#handoff-request").value.trim();
  const packet = handoffPacket(task, request);
  const link = `${location.origin}${location.pathname}#agent/${encodePacket(packet)}`;
  store.pendingHandoff = {
    workId: packet.work.id,
    task,
    createdAt: new Date().toISOString()
  };
  saveStore();
  const area = document.querySelector("#handoff-link-area");
  area.innerHTML = `
    <label>에이전트에게 전달할 링크
      <textarea id="handoff-link" rows="3" readonly>${escapeHtml(link)}</textarea>
    </label>
    <button class="button approve wide" data-action="copy-handoff-link">링크 복사</button>
    <p class="link-warning">링크에는 현재 작품과 기억이 포함됩니다. 신뢰하는 에이전트에게만 전달하세요.</p>`;
}

function agentView() {
  let packet;
  try {
    packet = decodePacket(location.hash.split("/").slice(1).join("/"));
  } catch {
    return `
      ${pageHeader("Agent Brief를 열 수 없습니다", "링크가 잘렸거나 올바른 CLE5 Handoff 링크가 아닙니다.")}
      <div class="page-body"><div class="empty-state"><a class="button primary" href="#workspace">Workspace로 돌아가기</a></div></div>`;
  }

  const feedback = packet.work.feedback ?? [];
  return `
    ${pageHeader(
      "CLE5 Agent Brief",
      "이 화면의 모든 내용을 읽고 창작자 역할을 수행하세요.",
      '<button class="button" data-action="copy-agent-brief">Brief 복사</button>'
    )}
    <div class="agent-brief" id="agent-brief">
      <section class="agent-mission">
        <span class="section-label">Mission</span>
        <h2>${escapeHtml(packet.task)}</h2>
        <p>${escapeHtml(packet.request || "추가 요청 없음. 작품의 의도와 피드백, 승인된 기억을 바탕으로 최선의 결과를 만든다.")}</p>
      </section>
      <section class="brief-section">
        <span class="section-label">Creative role</span>
        <h3>${escapeHtml(packet.agentRole)}</h3>
        <p>${escapeHtml(packet.productPurpose)}</p>
      </section>
      <section class="brief-section">
        <span class="section-label">Work</span>
        <h3>${escapeHtml(packet.work.title)}</h3>
        <dl class="brief-meta">
          <div><dt>창작 의도</dt><dd>${escapeHtml(packet.work.intent || "미작성")}</dd></div>
          <div><dt>현재 단계</dt><dd>${escapeHtml(stageLabels[packet.work.stage] ?? packet.work.stage)}</dd></div>
        </dl>
      </section>
      <div class="brief-documents">
        <section class="brief-section">
          <span class="section-label">Original</span>
          <div class="brief-document">${formatDocument(packet.work.original || "원본 없음")}</div>
        </section>
        <section class="brief-section">
          <span class="section-label">Current revision</span>
          <div class="brief-document">${formatDocument(packet.work.revision || "수정본 없음")}</div>
        </section>
      </div>
      <section class="brief-section">
        <span class="section-label">Human feedback</span>
        ${feedback.length
          ? `<div class="brief-list">${feedback.map((item) =>
              `<blockquote>“${escapeHtml(item.text)}”<footer>${escapeHtml(item.tag)}</footer></blockquote>`
            ).join("")}</div>`
          : '<p>아직 사람 피드백이 없습니다.</p>'}
      </section>
      <section class="brief-section memory-brief">
        <span class="section-label">Approved memory</span>
        <ol>${packet.approvedMemory.map((item) =>
          `<li>${escapeHtml(item.statement)}<small>${escapeHtml(item.source)}</small></li>`
        ).join("")}</ol>
      </section>
      <section class="brief-section">
        <span class="section-label">Operating rules</span>
        <ul class="rule-list">${packet.operatingRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>
      </section>
      <section class="return-contract">
        <span class="section-label">Return contract</span>
        <h3>최종 응답의 마지막에 아래 형식을 그대로 사용하세요.</h3>
        <pre>---CLE5-CONTENT-START---
[완성한 초안 또는 수정본]
---CLE5-CONTENT-END---

---CLE5-NOTE-START---
[무엇을 판단했고 왜 그렇게 했는지 3~5문장]
---CLE5-NOTE-END---

---CLE5-MEMORY-START---
[다음 작업에도 재사용할 가치가 있는 판단 한 문장. 없으면 없음]
---CLE5-MEMORY-END---</pre>
      </section>
    </div>`;
}

function openAgentResultModal() {
  const target = store.pendingHandoff?.task?.includes("초안") ? "original" : "revision";
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div class="modal-head">
          <div><span class="section-label">Agent result</span><h2 id="result-title">AI 에이전트 결과 가져오기</h2></div>
          <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
        </div>
        <p class="modal-help">에이전트의 전체 응답을 그대로 붙여넣으세요. CLE5 표시가 있으면 작품, 판단 근거, 기억 제안을 자동으로 분리합니다.</p>
        <label>반영 위치
          <select id="result-target">
            <option value="original" ${target === "original" ? "selected" : ""}>원본</option>
            <option value="revision" ${target === "revision" ? "selected" : ""}>수정본</option>
          </select>
        </label>
        <label>에이전트 응답
          <textarea id="agent-result" rows="13" placeholder="Codex, Claude, OpenClaw의 응답 전체를 붙여넣으세요."></textarea>
        </label>
        <div class="modal-actions">
          <button class="button" data-action="close-modal">취소</button>
          <button class="button primary" data-action="apply-agent-result">Workspace에 반영</button>
        </div>
      </section>
    </div>`;
}

function extractMarked(text, name) {
  const start = `---CLE5-${name}-START---`;
  const end = `---CLE5-${name}-END---`;
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) return "";
  return text.slice(startIndex + start.length, endIndex).trim();
}

function applyAgentResult() {
  const response = document.querySelector("#agent-result").value.trim();
  if (!response) {
    showToast("에이전트 응답을 붙여넣으세요.");
    return;
  }
  const target = document.querySelector("#result-target").value;
  const content = extractMarked(response, "CONTENT") || response;
  const note = extractMarked(response, "NOTE");
  const memory = extractMarked(response, "MEMORY");
  const work = currentWork();
  work[target] = content;
  work.stage = target === "revision" ? "revision" : "draft";
  work.updatedAt = new Date().toISOString();
  if (note) {
    work.feedback.push({
      id: `AGENT-${Date.now()}`,
      text: note,
      tag: "에이전트 판단",
      createdAt: new Date().toISOString()
    });
  }
  if (memory && memory !== "없음") {
    work.proposals.push({
      id: `PROPOSAL-${Date.now()}`,
      feedbackId: work.feedback.at(-1)?.id ?? null,
      tag: "에이전트 제안",
      learning: memory,
      action: "수정 결과를 확인한 뒤 다음 작업 적용 여부를 결정한다.",
      status: "pending"
    });
  }
  workspaceMode = target === "revision" ? "compare" : "original";
  delete store.pendingHandoff;
  saveStore();
  modalRoot.innerHTML = "";
  render();
  showToast("에이전트 결과를 Workspace에 반영했습니다.");
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
    settings: settingsView,
    agent: agentView
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
  if (event.target.classList.contains("modal-backdrop")) {
    modalRoot.innerHTML = "";
    return;
  }

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
  if (action === "open-handoff") {
    openHandoffModal();
  } else if (action === "create-handoff-link") {
    createHandoffLink();
  } else if (action === "copy-handoff-link") {
    navigator.clipboard?.writeText(document.querySelector("#handoff-link").value);
    showToast("에이전트에게 전달할 링크를 복사했습니다.");
  } else if (action === "import-agent-result") {
    openAgentResultModal();
  } else if (action === "apply-agent-result") {
    applyAgentResult();
  } else if (action === "copy-agent-brief") {
    navigator.clipboard?.writeText(document.querySelector("#agent-brief").innerText);
    showToast("Agent Brief 전체를 복사했습니다.");
  } else if (action === "close-modal") {
    modalRoot.innerHTML = "";
  } else if (action === "new-work") {
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
