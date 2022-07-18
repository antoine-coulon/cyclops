/* eslint-disable no-sync */

import { expect } from "chai";
import * as memfs from "memfs";

import { FileReader } from "../file-reader";

import { Cyclops, CyclopsStructure } from "./main";

class InMemoryFileReader implements FileReader {
  read(filename: string): Promise<string> {
    return new Promise((resolve) => {
      // @ts-expect-error - Will be a string as its decoded in utf-8
      resolve(memfs.fs.readFileSync(filename, "utf-8"));
    });
  }
}

async function buildProjectStructureUsingInMemoryFileExplorer(
  entrypoint: string,
  module = true
): Promise<CyclopsStructure> {
  const cyclops = new Cyclops({ entrypoint, module }, new InMemoryFileReader());
  const cyclopsInstance = await cyclops.initialize();

  return cyclopsInstance.getStructure();
}

describe("When traversing a JavaScript/Node.js project", () => {
  describe("When building the project structure", () => {
    describe("When the looked up file exists and can be read", () => {
      describe("When the file does not have any module declarations", () => {
        it("cyclops should build a graph with only the root node", async () => {
          const fakeFileSystem = {
            "index.js": "console.log('Hello, world!');"
          };
          memfs.vol.fromJSON(fakeFileSystem, "./");

          const projectStructure =
            await buildProjectStructureUsingInMemoryFileExplorer("index.js");

          expect(projectStructure).to.be.deep.equal({
            graph: {
              "index.js": {
                adjacentTo: [],
                id: "index.js",
                body: { size: 0 }
              }
            },
            files: ["index.js"],
            circularDependencies: [],
            hasCircularDependencies: false,
            leaves: ["index.js"]
          });
        });
      });

      describe("When the file contains imports that are not initially JavaScript modules", () => {
        it("should process only with JavaScript modules", async () => {
          const fakeFileSystem = {
            "index.js": `
              const foo = require("./javascript-module.js");
              const staticFile = require("./db.json");
              const binaryModule = require("./binary.node");
            `,
            "javascript-module.js": "console.log('Hello, world!');",
            "binaryModule.node": "",
            "staticFile.json": "{}"
          };
          memfs.vol.fromJSON(fakeFileSystem, "./");

          const projectStructure =
            await buildProjectStructureUsingInMemoryFileExplorer("index.js");

          expect(projectStructure.files).to.deep.equal([
            "index.js",
            "javascript-module.js"
          ]);
        });
      });

      describe("When the project uses ECMAScript modules", () => {
        describe("When extracting module declarations starting from the root file", () => {
          describe("When extracting import declarations", () => {
            describe("When the file has one import declaration", () => {
              it("cyclops should build the graph with two nodes and one link", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    import { foo } from "./src/foo.js";
            
                    console.log(foo.doSomething());
                  `,
                  "src/foo.js": `
                    export const foo = { doSomething: () => 'Hello, world!' };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure).to.be.deep.equal({
                  graph: {
                    "index.js": {
                      adjacentTo: ["src/foo.js"],
                      id: "index.js",
                      body: { size: 0 }
                    },
                    "src/foo.js": {
                      adjacentTo: [],
                      id: "src/foo.js",
                      body: { size: 0 }
                    }
                  },
                  files: ["index.js", "src/foo.js"],
                  circularDependencies: [],
                  hasCircularDependencies: false,
                  leaves: ["src/foo.js"]
                });
              });
            });

            describe("When the project has four nested import declarations", () => {
              it("cyclops should build the graph with all nodes and links", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    import { foo } from "./src/foo.js";
                    console.log(foo.doSomething());
                  `,
                  "src/foo.js": `
                    import { bar } from "./bar.js";
                    export const foo = { doSomething: () => bar() };
                  `,
                  "src/bar.js": `
                    import { baz } from './lib/baz/index.js';
                    export const bar = () => 'Hello, world!';
                  `,
                  "src/lib/baz/index.js": `
                    import lol from "../../lol/index.js";
                    export const baz = () => 'Hello, baz!';
                  `,
                  "src/lol/index.js": `
                    const lol = () => 'Hello, baz!';
                    export default lol;
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure).to.be.deep.equal({
                  graph: {
                    "index.js": {
                      adjacentTo: ["src/foo.js"],
                      id: "index.js",
                      body: { size: 0 }
                    },
                    "src/foo.js": {
                      adjacentTo: ["src/bar.js"],
                      id: "src/foo.js",
                      body: { size: 0 }
                    },
                    "src/bar.js": {
                      adjacentTo: ["src/lib/baz/index.js"],
                      id: "src/bar.js",
                      body: { size: 0 }
                    },
                    "src/lib/baz/index.js": {
                      adjacentTo: ["src/lol/index.js"],
                      id: "src/lib/baz/index.js",
                      body: { size: 0 }
                    },
                    "src/lol/index.js": {
                      adjacentTo: [],
                      id: "src/lol/index.js",
                      body: { size: 0 }
                    }
                  },
                  files: [
                    "index.js",
                    "src/foo.js",
                    "src/bar.js",
                    "src/lib/baz/index.js",
                    "src/lol/index.js"
                  ],
                  circularDependencies: [],
                  hasCircularDependencies: false,
                  leaves: ["src/lol/index.js"]
                });
              });
            });

            describe("When the file contains imports of Node.js core modules", () => {
              it("should ignore Node.js core modules imports by default", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    import { readFile } from "fs/promises";
                    import { join } from "node:path";
                    import { setImmediate } from "node:timers/promises";
                    
                    import * as foobar from "./foobar.js";
  
                    console.log(foobar.foo.doSomething());
                  `,
                  "foobar.js": `
                    export const foo = { doSomething: () => 'Hello, world!' };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure.graph).to.be.deep.equal({
                  "index.js": {
                    adjacentTo: ["foobar.js"],
                    id: "index.js",
                    body: { size: 0 }
                  },
                  "foobar.js": {
                    adjacentTo: [],
                    id: "foobar.js",
                    body: { size: 0 }
                  }
                });
                expect(projectStructure.files).to.be.deep.equal([
                  "index.js",
                  "foobar.js"
                ]);
              });
            });

            describe("When the file imports third-party libraries", () => {
              it("should ignore third-party libraries imports by default", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    import { parseScript } from "meriyah";
                    import * as vuln from "@nodesecure/vuln";
  
                    import * as foobar from "./foobar.js";
  
                    console.log(foobar.foo.doSomething());
                  `,
                  "foobar.js": `
                    export const foo = { doSomething: () => 'Hello, world!' };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure.graph).to.be.deep.equal({
                  "index.js": {
                    adjacentTo: ["foobar.js"],
                    id: "index.js",
                    body: { size: 0 }
                  },
                  "foobar.js": {
                    adjacentTo: [],
                    id: "foobar.js",
                    body: { size: 0 }
                  }
                });
                expect(projectStructure.files).to.be.deep.equal([
                  "index.js",
                  "foobar.js"
                ]);
              });
            });
          });

          describe("When extracting export declarations", () => {
            describe("When the file contains some 'ExportAllDeclaration'", () => {
              it("should extract all related export declarations", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    export * from "./foobar.js";
                    export * as foo from "./foo.js";
                  `,
                  "foobar.js": `
                    export const foo = { doSomething: () => 'Hello, world!' };
                  `,
                  "foo.js": `
                    export const foo = { doSomething: () => 'Hello, world!' };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure.graph).to.be.deep.equal({
                  "index.js": {
                    adjacentTo: ["foobar.js", "foo.js"],
                    id: "index.js",
                    body: { size: 0 }
                  },
                  "foobar.js": {
                    adjacentTo: [],
                    id: "foobar.js",
                    body: { size: 0 }
                  },
                  "foo.js": {
                    adjacentTo: [],
                    id: "foo.js",
                    body: { size: 0 }
                  }
                });
                expect(projectStructure.files).to.be.deep.equal([
                  "index.js",
                  "foobar.js",
                  "foo.js"
                ]);
              });
            });

            describe("When the file contains some 'ExportNamedDeclaration", () => {
              it("should only extract named exports with a source", async () => {
                const fakeFileSystem = {
                  "index.js": `
                    export { foobar } from "./foobar.js";
                  `,
                  "foobar.js": `
                    import { foo } from "./foo.js"
                    export const foobar = { doSomething: () => 'Hello, world!' };
                  `,
                  "foo.js": `
                    export const foo = { doSomething: () => foobar() };
  
                    const foo2 = { doSomething: () => foobar() };
                    export { foo2 };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const projectStructure =
                  await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                expect(projectStructure.graph).to.be.deep.equal({
                  "index.js": {
                    adjacentTo: ["foobar.js"],
                    id: "index.js",
                    body: { size: 0 }
                  },
                  "foobar.js": {
                    adjacentTo: ["foo.js"],
                    id: "foobar.js",
                    body: { size: 0 }
                  },
                  "foo.js": {
                    adjacentTo: [],
                    id: "foo.js",
                    body: { size: 0 }
                  }
                });
                expect(projectStructure.files).to.be.deep.equal([
                  "index.js",
                  "foobar.js",
                  "foo.js"
                ]);
              });
            });
          });

          describe("When the project contains circular dependencies", () => {
            describe("When there is direct a circular dependency between two files importing each other", () => {
              it("should find the cycle and keep traversing other nodes", async () => {
                const fakeFileSystem = {
                  "a.js": `
                    import { b } from "./b.js";
                    export const a = () => b();
                  `,
                  "b.js": `
                    import { a } from "./a.js";
                    import { c } from "./c.js";
                    export const b = { doSomething: () => bar() };
                  `,
                  "c.js": `
                    export const c = { doSomething: () => {} };
                  `
                };

                memfs.vol.fromJSON(fakeFileSystem, "./");

                const { graph, hasCircularDependencies, circularDependencies } =
                  await buildProjectStructureUsingInMemoryFileExplorer("a.js");

                expect(graph).to.deep.equal({
                  "a.js": {
                    id: "a.js",
                    adjacentTo: ["b.js"],
                    body: { size: 0 }
                  },
                  "b.js": {
                    id: "b.js",
                    adjacentTo: ["a.js", "c.js"],
                    body: { size: 0 }
                  },
                  "c.js": {
                    id: "c.js",
                    adjacentTo: [],
                    body: { size: 0 }
                  }
                });

                expect(hasCircularDependencies).to.equal(true);
                expect(circularDependencies).to.deep.equal([["b.js", "a.js"]]);
              });
            });

            describe("When there is an indirect circular dependency involving many files imports", () => {
              describe("When all the files are involved in the cycle", () => {
                it("should find the cycle and traverse+link all nodes involved in the cycle", async () => {
                  const fakeFileSystem = {
                    "a.js": `
                      import { b } from "./b.js";
                      export const a = () => b();
                    `,
                    "b.js": `
                      import { c } from "./c.js";
                      export const b = { doSomething: () => bar() };
                    `,
                    "c.js": `
                      import { d } from "./d.js";
                      export const c = { doSomething: () => {} };
                    `,
                    "d.js": `
                      import { a } from "./a.js";
                      export const d = { doSomething: () => {} };
                    `
                  };

                  memfs.vol.fromJSON(fakeFileSystem, "./");

                  const {
                    graph,
                    hasCircularDependencies,
                    circularDependencies
                  } = await buildProjectStructureUsingInMemoryFileExplorer(
                    "a.js"
                  );

                  expect(graph).to.deep.equal({
                    "a.js": {
                      id: "a.js",
                      adjacentTo: ["b.js"],
                      body: { size: 0 }
                    },
                    "b.js": {
                      id: "b.js",
                      adjacentTo: ["c.js"],
                      body: { size: 0 }
                    },
                    "c.js": {
                      id: "c.js",
                      adjacentTo: ["d.js"],
                      body: { size: 0 }
                    },
                    "d.js": {
                      id: "d.js",
                      adjacentTo: ["a.js"],
                      body: { size: 0 }
                    }
                  });

                  expect(hasCircularDependencies).to.equal(true);
                  expect(circularDependencies).to.deep.equal([
                    ["b.js", "c.js", "d.js", "a.js"]
                  ]);
                });
              });

              describe("When only some of the files are involved in the cycle", () => {
                it("should find the cycle and keep traversing+linking other nodes not involved in the cycle", async () => {
                  const fakeFileSystem = {
                    "index.js": `
                    import * as _ from "./src/feature.js";
                  `,
                    "src/feature.js": `
                    import * as _ from "./constants.js";
                    import * as _ from "./utils/index.js";
                    import * as _ from "./other-feature.js";
                  `,
                    "src/constants.js": ``,
                    "src/utils/index.js": `
                    import { doSomethingUtil } from "./doSomethingUtil.js";
                  `,
                    "src/utils/doSomethingUtil.js": `
                    import { anything } from "./index.js";
                  `,
                    "src/other-feature.js": `
                    import { scripts } from "./last-feature.js";
                    import { utils } from "./utils/index.js";
                  `,
                    "src/last-feature.js": ``
                  };

                  memfs.vol.fromJSON(fakeFileSystem, "./");

                  const {
                    graph,
                    circularDependencies,
                    hasCircularDependencies,
                    files
                  } = await buildProjectStructureUsingInMemoryFileExplorer(
                    "index.js"
                  );

                  expect(graph).to.deep.equal({
                    "index.js": {
                      id: "index.js",
                      adjacentTo: ["src/feature.js"],
                      body: { size: 0 }
                    },
                    "src/feature.js": {
                      id: "src/feature.js",
                      adjacentTo: [
                        "src/constants.js",
                        "src/utils/index.js",
                        "src/other-feature.js"
                      ],
                      body: { size: 0 }
                    },
                    "src/constants.js": {
                      id: "src/constants.js",
                      adjacentTo: [],
                      body: { size: 0 }
                    },
                    "src/utils/index.js": {
                      id: "src/utils/index.js",
                      adjacentTo: ["src/utils/doSomethingUtil.js"],
                      body: { size: 0 }
                    },
                    "src/utils/doSomethingUtil.js": {
                      id: "src/utils/doSomethingUtil.js",
                      adjacentTo: ["src/utils/index.js"],
                      body: { size: 0 }
                    },
                    "src/other-feature.js": {
                      id: "src/other-feature.js",
                      adjacentTo: ["src/last-feature.js", "src/utils/index.js"],
                      body: { size: 0 }
                    },
                    "src/last-feature.js": {
                      id: "src/last-feature.js",
                      adjacentTo: [],
                      body: { size: 0 }
                    }
                  });

                  expect(files).to.deep.equal([
                    "index.js",
                    "src/feature.js",
                    "src/constants.js",
                    "src/utils/index.js",
                    "src/utils/doSomethingUtil.js",
                    "src/other-feature.js",
                    "src/last-feature.js"
                  ]);

                  expect(hasCircularDependencies).to.equal(true);
                  expect(circularDependencies).to.deep.equal([
                    ["src/utils/doSomethingUtil.js", "src/utils/index.js"]
                  ]);
                });
              });
            });
          });
        });
      });

      describe("When the project uses CommonJS modules", () => {
        describe("When extracting import declarations", () => {
          const mixOfScenariosWithRequireImports = [
            {
              description:
                "When the file has one require identifier without the file extension",
              requireIdentifier: `require("./src/foo")`,
              expectedFinalFileExtension: "js"
            },
            {
              description:
                "When the file has one require identifier with a .js extension",
              requireIdentifier: `require("./src/foo.js")`,
              expectedFinalFileExtension: "js"
            },
            {
              description:
                "When the file has one require identifier with a .cjs extension",
              requireIdentifier: `require("./src/foo.cjs")`,
              expectedFinalFileExtension: "cjs"
            }
          ];

          for (const scenarioWithRequireImport of mixOfScenariosWithRequireImports) {
            it(scenarioWithRequireImport.description, async () => {
              const fakeFileSystem = {
                "index.js": `
                  const { foo } = ${scenarioWithRequireImport.requireIdentifier};
          
                  console.log(foo.doSomething());
                `,
                [`src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`]: `
                  module.exports.foo = { doSomething: () => 'Hello, world!' };
                `
              };

              memfs.vol.fromJSON(fakeFileSystem, "./");

              const projectStructure =
                await buildProjectStructureUsingInMemoryFileExplorer(
                  "index.js",
                  false
                );

              expect(projectStructure).to.be.deep.equal({
                graph: {
                  "index.js": {
                    adjacentTo: [
                      `src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`
                    ],
                    id: `index.js`,
                    body: { size: 0 }
                  },
                  [`src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`]:
                    {
                      adjacentTo: [],
                      id: `src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`,
                      body: { size: 0 }
                    }
                },
                files: [
                  `index.js`,
                  `src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`
                ],
                circularDependencies: [],
                hasCircularDependencies: false,
                leaves: [
                  `src/foo.${scenarioWithRequireImport.expectedFinalFileExtension}`
                ]
              });
            });
          }
        });
      });

      describe("When searching for leaves", () => {
        it("should only return nodes identifiers with no children", async () => {
          const fakeFileSystem = {
            "index.js": "export * from './file1.js';",
            "file1.js": "import { F2 } from './file2.js';",
            "file2.js": "export const F2 = 10;"
          };
          memfs.vol.fromJSON(fakeFileSystem, "./");

          const { leaves } =
            await buildProjectStructureUsingInMemoryFileExplorer("index.js");

          expect(leaves).to.be.deep.equal(["file2.js"]);
        });
      });

      describe("When deeply searching for parents of a given node", () => {
        it("should traverse the graph bottom-to-top and collect every file depending on the target", async () => {
          const fakeFileSystem = {
            "a.js": `
              import { b } from "./b.js";
              export const a = () => b();
            `,
            "b.js": `
              import { c } from "./c.js";
              export const b = { doSomething: () => bar() };
            `,
            "c.js": `
              import { d } from "./d.js";
              import { x } from "./x.js";
              export const c = { doSomething: () => {} };
            `,
            "x.js": `
              export const x = { doSomething: () => {} };
            `,
            "d.js": `
              export const d = { doSomething: () => {} };
            `
          };

          memfs.vol.fromJSON(fakeFileSystem, "./");

          const cyclops = new Cyclops(
            { entrypoint: "a.js", module: true },
            new InMemoryFileReader()
          );

          const cyclopsInstance = await cyclops.initialize();
          expect(cyclopsInstance.findParentsOf("d.js")).to.deep.equal([
            "c.js",
            "b.js",
            "a.js"
          ]);
          expect(cyclopsInstance.findParentsOf("c.js")).to.deep.equal([
            "b.js",
            "a.js"
          ]);
          expect(cyclopsInstance.findParentsOf("a.js")).to.deep.equal([]);
        });
      });
    });

    describe("When the looked up file does not exist", () => {
      it("should ignore the file not found/readable and keep looking up for other files", async () => {
        const fakeFileSystem = {
          "index.js": `
            // exists
            import { foo } from './foo.js';

            // does not exist or can't be reached
            import { bar } from './bar.js';

            // exists
            import { baz } from './baz.js';
          `,
          "foo.js": "",
          "baz.js": ""
        };
        memfs.vol.fromJSON(fakeFileSystem, "./");

        const { files, graph } =
          await buildProjectStructureUsingInMemoryFileExplorer("index.js");

        expect(graph).to.deep.equal({
          "index.js": {
            id: "index.js",
            adjacentTo: ["foo.js", "baz.js"],
            body: { size: 0 }
          },
          "foo.js": {
            id: "foo.js",
            adjacentTo: [],
            body: { size: 0 }
          },
          "baz.js": {
            id: "baz.js",
            adjacentTo: [],
            body: { size: 0 }
          }
        });
        expect(files).to.be.deep.equal(["index.js", "foo.js", "baz.js"]);
      });
    });
  });
});
