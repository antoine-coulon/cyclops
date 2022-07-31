#!/usr/bin/env node

import path from "node:path";
import { performance } from "node:perf_hooks";

import { makeTreeStructure, TreeStructure } from "fs-tree-structure";
import kleur from "kleur";
import sade from "sade";

import cyclops from "../index.js";
import { findWorkspaceEntrypointModule } from "../src/workspace/index.js";

function isDirectory(nodePath: string): boolean {
  return path.extname(nodePath) === "";
}

function renderProjectFileSystem(
  treeStructure: TreeStructure,
  whitespaces = 0
): void {
  const leftLevelSeparator = whitespaces === 0 ? "" : "└──";
  const indents = Array.from({ length: whitespaces }, () => " ").join("");
  for (const [node, subNodes] of Object.entries(treeStructure)) {
    if (isDirectory(node)) {
      console.log(
        `${indents} ${leftLevelSeparator} ${kleur.bold().yellow(node)}/`
      );
    } else {
      console.log(
        `${indents} ${leftLevelSeparator} ${kleur.bold().blue(node)}`
      );
    }
    renderProjectFileSystem(subNodes, whitespaces + 2);
  }
}

type CliOptions = {
  module: string;
  circular: number;
  includeBaseDir: boolean;
};

async function displayGraphStructure(
  entrypoint: string,
  options: CliOptions
): Promise<void> {
  const entrypointModule =
    entrypoint ?? (await findWorkspaceEntrypointModule());
  console.log(
    `\n${kleur.red().italic().bold("Cyclops")} entrypoint: ${kleur
      .yellow()
      .underline()
      .bold(`${entrypointModule}`)}`
  );

  const start = performance.now();
  const instance = await cyclops({
    entrypoint: entrypointModule,
    module: options.module === "esm",
    circularMaxDepth: Number.POSITIVE_INFINITY,
    includeBaseDir: options.includeBaseDir
  });
  const timeTook = `${(performance.now() - start).toFixed(3)}ms`;
  const { files, graph } = instance.getStructure();
  const filesWord = files.length > 1 ? "files" : "file";
  console.log(
    `\nProcessed ${kleur.bold().green(files.length)} ${filesWord} (${kleur
      .magenta()
      .bold(timeTook)})`
  );

  const flattenedFilesPaths = Object.values(graph).flatMap((rootValue) => [
    rootValue.id,
    ...rootValue.adjacentTo
  ]);

  const treeStructure = makeTreeStructure(flattenedFilesPaths);
  console.log();
  renderProjectFileSystem(treeStructure);
}

sade("cyclops <entrypoint>", true)
  .describe("Build the whole project file tree")
  .option(
    "-b, --includeBaseDir",
    "Include the base directory name for each graph node",
    false
  )
  .option(
    "-c, --circular",
    "Show circular dependencies found in the file tree",
    Number.POSITIVE_INFINITY
  )
  .option(
    "-m, --module",
    "Module system used in the project, can be either 'cjs or 'esm'",
    "esm"
  )
  .example("./node_modules/.bin/cyclops src/index.js --circular --module=esm")
  .action(displayGraphStructure)
  .parse(process.argv);
