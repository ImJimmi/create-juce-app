import fs from "node:fs";
import path from "node:path";

export const templatesDir = path.join(import.meta.dirname, "..", "templates");

export function getArgValue(argPrefix) {
  return process.argv
    .find((arg) => arg.startsWith(argPrefix))
    ?.slice(argPrefix.length);
}

export function setVar(file, varName, value) {
  const content = fs.readFileSync(file, { encoding: "utf8" });

  if (!content.includes(varName))
    throw new Error(`No variable named VAR_${varName} in ${file}`);

  fs.writeFileSync(
    file,
    content.replace(new RegExp(`VAR_${varName}(?![A-Z0-9_])`, "g"), value),
    { encoding: "utf8" },
  );
}

export function clearUnsetVars(file) {
  const lines = fs.readFileSync(file, { encoding: "utf8" }).split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("VAR_")) {
      if (result.at(-1) === "" && lines[i + 1] === "") {
        result.pop();
      }

      continue;
    }

    result.push(lines[i]);
  }

  fs.writeFileSync(file, result.join("\n"), { encoding: "utf8" });

  return 0;
}

export function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toTitleCase(value) {
  return `${value[0].toUpperCase()}${value.substring(1, value.length)}`;
}
