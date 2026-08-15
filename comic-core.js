export const comicStages = ["structure", "production", "review", "publish"];

export const comicStageLabels = {
  structure: "구성",
  production: "제작",
  review: "검토",
  publish: "발행"
};

const now = () => new Date().toISOString();

export function initialComicProject() {
  return {
    id: "COMIC-001",
    title: "남겨진 의자",
    purpose: "떠난 사람을 직접 보여주지 않고 빈 공간과 사물의 변화로 그리움을 전달한다.",
    activeEpisodeId: "EP-001",
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    episodes: [
      {
        id: "EP-001",
        title: "해 질 무렵",
        stage: "review",
        logline: "오래 비운 집으로 돌아온 미나가 식지 않은 흔적을 발견한다.",
        story: "해 질 무렵 미나는 오래 비운 집으로 돌아온다. 창가의 빈 의자와 식어버린 차 한 잔이 누군가 방금 떠난 것처럼 남아 있다.",
        characters: [
          {
            id: "CHAR-001",
            name: "미나",
            role: "주인공",
            description: "30대 여성. 짧은 검은 머리와 짙은 초록 코트. 감정을 과장하지 않고 사물과 거리를 둔다.",
            imageUrl: "./assets/comic/mina-character.webp"
          }
        ],
        storyboard: [
          {
            id: "SHOT-001",
            order: 1,
            description: "해 질 무렵의 방. 미나가 열린 문 앞에서 빈 의자를 바라본다.",
            camera: "wide",
            characters: ["CHAR-001"]
          }
        ],
        panels: [
          {
            id: "PANEL-001",
            order: 1,
            storyboardId: "SHOT-001",
            description: "문 앞의 미나와 창가의 빈 의자",
            dialogue: "",
            status: "candidates_ready",
            imageUrl: "",
            candidates: [
              {
                id: "CAND-001-A",
                label: "A",
                imageUrl: "./assets/comic/panel-001-a.webp",
                note: "인물의 망설임과 방의 깊이를 우선"
              },
              {
                id: "CAND-001-B",
                label: "B",
                imageUrl: "./assets/comic/panel-001-b.webp",
                note: "빈 의자와 저녁빛의 여백을 우선"
              }
            ],
            review: null,
            qa: {
              composition: "pending",
              character: "pending",
              continuity: "pending",
              text: "pending",
              approved: false,
              note: ""
            }
          }
        ],
        artifacts: [],
        reviewHistory: [],
        publish: {
          title: "남겨진 의자 · 1화",
          summary: "떠난 사람을 빈 공간으로 기억하는 짧은 만화",
          status: "draft",
          publishedAt: null
        },
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z"
      }
    ]
  };
}

export function ensureComicWorkspace(store) {
  if (!store || typeof store !== "object") throw new Error("workspace is required");
  store.version = Math.max(3, Number(store.version) || 0);
  if (!Array.isArray(store.comicProjects)) store.comicProjects = [initialComicProject()];
  if (!store.activeComicProjectId && store.comicProjects.length) {
    store.activeComicProjectId = store.comicProjects[0].id;
  }
  return store;
}

export function activeComicProject(store) {
  return store.comicProjects?.find((project) => project.id === store.activeComicProjectId)
    ?? store.comicProjects?.[0]
    ?? null;
}

export function activeComicEpisode(store) {
  const project = activeComicProject(store);
  return project?.episodes?.find((episode) => episode.id === project.activeEpisodeId)
    ?? project?.episodes?.[0]
    ?? null;
}

