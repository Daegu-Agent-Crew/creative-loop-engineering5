import { analyzeFeedback } from "./feedback-rules.js";
import {
  createGitHubSyncClient,
  GitHubApiError,
  parseRepository,
  resolveWriteSha,
  validateWorkspace
} from "./github-sync.js";
import {
  activeComicEpisode,
  activeComicProject,
  addComicArtifact,
  approvePanelMemory,
  buildGenerationRequest,
  comicHandoffPacket,
  comicPublishReadiness,
  comicStageLabels,
  comicStages,
  createComicEpisode,
  createComicProject,
  ensureComicWorkspace,
  installThreeBodyPilot,
  parseComicAgentResult,
  selectPanelCandidate,
  setComicStage,
  updatePanelQa
} from "./comic-core.js";

const STORAGE_KEY = "cle5-workspace-v2";
const GITHUB_SETTINGS_KEY = "cle5-github-settings-v1";
const GITHUB_SYNC_META_KEY = "cle5-github-sync-meta-v1";
const routes = new Set(["comic", "workspace", "history", "memory", "settings", "agent", "reader"]);
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

let store = ensureComicWorkspace(loadStore());
let workspaceMode = "original";
let comicViewStage = activeComicEpisode(store)?.stage || "structure";
let selectedWorkId = store.activeWorkId;
let pendingImport = null;
let githubSettings = loadGitHubSettings();
let githubSyncMeta = loadJsonStorage(GITHUB_SYNC_META_KEY, {});
let githubStatus = {
  state: githubSettings.token ? "saved" : "disconnected",
  message: githubSettings.token
    ? "설정이 이 브라우저에 저장되어 있습니다."
    : "아직 GitHub 저장소를 연결하지 않았습니다."
};
let githubBusy = false;

function initialStore() {
  return ensureComicWorkspace({
    version: 3,
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
  });
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

function loadJsonStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function loadGitHubSettings() {
  return {
    repository: "Daegu-Agent-Crew/creative-loop-engineering5-private",
    branch: "main",
    path: "workspace/cle5-workspace.json",
    token: "",
    ...loadJsonStorage(GITHUB_SETTINGS_KEY, {})
  };
}

function saveGitHubSettings(settings) {
  const previousTarget = [
    githubSettings.repository,
    githubSettings.branch,
    githubSettings.path
  ].join(":");
  const nextTarget = [settings.repository, settings.branch, settings.path].join(":");
  githubSettings = settings;
  localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(githubSettings));
  if (previousTarget !== nextTarget) {
    githubSyncMeta = {};
    localStorage.removeItem(GITHUB_SYNC_META_KEY);
  }
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
  const hash = location.hash.replace("#", "") || "comic";
  const route = hash.startsWith("agent/") ? "agent" : hash.startsWith("reader/") ? "reader" : hash;
  return routes.has(route) ? route : "workspace";
}

