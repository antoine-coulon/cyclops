#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import kleur from "kleur";
import sade from "sade";
import { table, TableUserConfig } from "table";

import { CyclopsStructure } from "../src/cyclops/main.js";
import cyclops from "../src/index.js";

const kTableConfig: TableUserConfig = {
  header: {
    alignment: "center",
    content: kleur.bold().underline().yellow("PROJECT SUMMARY")
  },
  columns: [
    { alignment: "center", verticalAlignment: "middle" },
    { alignment: "center", verticalAlignment: "middle" },
    { alignment: "center", verticalAlignment: "middle" }
  ],
  border: {
    topBody: kleur.blue(`─`),
    topJoin: kleur.blue(`┬`),
    topLeft: kleur.blue(`┌`),
    topRight: kleur.blue(`┐`),

    bottomBody: kleur.blue(`─`),
    bottomJoin: kleur.blue(`┴`),
    bottomLeft: kleur.blue(`└`),
    bottomRight: kleur.blue(`┘`),

    bodyLeft: kleur.blue(`│`),
    bodyRight: kleur.blue(`│`),
    bodyJoin: kleur.blue(`│`),

    joinBody: kleur.blue(`─`),
    joinLeft: kleur.blue(`├`),
    joinRight: kleur.blue(`┤`),
    joinJoin: kleur.blue(`┼`)
  }
};

async function findDefaultEntrypoint(): Promise<string> {
  // look for package.json
  const packageJson = JSON.parse(
    await readFile(`${process.cwd()}/package.json`, "utf-8")
  );
  if (packageJson.main) {
    return path.resolve(process.cwd(), packageJson.main);
  }
  throw new Error(
    "Could not automatically find the default entrypoint. Please try to provide it manually through the --entrypoint CLI option."
  );
}

function truncateString(filePath: string): string {
  return filePath.length > 15
    ? `${filePath.slice(0, 15)}.../${path.basename(filePath)}`
    : filePath;
}

function buildGraphStructure(
  structure: CyclopsStructure
): Array<[string, string, string]> {
  return Object.values(structure.graph).map((graphNode) => [
    kleur.white().bold(truncateString(graphNode.id)),
    kleur
      .white()
      .bold(
        graphNode.adjacentTo.length
          ? graphNode.adjacentTo.map(truncateString).join("\n")
          : "None"
      ),
    kleur.white().bold(graphNode.adjacentTo.length)
  ]);
}

function prettyPrintCircularDependencies(
  circularDependencies: string[][]
): string {
  return circularDependencies
    .flatMap((cyclicDeps) => {
      const truncatedCyclicDeps = cyclicDeps.map(truncateString);

      return `\n${truncatedCyclicDeps.join(`\n--> `)}\n`;
    })
    .join("\n");
}

type CliOptions = {
  entrypoint: string;
  module: string;
  circularMaxDepth: number;
  graph: boolean;
  baseDir: boolean;
};

async function displayGraphStructure({
  entrypoint,
  module,
  circularMaxDepth,
  graph,
  baseDir
}: CliOptions): Promise<void> {
  const finalEntrypoint = entrypoint ?? (await findDefaultEntrypoint());
  console.log(
    `\n ${kleur.red().bold("Cyclops")} entrypoint: ${kleur
      .yellow()
      .bold(`${finalEntrypoint}`)}`
  );

  const start = performance.now();
  const instance = await cyclops({
    entrypoint: finalEntrypoint,
    module: module === "esm",
    circularMaxDepth,
    includeBaseDir: baseDir
  });
  const timeTook = `${(performance.now() - start).toFixed(5)}ms`;

  console.log(
    `\n 👁️ ${kleur.red().bold(" Cyclops")} took ${kleur
      .green()
      .bold(timeTook)} to build the entire graph. 👁️`
  );

  const structure = instance.getStructure();
  const tableData = [
    [
      kleur.bold().underline().yellow("Number of files"),
      kleur.bold().underline().yellow("Circular dependencies"),
      kleur.bold().underline().yellow("Leaves")
    ],
    [
      structure.files.length,
      structure.circularDependencies.length
        ? prettyPrintCircularDependencies(structure.circularDependencies)
        : "None",
      structure.leaves.length
        ? structure.leaves.map(truncateString).join("\n")
        : "None"
    ]
  ];

  if (graph) {
    const graphData = [
      [
        kleur.bold().underline().yellow("File node"),
        kleur.bold().underline().yellow("File dependencies"),
        kleur.bold().underline().yellow("Number of dependencies")
      ],
      ...buildGraphStructure(structure)
    ];

    tableData.push(...graphData);
  }

  console.log(table(tableData, kTableConfig));
}

sade("cyclops", true)
  .describe("Build the whole project structure")
  .option(
    "-b, --base-dir",
    "Include the base directory name for each graph node",
    false
  )
  .option(
    "-c, --circular-max-depth",
    "Limit the depth when searching for circular dependencies",
    Number.POSITIVE_INFINITY
  )
  .option("-e, --entrypoint", "Specify the project entrypoint file")
  .option(
    "-g, --graph",
    "Print the whole project graph as a table in the console",
    true
  )
  .option(
    "-m, --module",
    "Module system used in the project, can be either 'cjs or 'esm'",
    "esm"
  )
  .example(
    "./node_modules/.bin/cyclops --entrypoint=src/index.js --module=esm --circular-max-depth=5"
  )
  .action(displayGraphStructure)
  .parse(process.argv);
