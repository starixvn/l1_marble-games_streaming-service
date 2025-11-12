import { asClass, asValue, AwilixContainer, createContainer, InjectionMode } from "awilix";
import { EventStreamService } from "./services/event-stream-service";
import { AppContainer } from "./types";
import { EventStreamController } from "./controllers/event-stream-controller";
import { HealthController } from "./controllers/health-controller";
import { logger } from "sc-common";
import { ClientManager } from "./managers/client-manager";
import { initContainer, OddsFeedDataContainer, registerContainer } from "./features/container-registry";
import { DebugController } from "./controllers/debug-controller";
import { AwilixDIContainer } from "odds-feed-client/awilix";
import { init, register } from "odds-feed-client/dependency-injection";
import { appConfigs } from "./app-configs";
import { ReplayController } from "./controllers/replay-controller";

export class ContainerRegistry {
  container: AwilixContainer<AppContainer>;
  diContainer: AwilixDIContainer;

  constructor() {
    this.container = createContainer<AppContainer>({
      injectionMode: InjectionMode.PROXY,
    });
    this.diContainer = new AwilixDIContainer(this.container);
  }

  register() {
    register(this.diContainer);
    this.diContainer.register({
      registerType: "value",
      key: "appConfigs",
      value: appConfigs as any,
    });

    this.container.register({
      clientManager: asClass(ClientManager)
        .singleton()
        .disposer((service) => service.destroy()),
    });

    this.container.register({
      eventStreamService: asClass(EventStreamService).singleton(),
      logService: asValue(logger),
    });

    this.container.register({
      eventStreamController: asClass(EventStreamController).singleton(),
      healthController: asClass(HealthController).singleton(),
      debugController: asClass(DebugController)
        .disposer((service) => service.dispose())
        .singleton(),
      replayController: asClass(ReplayController).singleton(),
    });

    registerContainer(this.container as unknown as AwilixContainer<OddsFeedDataContainer>);

    return this.container;
  }

  init() {
    init(this.diContainer, {
      startCurrentEvents: true,
    });
    initContainer(this.container as unknown as AwilixContainer<OddsFeedDataContainer>);
  }
}
