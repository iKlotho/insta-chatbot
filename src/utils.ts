import * as path from "path";
import * as winston from "winston";
import { promises as fs, constants } from "fs";
import axios from "axios";

export interface AuthData {
  IG_USERNAME: string;
  IG_PASSWORD: string;
}

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "app.log" }),
  ],
});

export async function writeToFile(
  directory: string,
  filename: string,
  content: string,
): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true });

    const filePath = path.join(directory, filename);

    await fs.writeFile(filePath, content, "utf8");

    logger.debug(`File has been written to ${filePath}`);
  } catch (error) {
    logger.warning(`Error writing to file: ${error}`);
  }
}

export async function downloadImageToBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const base64 = Buffer.from(response.data).toString("base64");

    // TODO: check image-type
    return `data:image/png;base64,${base64}`;
  } catch (error: any) {
    logger.error(`Error downloading or converting image: ${error.message}`);
    throw error;
  }
}

export async function sessionSave(data: object) {
  await writeToFile("session/", "account.session", JSON.stringify(data));
  return data;
}

export async function sessionExists(): Promise<boolean> {
  try {
    await fs.access(path.join("session", "account.session"), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function sessionLoad(): Promise<object | null> {
  if (await sessionExists()) {
    const sessionData = await fs.readFile(
      path.join("session/", "account.session"),
      "utf-8",
    );
    return JSON.parse(sessionData);
  }
  return null;
}
