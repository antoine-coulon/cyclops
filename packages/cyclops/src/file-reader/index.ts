import { R_OK } from "node:constants";
import fs from "node:fs/promises";

export interface FileReader {
  read: (filename: string) => Promise<string>;
}

export class FileSystemReader implements FileReader {
  read(filename: string): Promise<string> {
    return fs.readFile(filename, { encoding: "utf-8", flag: R_OK });
  }
}
