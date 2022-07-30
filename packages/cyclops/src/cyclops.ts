import path from "node:path";

import { DiGraph, VertexDefinition } from "digraph-js";
import { walk } from "estree-walker";
import { parseScript } from "meriyah";

import { FileReader, FileSystemReader } from "./filesystem/file-reader.js";
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
  includeBaseDir: boolean;
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

const defaultConfig = {
  entrypoint: "",
  module: true,
  includeBaseDir: false,
  circularMaxDepth: Number.POSITIVE_INFINITY
};

export class Cyclops {
  #projectGraph = new DiGraph<CyclopsNode>();
  #visitedNodes = new Set<string>();
  #baseDir = "";

  constructor(
    private readonly config: CyclopsConfig = defaultConfig,
    private readonly fileReader: FileReader = new FileSystemReader()
  ) {
    if (!this.config.entrypoint) {
      throw new Error(
        "An entrypoint must be provided to Cyclops to build the graph"
      );
    }
  }

  private formatNodePath(nodePath: string): string {
    /**
     * When the base directory name has to be included, every node path should be
     * registered while being discovered without any further do
     */
    if (this.config.includeBaseDir) {
      return nodePath;
    }

    /**
     * When the base directory name has to be ignored, we try to remove it
     * in the current node path.
     * "lib/index.js" <-- "lib" is the base directory name
     * "lib/util/index.js" <-- "lib" must be removed from the node path.
     *
     * Given that "lib/index.js" uses "lib/util/index.js" we should have the
     * following graph:
     * {
     *    "index.js": {
     *      adjacentTo: ["util/index.js"]
     *    },
     *    "util/index.js": {}
     * }
     * See above how "lib/" was removed from the "lib/util/index.js" node path
     * because everything needs to be relative to the entrypoint when not including
     * base directory name.
     */
    const baseDirWithFileSystemSeparator = this.#baseDir.concat(path.sep);
    const nodePathWithoutBaseDir = nodePath.split(
      baseDirWithFileSystemSeparator
    )[1];

    if (nodePathWithoutBaseDir) {
      return nodePathWithoutBaseDir;
    }

    /**
     * If we can't create a node path without the base directory name,
     * it probably means that the initial node path is located in an higher scope
     * than the base directory name.
     * Example:
     * Say we have the following file "lib/feature/index.js" with the following
     * content:
     *    import * as _1 from "../something.js";
     *
     * If providing the entrypoint as "lib/feature/index.js", the base
     * directory name will be "lib/feature".
     * However "../something.js" is located in lib/ and is out of the scope of
     * lib/feature (base directory name). Consequently, the node path must
     * be resolved relatively from the base directory name.
     */
    return path.relative(this.#baseDir, nodePath);
  }

  private addNode(node: string): void {
    this.#projectGraph.addVertex({
      id: this.formatNodePath(node),
      adjacentTo: [],
      body: {
        size: 0
      }
    });
  }

  private linkNodes({ from, to }: { from: string; to: string }): void {
    this.addNode(to);
    this.#projectGraph.addEdge({
      from: this.formatNodePath(from),
      to: this.formatNodePath(to)
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

    this.#baseDir = path.dirname(entrypointModulePath);
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