function nextSequence(items, prefix) {
  const max = Math.max(0, ...items.map((item) => Number(String(item.id).split("-").at(-1)) || 0));
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function createComicProject(store, { title, purpose = "" }) {
  ensureComicWorkspace(store);
  const id = nextSequence(store.comicProjects, "COMIC");
  const episode = createEpisodeRecord([], { title: "첫 에피소드", logline: "" });
  const project = {
    id,
    title: title?.trim() || `새 만화 ${store.comicProjects.length + 1}`,
    purpose: purpose.trim(),
    activeEpisodeId: episode.id,
    episodes: [episode],
    createdAt: now(),
    updatedAt: now()
  };
  store.comicProjects.push(project);
  store.activeComicProjectId = id;
  return project;
}

function createEpisodeRecord(existing, { title, logline = "" }) {
  return {
    id: nextSequence(existing, "EP"),
    title: title?.trim() || `새 에피소드 ${existing.length + 1}`,
    stage: "structure",
    logline: logline.trim(),
    story: "",
    characters: [],
    storyboard: [],
    panels: [],
    artifacts: [],
    reviewHistory: [],
    publish: { title: title?.trim() || "새 에피소드", summary: "", status: "draft", publishedAt: null },
    createdAt: now(),
    updatedAt: now()
  };
}

export function createComicEpisode(project, values) {
  const episode = createEpisodeRecord(project.episodes || [], values);
  project.episodes = project.episodes || [];
  project.episodes.push(episode);
  project.activeEpisodeId = episode.id;
  project.updatedAt = now();
  return episode;
}

export function addComicArtifact(episode, artifact) {
  const type = artifact.type || "reference";
  const id = artifact.id || `${type.toUpperCase()}-${Date.now()}`;
  const record = {
    id,
    type,
    label: artifact.label?.trim() || id,
    url: artifact.url?.trim() || "",
    path: artifact.path?.trim() || "",
    note: artifact.note?.trim() || "",
    createdAt: now()
  };
  episode.artifacts.push(record);
  if (type === "character") {
    episode.characters.push({
      id,
      name: record.label,
      role: artifact.role?.trim() || "등장인물",
      description: record.note,
      imageUrl: record.url || record.path
    });
  }
  episode.updatedAt = now();
  return record;
}

export function setComicStage(episode, stage) {
  if (!comicStages.includes(stage)) throw new Error(`invalid comic stage: ${stage}`);
  episode.stage = stage;
  episode.updatedAt = now();
}

export function selectPanelCandidate(episode, panelId, { verdict, candidateId = null, reason = "" }) {
  if (!["winner", "tie", "both_bad"].includes(verdict)) throw new Error("invalid verdict");
  const panel = episode.panels.find((item) => item.id === panelId);
  if (!panel) throw new Error(`unknown panel: ${panelId}`);
  const candidate = candidateId ? panel.candidates.find((item) => item.id === candidateId) : null;
  if (verdict === "winner" && !candidate) throw new Error("winner candidate is required");
  panel.review = {
    verdict,
    candidateId: candidate?.id || null,
    reason: reason.trim(),
    reviewedAt: now(),
    humanApproved: verdict === "winner"
  };
  if (candidate) {
    panel.imageUrl = candidate.imageUrl;
    panel.status = "selected";
  } else {
    panel.status = verdict === "both_bad" ? "regenerate" : "review_hold";
  }
  episode.reviewHistory.push({ panelId, ...panel.review });
  episode.updatedAt = now();
  return panel.review;
}

export function approvePanelMemory(store, project, episode, panelId) {
  const panel = episode.panels.find((item) => item.id === panelId);
  if (!panel?.review?.humanApproved || !panel.imageUrl) throw new Error("selected panel is required");
  const existing = store.memory.find((item) => item.source === `${project.id}/${episode.id}/${panel.id}`);
  if (existing) return existing;
  const memory = {
    id: `MEM-${Date.now()}`,
    statement: panel.review.reason || `${panel.description}에서 승인한 시각적 판단을 다음 패널의 참조로 사용한다.`,
    source: `${project.id}/${episode.id}/${panel.id}`,
    status: "active",
    scope: { type: "comic-panel", projectId: project.id, episodeId: episode.id, panelId: panel.id },
    assetUrl: panel.imageUrl,
    createdAt: now()
  };
  store.memory.push(memory);
  return memory;
}

export function updatePanelQa(panel, qa) {
  panel.qa = { ...panel.qa, ...qa };
  const checks = ["composition", "character", "continuity", "text"];
  panel.qa.approved = checks.every((key) => panel.qa[key] === "pass");
  if (panel.qa.approved && panel.review?.humanApproved) panel.status = "approved";
  return panel.qa;
}

export function comicPublishReadiness(episode) {
  const panels = episode.panels || [];
  const approved = panels.filter((panel) => panel.status === "approved" && panel.imageUrl);
  const issues = [];
  if (!episode.story?.trim()) issues.push("스토리 미작성");
  if (!episode.characters?.length) issues.push("캐릭터 없음");
  if (!episode.storyboard?.length) issues.push("콘티 없음");
  if (!panels.length) issues.push("패널 없음");
  if (approved.length !== panels.length) issues.push(`승인 패널 ${approved.length}/${panels.length}`);
  return { ready: issues.length === 0, issues, approved, total: panels.length };
}

export function comicHandoffPacket(store, project, episode, task, request = "") {
  const relevantMemory = (store.memory || []).filter((item) => {
    if (item.status !== "active") return false;
    return !item.scope?.projectId || item.scope.projectId === project.id;
  });
  return {
    protocol: "CLE5_COMIC_AGENT_HANDOFF_V1",
    task,
    request,
    productPurpose: "CLE5 안에서 사람의 승인과 기억을 이어가는 독립 연재 만화 제작",
    agentRole: "당신은 만화 제작 에이전트다. 요청된 산출물을 실제로 만들고 CLE5 내부 목표 경로와 반환 계약을 지킨다.",
    project: { id: project.id, title: project.title, purpose: project.purpose },
    episode: {
      id: episode.id,
      title: episode.title,
      stage: episode.stage,
      logline: episode.logline,
      story: episode.story,
      characters: episode.characters,
      storyboard: episode.storyboard,
      panels: episode.panels.map(({ id, order, description, dialogue, imageUrl, status }) => ({ id, order, description, dialogue, imageUrl, status }))
    },
    approvedMemory: relevantMemory.map(({ statement, source, scope, assetUrl }) => ({ statement, source, scope, assetUrl })),
    targetRoot: `projects/${project.id}/episodes/${episode.id}`,
    operatingRules: [
      "CLE5 외부 시스템의 데이터나 경로를 사용하지 않는다.",
      "이미지 안에 대사와 자막을 넣지 않고 별도 텍스트로 반환한다.",
      "참조 이미지가 있으면 캐릭터 외형과 승인된 시각적 판단을 유지한다.",
      "생성한 산출물의 URL 또는 CLE5 저장 경로를 반환한다."
    ],
    returnFormat: {
      contentStart: "---CLE5-CONTENT-START---",
      contentEnd: "---CLE5-CONTENT-END---",
      assetsStart: "---CLE5-ASSETS-START---",
      assetsEnd: "---CLE5-ASSETS-END---",
      noteStart: "---CLE5-NOTE-START---",
      noteEnd: "---CLE5-NOTE-END---",
      memoryStart: "---CLE5-MEMORY-START---",
      memoryEnd: "---CLE5-MEMORY-END---"
    }
  };
}
