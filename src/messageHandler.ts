import { IgApiClientRealtime } from "instagram_mqtt";
import { logger, saveMessage, writeToFile } from "./utils";
import { classifyImage } from "./classifier";
import { RateLimiterMemory } from "rate-limiter-flexible";
import {
  LIMIT_RETRY_INFO,
  PREDICTION_FAIL_MESSAGE,
  SPRITE_NOT_FOUND_MESSAGE,
  WELCOME_MESSAGE,
} from "./constants";
import { MessageItemType, MessageOperation } from "./enums";

class MessageHandler {
  private ig: IgApiClientRealtime;
  private limiter: RateLimiterMemory;
  private notifyLimit: boolean;

  constructor(
    ig: IgApiClientRealtime,
    requestDelayMinutes: number,
    notifyLimit: boolean
  ) {
    this.ig = ig;
    this.limiter = new RateLimiterMemory({
      // 1 req per X minute
      points: 1,
      duration: requestDelayMinutes * 60,
    });
    this.notifyLimit = notifyLimit;
    logger.info(
      `MessageHandler created with message limit as 1req/${requestDelayMinutes}m`
    );
  }

  public onMessage = async (data: any): Promise<void> => {
    const { message } = data;
    const { user_id: userId } = message;
    const accountUserId = Number.parseInt(this.ig.state.cookieUserId);
    if (!userId) {
      logger.info("No user id found for the message");
      return;
    }
    if (userId === accountUserId) {
      logger.info("Skipping message same user id");
      return;
    }
    if (message.op !== MessageOperation.Add) {
      logger.info(
        `Got new message with op ${message.op} from ${message.thread_id}`
      );
      return;
    }

    if (process.env.DEBUG) await saveMessage(message);
    logger.info(`Got new message from ${userId}`);

    // check user limit
    try {
      await this.limiter.consume(userId);
    } catch (rlRejected: any) {
      const remainingSeconds = Math.round(rlRejected.msBeforeNext / 1000);
      logger.error(`Too many requests ${userId} error: ${rlRejected}`);
      if (rlRejected.consumedPoints < LIMIT_RETRY_INFO && this.notifyLimit) {
        await this.sendUserMessage(
          userId,
          `You need to wait ${remainingSeconds} seconds before sending another message.`
        );
      }
      return;
    }

    const spriteUrl = this.findSpriteUrl(message);
    if (!spriteUrl) {
      logger.info(`[${message.thread_id}] No sprite URL found for the clip.`);
      await this.sendUserMessage(userId, SPRITE_NOT_FOUND_MESSAGE);
      return;
    }

    const friendshipStatus = await this.ig.friendship.show(userId);
    if (!friendshipStatus.followed_by) {
      logger.info(`User ${userId} is not following the account`);
      await this.sendUserMessage(userId, WELCOME_MESSAGE);
      return;
    }

    const prediction = await classifyImage(spriteUrl);
    if (!prediction) {
      logger.error(`Prediction failed for user ${userId}`);
      await this.sendUserMessage(userId, PREDICTION_FAIL_MESSAGE);
      return;
    }

    //send the result
    await this.sendUserMessage(userId, prediction);
  };

  public findSpriteUrl(message: any) {
    let spriteUrl: any = null;

    if (message.item_type === MessageItemType.Clip) {
      const { clip } = message.clip;
      // spriteUrl =
      //   clip.image_versions2?.scrubber_spritesheet_info_candidates?.default
      //     ?.sprite_urls || clip.image_versions2?.candidates?.[0]?.url;
      spriteUrl = clip.image_versions2?.candidates?.[0]?.url;
    } else if (message.item_type === MessageItemType.MediaShare) {
      const { media_share } = message;
      spriteUrl = media_share.image_versions2?.candidates?.[0].url;
    } else {
      logger.error(
        `[${message.thread_id}] Unsupported message item type ${message.item_type}`
      );
    }
    return spriteUrl;
  }

  private async sendUserMessage(userId: number, content: string) {
    const thread = this.ig.entity.directThread([userId.toString()]);
    thread.broadcastText(content);
  }
}

export default MessageHandler;
