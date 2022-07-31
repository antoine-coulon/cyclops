import { expect } from "chai";

import { makeTreeStructure } from ".";

describe("Filesystem tree structure maker", () => {
  describe("When dealing with absolute paths", () => {
    describe("When there is one file with no base directory", () => {
      it("should make a flat tree structure", () => {
        const filePaths = ["index.js"];

        expect(makeTreeStructure(filePaths)).to.deep.equal({
          "index.js": {}
        });
      });
    });

    describe("When files are not located in the same parent directories", () => {
      it("should make a tree structure from raw file paths", () => {
        const filePaths = ["lib/feature/index.js", "apps/main.js"];

        expect(makeTreeStructure(filePaths)).to.deep.equal({
          lib: {
            feature: {
              "index.js": {}
            }
          },
          apps: {
            "main.js": {}
          }
        });
      });
    });

    describe("When files are located in the same exact parent directories", () => {
      it("should make a tree structure with common parents", () => {
        const filePaths = ["lib/feature/index.js", "lib/feature/util.js"];

        expect(makeTreeStructure(filePaths)).to.deep.equal({
          lib: {
            feature: {
              "index.js": {},
              "util.js": {}
            }
          }
        });
      });
    });

    describe("When files are only sharing a subset of parent directories", () => {
      it("should nest them in the same leaves until they diverge", () => {
        const filePaths = ["lib/feature/index.js", "lib/feature/util/index.js"];

        expect(makeTreeStructure(filePaths)).to.deep.equal({
          lib: {
            feature: {
              "index.js": {},
              util: {
                "index.js": {}
              }
            }
          }
        });
      });
    });
  });

  describe("When dealing with base directory names", () => {
    describe("When the directory name is the current working directory", () => {
      it("should trim the base directory segment", () => {
        const filePaths = [
          "./lib/feature/index.js",
          "lib/util.js",
          "../something.js",
          "../../something-faraway.js"
        ];

        expect(makeTreeStructure(filePaths)).to.deep.equal({
          lib: {
            feature: {
              "index.js": {}
            },
            "util.js": {}
          },
          "..": {
            "something.js": {},
            "..": {
              "something-faraway.js": {}
            }
          }
        });
      });
    });
  });
});
