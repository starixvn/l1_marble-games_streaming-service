import { logger } from "sc-common";
import { appConfigs } from "./app-configs";

type AppConfig = typeof appConfigs;

export class Configuration {
  async configureDatabaseAndSentry(configs: AppConfig) {
    logger.start(configs.sentry as any);
  }
}
