import { asClass, asValue, AwilixContainer, createContainer, InjectionMode } from "awilix";
import { EventStreamService } from "./services/event-stream-service";
import { AppContainer } from "./types";
import { AuthenticateService } from "./services/authenticate-service";
import { OddsFeedService } from "./services/odds-feed-service";
import { AuthController } from "./controllers/auth-controller";
import { EventStreamController } from "./controllers/event-stream-controller";
import { HealthController } from "./controllers/health-controller";
import { logger } from "sc-common";
import { ClientManager } from "./managers/client-manager";
import { initContainer, OddFeedDataContainer, registerContainer } from "./features/container-registry";

export class ContainerRegistry {
  container: AwilixContainer<AppContainer>;

  constructor() {
    this.container = createContainer<AppContainer>({
      injectionMode: InjectionMode.PROXY,
    });
  }

  register() {
    this.container.register({
      clientManager: 
        asClass(ClientManager)
        .singleton()
        .disposer((service) => service.destroy()),
    });

    this.container.register({
      eventStreamService: asClass(EventStreamService).singleton(),
      authenticateService: asClass(AuthenticateService).singleton(),
      oddsFeedService: asClass(OddsFeedService).singleton(),
      logService: asValue(logger),
    });

    this.container.register({
      authController: asClass(AuthController).singleton(),
      eventStreamController: asClass(EventStreamController).singleton(),
      healthController: asClass(HealthController).singleton(),
    });

    registerContainer(this.container as unknown as AwilixContainer<OddFeedDataContainer>);

    return this.container;
  }

  init() {
    initContainer(this.container as unknown as AwilixContainer<OddFeedDataContainer>);
  }
}
