import {
  asClass,
  asValue,
  AwilixContainer,
  createContainer,
  InjectionMode,
} from "awilix";
import { EventStreamService } from "./services/event-stream-service";
import { AppContainer } from "./types";
import { AuthenticateService } from "./services/authenticate-service";
import { OddsFeedService } from "./services/odds-feed-service";
import { AuthController } from "./controllers/auth-controller";
import { EventStreamController } from "./controllers/event-stream-controller";
import { HealthController } from "./controllers/health-controller";
import { logger } from "sc-common";
import { EventManagementService } from "./services/event-management-service";
import { EventState } from "./stores/event-state";
import { JobScheduler } from "./services/job-scheduler";

export class ContainerRegistry {
  container: AwilixContainer<AppContainer>;

  constructor() {
    this.container = createContainer<AppContainer>({
      injectionMode: InjectionMode.PROXY,
    });
  }

  register() {
    this.container.register({
      eventState: asClass(EventState).singleton(),
    });

    this.container.register({
      eventStreamService: asClass(EventStreamService).singleton(),
      authenticateService: asClass(AuthenticateService).singleton(),
      oddsFeedService: asClass(OddsFeedService).singleton(),
      logService: asValue(logger),
      eventManagementService: asClass(EventManagementService).singleton(),
      jobScheduler: asClass(JobScheduler).singleton(),
    });

    this.container.register({
      authController: asClass(AuthController).singleton(),
      eventStreamController: asClass(EventStreamController).singleton(),
      healthController: asClass(HealthController).singleton(),
    });

    return this.container;
  }
}
