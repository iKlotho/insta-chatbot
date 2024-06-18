import { promises as fs, constants } from "fs";
import { writeToFile } from "./utils";
import * as path from "path";

export default class SessionManager {
  private filename: string;
  private filepath: string;
  constructor() {
    this.filename = "account_session.json";
    this.filepath = path.join("./session/", this.filename);
  }

  async sessionSave(data: object): Promise<object> {
    await writeToFile(this.filepath, this.filename, JSON.stringify(data));
    return data;
  }

  async sessionExists(): Promise<boolean> {
    try {
      await fs.access(this.filepath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async sessionLoad(): Promise<object | null> {
    if (await this.sessionExists()) {
      const sessionData = await fs.readFile(this.filepath, "utf-8");
      return JSON.parse(sessionData);
    }
    return null;
  }
}