function updateSidebarStatus() {
  if (currentRoute() === "comic" || currentRoute() === "reader") {
    const project = activeComicProject(store);
    const episode = activeComicEpisode(store);
    document.querySelector("#current-work-label").textContent = project?.title ?? "만화 프로젝트 없음";
    document.querySelector("#current-stage-label").textContent = episode
      ? `${episode.id} · ${comicStageLabels[episode.stage]}`
      : "에피소드 필요";
    document.querySelector("#memory-count-label").textContent =
      `${store.memory.filter((item) => item.status === "active" && item.scope?.type === "comic-panel").length}개의 패널 기억`;
    return;
  }
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

  if (packet.protocol === "CLE5_COMIC_AGENT_HANDOFF_V1") {
    return comicAgentView(packet);
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

function comicStageDescription(stage) {
  return {
    structure: "스토리·캐릭터·콘티",
    production: "이미지 산출물·패널",
    review: "후보 선택·패널 QA",
    publish: "발행 게이트·세로 뷰어"
  }[stage];
}

function comicStageRail(episode) {
  const activeIndex = comicStages.indexOf(episode.stage);
  return `<ol class="stage-rail comic-stage-rail" aria-label="만화 제작 단계">
    ${comicStages.map((stage, index) => `
      <li class="${index < activeIndex ? "done" : ""} ${stage === comicViewStage ? "active" : ""}">
        <button class="stage-link" data-action="view-comic-stage" data-stage="${stage}">
          <span class="stage-marker">${index < activeIndex ? "✓" : index + 1}</span>
          <span><strong>${comicStageLabels[stage]}</strong><small>${comicStageDescription(stage)}</small></span>
        </button>
      </li>`).join("")}
  </ol>`;
}

function comicNextAction(episode) {
  const readiness = comicPublishReadiness(episode);
  if (episode.stage === "structure") return { title: "구성을 완성하세요", detail: "스토리, 캐릭터와 첫 콘티를 준비합니다.", action: "advance-comic-stage", label: "제작 단계로" };
  if (episode.stage === "production") return { title: "패널 산출물을 등록하세요", detail: "AI 에이전트에게 이미지를 맡기거나 결과 URL을 등록합니다.", action: "open-comic-handoff", label: "AI 에이전트에게 맡기기" };
  if (episode.stage === "review") {
    const waiting = episode.panels.filter((panel) => !panel.review).length;
    return waiting
      ? { title: `후보 선택 ${waiting}건 남음`, detail: "승인한 후보와 선택 근거만 다음 작업에 기억됩니다.", action: "focus-comic-review", label: "후보 검토" }
      : { title: "패널 QA를 완료하세요", detail: readiness.issues.join(" · ") || "모든 검수를 통과했습니다.", action: "advance-comic-stage", label: "발행 확인" };
  }
  return readiness.ready
    ? { title: "발행 준비 완료", detail: "최종 세로 만화를 확인합니다.", action: "publish-comic", label: "에피소드 발행" }
    : { title: "발행 전 확인 필요", detail: readiness.issues.join(" · "), action: "view-comic-stage", label: "검토로 돌아가기", stage: "review" };
}

function comicView() {
  const project = activeComicProject(store);
  const episode = activeComicEpisode(store);
  if (!project || !episode) {
    return `${pageHeader("Comic Workspace", "CLE5 안에서 연재 만화를 구성하고 제작합니다.", '<button class="button primary" data-action="new-comic-project">새 만화 프로젝트</button>')}
      <div class="page-body"><div class="empty-state"><h2>첫 만화 프로젝트를 시작하세요</h2><p>제목과 창작 목적만 있으면 됩니다.</p><button class="button primary" data-action="new-comic-project">새 만화 프로젝트</button></div></div>`;
  }
  const next = comicNextAction(episode);
  const selectedCount = episode.panels.filter((panel) => panel.review?.humanApproved).length;
  const approvedCount = episode.panels.filter((panel) => panel.status === "approved").length;
  return `
    ${pageHeader(
      `${project.title} · ${episode.title}`,
      "현재 단계와 다음 결정에 집중하고, 제작 데이터는 CLE5가 내부에서 관리합니다.",
      '<span class="save-state">이 브라우저에 자동 저장</span><button class="button" data-action="install-three-body-pilot">삼체 EP001 시작</button><button class="button" data-action="open-comic-result">AI 결과 붙여넣기</button><button class="button primary" data-action="open-comic-handoff">AI 에이전트에게 맡기기</button><button class="button" data-action="new-comic-episode">새 에피소드</button>'
    )}
    <div class="comic-shell">
      <aside class="comic-sidebar">
        <div class="section-label">에피소드</div>
        <select id="comic-project-select" aria-label="만화 프로젝트">
          ${store.comicProjects.map((item) => `<option value="${item.id}" ${item.id === project.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
        </select>
        <div class="episode-switcher">
          ${project.episodes.map((item) => `<button class="episode-chip ${item.id === episode.id ? "active" : ""}" data-action="select-comic-episode" data-episode-id="${item.id}"><strong>${escapeHtml(item.id)}</strong><span>${escapeHtml(item.title)}</span></button>`).join("")}
        </div>
        <div class="section-label stage-label">진행 단계</div>
        ${comicStageRail(episode)}
      </aside>
      <main class="comic-main">
        <section class="next-action-band">
          <div><span class="section-label">Next action</span><h2>${escapeHtml(next.title)}</h2><p>${escapeHtml(next.detail)}</p></div>
          <button class="button primary" data-action="${next.action}" ${next.stage ? `data-stage="${next.stage}"` : ""}>${escapeHtml(next.label)}</button>
        </section>
        <div class="comic-stats">
          <div><strong>${episode.storyboard.length}</strong><span>콘티</span></div>
          <div><strong>${episode.panels.length}</strong><span>패널</span></div>
          <div><strong>${selectedCount}</strong><span>선택</span></div>
          <div><strong>${approvedCount}</strong><span>QA 승인</span></div>
        </div>
        ${comicStageContent(project, episode)}
      </main>
    </div>`;
}

function comicStageContent(project, episode) {
  if (comicViewStage === "structure") return comicStructureStage(episode);
  if (comicViewStage === "production") return comicProductionStage(episode);
  if (comicViewStage === "review") return comicReviewStage(project, episode);
  return comicPublishStage(project, episode);
}

function comicStructureStage(episode) {
  return `<section class="comic-stage-content">
    <div class="stage-heading"><div><span class="section-label">01 · Structure</span><h2>에피소드 구성</h2></div><button class="button" data-action="open-comic-artifact">산출물 등록</button></div>
    <div class="comic-form-grid">
      <label>에피소드 제목<input id="comic-episode-title" value="${escapeHtml(episode.title)}"></label>
      <label>한 줄 이야기<input id="comic-episode-logline" value="${escapeHtml(episode.logline)}"></label>
      <label class="full">스토리<textarea id="comic-episode-story" rows="8">${escapeHtml(episode.story)}</textarea></label>
    </div>
    <div class="artifact-section">
      <div class="section-head"><div><span class="section-label">Characters</span><h3>캐릭터</h3></div><span>${episode.characters.length}</span></div>
      <div class="character-strip">
        ${episode.characters.length ? episode.characters.map((character) => `<article class="character-tile">
          ${character.imageUrl ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapeHtml(character.name)} 캐릭터 시트">` : '<div class="asset-placeholder">이미지 없음</div>'}
          <div><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.role)}</small><p>${escapeHtml(character.description)}</p></div>
        </article>`).join("") : '<div class="quiet-empty">등록된 캐릭터가 없습니다.</div>'}
      </div>
    </div>
    <div class="artifact-section">
      <div class="section-head"><div><span class="section-label">Storyboard</span><h3>콘티</h3></div><span>${episode.storyboard.length}</span></div>
      <div class="storyboard-list">
        ${episode.storyboard.length ? episode.storyboard.map((shot) => `<article><span>${String(shot.order).padStart(2, "0")}</span><div><strong>${escapeHtml(shot.description)}</strong><small>${escapeHtml(shot.camera)} · ${shot.characters.length}명</small></div></article>`).join("") : '<div class="quiet-empty">Agent Handoff 또는 산출물 등록으로 첫 콘티를 추가하세요.</div>'}
      </div>
    </div>
  </section>`;
}

function comicProductionStage(episode) {
  return `<section class="comic-stage-content">
    <div class="stage-heading"><div><span class="section-label">02 · Production</span><h2>패널 제작</h2></div><div class="actions"><button class="button" data-action="open-comic-artifact">산출물 등록</button><button class="button primary" data-action="open-comic-handoff">이미지 생성 맡기기</button></div></div>
    <div class="production-reference-strip">
      ${episode.characters.map((character) => `<div>${character.imageUrl ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapeHtml(character.name)}">` : ""}<span>${escapeHtml(character.name)}</span></div>`).join("")}
    </div>
    <div class="panel-production-list">
      ${episode.panels.length ? episode.panels.map((panel) => `<article class="production-panel-row">
        <div class="panel-order">${String(panel.order).padStart(2, "0")}</div>
        <div class="production-thumb">${panel.imageUrl ? `<img src="${escapeHtml(panel.imageUrl)}" alt="${escapeHtml(panel.id)}">` : panel.candidates?.[0]?.imageUrl ? `<img src="${escapeHtml(panel.candidates[0].imageUrl)}" alt="${escapeHtml(panel.id)} 후보">` : '<div class="asset-placeholder">생성 대기</div>'}</div>
        <div><strong>${escapeHtml(panel.description)}</strong><p>${escapeHtml(panel.dialogue || "대사 없음")}</p><small>${escapeHtml(panel.status)}</small></div>
        <button class="button" data-action="view-comic-stage" data-stage="review">검토</button>
      </article>`).join("") : '<div class="empty-state compact-empty"><h3>패널이 아직 없습니다</h3><p>콘티를 기준으로 AI 에이전트에게 패널 제작을 맡기세요.</p><button class="button primary" data-action="open-comic-handoff">이미지 생성 맡기기</button></div>'}
    </div>
  </section>`;
}

function comicReviewStage(project, episode) {
  return `<section class="comic-stage-content" id="comic-review-stage">
    <div class="stage-heading"><div><span class="section-label">03 · Review</span><h2>후보 선택과 패널 QA</h2></div><span class="review-rule">사람이 승인한 결과만 기억</span></div>
    ${episode.panels.length ? episode.panels.map((panel) => comicPanelReview(project, episode, panel)).join("") : '<div class="quiet-empty">검토할 패널이 없습니다.</div>'}
  </section>`;
}

function comicPanelReview(project, episode, panel) {
  const selectedId = panel.review?.candidateId;
  const memory = store.memory.find((item) => item.source === `${project.id}/${episode.id}/${panel.id}`);
  return `<article class="comic-review-card">
    <div class="review-card-head"><div><span class="section-label">${escapeHtml(panel.id)}</span><h3>${escapeHtml(panel.description)}</h3></div><span class="review-status ${panel.status}">${escapeHtml(panel.status)}</span></div>
    ${panel.candidates?.length ? `<div class="candidate-grid">
      ${panel.candidates.map((candidate) => `<figure class="candidate ${candidate.id === selectedId ? "selected" : ""}">
        <div class="candidate-label">후보 ${escapeHtml(candidate.label)}</div>
        <img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(panel.id)} 후보 ${escapeHtml(candidate.label)}">
        ${panel.review ? `<figcaption>${escapeHtml(candidate.note || "")}</figcaption>` : ""}
      </figure>`).join("")}
    </div>
    <textarea class="review-reason" id="review-reason-${panel.id}" rows="3" placeholder="선택 근거 또는 재생성 진단">${escapeHtml(panel.review?.reason || "")}</textarea>
    <div class="candidate-actions">
      ${panel.candidates.map((candidate) => `<button class="button ${candidate.id === selectedId ? "approve" : ""}" data-action="select-comic-candidate" data-panel-id="${panel.id}" data-candidate-id="${candidate.id}">${escapeHtml(candidate.label)} 선택</button>`).join("")}
      <button class="button" data-action="hold-comic-candidates" data-panel-id="${panel.id}">동점</button>
      <button class="button danger" data-action="reject-comic-candidates" data-panel-id="${panel.id}">모두 탈락</button>
    </div>` : `<div class="single-panel-preview">${panel.imageUrl ? `<img src="${escapeHtml(panel.imageUrl)}" alt="${escapeHtml(panel.id)}">` : '<div class="asset-placeholder">이미지 없음</div>'}</div>`}
    ${panel.review ? `<section class="panel-qa-box">
      <div><span class="section-label">Panel QA</span><strong>${panel.qa.approved ? "통과" : "검토 중"}</strong></div>
      <div class="qa-check-grid">
        ${[["composition", "구도"], ["character", "캐릭터"], ["continuity", "연속성"], ["text", "대사 분리"]].map(([key, label]) => `<label>${label}<select id="qa-${panel.id}-${key}"><option value="pending" ${panel.qa[key] === "pending" ? "selected" : ""}>미확인</option><option value="pass" ${panel.qa[key] === "pass" ? "selected" : ""}>통과</option><option value="fail" ${panel.qa[key] === "fail" ? "selected" : ""}>수정</option></select></label>`).join("")}
      </div>
      <div class="qa-actions"><button class="button" data-action="save-comic-qa" data-panel-id="${panel.id}">QA 저장</button>${panel.review.humanApproved ? `<button class="button approve" data-action="approve-comic-memory" data-panel-id="${panel.id}" ${memory ? "disabled" : ""}>${memory ? "기억 승인됨" : "판단을 기억"}</button>` : ""}</div>
    </section>` : ""}
  </article>`;
}

function comicPublishStage(project, episode) {
  const readiness = comicPublishReadiness(episode);
  return `<section class="comic-stage-content">
    <div class="stage-heading"><div><span class="section-label">04 · Publish</span><h2>발행</h2></div><a class="button" href="#reader/${project.id}/${episode.id}">독자 화면 미리보기</a></div>
    <div class="publish-gate ${readiness.ready ? "ready" : "blocked"}">
      <div><span class="section-label">Release gate</span><h3>${readiness.ready ? "발행 준비 완료" : "아직 발행할 수 없습니다"}</h3><p>${readiness.ready ? `승인 패널 ${readiness.total}개가 준비됐습니다.` : readiness.issues.join(" · ")}</p></div>
      <button class="button ${readiness.ready ? "approve" : ""}" data-action="publish-comic" ${readiness.ready ? "" : "disabled"}>${episode.publish.status === "published" ? "발행됨" : "에피소드 발행"}</button>
    </div>
    <div class="publish-form">
      <label>발행 제목<input id="comic-publish-title" value="${escapeHtml(episode.publish.title)}"></label>
      <label>소개<textarea id="comic-publish-summary" rows="3">${escapeHtml(episode.publish.summary)}</textarea></label>
    </div>
    ${comicReaderPanels(episode, false)}
  </section>`;
}

function comicReaderPanels(episode, readerMode) {
  const panels = [...episode.panels].filter((panel) => panel.imageUrl && (panel.status === "approved" || !readerMode)).sort((a, b) => a.order - b.order);
  return `<div class="comic-reader ${readerMode ? "reader-mode" : "preview-mode"}">
    ${panels.length ? panels.map((panel) => `<figure><img src="${escapeHtml(panel.imageUrl)}" alt="${escapeHtml(panel.description)}">${panel.dialogue ? `<figcaption>${escapeHtml(panel.dialogue)}</figcaption>` : ""}</figure>`).join("") : '<div class="quiet-empty">승인된 패널이 없습니다.</div>'}
  </div>`;
}

function readerView() {
  const [, projectId, episodeId] = location.hash.replace("#", "").split("/");
  const project = store.comicProjects.find((item) => item.id === projectId) || activeComicProject(store);
  const episode = project?.episodes.find((item) => item.id === episodeId) || project?.episodes[0];
  if (!project || !episode) return `${pageHeader("만화를 찾을 수 없습니다", "CLE5 Comic Workspace에서 발행 상태를 확인하세요.")}`;
  return `<div class="reader-page">
    <header><a href="#comic">CLE5</a><span>${escapeHtml(project.title)}</span></header>
    <section class="reader-title"><span>${escapeHtml(episode.id)}</span><h1>${escapeHtml(episode.publish.title)}</h1><p>${escapeHtml(episode.publish.summary)}</p></section>
    ${comicReaderPanels(episode, true)}
    <footer>Created and approved in CLE5</footer>
  </div>`;
}

function openNewComicProjectModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="section-label">New comic</span><h2>만화 프로젝트 만들기</h2></div><button class="icon-button" data-action="close-modal">×</button></div><label>프로젝트 제목<input id="new-comic-title" placeholder="예: 별을 기다리는 사람들"></label><label>창작 목적<textarea id="new-comic-purpose" rows="4" placeholder="이 만화가 독자에게 남길 경험"></textarea></label><div class="modal-actions"><button class="button" data-action="close-modal">취소</button><button class="button primary" data-action="create-comic-project">프로젝트 생성</button></div></section></div>`;
}

function openNewComicEpisodeModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="section-label">New episode</span><h2>에피소드 추가</h2></div><button class="icon-button" data-action="close-modal">×</button></div><label>에피소드 제목<input id="new-episode-title" placeholder="예: 첫 번째 신호"></label><label>한 줄 이야기<input id="new-episode-logline" placeholder="누가 무엇을 발견하는가"></label><div class="modal-actions"><button class="button" data-action="close-modal">취소</button><button class="button primary" data-action="create-comic-episode">에피소드 생성</button></div></section></div>`;
}

function openComicArtifactModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="section-label">Artifact</span><h2>산출물 등록</h2></div><button class="icon-button" data-action="close-modal">×</button></div><label>종류<select id="artifact-type"><option value="character">캐릭터</option><option value="storyboard">콘티</option><option value="panel">패널</option><option value="reference">레퍼런스</option></select></label><label>이름<input id="artifact-label" placeholder="예: 미나 캐릭터 시트"></label><label>이미지 URL 또는 CLE5 경로<input id="artifact-url" placeholder="https://... 또는 ./assets/..."></label><label>설명<textarea id="artifact-note" rows="4"></textarea></label><div class="modal-actions"><button class="button" data-action="close-modal">취소</button><button class="button primary" data-action="register-comic-artifact">등록</button></div></section></div>`;
}

