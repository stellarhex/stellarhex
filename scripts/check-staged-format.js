import { execFileSync } from "node:child_process";
import * as prettier from "prettier";

try {
  const files = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);

  for (const file of files) {
    const info = await prettier.getFileInfo(file, {
      ignorePath: [".gitignore", ".prettierignore"],
    });
    if (info.ignored || !info.inferredParser) continue;

    const source = execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });
    const config = await prettier.resolveConfig(file, { editorconfig: true });
    if (!(await prettier.check(source, { ...config, filepath: file }))) {
      console.error(`not formatted: ${JSON.stringify(file)}`);
      process.exitCode = 1;
    }
  }

  if (process.exitCode) {
    console.error("run 'npm run format', then 'git add' and commit again.");
  }
} catch (error) {
  console.error("staged format check failed:", error.message);
  process.exitCode = 1;
}
