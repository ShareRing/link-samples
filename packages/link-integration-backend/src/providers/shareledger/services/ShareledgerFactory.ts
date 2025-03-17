import { ShareledgerClient } from "@shareledgerjs/client";
import { Configuration, registerProvider } from "@tsed/di";
import { Logger } from "@tsed/logger";
import { ShareledgerSettings } from "../domain/ShareledgerSettings";

registerProvider({
  provide: ShareledgerClient,
  deps: [Logger, Configuration],
  async useAsyncFactory(logger: Logger, config: Configuration): Promise<ShareledgerClient> {
    const options = config.get<ShareledgerSettings>("shareledger", {} as ShareledgerSettings);
    try {
      const { rpcEndpoint } = options;
      const client = await ShareledgerClient.connect(rpcEndpoint);
      return client;
    } catch (err) {
      logger.error(err);
      process.exit();
    }
  }
});
