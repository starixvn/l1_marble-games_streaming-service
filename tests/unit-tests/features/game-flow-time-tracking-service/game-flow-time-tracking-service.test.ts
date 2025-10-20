import { GameFlowTimeTrackingService } from "../../../../src/features/game-flow-time-tracking-service/game-flow-time-tracking-service"

jest.spyOn(global.Date, "now")
    .mockImplementation(
        () => 1000
    )

describe("GameFlowTimeTrackingService", () => {
    let mockNow: number;
    let gameFlowTimeTrackingService: GameFlowTimeTrackingService;

    beforeEach(() => {
        // Please mock now
        gameFlowTimeTrackingService = new GameFlowTimeTrackingService();
    })

    describe("setTrackPoint", () => {
        it("should make relative time available", () => {
            const gameId = "2000";
            const timestamp = 0;
            // Act
            gameFlowTimeTrackingService.setTrackPoint(gameId, timestamp);
            const relativeTime = gameFlowTimeTrackingService.getRelativeTime(gameId);
            // Assert
            expect(relativeTime).toEqual(1);
        })
    });

    describe("getRelativeTime", () => {
        it("when no track point, should get current time", () => {
            // Arrange
            const gameId = "20xx";
            // Act
            const relativeTime = gameFlowTimeTrackingService.getRelativeTime(gameId);
            // Assert
            expect(relativeTime).toEqual(0);
        });

        it("when track point set, should get (now - currentTime) / 1000", () => {
            const gameId = "2000";
            const timestamp = -1000;
            // Act
            gameFlowTimeTrackingService.setTrackPoint(gameId, timestamp);
            const relativeTime = gameFlowTimeTrackingService.getRelativeTime(gameId);
            // Assert
            expect(relativeTime).toEqual(2);
        })
    })
})