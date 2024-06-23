import { IgApiClientRealtime, withRealtime } from "instagram_mqtt";
import MessageHandler from "./messageHandler";
import { IgApiClient } from "instagram-private-api";
import { AuthData, logger } from "./utils";
import { DEFAULT_REQUEST_DELAY, REALTIME_RECONNECT_DELAY } from "./constants";
import SessionManager from "./sessionManager";
import { PendingMessageManager } from "./pendingManager";

export default class ChatBot {
  private ig: IgApiClientRealtime;
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;
  private pendingManager: PendingMessageManager;
  private intervalId?: any;

  constructor(requestDelayMinutes: number, notifyLimit: boolean) {
    this.ig = withRealtime(new IgApiClient());
    this.messageHandler = new MessageHandler(
      this.ig,
      requestDelayMinutes,
      notifyLimit
    );
    this.sessionManager = new SessionManager();
    this.pendingManager = new PendingMessageManager(this.ig);
  }

  /**
   * Creates an instance of ChatBot with specified configurations.
   *
   * @param {number} [requestDelayMinutes=DEFAULT_REQUEST_DELAY] - Optional. The delay between requests in minutes. Defaults to DEFAULT_REQUEST_DELAY if not provided.
   * @param {boolean} [notifyLimit=true] - Optional. Whether to notify when the request limit is reached. Defaults to true if not provided.
   */
  public static async create(
    requestDelayMinutes?: number,
    notifyLimit?: boolean
  ): Promise<ChatBot> {
    const instance = new ChatBot(
      requestDelayMinutes || DEFAULT_REQUEST_DELAY,
      notifyLimit || true
    );
    await instance.initialize();
    await instance.pendingManager.initialize();
    return instance;
  }

  /**
   * Starts the ChatBot by connecting to Instagram's real-time service.
   */
  async connect() {
    logger.info("Connected to realtime");
    return this.ig.realtime.connect({
      irisData: await this.ig.feed.directInbox().request(),
      connectOverrides: {},
    });
  }

  public async start(): Promise<any> {
    await this.connect();
    if (!this.intervalId) {
      logger.info("Created a interval for realtime reconnect");
      this.intervalId = setInterval(async () => {
        try {
          await this.ig.realtime.disconnect();
          // Wait 5 seconds
          await new Promise((resolve) => setTimeout(resolve, 5000));
          // Reconnect
          await this.connect();
        } catch (err) {
          console.error("Failed to reconnect:", err);
        }
      }, REALTIME_RECONNECT_DELAY);
    }
  }

  async disconnect() {
    logger.info("Disconnected from realtime");
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
    this.ig.realtime.on("disconnect", this.disconnect);
    this.ig.realtime.on("message", this.messageHandler.onMessage);
    this.ig.realtime.on("direct", (data) => {
      console.log("new direct", data);
    });
    this.ig.realtime.on("error", logger.error);
    this.ig.realtime.on("close", () => logger.error("RealtimeClient closed"));
  }
}
