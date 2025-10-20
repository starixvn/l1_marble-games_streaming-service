import { createContainer } from "awilix";
import { initContainer, registerContainer } from "../../../src/features/container-registry";

// mock ALL external dependencies, including class, event awilix
jest.mock("awilix", () => {
    const asClass = jest.fn((Type: any) => {
        const chain: any = {
            __meta: {
                Type,
                singletonCalled: false,
                proxyCalled: false,
                disposerFn: undefined as undefined | ((service: any) => any),
            },
            singleton() {
                this.__meta.singletonCalled = true;
                return this;
            },
            proxy() {
                this.__meta.proxyCalled = true;
                return this;
            },
            disposer(fn: (service: any) => any) {
                this.__meta.disposerFn = fn;
                return this;
            },
        };
        return chain;
    });

    const createContainer = jest.fn(() => {
        const store: Record<string, any> = {};
        const resolved: Record<string, any> = {};
        return {
            register: jest.fn((obj: Record<string, any>) => {
                Object.assign(store, obj);
                return undefined;
            }),
            resolve: jest.fn((name: string) => resolved[name]),
            __getRegistered: () => ({ ...store }),
            __setResolved: (name: string, value: any) => {
                resolved[name] = value;
            },
        } as any;
    });

    return {
        asClass,
        createContainer,
    };
});

describe("Feature Container Registry", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("registerContainer", () => {
        it("should register game flow service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.gameFlowService).toBeTruthy();
            expect(reg.gameFlowService.__meta.singletonCalled).toBe(true);
            expect(reg.gameFlowService.__meta.proxyCalled).toBe(false);
            expect(reg.gameFlowService.__meta.disposerFn).toBeUndefined();
        });

        it("should register feature debug service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.featureDebugService).toBeTruthy();
            expect(reg.featureDebugService.__meta.singletonCalled).toBe(true);
            expect(reg.featureDebugService.__meta.proxyCalled).toBe(false);
            expect(reg.featureDebugService.__meta.disposerFn).toBeUndefined();
        });

        it("should register delay handling service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.delayHandlingService).toBeTruthy();
            expect(reg.delayHandlingService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.delayHandlingService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.delayHandlingService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register game flow time tracking service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.gameFlowTimeTrackingService).toBeTruthy();
            expect(reg.gameFlowTimeTrackingService.__meta.singletonCalled).toBe(true);
            expect(reg.gameFlowTimeTrackingService.__meta.disposerFn).toBeUndefined();
        });

        it("should register current event service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.currentEventService).toBeTruthy();
            expect(reg.currentEventService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.currentEventService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.currentEventService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register video streaming service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.videoStreamingService).toBeTruthy();
            expect(reg.videoStreamingService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.videoStreamingService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.videoStreamingService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register  in game consumer", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.inGameConsumer).toBeTruthy();
            expect(reg.inGameConsumer.__meta.singletonCalled).toBe(true);
            expect(reg.inGameConsumer.__meta.disposerFn).toBeUndefined();
        });
        
        it("should register game broadcast service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.gameBroadcastService).toBeTruthy();
            expect(reg.gameBroadcastService.__meta.singletonCalled).toBe(true);
            expect(reg.gameBroadcastService.__meta.disposerFn).toBeUndefined();
        });

        it("should register live score service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.liveScoreService).toBeTruthy();
            expect(reg.liveScoreService.__meta.singletonCalled).toBe(true);
            expect(reg.liveScoreService.__meta.proxyCalled).toBe(true);
            expect(typeof reg.liveScoreService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.liveScoreService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register result service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.resultService).toBeTruthy();
            expect(reg.resultService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.resultService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.resultService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register commentator voice service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.commentatorVoiceService).toBeTruthy();
            expect(reg.commentatorVoiceService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.commentatorVoiceService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.commentatorVoiceService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register intro service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.introService).toBeTruthy();
            expect(reg.introService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.introService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.introService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });

        it("should register team name service", () => {
            const container: any = createContainer();
            registerContainer(container);
            const reg = container.__getRegistered();
            expect(reg.teamNameService).toBeTruthy();
            expect(reg.teamNameService.__meta.singletonCalled).toBe(true);
            expect(typeof reg.teamNameService.__meta.disposerFn).toBe("function");
            const spy = { dispose: jest.fn() };
            reg.teamNameService.__meta.disposerFn?.(spy);
            expect(spy.dispose).toHaveBeenCalledTimes(1);
        });
    });
    
    describe("initContainer", () => {
        let container: any;
        let stubs: Record<string, { initEvent: jest.Mock }>;

        beforeEach(() => {
            container = createContainer();
            registerContainer(container);
            stubs = {} as any;
            const registered = container.__getRegistered();
            Object.keys(registered).forEach((name) => {
                stubs[name] = { initEvent: jest.fn() } as any;
                container.__setResolved(name, stubs[name]);
            });
        });

        it("should call init event delay handling service", () => {
            initContainer(container);
            expect(stubs.delayHandlingService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init current event service", () => {
            initContainer(container);
            expect(stubs.currentEventService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event game flow service", () => {
            initContainer(container);
            expect(stubs.gameFlowService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event video streaming service", () => {
            initContainer(container);
            expect(stubs.videoStreamingService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event live score service", () => {
            initContainer(container);
            expect(stubs.liveScoreService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event result service", () => {
            initContainer(container);
            expect(stubs.resultService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event commentator voice service", () => {
            initContainer(container);
            expect(stubs.commentatorVoiceService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event intro service", () => {
            initContainer(container);
            expect(stubs.introService.initEvent).toHaveBeenCalledTimes(1);
        });

        it("should call init event team name service", () => {
            initContainer(container);
            expect(stubs.teamNameService.initEvent).toHaveBeenCalledTimes(1);
        });
    });
});

