import { IgApiClient } from "instagram-private-api";
import { IgApiClientRealtime, withRealtime } from "instagram_mqtt";
import MessageHandler from "./src/messageHandler";
import {
  logger,
  AuthData,
  sessionSave,
  sessionExists,
  sessionLoad,
} from "./src/utils";
import { RateLimiterMemory } from "rate-limiter-flexible";

(async () => {
  const limiterFlexible = new RateLimiterMemory({
    // 1 req per 3 minute
    points: 1,
    duration: 60 * 3,
  });

  const { IG_USERNAME, IG_PASSWORD } = process.env as unknown as AuthData;

  if (!IG_USERNAME || !IG_PASSWORD) {
    throw new Error(
      "Environment variables IG_USERNAME and IG_PASSWORD must be set",
    );
  }
  const ig: IgApiClientRealtime = withRealtime(new IgApiClient());
  ig.state.generateDevice(IG_USERNAME);

  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize();
    delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
    sessionSave(serialized);
  });

  if (await sessionExists()) {
    await ig.state.deserialize(await sessionLoad());
  }

  await ig.simulate.preLoginFlow();

  await ig.account.login(IG_USERNAME, IG_PASSWORD);

  logger.info(`Client initialized with user id ${ig.state.cookieUserId}`);
  const messageHandler = new MessageHandler(ig, limiterFlexible);

  // whenever something gets sent and has no event, this is called
  ig.realtime.on("receive", (topic, messages) =>
    logger.info(`receive topic: ${JSON.stringify(topic)} -> message: ${JSON.stringify(messages)}`),
  );

  // this is called with a wrapper use {message} to only get the "actual" message from the wrapper
  ig.realtime.on("message", messageHandler.onMessage);

  // whenever the client has a fatal error
  ig.realtime.on("error", logger.error);

  ig.realtime.on("close", () => logger.error("RealtimeClient closed"));

  await ig.realtime.connect({
    irisData: await ig.feed.directInbox().request(),
    connectOverrides: {},
  });
})();
