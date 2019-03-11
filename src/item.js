// @flow
import * as fs from "fs-extra";
import nodePath from "path";
import is from "sarcastic";
import { readFileSync } from "fs";

let itemsByPath: { [string]: Set<Item> } = {};

export class Item {
  _contents: string;
  path: string;
  directory: string;
  json: Object;
  _config: Object;
  constructor(filePath: string, contents: string) {
    this.json = is(JSON.parse(contents), is.object);
    this._contents = contents;
    this.path = filePath;
    this.directory = nodePath.dirname(filePath);
    this._config = this.json.preconstruct || {};
    if (itemsByPath[this.path] === undefined) {
      itemsByPath[this.path] = new Set();
    }
    itemsByPath[this.path].add(this);
  }

  static async create(directory: string): Promise<this> {
    let filePath = nodePath.join(directory, "package.json");
    let contents = await fs.readFile(filePath, "utf-8");
    let item = new this(filePath, contents);
    await item._init();
    return item;
  }
  static createSync(directory: string): this {
    let filePath = nodePath.join(directory, "package.json");
    let contents = readFileSync(filePath, "utf-8");
    let item = new this(filePath, contents);
    item._initSync();
    return item;
  }
  _initSync() {}
  async _init() {}
  updater(json: Object) {
    this.json = json;
  }

  async refresh() {
    let contents: string = await fs.readFile(this.path, "utf-8");
    let json = is(JSON.parse(contents), is.object);
    for (let item of itemsByPath[this.path]) {
      item.updater(json);
    }
  }
  async save() {
    if (Object.keys(this._config).length) {
      this.json.preconstruct = this._config;
    } else {
      delete this.json.preconstruct;
    }
    await fs.writeFile(this.path, JSON.stringify(this.json, null, 2) + "\n");

    this._config = this.json.preconstruct || {};
    for (let item of itemsByPath[this.path]) {
      item.updater(this.json);
    }
  }
}