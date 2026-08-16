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

export function threeBodyPilotProject() {
  const characterReference = "./assets/comic/three-body/characters.webp";
  const qa = () => ({
    composition: "pending",
    character: "pending",
    continuity: "pending",
    text: "pending",
    approved: false,
    note: ""
  });
  const candidate = (panelId, label, note) => ({
    id: `CAND-${panelId}-${label}`,
    label,
    imageUrl: `./assets/comic/three-body/${panelId.toLowerCase()}-${label.toLowerCase()}.webp`,
    note
  });
  return {
    id: "COMIC-PILOT-3BODY",
    title: "삼체 · 유령 카운트다운",
    purpose: "일상 속 숫자의 균열을 통해 과학자가 처음 마주하는 우주적 공포를 절제된 연출로 전달한다.",
    activeEpisodeId: "EP-001",
    source: "cle5-native",
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    episodes: [{
      id: "EP-001",
      title: "유령 카운트다운",
      stage: "review",
      logline: "나노과학자 왕먀오가 사진과 시야에 반복되는 정체불명의 카운트다운을 발견한다.",
      story: "연구 현장에서 돌아온 왕먀오는 자신이 찍은 사진마다 같은 빛의 흔적이 남는다는 사실을 발견한다. 암실에서 필름을 다시 확인하지만 현상 조건을 바꿔도 흔적은 사라지지 않는다. 그날 밤 형사 스창이 연구실을 찾아와 최근 과학자들에게도 비슷한 이상이 있었다고 말한다. 왕먀오는 설명을 거부하지만, 스창이 떠난 뒤 숫자처럼 보이는 붉은 빛이 사진 밖 현실의 시야까지 침범한다. 도시는 평소와 다름없이 움직이고, 카운트다운은 오직 왕먀오에게만 보인다.",
      characters: [
        { id: "CHAR-WANG", name: "왕먀오", role: "나노과학자", description: "40대 초반. 마른 체격, 각진 얼굴, 얇은 사각 안경과 남색 필드 재킷. 분석적이지만 누적된 피로가 있다.", imageUrl: characterReference },
        { id: "CHAR-SHI", name: "스창", role: "형사", description: "40대 후반. 다부진 체격, 낡은 갈색 재킷. 무심한 자세로 상대의 반응을 집요하게 관찰한다.", imageUrl: characterReference }
      ],
      storyboard: [
        { id: "SHOT-001", order: 1, description: "붉은 안전등 아래 왕먀오가 이상한 흔적이 밴 사진을 확인한다.", camera: "medium / over-shoulder", characters: ["CHAR-WANG"] },
        { id: "SHOT-002", order: 2, description: "밤의 연구실에서 왕먀오와 스창이 사진을 사이에 두고 서로를 탐색한다.", camera: "two-shot / reflection", characters: ["CHAR-WANG", "CHAR-SHI"] },
        { id: "SHOT-003", order: 3, description: "도시는 정상인데 왕먀오의 시야에만 붉은 카운트다운이 떠오른다.", camera: "extreme close-up / full-page wide", characters: ["CHAR-WANG"] }
      ],
      panels: [
        { id: "PANEL-001", order: 1, storyboardId: "SHOT-001", description: "암실 사진에 나타난 반복 흔적", dialogue: "", status: "candidates_ready", imageUrl: "", candidates: [candidate("PANEL-001", "A", "인물의 통제된 불안을 가까이 포착"), candidate("PANEL-001", "B", "반복되는 사진과 고립된 공간을 강조")], review: null, qa: qa() },
        { id: "PANEL-002", order: 2, storyboardId: "SHOT-002", description: "왕먀오와 스창의 첫 대면", dialogue: "스창: 사진보다 자네 표정이 더 많은 걸 말해주는데.", status: "candidates_ready", imageUrl: "", candidates: [candidate("PANEL-002", "A", "두 인물의 시선과 거리 관계가 명확한 정면 구도"), candidate("PANEL-002", "B", "유리 반사를 이용해 감시와 불신을 강조")], review: null, qa: qa() },
        { id: "PANEL-003", order: 3, storyboardId: "SHOT-003", description: "현실을 침범한 붉은 카운트다운", dialogue: "", status: "candidates_ready", imageUrl: "", candidates: [candidate("PANEL-003", "A", "왕먀오의 눈과 통제된 공포를 전면화"), candidate("PANEL-003", "B", "정상적인 도시와 개인에게만 보이는 위협의 대비")], review: null, qa: qa() }
      ],
      artifacts: [{ id: "ASSET-CHARACTERS", type: "character-reference", label: "왕먀오·스창 캐릭터 레퍼런스", url: characterReference, path: "app/assets/comic/three-body/characters.webp", note: "CLE5 파일럿을 위해 새로 생성한 내부 자산", createdAt: "2026-08-16T00:00:00.000Z" }],
      reviewHistory: [],
      publish: { title: "삼체 · 1화 — 유령 카운트다운", summary: "설명할 수 없는 숫자가 과학자의 현실을 침범하기 시작한다.", status: "draft", publishedAt: null },
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z"
    }]
  };
}

export function installThreeBodyPilot(store) {
  ensureComicWorkspace(store);
  let project = store.comicProjects.find((item) => item.id === "COMIC-PILOT-3BODY");
  const created = !project;
  if (!project) {
    project = threeBodyPilotProject();
    store.comicProjects.push(project);
  }
  store.activeComicProjectId = project.id;
  project.activeEpisodeId = "EP-001";
  return { project, created };
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
