jest.mock("odds-feed-client", () => {
  return {
    OddsFeedEventName: {
      EventDetailStart: "EventDetailStart",
      EventStart: "EventStart",
      EventUpcoming: "EventUpcoming",
      EventDetailResultsAvailable: "EventDetailResultsAvailable",
    },
    Scheduler: class {
      schedule = jest.fn();
    },
    OddsFeedEventSource: class {
      eventDetailOn = jest.fn();
      eventDetailOff = jest.fn();
      eventOn = jest.fn();
      eventOff = jest.fn();
      cleanupOn = jest.fn();
      cleanupOff = jest.fn();
    },
    OddsFeedService: class {
      getRemoteJson = jest.fn();
    },
  };
});

// Mock odds-feed-client awilix bindings and DI helpers used by src/container-registry
jest.mock("odds-feed-client/awilix", () => {
  return {
    AwilixDIContainer: class {
      public container: any;
      constructor(container: any) {
        this.container = container;
      }
      register() {}
    },
  };
});

jest.mock("odds-feed-client/dependency-injection", () => {
  const { asValue } = require("awilix");
  return {
    register: (diContainer: any) => {
      if (!diContainer?.container?.register) return;
      diContainer.container.register({
        oddsFeedEventSource: asValue({
          eventDetailOn() {},
          eventDetailOff() {},
          eventOn() {},
          eventOff() {},
          cleanupOn() {},
          cleanupOff() {},
        }),
        scheduler: asValue({ schedule() {} }),
        oddsFeedService: asValue({ getRemoteJson: async () => null }),
      });
    },
    init: (_diContainer: any) => {
      // no-op for tests
    },
  };
});