function openComicHandoffModal() {
  const episode = activeComicEpisode(store);
  const suggested = episode.stage === "structure" ? "스토리와 콘티 구성" : episode.stage === "production" ? "패널 이미지 후보 생성" : episode.stage === "review" ? "패널 비평과 개선" : "발행본 검수";
  const panelOptions = episode.panels.map((panel) => `<option value="${escapeHtml(panel.id)}">${escapeHtml(panel.id)} · ${escapeHtml(panel.description)}</option>`).join("");
  const referenceIds = [...episode.characters.map((item) => item.id), ...episode.artifacts.map((item) => item.id)].join(", ");
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal wide-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="section-label">Comic agent handoff</span><h2>AI 에이전트에게 만화 작업 맡기기</h2></div><button class="icon-button" data-action="close-modal">×</button></div><p class="modal-help">CLE5의 프로젝트, 에피소드, 참조 이미지, 승인 기억과 결과 저장 계약을 하나의 링크로 전달합니다.</p><label>맡길 작업<select id="comic-handoff-task">${["스토리와 콘티 구성", "캐릭터 시트 생성", "패널 이미지 후보 생성", "패널 비평과 개선", "발행본 검수"].map((task) => `<option ${task === suggested ? "selected" : ""}>${task}</option>`).join("")}</select></label><label>추가 요청<textarea id="comic-handoff-request" rows="3" placeholder="예: PANEL-001 후보를 두 장 만들고 CLE5 경로를 반환해줘."></textarea></label><section class="generation-card-form"><span class="section-label">Generation request card</span><p>이미지 생성에서는 고정 기준은 유지하고 이번 컷의 변화만 지정합니다. 이 값은 Agent Brief와 결과 증거에 함께 보존됩니다.</p><label>대상 패널<select id="generation-panel-id"><option value="">패널을 선택하지 않음</option>${panelOptions}</select></label><label>고정 기준 (Bible/레퍼런스 ID, 쉼표로 구분)<input id="generation-reference-ids" value="${escapeHtml(referenceIds)}" placeholder="CHAR-WANG, ASSET-LAB-V1"></label><div class="generation-card-grid"><label>이전 상태<textarea id="generation-previous-state" rows="3" placeholder="인물 위치, 감정, 소품, 시간대"></textarea></label><label>이번 변화 (Delta)<textarea id="generation-delta" rows="3" placeholder="이번 컷에서만 일어나는 행동·표정·사건"></textarea></label><label>카메라<input id="generation-camera" placeholder="over-the-shoulder, monitor 60%"></label><label>서사 목적<select id="generation-narrative"><option value="information">정보</option><option value="emotion">감정</option><option value="action">행동</option><option value="question">의문</option><option value="reversal">반전</option><option value="transition">전환</option><option value="spectacle">스펙터클</option></select></label><label>중요도<select id="generation-tier"><option value="A">A · 핵심 장면</option><option value="B" selected>B · 일반 장면</option><option value="C">C · 전환/삽입</option></select></label><label>후보 수<select id="generation-candidate-count"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option></select></label></div></section><div id="comic-handoff-link-area"></div><div class="modal-actions"><button class="button" data-action="close-modal">취소</button><button class="button primary" data-action="create-comic-handoff-link">공유 링크 만들기</button></div></section></div>`;
}

function createComicHandoffLink() {
  const project = activeComicProject(store);
  const episode = activeComicEpisode(store);
  const task = document.querySelector("#comic-handoff-task").value;
  const request = document.querySelector("#comic-handoff-request").value.trim();
  const generationRequest = buildGenerationRequest(episode, {
    panelId: document.querySelector("#generation-panel-id")?.value,
    referenceIds: document.querySelector("#generation-reference-ids")?.value,
    previousState: document.querySelector("#generation-previous-state")?.value,
    delta: document.querySelector("#generation-delta")?.value,
    camera: document.querySelector("#generation-camera")?.value,
    narrativeFunction: document.querySelector("#generation-narrative")?.value,
    qualityTier: document.querySelector("#generation-tier")?.value,
    candidateCount: document.querySelector("#generation-candidate-count")?.value
  });
  episode.generationRequests = episode.generationRequests || [];
  episode.generationRequests.push(generationRequest);
  const packet = comicHandoffPacket(store, project, episode, task, request, generationRequest);
  const link = `${location.origin}${location.pathname}#agent/${encodePacket(packet)}`;
  store.pendingComicHandoff = { projectId: project.id, episodeId: episode.id, task, generationRequestId: generationRequest.id, createdAt: new Date().toISOString() };
  saveStore();
  document.querySelector("#comic-handoff-link-area").innerHTML = `<label>에이전트에게 전달할 링크<textarea id="comic-handoff-link" rows="3" readonly>${escapeHtml(link)}</textarea></label><button class="button approve wide" data-action="copy-comic-handoff-link">링크 복사</button><p class="link-warning">링크에는 작품과 이미지 참조 URL이 포함됩니다.</p>`;
}

