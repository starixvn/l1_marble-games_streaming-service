jest.mock("odd-feed-client", () => {
  return {
    OddFeedEventName: {
      EventDetailStart: "EventDetailStart",
      EventStart: "EventStart",
      EventUpcoming: "EventUpcoming",
      EventDetailResultsAvailable: "EventDetailResultsAvailable",
    },
    Scheduler: class {
      schedule = jest.fn();
    },
    OddFeedEventSource: class {
      registerEventDetailEventListener = jest.fn();
      unregisterEventDetailEventListener = jest.fn();
      registerEventListener = jest.fn();
      unregisterEventListener = jest.fn();
      registerSystemDataCleanupEventListener = jest.fn();
      unregisterSystemDataCleanupEventListener = jest.fn();
    },
    OddFeedService: class {
      getRemoteJson = jest.fn();
    },
  };
});

// Mock odd-feed-client awilix bindings and DI helpers used by src/container-registry
jest.mock("odd-feed-client/awilix", () => {
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

jest.mock("odd-feed-client/dependency-injection", () => {
  const { asValue } = require("awilix");
  return {
    register: (diContainer: any) => {
      if (!diContainer?.container?.register) return;
      diContainer.container.register({
        oddFeedEventSource: asValue({
          registerEventDetailEventListener() {},
          unregisterEventDetailEventListener() {},
          registerEventListener() {},
          unregisterEventListener() {},
          registerSystemDataCleanupEventListener() {},
          unregisterSystemDataCleanupEventListener() {},
        }),
        scheduler: asValue({ schedule() {} }),
        oddFeedService: asValue({ getRemoteJson: async () => null }),
      });
    },
    init: (_diContainer: any) => {
      // no-op for tests
    },
  };
});


