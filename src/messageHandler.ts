import { IgApiClientRealtime } from "instagram_mqtt";
import { logger, writeToFile } from "./utils";
import { classifyImage } from "./classifier";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { LIMIT_RETRY_INFO, MessageOP, WELCOME_MESSAGE } from "./constants";
import { MessageItemType } from "./enums";

class MessageHandler {
  private ig: IgApiClientRealtime;
  private limiter: RateLimiterMemory;
  private accountUserId: number;

  constructor(ig: IgApiClientRealtime, limiter: RateLimiterMemory) {
    this.ig = ig;
    this.limiter = limiter;
    this.accountUserId = Number.parseInt(ig.state.cookieUserId);
  }

  public onMessage = async (data: any) => {
    const { message } = data;

    if (!message.user_id) {
      return;
    }

    // dont process our messages
    // message.user_id: number
    if (message.user_id === this.accountUserId) {
      return;
    }

    if (message.op !== MessageOP.Add) {
      logger.info(
        `Got new message with op ${message.op} from ${message.thread_id}`,
      );
      return;
    }

    logger.info(`Got new message from ${message.user_id}`);

    writeToFile(
      `./messages_example/${message.thread_id}`,
      `${message.item_id}_${message.item_type}.json`,
      JSON.stringify(message),
    );
    const spriteUrl = this.findSpriteUrl(message);
    if (!spriteUrl) {
      logger.info(`[${message.thread_id}] No sprite URL found for the clip.`);
      return;
    }

    try {
      await this.limiter.consume(message.user_id);
    } catch (rejRes: any) {
      const remainingSeconds = Math.round(rejRes.msBeforeNext / 1000);
      logger.error(`Too many requests ${message.user_id} error: ${rejRes}`);
      if (rejRes.consumedPoints < LIMIT_RETRY_INFO) {
        // TODO: check initializing the directThread for every new message is ok
        const thread = this.ig.entity.directThread([
          message.user_id.toString(),
        ]);
        thread.broadcastText(
          `You need to wait ${remainingSeconds} seconds before sending another message.`,
        );
      }
      return;
    }

    const thread = this.ig.entity.directThread([message.user_id.toString()]);
    const friendshipStatus = await this.ig.friendship.show(message.user_id);
    if (!friendshipStatus.followed_by) {
      logger.info(`User ${message.user_id} is not following the account`);
      thread.broadcastText(WELCOME_MESSAGE);
      return;
    }

    const prediction = await classifyImage(spriteUrl);
    if (!prediction) {
      logger.error(`Prediction failed for user ${message.user_id}`);
      return;
    }

    //send the result
    thread.broadcastText(prediction);
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
        `[${message.thread_id}] Unsupported message item type ${message.item_type}`,
      );
    }
    return spriteUrl;
  }
}

export default MessageHandler;
