import child_process from "node:child_process";

import { getArgValue } from "./utils.js";

const githubTokenArg = "--github-token=";
const githubToken =
  getArgValue(githubTokenArg) ??
  process.env.GITHUB_TOKEN ??
  process.env.GH_TOKEN;

export async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 429
        ? `GitHub rate limit reached - provide a personal access token using ${githubTokenArg}<token>, $GITHUB_TOKEN, or $GH_TOKEN`
        : `Request to ${url} failed with ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export async function fetchLatestGitHubTag(repo, displayName) {
  const message = `Fetching latest ${displayName} release…`;
  process.stdout.write(message);

  const release = await fetchGitHubJson(
    `https://api.github.com/repos/${repo}/releases/latest`,
  );

  process.stdout.write("\r" + " ".repeat(message.length) + "\r");

  return release.tag_name;
}

export function makeInitialCommit(config) {
  try {
    child_process.execSync("git add --all", { cwd: config.projectDir });
    child_process.execSync(
      'git commit -m "Create initial project using create-juce-app"',
      { cwd: config.projectDir },
    );
  } catch (error) {
    throw new Error("Failed to make initial commit", { cause: error });
  }
}