function comicAgentView(packet) {
  return `${pageHeader("CLE5 Comic Agent Brief", "요청된 산출물을 실제로 만들고 CLE5 반환 계약을 지키세요.", '<button class="button" data-action="copy-agent-brief">Brief 복사</button>')}
    <div class="agent-brief" id="agent-brief">
      <section class="agent-mission"><span class="section-label">Mission</span><h2>${escapeHtml(packet.task)}</h2><p>${escapeHtml(packet.request || "추가 요청 없음")}</p></section>
      <section class="brief-section"><span class="section-label">Project</span><h3>${escapeHtml(packet.project.title)} · ${escapeHtml(packet.episode.title)}</h3><p>${escapeHtml(packet.project.purpose)}</p><p>${escapeHtml(packet.episode.logline)}</p></section>
      <section class="brief-section"><span class="section-label">Story</span><div class="brief-document">${formatDocument(packet.episode.story || "미작성")}</div></section>
      <div class="brief-documents"><section class="brief-section"><span class="section-label">Characters</span>${packet.episode.characters.map((character) => `<article class="brief-asset"><strong>${escapeHtml(character.name)}</strong><p>${escapeHtml(character.description)}</p><code>${escapeHtml(character.imageUrl || "이미지 없음")}</code></article>`).join("") || "없음"}</section><section class="brief-section"><span class="section-label">Storyboard</span>${packet.episode.storyboard.map((shot) => `<p><strong>${escapeHtml(shot.id)}</strong> ${escapeHtml(shot.description)}</p>`).join("") || "없음"}</section></div>
      <section class="brief-section memory-brief"><span class="section-label">Approved memory</span><ol>${packet.approvedMemory.map((item) => `<li>${escapeHtml(item.statement)}${item.assetUrl ? `<small>${escapeHtml(item.assetUrl)}</small>` : ""}</li>`).join("") || "<li>승인 기억 없음</li>"}</ol></section>
      ${packet.generationRequest ? `<section class="brief-section generation-brief"><span class="section-label">Generation request card</span><dl><div><dt>Target</dt><dd>${escapeHtml(packet.generationRequest.panelId || "미지정")} ${escapeHtml(packet.generationRequest.panelDescription || "")}</dd></div><div><dt>DNA</dt><dd>${escapeHtml(packet.generationRequest.dna.join(", ") || "미지정")}</dd></div><div><dt>Previous state</dt><dd>${escapeHtml(packet.generationRequest.previousState || "미지정")}</dd></div><div><dt>Delta</dt><dd>${escapeHtml(packet.generationRequest.delta || "미지정")}</dd></div><div><dt>Camera</dt><dd>${escapeHtml(packet.generationRequest.camera || "미지정")}</dd></div><div><dt>Narrative</dt><dd>${escapeHtml(packet.generationRequest.narrativeFunction)} · ${escapeHtml(packet.generationRequest.qualityTier)} tier · ${packet.generationRequest.candidateCount} candidates</dd></div></dl></section>` : ""}
      <section class="brief-section"><span class="section-label">Target</span><h3>${escapeHtml(packet.targetRoot)}</h3><ul class="rule-list">${packet.operatingRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></section>
      <section class="return-contract"><span class="section-label">Return contract</span><pre>---CLE5-CONTENT-START---
[스토리·콘티·대사 등 텍스트 결과. 없으면 없음]
---CLE5-CONTENT-END---

---CLE5-ASSETS-START---
[한 줄에 하나: type|target-id|url-or-cle5-path|label]
---CLE5-ASSETS-END---

---CLE5-NOTE-START---
[판단 근거와 불확실성]
---CLE5-NOTE-END---

---CLE5-CRITIC-START---
[DNA 유지, State→Delta 연결, 카메라, 서사 목적, 이미지 오류를 PASS/FIX/REGENERATE로 제안. 사람 QA를 대체하지 않음]
---CLE5-CRITIC-END---

---CLE5-MEMORY-START---
[다음 작업에도 재사용할 판단. 없으면 없음]
---CLE5-MEMORY-END---</pre></section>
    </div>`;
}

function openComicResultModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="section-label">Comic agent result</span><h2>만화 작업 결과 가져오기</h2></div><button class="icon-button" data-action="close-modal">×</button></div><p class="modal-help">에이전트의 전체 응답을 붙여넣으면 텍스트와 산출물 경로를 분리해 현재 에피소드에 등록합니다.</p><label>에이전트 응답<textarea id="comic-agent-result" rows="15"></textarea></label><div class="modal-actions"><button class="button" data-action="close-modal">취소</button><button class="button primary" data-action="apply-comic-result">CLE5에 반영</button></div></section></div>`;
}

function applyComicResult() {
  const response = document.querySelector("#comic-agent-result")?.value.trim();
  if (!response) return showToast("에이전트 응답을 붙여넣으세요.");
  const episode = activeComicEpisode(store);
  const result = parseComicAgentResult(response);
  const { content, note, memory, critic } = result;
  episode.agentResults = episode.agentResults || [];
  episode.agentResults.push({
    id: `AGENT-RESULT-${Date.now()}`,
    rawResponse: result.rawResponse,
    receivedAt: new Date().toISOString(),
    handoff: store.pendingComicHandoff || null,
    sections: { content, assets: result.assets, note, critic, memory },
    warnings: result.warnings
  });
  if (content && content !== "없음") episode.story = content;
  result.assets.filter((asset) => asset.valid).forEach(({ type, targetId, url, label }) => {
    if (type === "panel" && targetId) {
      let panel = episode.panels.find((item) => item.id === targetId);
      if (!panel) {
        panel = { id: targetId, order: episode.panels.length + 1, storyboardId: "", description: label || targetId, dialogue: "", status: "candidates_ready", imageUrl: "", candidates: [], review: null, qa: { composition: "pending", character: "pending", continuity: "pending", text: "pending", approved: false, note: "" } };
        episode.panels.push(panel);
      }
      panel.candidates.push({ id: `CAND-${Date.now()}-${panel.candidates.length + 1}`, label: String.fromCharCode(65 + panel.candidates.length), imageUrl: url, note: label });
      panel.status = "candidates_ready";
    } else {
      addComicArtifact(episode, { type, id: targetId || undefined, label: label || targetId, url, note });
    }
  });
  if (note) episode.reviewHistory.push({ panelId: null, verdict: "agent_note", reason: note, reviewedAt: new Date().toISOString() });
  if (memory && memory !== "없음") {
    const work = currentWork();
    work?.proposals.push({ id: `PROPOSAL-${Date.now()}`, feedbackId: null, tag: "만화 에이전트 제안", learning: memory, action: "결과를 검토한 뒤 기억 적용 여부를 결정한다.", status: "pending" });
  }
  delete store.pendingComicHandoff;
  episode.updatedAt = new Date().toISOString();
  saveStore();
  modalRoot.innerHTML = "";
  comicViewStage = episode.stage;
  render();
  showToast(result.warnings.length
    ? `원문을 보존하고 결과를 반영했습니다. 형식 경고 ${result.warnings.length}건을 검토하세요.`
    : "만화 작업 결과를 현재 에피소드에 반영했습니다.");
}

function settingsView() {
  const statusClass = ["connected", "working"].includes(githubStatus.state)
    ? "connected"
    : githubStatus.state === "error"
      ? "error"
      : "";
  return `
    ${pageHeader("설정", "브라우저에 자동 저장하고 필요할 때 GitHub에 명시적으로 동기화합니다.")}
    <div class="page-body settings-layout">
      <section class="settings-section">
        <div><h2>데이터 보관</h2><p>현재 작업은 이 브라우저에 자동 저장됩니다. 다른 기기로 옮길 때 파일로 내보내세요.</p></div>
        <div class="settings-actions">
          <button class="button" data-action="export-data">작업 내보내기</button>
          <label class="button file-button">작업 가져오기<input type="file" id="import-file" accept="application/json"></label>
        </div>
      </section>
      <section class="settings-section github-sync-section">
        <div class="github-section-copy">
          <span class="section-label">GitHub sync</span>
          <h2>GitHub 저장소 연결</h2>
          <p>작업공간 JSON만 지정한 저장소에 커밋합니다. PAT는 이 브라우저에만 저장되며 Pages 코드, 공유 링크, 내보내기 파일에는 포함되지 않습니다.</p>
        </div>
        <div class="github-form">
          <label>저장소
            <input id="github-repository" autocomplete="off" value="${escapeHtml(githubSettings.repository)}" placeholder="owner/repository">
          </label>
          <div class="github-form-row">
            <label>브랜치
              <input id="github-branch" autocomplete="off" value="${escapeHtml(githubSettings.branch)}">
            </label>
            <label>데이터 경로
              <input id="github-path" autocomplete="off" value="${escapeHtml(githubSettings.path)}">
            </label>
          </div>
          <label>Fine-grained PAT
            <input id="github-token" type="password" autocomplete="off" value="${escapeHtml(githubSettings.token)}" placeholder="github_pat_...">
          </label>
          <p class="token-help">비공개 저장소의 Metadata 읽기와 Contents 읽기·쓰기 권한만 부여하세요. 공용 기기에서는 사용하지 마세요.</p>
          <div class="github-status ${statusClass}">
            <span class="status-dot"></span>
            <span>${escapeHtml(githubStatus.message)}</span>
          </div>
          ${githubSyncMeta.sha ? `<p class="sync-meta">마지막 동기화 SHA <code>${escapeHtml(githubSyncMeta.sha.slice(0, 10))}</code>${githubSyncMeta.syncedAt ? ` · ${escapeHtml(new Date(githubSyncMeta.syncedAt).toLocaleString("ko-KR"))}` : ""}</p>` : ""}
          <div class="github-actions">
            <button class="button" data-action="save-github" ${githubBusy ? "disabled" : ""}>설정 저장</button>
            <button class="button" data-action="test-github" ${githubBusy ? "disabled" : ""}>연결 테스트</button>
            <button class="button" data-action="pull-github" ${githubBusy ? "disabled" : ""}>GitHub에서 불러오기</button>
            <button class="button primary" data-action="push-github" ${githubBusy ? "disabled" : ""}>GitHub에 커밋</button>
            <button class="button danger-link" data-action="disconnect-github" ${githubBusy ? "disabled" : ""}>연결 해제</button>
          </div>
        </div>
      </section>
      <section class="settings-section">
        <div><h2>공개 범위</h2><p>작품 데이터는 공개 Pages 저장소가 아니라 위에서 지정한 저장소에만 커밋됩니다. 자동 동기화하지 않으며 매번 사용자가 버튼을 눌러야 합니다.</p></div>
        <span class="privacy-state">${githubSettings.token ? "로컬 + GitHub" : "로컬 전용"}</span>
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
    comic: comicView,
    workspace: workspaceView,
    history: historyView,
    memory: memoryView,
    settings: settingsView,
    agent: agentView,
    reader: readerView
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

