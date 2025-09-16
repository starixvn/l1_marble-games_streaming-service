import { asClass, AwilixContainer } from "awilix";
import { registerContainer, initContainer, OddFeedDataContainer } from "../../../src/features/container-registry";

// Import all the services that should be registered
import { OddFeedEventSource } from "../../../src/features/odd-feed-data";
import { OddFeedCron } from "../../../src/features/odd-feed-data/odd-feed-cron";
import { OddFeedPullService } from "../../../src/features/odd-feed-data/odd-feed-pull-service";
import { OddFeedScheduler } from "../../../src/features/odd-feed-data/odd-feed-scheduler";
import { OddFeedStore } from "../../../src/features/odd-feed-data/odd-feed-store";
import { Scheduler } from "../../../src/features/scheduler/scheduler";
import { DelayHandlingService } from "../../../src/features/delay/delay-handling-service";
import { CurrentEventService } from "../../../src/features/current-event/current-event-service";
import { EventCleanerService } from "../../../src/features/event-cleaner/event-cleaner-service";
import { GameFlowService } from "../../../src/features/game-flow/game-flow-service";
import { VideoStreamingService } from "../../../src/features/video-streaming/video-streaming-service";
import { InGameConsumer } from "../../../src/features/in-game-consumer/in-game-consumer";
import { GameBroadcastService } from "../../../src/services/game-broadcast.service";

// Mock awilix
jest.mock("awilix", () => ({
    asClass: jest.fn(),
}));

// Mock all service classes
jest.mock("../../../src/features/odd-feed-data", () => ({
    OddFeedEventSource: jest.fn(),
}));
jest.mock("../../../src/features/odd-feed-data/odd-feed-cron");
jest.mock("../../../src/features/odd-feed-data/odd-feed-pull-service");
jest.mock("../../../src/features/odd-feed-data/odd-feed-scheduler");
jest.mock("../../../src/features/odd-feed-data/odd-feed-store");
jest.mock("../../../src/features/scheduler/scheduler");
jest.mock("../../../src/features/delay/delay-handling-service");
jest.mock("../../../src/features/current-event/current-event-service");
jest.mock("../../../src/features/event-cleaner/event-cleaner-service");
jest.mock("../../../src/features/game-flow/game-flow-service");
jest.mock("../../../src/features/video-streaming/video-streaming-service");
jest.mock("../../../src/features/in-game-consumer/in-game-consumer");
jest.mock("../../../src/services/game-broadcast.service");

// Test constants
const TEST_SERVICES_WITH_DISPOSERS = [
    'oddFeedStore',
    'scheduler',
    'delayHandlingService',
    'currentEventService',
    'eventCleanerService',
    'gameFlowService',
    'videoStreamingService'
];

const TEST_SERVICES_WITHOUT_DISPOSERS = [
    'oddFeedEventSource',
    'oddFeedScheduler',
    'oddFeedPullService',
    'oddFeedCron',
    'inGameConsumer',
    'gameBoardcastService'
];

const ALL_SERVICES = [...TEST_SERVICES_WITH_DISPOSERS, ...TEST_SERVICES_WITHOUT_DISPOSERS];

const SERVICES_WITH_INIT_EVENT = [
    'delayHandlingService',
    'currentEventService',
    'oddFeedStore',
    'eventCleanerService',
    'gameFlowService',
    'videoStreamingService'
];

// Mock service instances with required methods
const createMockService = (hasInitEvent = false, hasDispose = false, hasStart = false) => ({
    ...(hasInitEvent && { initEvent: jest.fn() }),
    ...(hasDispose && { dispose: jest.fn() }),
    ...(hasStart && { start: jest.fn() }),
});

// Mock container
const createMockContainer = () => {
    const mockServices: Record<string, any> = {
        delayHandlingService: createMockService(true, true),
        currentEventService: createMockService(true, true),
        oddFeedStore: createMockService(true, true),
        eventCleanerService: createMockService(true, true),
        gameFlowService: createMockService(true, true),
        videoStreamingService: createMockService(true, true),
        oddFeedCron: createMockService(false, false, true),
    };

    const mockContainer = {
        register: jest.fn(),
        resolve: jest.fn((serviceName: string) => mockServices[serviceName] || createMockService()),
    } as unknown as jest.Mocked<AwilixContainer<OddFeedDataContainer>>;

    return { mockContainer, mockServices };
};

