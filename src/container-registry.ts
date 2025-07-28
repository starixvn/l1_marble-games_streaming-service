import { asClass, asValue, AwilixContainer, createContainer, InjectionMode } from "awilix";
import { EventStreamService } from "./services/event-stream-service";
import { AppContainer } from "./types";
import { AuthenticateService } from "./services/authenticate-service";
import { OddsFeedService } from "./services/odds-feed-service";
import { AuthController } from "./controllers/auth-controller";
import { EventStreamController } from "./controllers/event-stream-controller";
import { HealthController } from "./controllers/health-controller";
import { MonitorController } from "./controllers/monitor-controller";
import { logger } from "sc-common";
import { EventManagementService } from "./services/event-management-service";
import { EventStore } from "./stores/event-store";
import { JobScheduler } from "./services/job-scheduler";
import { EventSchedulerService } from "./services/event-scheduler-service";
import { EventManager } from "./stores/event-manager";
import { ClientManager } from "./managers/client-manager";

export class ContainerRegistry {
  container: AwilixContainer<AppContainer>;

  constructor() {
    this.container = createContainer<AppContainer>({
      injectionMode: InjectionMode.PROXY,
    });
  }

  register() {
    this.container.register({
      eventStore: asClass(EventStore).singleton(),
      eventManager: asClass(EventManager).singleton(),
      clientManager: asClass(ClientManager).singleton(),
    });

    this.container.register({
      eventStreamService: asClass(EventStreamService).singleton(),
      authenticateService: asClass(AuthenticateService).singleton(),
      oddsFeedService: asClass(OddsFeedService).singleton(),
      logService: asValue(logger),
      eventManagementService: asClass(EventManagementService).singleton(),
      jobScheduler: asClass(JobScheduler).singleton(),
      eventSchedulerService: asClass(EventSchedulerService).singleton(),
    });

    this.container.register({
      authController: asClass(AuthController).singleton(),
      eventStreamController: asClass(EventStreamController).singleton(),
      healthController: asClass(HealthController).singleton(),
      monitorController: asClass(MonitorController).singleton(),
    });

    return this.container;
  }
}