function readGitHubForm() {
  const parsedRepository = parseRepository(document.querySelector("#github-repository")?.value || "");
  const settings = {
    repository: `${parsedRepository.owner}/${parsedRepository.repo}`,
    branch: document.querySelector("#github-branch")?.value.trim() || "",
    path: document.querySelector("#github-path")?.value.trim() || "",
    token: document.querySelector("#github-token")?.value.trim() || ""
  };
  if (!settings.branch || !settings.path || !settings.token) {
    throw new Error("저장소, 브랜치, 데이터 경로, PAT를 모두 입력하세요.");
  }
  return settings;
}

function persistGitHubForm() {
  const settings = readGitHubForm();
  saveGitHubSettings(settings);
  githubStatus = {
    state: "saved",
    message: "설정을 이 브라우저에 저장했습니다."
  };
  return settings;
}

function gitHubErrorMessage(error) {
  if (error instanceof GitHubApiError) {
    if (error.status === 401) return "PAT가 유효하지 않거나 만료되었습니다.";
    if (error.status === 403) return "저장소 Contents 권한이 부족합니다.";
    if (error.status === 404) {
      if (error.details?.login && error.details?.repository) {
        return `PAT는 ${error.details.login} 계정으로 유효하지만 ${error.details.repository} 저장소에 접근할 수 없습니다.`;
      }
      return "저장소를 찾지 못했습니다. 저장소 이름과 PAT 접근 범위를 확인하세요.";
    }
    if (error.status === 409) return "GitHub 파일 상태가 변경되었습니다. 먼저 다시 불러오세요.";
  }
  return error.message || "GitHub 연결 중 오류가 발생했습니다.";
}