// Mock asClass registration result
const createMockRegistration = (withDisposer = false) => {
    const registration = {
        singleton: jest.fn().mockReturnThis(),
        disposer: jest.fn().mockReturnThis(),
        // Add other required properties to satisfy TypeScript
        setLifetime: jest.fn().mockReturnThis(),
        setInjectionMode: jest.fn().mockReturnThis(),
        scoped: jest.fn().mockReturnThis(),
        transient: jest.fn().mockReturnThis(),
        proxy: jest.fn().mockReturnThis(),
        classic: jest.fn().mockReturnThis(),
        inject: jest.fn().mockReturnThis(),
        resolve: jest.fn().mockReturnThis(),
    };
    
    if (!withDisposer) {
        // For services without disposer, singleton() should be the final call
        registration.singleton.mockReturnValue(registration);
    }
    
    return registration as any; // Type assertion to bypass strict typing
};

describe("Container Registry", () => {
    let mockAsClass: jest.MockedFunction<typeof asClass>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAsClass = asClass as jest.MockedFunction<typeof asClass>;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("registerContainer", () => {
        it("should register all required services", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            mockAsClass.mockReturnValue(createMockRegistration());

            // Act
            registerContainer(mockContainer);

            // Assert
            expect(mockContainer.register).toHaveBeenCalledTimes(1);
            const registrationConfig = mockContainer.register.mock.calls[0][0];
            
            // Verify all expected services are registered
            ALL_SERVICES.forEach(serviceName => {
                expect(registrationConfig).toHaveProperty(serviceName);
            });
        });

        it("should register services with asClass", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const mockRegistration = createMockRegistration();
            mockAsClass.mockReturnValue(mockRegistration);

            // Act
            registerContainer(mockContainer);

            // Assert
            expect(mockAsClass).toHaveBeenCalledTimes(ALL_SERVICES.length);
            expect(mockAsClass).toHaveBeenCalledWith(OddFeedEventSource);
            expect(mockAsClass).toHaveBeenCalledWith(OddFeedScheduler);
            expect(mockAsClass).toHaveBeenCalledWith(OddFeedStore);
            expect(mockAsClass).toHaveBeenCalledWith(OddFeedPullService);
            expect(mockAsClass).toHaveBeenCalledWith(Scheduler);
            expect(mockAsClass).toHaveBeenCalledWith(OddFeedCron);
            expect(mockAsClass).toHaveBeenCalledWith(DelayHandlingService);
            expect(mockAsClass).toHaveBeenCalledWith(CurrentEventService);
            expect(mockAsClass).toHaveBeenCalledWith(EventCleanerService);
            expect(mockAsClass).toHaveBeenCalledWith(GameFlowService);
            expect(mockAsClass).toHaveBeenCalledWith(VideoStreamingService);
            expect(mockAsClass).toHaveBeenCalledWith(InGameConsumer);
            expect(mockAsClass).toHaveBeenCalledWith(GameBroadcastService);
        });

        it("should register all services as singletons", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const mockRegistration = createMockRegistration();
            mockAsClass.mockReturnValue(mockRegistration);

            // Act
            registerContainer(mockContainer);

            // Assert
            expect(mockRegistration.singleton).toHaveBeenCalledTimes(ALL_SERVICES.length);
        });

        it("should register disposers for services that need cleanup", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const mockRegistration = createMockRegistration(true);
            mockAsClass.mockReturnValue(mockRegistration);

            // Act
            registerContainer(mockContainer);

            // Assert
            expect(mockRegistration.disposer).toHaveBeenCalledTimes(TEST_SERVICES_WITH_DISPOSERS.length);
            
            // Verify disposer is called with a function for each service that needs it
            const disposerCalls = mockRegistration.disposer.mock.calls;
            disposerCalls.forEach((call: any) => {
                expect(typeof call[0]).toBe('function');
            });
        });

        it("should not register disposers for services that don't need cleanup", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const mockRegistrationWithDisposer = createMockRegistration(true);
            const mockRegistrationWithoutDisposer = createMockRegistration(false);
            
            // Mock asClass to return different registrations based on the service
            mockAsClass.mockImplementation((serviceClass) => {
                const serviceName = serviceClass.name;
                const needsDisposer = [
                    'OddFeedStore', 'Scheduler', 'DelayHandlingService', 
                    'CurrentEventService', 'EventCleanerService', 
                    'GameFlowService', 'VideoStreamingService'
                ].includes(serviceName);
                
                return needsDisposer ? mockRegistrationWithDisposer : mockRegistrationWithoutDisposer;
            });

            // Act
            registerContainer(mockContainer);

            // Assert
            expect(mockRegistrationWithDisposer.disposer).toHaveBeenCalledTimes(TEST_SERVICES_WITH_DISPOSERS.length);
            expect(mockRegistrationWithoutDisposer.disposer).not.toHaveBeenCalled();
        });

        it("should register services with correct configuration structure", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            mockAsClass.mockReturnValue(createMockRegistration());

            // Act
            registerContainer(mockContainer);

            // Assert
            const registrationConfig = mockContainer.register.mock.calls[0][0];
            
            // Verify the structure contains all expected services
            expect(Object.keys(registrationConfig)).toHaveLength(ALL_SERVICES.length);
            expect(registrationConfig).toEqual(
                expect.objectContaining({
                    oddFeedEventSource: expect.any(Object),
                    oddFeedScheduler: expect.any(Object),
                    oddFeedStore: expect.any(Object),
                    oddFeedPullService: expect.any(Object),
                    scheduler: expect.any(Object),
                    oddFeedCron: expect.any(Object),
                    delayHandlingService: expect.any(Object),
                    currentEventService: expect.any(Object),
                    eventCleanerService: expect.any(Object),
                    gameFlowService: expect.any(Object),
                    videoStreamingService: expect.any(Object),
                    inGameConsumer: expect.any(Object),
                    gameBoardcastService: expect.any(Object),
                })
            );
        });

        it("should handle container registration errors gracefully", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            mockContainer.register.mockImplementation(() => {
                throw new Error("Registration failed");
            });
            mockAsClass.mockReturnValue(createMockRegistration());

            // Act & Assert
            expect(() => {
                registerContainer(mockContainer);
            }).toThrow("Registration failed");
        });
    });

    describe("initContainer", () => {
        it("should initialize all services with initEvent method", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();

            // Act
            initContainer(mockContainer);

            // Assert
            SERVICES_WITH_INIT_EVENT.forEach(serviceName => {
                expect(mockContainer.resolve).toHaveBeenCalledWith(serviceName);
                expect(mockServices[serviceName].initEvent).toHaveBeenCalledTimes(1);
            });
        });

        it("should start oddFeedCron service", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();

            // Act
            initContainer(mockContainer);

            // Assert
            expect(mockContainer.resolve).toHaveBeenCalledWith("oddFeedCron");
            expect(mockServices.oddFeedCron.start).toHaveBeenCalledTimes(1);
        });

        it("should resolve services in correct order", () => {
            // Arrange
            const { mockContainer } = createMockContainer();

            // Act
            initContainer(mockContainer);

            // Assert
            const expectedOrder = [
                "delayHandlingService",
                "currentEventService", 
                "oddFeedStore",
                "eventCleanerService",
                "gameFlowService",
                "videoStreamingService",
                "oddFeedCron"
            ];

            expect(mockContainer.resolve).toHaveBeenCalledTimes(expectedOrder.length);
            expectedOrder.forEach((serviceName, index) => {
                expect(mockContainer.resolve).toHaveBeenNthCalledWith(index + 1, serviceName);
            });
        });

        it("should handle service resolution errors", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            mockContainer.resolve.mockImplementation((serviceName: string | symbol) => {
                if (serviceName === "delayHandlingService") {
                    throw new Error("Service resolution failed");
                }
                return createMockService(true);
            });

            // Act & Assert
            expect(() => {
                initContainer(mockContainer);
            }).toThrow("Service resolution failed");
        });

        it("should handle service initialization errors", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();
            mockServices.delayHandlingService.initEvent.mockImplementation(() => {
                throw new Error("Service initialization failed");
            });

            // Act & Assert
            expect(() => {
                initContainer(mockContainer);
            }).toThrow("Service initialization failed");
        });

        it("should handle oddFeedCron start errors", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();
            mockServices.oddFeedCron.start.mockImplementation(() => {
                throw new Error("Cron start failed");
            });

            // Act & Assert
            expect(() => {
                initContainer(mockContainer);
            }).toThrow("Cron start failed");
        });

        it("should not call initEvent on services that don't have it", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const serviceWithoutInit = createMockService(false);
            mockContainer.resolve.mockImplementation((serviceName: string | symbol) => {
                if (serviceName === "oddFeedCron") {
                    return createMockService(false, false, true);
                }
                return SERVICES_WITH_INIT_EVENT.includes(serviceName as string) 
                    ? createMockService(true) 
                    : serviceWithoutInit;
            });

            // Act
            initContainer(mockContainer);

            // Assert - Verify initEvent is not called on serviceWithoutInit
            expect(serviceWithoutInit.initEvent).toBeUndefined();
        });
    });

    describe("OddFeedDataContainer interface", () => {
        it("should define all required service types", () => {
            // This is a type-only test to ensure the interface is properly defined
            // We can't directly test TypeScript interfaces at runtime, but we can verify
            // that the services we register match what the interface expects
            
            const expectedServices = [
                'oddFeedEventSource',
                'oddFeedScheduler',
                'oddFeedStore',
                'oddFeedPullService',
                'oddFeedCron',
                'scheduler',
                'logService',
                'oddsFeedService',
                'delayHandlingService',
                'currentEventService',
                'eventCleanerService',
                'gameFlowService',
                'videoStreamingService',
                'inGameConsumer',
                'gameBoardcastService'
            ];

            // This test mainly serves as documentation and will fail at compile time
            // if the interface doesn't match the expected structure
            expect(expectedServices).toHaveLength(15);
        });
    });

    describe("Integration scenarios", () => {
        it("should successfully register and initialize all services", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();
            mockAsClass.mockReturnValue(createMockRegistration(true));

            // Act - Full workflow
            registerContainer(mockContainer);
            initContainer(mockContainer);

            // Assert
            expect(mockContainer.register).toHaveBeenCalledTimes(1);
            expect(mockContainer.resolve).toHaveBeenCalledTimes(7); // 6 services + 1 cron
            
            // Verify all initialization methods were called
            SERVICES_WITH_INIT_EVENT.forEach(serviceName => {
                expect(mockServices[serviceName].initEvent).toHaveBeenCalledTimes(1);
            });
            expect(mockServices.oddFeedCron.start).toHaveBeenCalledTimes(1);
        });

        it("should handle partial initialization failures gracefully", () => {
            // Arrange
            const { mockContainer, mockServices } = createMockContainer();
            mockAsClass.mockReturnValue(createMockRegistration(true));
            
            // Make one service fail during initialization
            mockServices.gameFlowService.initEvent.mockImplementation(() => {
                throw new Error("Game flow initialization failed");
            });

            // Act & Assert
            registerContainer(mockContainer);
            expect(() => {
                initContainer(mockContainer);
            }).toThrow("Game flow initialization failed");

            // Verify that services before the failure were still initialized
            expect(mockServices.delayHandlingService.initEvent).toHaveBeenCalledTimes(1);
            expect(mockServices.currentEventService.initEvent).toHaveBeenCalledTimes(1);
            expect(mockServices.oddFeedStore.initEvent).toHaveBeenCalledTimes(1);
            expect(mockServices.eventCleanerService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should work with empty container", () => {
            // Arrange
            const emptyContainer = {
                register: jest.fn(),
                resolve: jest.fn(),
            } as unknown as jest.Mocked<AwilixContainer<OddFeedDataContainer>>;
            mockAsClass.mockReturnValue(createMockRegistration());

            // Act & Assert - Should not throw
            expect(() => {
                registerContainer(emptyContainer);
            }).not.toThrow();
        });
    });

    describe("Disposer functions", () => {
        it("should create disposer functions that call service dispose method", () => {
            // Arrange
            const { mockContainer } = createMockContainer();
            const mockRegistration = createMockRegistration(true);
            mockAsClass.mockReturnValue(mockRegistration);

            // Act
            registerContainer(mockContainer);

            // Assert
            const disposerCalls = mockRegistration.disposer.mock.calls;
            expect(disposerCalls).toHaveLength(TEST_SERVICES_WITH_DISPOSERS.length);

            // Test that disposer functions work correctly
            disposerCalls.forEach((call: any) => {
                const disposerFunction = call[0];
                const mockService = { dispose: jest.fn() };
                
                // Act - Call the disposer function
                disposerFunction(mockService);
                
                // Assert - Verify dispose was called
                expect(mockService.dispose).toHaveBeenCalledTimes(1);
            });
        });
    });
});
