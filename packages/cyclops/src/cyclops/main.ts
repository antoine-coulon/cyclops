import path from "path";

import { DiGraph, VertexDefinition } from "digraph-js";
import { walk } from "estree-walker";
import { parseScript } from "meriyah";

import { FileReader, FileSystemReader } from "../file-reader/index.js";

import { isCommonJSModuleImport } from "./modules/cjs.js";
import { isEcmaScriptModuleDeclaration } from "./modules/esm.js";
import {
  resolveImportedModulePath,
  isBinaryModule,
  isBuiltinModule,
  isJSONModule,
  isThirdPartyModule
} from "./modules/import-checker.js";

type CyclopsNode = VertexDefinition<{ size: number }>;

export interface CyclopsConfig {
  entrypoint: string;
  module: boolean;
  circularMaxDepth?: number;
}

export interface CyclopsStructure {
  graph: Record<string, CyclopsNode>;
  files: string[];
  circularDependencies: string[][];
  hasCircularDependencies: boolean;
  leaves: string[];
}

export interface CyclopsInstance {
  getStructure: () => CyclopsStructure;
  findLeaves: () => string[];
  findCircularDependencies: () => string[][];
  hasCircularDependencies: () => boolean;
  findParentsOf: (node: string) => string[];
}

export class Cyclops {
  #projectGraph = new DiGraph<CyclopsNode>();
  #visitedNodes = new Set<string>();

  constructor(
    private readonly config: CyclopsConfig,
    private readonly fileReader: FileReader = new FileSystemReader()
  ) {}

  private addNode(node: string): void {
    this.#projectGraph.addVertex({
      id: node,
      adjacentTo: [],
      body: {
        size: 0
      }
    });
  }

  private linkNodes({ from, to }: { from: string; to: string }): void {
    this.addNode(to);
    this.#projectGraph.addEdge({
      from,
      to
    });
  }

  private async followModuleDeclarationsFromFile(
    rootDir: string,
    fileContent: string
  ): Promise<void> {
    if (this.#visitedNodes.has(rootDir)) {
      return;
    }

    const moduleDeclarations = new Set<string>();
    const node = parseScript(fileContent, {
      module: this.config.module,
      next: true
    });
    const isRootNode = node.type === "Program";

    walk(isRootNode ? node.body : node, {
      enter(node) {
        if (isCommonJSModuleImport(node)) {
          moduleDeclarations.add(node.arguments[0].value);
        }

        if (isEcmaScriptModuleDeclaration(node)) {
          moduleDeclarations.add(node.source.value);
        }
      }
    });

    this.#visitedNodes.add(rootDir);

    if (moduleDeclarations.size === 0) {
      return;
    }

    for (const moduleDeclaration of moduleDeclarations.values()) {
      if (
        isBuiltinModule(moduleDeclaration) ||
        isThirdPartyModule(moduleDeclaration) ||
        isBinaryModule(moduleDeclaration) ||
        isJSONModule(moduleDeclaration)
      ) {
        continue;
      }

      const fullFilePathFromEntrypoint = await resolveImportedModulePath(
        path.join(path.dirname(rootDir), moduleDeclaration),
        this.fileReader
      );

      try {
        const nextFileContentToExplore = await this.fileReader.read(
          fullFilePathFromEntrypoint
        );

        this.addNode(fullFilePathFromEntrypoint);
        this.linkNodes({
          from: rootDir,
          to: fullFilePathFromEntrypoint
        });

        await this.followModuleDeclarationsFromFile(
          fullFilePathFromEntrypoint,
          nextFileContentToExplore
        );
      } catch {}
    }
  }

  private hasCircularDependencies(): boolean {
    return this.#projectGraph.hasCycles({
      maxDepth: this.config.circularMaxDepth ?? Number.POSITIVE_INFINITY
    });
  }

  private circularDependencies(): string[][] {
    return this.#projectGraph.findCycles({
      maxDepth: this.config.circularMaxDepth ?? Number.POSITIVE_INFINITY
    });
  }

  private findLeaves(): string[] {
    return Object.entries(this.#projectGraph.toDict())
      .filter(([_, node]) => node.adjacentTo.length === 0)
      .map(([leafId]) => leafId);
  }

  private findParentsOf(node: string): string[] {
    return this.#projectGraph.getDeepUpperDependencies(node);
  }

  private makeProjectStructure(): CyclopsStructure {
    const projectStructure = this.#projectGraph.toDict();

    return {
      graph: projectStructure,
      files: Object.keys(projectStructure),
      leaves: this.findLeaves(),
      circularDependencies: this.circularDependencies(),
      hasCircularDependencies: this.hasCircularDependencies()
    };
  }

  public async initialize(): Promise<CyclopsInstance> {
    const entrypointModulePath = await resolveImportedModulePath(
      this.config.entrypoint,
      this.fileReader
    );
    const rootFileContent = await this.fileReader.read(entrypointModulePath);

    this.addNode(entrypointModulePath);
    await this.followModuleDeclarationsFromFile(
      entrypointModulePath,
      rootFileContent
    );

    return {
      getStructure: this.makeProjectStructure.bind(this),
      findCircularDependencies: this.circularDependencies.bind(this),
      hasCircularDependencies: this.hasCircularDependencies.bind(this),
      findLeaves: this.findLeaves.bind(this),
      findParentsOf: this.findParentsOf.bind(this)
    };
  }
}