async function runGitHubAction(action) {
  if (githubBusy) return;
  try {
    const settings = persistGitHubForm();
    githubBusy = true;
    githubStatus = { state: "working", message: "GitHub와 통신하고 있습니다." };
    render();
    await action(createGitHubSyncClient(settings));
  } catch (error) {
    githubStatus = { state: "error", message: gitHubErrorMessage(error) };
  } finally {
    githubBusy = false;
    render();
  }
}

async function testGitHubConnection() {
  await runGitHubAction(async (client) => {
    const identity = await client.inspectIdentity();
    let repository;
    try {
      repository = await client.inspectRepository();
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        error.details = { ...error.details, login: identity.login, repository: client.repository };
      }
      throw error;
    }
    const canPush = repository.permissions?.push !== false;
    githubStatus = {
      state: canPush ? "connected" : "error",
      message: canPush
        ? `${identity.login} → ${repository.full_name} 읽기·쓰기 연결이 확인됐습니다.`
        : `${identity.login} → ${repository.full_name}은 읽기만 가능합니다. Contents 쓰기 권한을 추가하세요.`
    };
  });
}

async function pullWorkspaceFromGitHub() {
  await runGitHubAction(async (client) => {
    const remote = await client.readWorkspace();
    if (!remote) {
      githubStatus = {
        state: "connected",
        message: "원격 작업 파일이 아직 없습니다. 현재 작업을 처음 커밋할 수 있습니다."
      };
      return;
    }
    if (!window.confirm("GitHub 작업으로 이 브라우저의 현재 작업을 교체할까요?")) {
      githubStatus = { state: "connected", message: "불러오기를 취소했습니다." };
      return;
    }
    store = ensureComicWorkspace(remote.workspace);
    selectedWorkId = store.activeWorkId;
    workspaceMode = "original";
    comicViewStage = activeComicEpisode(store)?.stage || "structure";
    saveStore();
    githubSyncMeta = {
      sha: remote.sha,
      syncedAt: new Date().toISOString()
    };
    localStorage.setItem(GITHUB_SYNC_META_KEY, JSON.stringify(githubSyncMeta));
    githubStatus = {
      state: "connected",
      message: "GitHub 작업을 이 브라우저로 불러왔습니다."
    };
  });
}

async function pushWorkspaceToGitHub() {
  await runGitHubAction(async (client) => {
    const remote = await client.readWorkspace();
    const writeSha = resolveWriteSha(remote?.sha, githubSyncMeta.sha);
    const result = await client.writeWorkspace({
      workspace: store,
      sha: writeSha,
      message: `sync: update CLE5 workspace (${new Date().toISOString()})`
    });
    githubSyncMeta = {
      sha: result.sha,
      syncedAt: new Date().toISOString(),
      commitUrl: result.commitUrl
    };
    localStorage.setItem(GITHUB_SYNC_META_KEY, JSON.stringify(githubSyncMeta));
    githubStatus = {
      state: "connected",
      message: "현재 작업과 기억을 GitHub에 커밋했습니다."
    };
  });
}

function disconnectGitHub() {
  if (!window.confirm("이 브라우저에 저장된 GitHub PAT와 동기화 정보를 삭제할까요?")) return;
  localStorage.removeItem(GITHUB_SETTINGS_KEY);
  localStorage.removeItem(GITHUB_SYNC_META_KEY);
  githubSettings = loadGitHubSettings();
  githubSyncMeta = {};
  githubStatus = {
    state: "disconnected",
    message: "GitHub 연결 정보를 삭제했습니다."
  };
  render();
}

document.addEventListener("input", (event) => {
  if (event.target.id === "work-title") updateWork("title", event.target.value);
  if (event.target.id === "work-intent") updateWork("intent", event.target.value);
  if (event.target.id === "document-content") {
    updateWork(event.target.dataset.field, event.target.value);
  }
  const episode = activeComicEpisode(store);
  if (event.target.id === "comic-episode-title" && episode) episode.title = event.target.value;
  if (event.target.id === "comic-episode-logline" && episode) episode.logline = event.target.value;
  if (event.target.id === "comic-episode-story" && episode) episode.story = event.target.value;
  if (event.target.id === "comic-publish-title" && episode) episode.publish.title = event.target.value;
  if (event.target.id === "comic-publish-summary" && episode) episode.publish.summary = event.target.value;
  if (event.target.id.startsWith("comic-episode-") || event.target.id.startsWith("comic-publish-")) {
    if (episode) episode.updatedAt = new Date().toISOString();
    saveStore();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "comic-project-select") {
    store.activeComicProjectId = event.target.value;
    const episode = activeComicEpisode(store);
    comicViewStage = episode?.stage || "structure";
    saveStore();
    render();
    return;
  }
  if (event.target.id !== "import-file") return;
  try {
    pendingImport = ensureComicWorkspace(JSON.parse(await event.target.files[0].text()));
    if (!validateWorkspace(pendingImport)) {
      throw new Error("invalid workspace");
    }
    render();
  } catch {
    pendingImport = null;
    showToast("CLE5 작업 파일 형식이 아닙니다.");
  }
});

