const API_ROOT = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.details = details;
  }
}

export function parseRepository(value) {
  let normalized = String(value).trim();
  if (/^https?:\/\//i.test(normalized)) {
    let url;
    try {
      url = new URL(normalized);
    } catch {
      throw new Error("저장소는 owner/repository 또는 GitHub URL 형식으로 입력하세요.");
    }
    if (url.hostname.toLowerCase() !== "github.com") {
      throw new Error("GitHub 저장소 주소만 사용할 수 있습니다.");
    }
    normalized = url.pathname;
  }
  normalized = normalized
    .replace(/^git@github\.com:/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/i, "");
  const [owner, repo, ...rest] = normalized.split("/");
  if (!owner || !repo || rest.length) {
    throw new Error("저장소는 owner/repository 또는 GitHub URL 형식으로 입력하세요.");
  }
  return { owner, repo };
}

export function validateWorkspace(value) {
  return Boolean(
    value &&
    Array.isArray(value.works) &&
    Array.isArray(value.memory) &&
    typeof value.activeWorkId === "string"
  );
}

export function resolveWriteSha(remoteSha, lastSyncedSha) {
  if (remoteSha && !lastSyncedSha) {
    throw new Error("원격 작업이 이미 있습니다. 먼저 GitHub에서 불러오세요.");
  }
  if (remoteSha && remoteSha !== lastSyncedSha) {
    throw new Error("다른 곳에서 원격 작업이 변경되었습니다. 먼저 GitHub에서 불러오세요.");
  }
  return remoteSha || null;
}

function encodePath(path) {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(String(value).replaceAll("\n", ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createGitHubSyncClient(config, fetchImpl = fetch) {
  const { owner, repo } = parseRepository(config.repository);
  const branch = String(config.branch || "main").trim();
  const path = encodePath(config.path);
  const token = String(config.token || "").trim();

  if (!branch || !path || !token) {
    throw new Error("저장소, 브랜치, 데이터 경로, PAT를 모두 입력하세요.");
  }

  const baseUrl = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  async function request(url, options = {}) {
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || `GitHub 요청 실패 (${response.status})`;
      throw new GitHubApiError(message, response.status, payload);
    }
    return payload;
  }

  async function inspectRepository() {
    return request(baseUrl);
  }

  async function inspectIdentity() {
    return request(`${API_ROOT}/user`);
  }

  async function readWorkspace() {
    const url = `${baseUrl}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    try {
      const file = await request(url);
      if (file.type !== "file" || !file.content) {
        throw new Error("설정한 경로가 JSON 파일이 아닙니다.");
      }
      const workspace = JSON.parse(decodeBase64(file.content));
      if (!validateWorkspace(workspace)) {
        throw new Error("원격 파일이 CLE5 작업공간 형식이 아닙니다.");
      }
      return {
        workspace,
        sha: file.sha,
        htmlUrl: file.html_url,
        updatedAt: file._links?.git || null
      };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  }

  async function writeWorkspace({ workspace, sha = null, message }) {
    if (!validateWorkspace(workspace)) {
      throw new Error("현재 데이터가 CLE5 작업공간 형식이 아닙니다.");
    }
    const body = {
      message,
      content: encodeBase64(`${JSON.stringify(workspace, null, 2)}\n`),
      branch
    };
    if (sha) body.sha = sha;

    const result = await request(`${baseUrl}/contents/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return {
      sha: result.content.sha,
      htmlUrl: result.content.html_url,
      commitUrl: result.commit.html_url
    };
  }

  return {
    repository: `${owner}/${repo}`,
    inspectIdentity,
    inspectRepository,
    readWorkspace,
    writeWorkspace
  };
}
