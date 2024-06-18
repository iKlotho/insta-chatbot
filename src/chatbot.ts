import { IgApiClientRealtime, withRealtime } from "instagram_mqtt";
import MessageHandler from "./messageHandler";
import { IgApiClient } from "instagram-private-api";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { AuthData, logger } from "./utils";
import { DEFAULT_REQUEST_DELAY } from "./constants";
import SessionManager from "./sessionManager";

export default class ChatBot {
  private ig: IgApiClientRealtime;
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;

  constructor(requestDelayMinutes: number, notifyLimit: boolean) {
    this.ig = withRealtime(new IgApiClient());
    this.messageHandler = new MessageHandler(
      this.ig,
      requestDelayMinutes,
      notifyLimit
    );
    this.sessionManager = new SessionManager();
  }

  public static async create(
    requestDelayMinutes?: number,
    notifyLimit?: boolean
  ): Promise<ChatBot> {
    const instance = new ChatBot(
      requestDelayMinutes || DEFAULT_REQUEST_DELAY,
      notifyLimit || true
    );
    await instance.initialize();
    return instance;
  }

  public async start(): Promise<any> {
    return this.ig.realtime.connect({
      irisData: await this.ig.feed.directInbox().request(),
      connectOverrides: {},
    });
  }

  private async initialize(): Promise<void> {
    this.registerListeners();
    await this.loginFlow();
  }

  private async loginFlow() {
    const { IG_USERNAME, IG_PASSWORD } = process.env as unknown as AuthData;
    if (!IG_USERNAME || !IG_PASSWORD) {
      throw new Error(
        "Environment variables IG_USERNAME and IG_PASSWORD must be set"
      );
    }

    this.ig.state.generateDevice(IG_USERNAME);
    await this.ig.simulate.preLoginFlow();
    await this.loadSession();
    await this.ig.account.login(IG_USERNAME, IG_PASSWORD);
    logger.info(
      `Client initialized with user id ${this.ig.state.cookieUserId}`
    );
  }

  private async loadSession() {
    // subscribe and save session every time state updated
    this.ig.request.end$.subscribe(async () => {
      const serialized = await this.ig.state.serialize();
      delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
      this.sessionManager.sessionSave(serialized);
    });
    const sessionData = await this.sessionManager.sessionLoad();
    if (!sessionData) return;
    await this.ig.state.deserialize(sessionData);
  }

  private registerListeners() {
    this.ig.realtime.on("receive", (topic, messages) =>
      logger.info(
        `receive topic: ${JSON.stringify(topic)} -> message: ${JSON.stringify(
          messages
        )}`
      )
    );
    this.ig.realtime.on("message", this.messageHandler.onMessage);
    this.ig.realtime.on("error", logger.error);
    this.ig.realtime.on("close", () => logger.error("RealtimeClient closed"));
  }
}