document.addEventListener("click", async (event) => {
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
  if (action === "new-comic-project") {
    openNewComicProjectModal();
  } else if (action === "install-three-body-pilot") {
    const { project, created } = installThreeBodyPilot(store);
    comicViewStage = project.episodes[0].stage;
    saveStore();
    render();
    showToast(created ? "삼체 EP001 파일럿을 CLE5에 등록했습니다." : "삼체 EP001 파일럿으로 이동했습니다.");
  } else if (action === "create-comic-project") {
    const project = createComicProject(store, {
      title: document.querySelector("#new-comic-title")?.value || "",
      purpose: document.querySelector("#new-comic-purpose")?.value || ""
    });
    comicViewStage = project.episodes[0].stage;
    saveStore();
    modalRoot.innerHTML = "";
    location.hash = "comic";
    render();
  } else if (action === "new-comic-episode") {
    openNewComicEpisodeModal();
  } else if (action === "create-comic-episode") {
    const project = activeComicProject(store);
    const episode = createComicEpisode(project, {
      title: document.querySelector("#new-episode-title")?.value || "",
      logline: document.querySelector("#new-episode-logline")?.value || ""
    });
    comicViewStage = episode.stage;
    saveStore();
    modalRoot.innerHTML = "";
    render();
  } else if (action === "select-comic-episode") {
    const project = activeComicProject(store);
    project.activeEpisodeId = actionButton.dataset.episodeId;
    comicViewStage = activeComicEpisode(store)?.stage || "structure";
    saveStore();
    render();
  } else if (action === "view-comic-stage") {
    comicViewStage = actionButton.dataset.stage || "structure";
    render();
  } else if (action === "advance-comic-stage") {
    const episode = activeComicEpisode(store);
    const index = comicStages.indexOf(episode.stage);
    if (index < comicStages.length - 1) setComicStage(episode, comicStages[index + 1]);
    comicViewStage = episode.stage;
    saveStore();
    render();
  } else if (action === "focus-comic-review") {
    comicViewStage = "review";
    render();
  } else if (action === "open-comic-artifact") {
    openComicArtifactModal();
  } else if (action === "register-comic-artifact") {
    const episode = activeComicEpisode(store);
    const type = document.querySelector("#artifact-type")?.value || "reference";
    const artifact = addComicArtifact(episode, {
      type,
      label: document.querySelector("#artifact-label")?.value || "",
      url: document.querySelector("#artifact-url")?.value || "",
      note: document.querySelector("#artifact-note")?.value || ""
    });
    if (type === "storyboard") {
      episode.storyboard.push({ id: artifact.id, order: episode.storyboard.length + 1, description: artifact.note || artifact.label, camera: "unspecified", characters: [] });
    } else if (type === "panel") {
      episode.panels.push({ id: artifact.id, order: episode.panels.length + 1, storyboardId: "", description: artifact.label, dialogue: "", status: "generated", imageUrl: artifact.url || artifact.path, candidates: [], review: { verdict: "winner", candidateId: null, reason: "등록된 단일 패널", reviewedAt: new Date().toISOString(), humanApproved: true }, qa: { composition: "pending", character: "pending", continuity: "pending", text: "pending", approved: false, note: "" } });
    }
    saveStore();
    modalRoot.innerHTML = "";
    render();
    showToast("산출물을 현재 에피소드에 등록했습니다.");
  } else if (action === "open-comic-handoff") {
    openComicHandoffModal();
  } else if (action === "create-comic-handoff-link") {
    createComicHandoffLink();
  } else if (action === "copy-comic-handoff-link") {
    navigator.clipboard?.writeText(document.querySelector("#comic-handoff-link").value);
    showToast("Comic Agent 링크를 복사했습니다.");
  } else if (action === "open-comic-result") {
    openComicResultModal();
  } else if (action === "apply-comic-result") {
    applyComicResult();
  } else if (action === "select-comic-candidate") {
    const episode = activeComicEpisode(store);
    const panelId = actionButton.dataset.panelId;
    const reason = document.querySelector(`#review-reason-${panelId}`)?.value || "";
    if (!reason.trim()) return showToast("선택 근거를 먼저 입력하세요.");
    selectPanelCandidate(episode, panelId, { verdict: "winner", candidateId: actionButton.dataset.candidateId, reason });
    saveStore();
    render();
    showToast("후보를 선택했습니다. QA 후 기억으로 승인할 수 있습니다.");
  } else if (action === "hold-comic-candidates" || action === "reject-comic-candidates") {
    const episode = activeComicEpisode(store);
    const panelId = actionButton.dataset.panelId;
    const reason = document.querySelector(`#review-reason-${panelId}`)?.value || "";
    if (!reason.trim()) return showToast("판정 근거를 먼저 입력하세요.");
    selectPanelCandidate(episode, panelId, { verdict: action === "hold-comic-candidates" ? "tie" : "both_bad", reason });
    saveStore();
    render();
  } else if (action === "save-comic-qa") {
    const episode = activeComicEpisode(store);
    const panel = episode.panels.find((item) => item.id === actionButton.dataset.panelId);
    const values = {};
    ["composition", "character", "continuity", "text"].forEach((key) => { values[key] = document.querySelector(`#qa-${panel.id}-${key}`)?.value || "pending"; });
    updatePanelQa(panel, values);
    saveStore();
    render();
    showToast(panel.qa.approved ? "패널 QA를 통과했습니다." : "패널 QA를 저장했습니다.");
  } else if (action === "approve-comic-memory") {
    const project = activeComicProject(store);
    const episode = activeComicEpisode(store);
    approvePanelMemory(store, project, episode, actionButton.dataset.panelId);
    saveStore();
    render();
    showToast("승인한 패널과 판단을 다음 작업의 기억에 반영했습니다.");
  } else if (action === "publish-comic") {
    const episode = activeComicEpisode(store);
    const readiness = comicPublishReadiness(episode);
    if (!readiness.ready) return showToast("발행 전 패널 QA를 완료하세요.");
    episode.publish.status = "published";
    episode.publish.publishedAt = new Date().toISOString();
    setComicStage(episode, "publish");
    comicViewStage = "publish";
    saveStore();
    render();
    showToast("에피소드를 발행 상태로 전환했습니다.");
  } else if (action === "open-handoff") {
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
  } else if (action === "save-github") {
    try {
      persistGitHubForm();
      render();
      showToast("GitHub 설정을 이 브라우저에 저장했습니다.");
    } catch (error) {
      githubStatus = { state: "error", message: gitHubErrorMessage(error) };
      render();
    }
  } else if (action === "test-github") {
    await testGitHubConnection();
  } else if (action === "pull-github") {
    await pullWorkspaceFromGitHub();
  } else if (action === "push-github") {
    await pushWorkspaceToGitHub();
  } else if (action === "disconnect-github") {
    disconnectGitHub();
  } else if (action === "confirm-import") {
    store = ensureComicWorkspace(pendingImport);
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
      comicViewStage = activeComicEpisode(store)?.stage || "structure";
      saveStore();
      location.hash = "comic";
      render();
    }
  }
});

document.querySelector("#menu-button").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

window.addEventListener("hashchange", render);
render();
