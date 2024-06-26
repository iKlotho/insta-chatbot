import { IgApiClientRealtime } from "instagram_mqtt";
import { logger } from "./utils";
import { PENDING_MESSAGE_DELAY } from "./constants";

export class PendingMessageManager {
  private ig: IgApiClientRealtime;

  constructor(ig: IgApiClientRealtime) {
    this.ig = ig;
  }

  async initialize() {
    await this.approvePendingMessages();

    setInterval(async () => {
      await this.approvePendingMessages();
    }, PENDING_MESSAGE_DELAY);
  }

  async approvePendingMessages() {
    logger.info(`Checking pending threads`);
    const items = await this.ig.feed.directPending().items();
    items.forEach(async (item) => {
      logger.info(`New thread found ${item.thread_id}`);
      await this.ig.directThread.approve(item.thread_id);
      try {
        const thread = this.ig.entity.directThread([
          item.inviter.pk.toString(),
        ]);
        thread.broadcastText(
          `Hello, I just approved your DM. Please send your message again`
        );
      } catch (error) {
        logger.error(`Error while responding to a user ${error}`);
      }
      logger.info(`Approved the thread ${item.thread_id}`);
    });
  }
}
