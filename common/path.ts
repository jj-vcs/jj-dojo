import { logAndShowInternalError } from "../logging/logging";

export class AbsolutePath {
  private readonly parts: string[];
  readonly value: string;

  constructor(path: string) {
    const parts = path.split("/");
    if (parts.shift() !== '') {
      throw logAndShowInternalError(`Not absolute path: ${path}`);
    }
    for (const part of parts) {
      if (part.length === 0) {
        throw logAndShowInternalError(`Invalid path: ${path}`);
      }
      if (part.indexOf("..") !== -1) {
        throw logAndShowInternalError(`Invalid path: ${path}`);
      }
    }
    this.parts = parts;
    this.value = "/" + this.parts.join("/");
  }

  equals(path: AbsolutePath) {
    return this.value === path.value;
  }

  parent(): AbsolutePath {
    const parentParts = [...this.parts];
    parentParts.pop();
    return new AbsolutePath("/" + parentParts.join("/"));
  }

  basename(): string {
    if (this.parts.length === 0) {
      return "";
    }
    return this.parts[this.parts.length - 1];
  }

  join(relativePath: string): AbsolutePath {
    if (relativePath.startsWith("/")) {
      throw logAndShowInternalError(
        "Arguments to .join must be a relative path"
      );
    }
    return new AbsolutePath(this.value + "/" + relativePath);
  }

  isParentOf(path: AbsolutePath): boolean {
    return path.value.indexOf(this.value + "/") !== -1;
  }
}
