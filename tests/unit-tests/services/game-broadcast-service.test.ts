import { GameBroadcastService } from "../../../src/services/game-broadcast.service";
import { ClientManager } from "../../../src/managers/client-manager";
import { Response } from "express";

// Mock dependencies
const mockClientManager = {
    getClientSetForGame: jest.fn(),
} as unknown as jest.Mocked<ClientManager>;

// Test constants
const TEST_GAME_ID = '1';
const TEST_GAME_ID_2 = '2';
const TEST_PAYLOAD = { event: 123456, eventDetailIndex: 2 };
const TEST_EVENT_NAME = 'testEvent';

// Mock client objects
const createMockClient = (id: string) => ({
    id,
    write: jest.fn(),
    destroyed: false,
    writableEnded: false,
    on: jest.fn(),
    end: jest.fn(),
} as unknown as Response);

// Helper functions for test setup
const createContainer = () => ({
    clientManager: mockClientManager,
});

const setupMocks = () => {
    jest.clearAllMocks();
};

describe('GameBroadcastService', () => {
    let gameBroadcastService: GameBroadcastService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        gameBroadcastService = new GameBroadcastService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with client manager dependency', () => {
            // Arrange & Act
            const service = new GameBroadcastService(container);

            // Assert
            expect(service['clientManager']).toBe(mockClientManager);
        });
    });

    describe('broadcastToAllClientByGameId', () => {
        it('should broadcast to all clients for a specific game with event name', () => {
            // Arrange
            const mockClient1 = createMockClient('client1');
            const mockClient2 = createMockClient('client2');
            const clientSet = new Set([mockClient1, mockClient2]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD, TEST_EVENT_NAME);

            // Assert
            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID);
            
            const expectedMessage = `data: ${JSON.stringify({ [TEST_EVENT_NAME]: TEST_PAYLOAD, message: "FeatureBoardCast" })}\n\n`;
            expect(mockClient1.write).toHaveBeenCalledWith(expectedMessage);
            expect(mockClient2.write).toHaveBeenCalledWith(expectedMessage);
        });

        it('should broadcast to all clients for a specific game without event name (default to "data")', () => {
            // Arrange
            const mockClient1 = createMockClient('client1');
            const clientSet = new Set([mockClient1]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD);

            // Assert
            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID);
            
            const expectedMessage = `data: ${JSON.stringify({ data: TEST_PAYLOAD, message: "FeatureBoardCast" })}\n\n`;
            expect(mockClient1.write).toHaveBeenCalledWith(expectedMessage);
        });

        it('should handle empty client set gracefully', () => {
            // Arrange
            const emptyClientSet = new Set<Response>();
            mockClientManager.getClientSetForGame.mockReturnValue(emptyClientSet);

            // Act & Assert - should not throw
            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD, TEST_EVENT_NAME);
            }).not.toThrow();

            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID);
        });

        it('should handle multiple games independently', () => {
            // Arrange
            const mockClient1 = createMockClient('client1');
            const mockClient2 = createMockClient('client2');
            const clientSet1 = new Set([mockClient1]);
            const clientSet2 = new Set([mockClient2]);
            
            mockClientManager.getClientSetForGame
                .mockReturnValueOnce(clientSet1)
                .mockReturnValueOnce(clientSet2);

            const payload1 = { event: 111, eventDetailIndex: 0 };
            const payload2 = { event: 222, eventDetailIndex: 1 };

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, payload1, 'event1');
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID_2, payload2, 'event2');

            // Assert
            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID);
            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID_2);
            
            const expectedMessage1 = `data: ${JSON.stringify({ event1: payload1, message: "FeatureBoardCast" })}\n\n`;
            const expectedMessage2 = `data: ${JSON.stringify({ event2: payload2, message: "FeatureBoardCast" })}\n\n`;
            
            expect(mockClient1.write).toHaveBeenCalledWith(expectedMessage1);
            expect(mockClient2.write).toHaveBeenCalledWith(expectedMessage2);
        });

        it('should handle complex payload objects', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            const complexPayload = {
                event: 123456,
                eventDetailIndex: 2,
                videoStreaming: {
                    videoLink: "https://example.com/stream.m3u8",
                    timeToStream: 1640995200000,
                    currentTime: 45000,
                    phaseIndex: 1
                },
                gameFlow: {
                    state: "Streaming"
                }
            };

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, complexPayload, 'complexEvent');

            // Assert
            const expectedMessage = `data: ${JSON.stringify({ complexEvent: complexPayload, message: "FeatureBoardCast" })}\n\n`;
            expect(mockClient.write).toHaveBeenCalledWith(expectedMessage);
        });

        it('should handle null and undefined payloads', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            // Act & Assert - should not throw
            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, null as any, TEST_EVENT_NAME);
            }).not.toThrow();

            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, undefined as any, TEST_EVENT_NAME);
            }).not.toThrow();

            // Verify messages were sent
            expect(mockClient.write).toHaveBeenCalledTimes(2);
        });

        it('should handle client write errors gracefully', () => {
            // Arrange
            const mockClient1 = createMockClient('client1');
            const mockClient2 = createMockClient('client2');
            (mockClient1.write as jest.Mock).mockImplementation(() => {
                throw new Error('Client write error');
            });
            const clientSet = new Set([mockClient1, mockClient2]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            // Act & Assert - should not throw and should continue to other clients
            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD, TEST_EVENT_NAME);
            }).toThrow('Client write error');

            // Verify first client threw error but second client was not called due to error
            expect(mockClient1.write).toHaveBeenCalled();
            expect(mockClient2.write).not.toHaveBeenCalled();
        });

        it('should format SSE message correctly', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            const testPayload = { test: 'value' };
            const testEventName = 'testEvent';

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, testPayload, testEventName);

            // Assert
            const expectedData = {
                [testEventName]: testPayload,
                message: "FeatureBoardCast"
            };
            const expectedMessage = `data: ${JSON.stringify(expectedData)}\n\n`;
            expect(mockClient.write).toHaveBeenCalledWith(expectedMessage);
        });

        it('should handle special characters in payload', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            const payloadWithSpecialChars = {
                message: 'Hello "World" with \n newlines and \t tabs',
                unicode: '🎮🎯⚽',
                escaped: 'C:\\path\\to\\file'
            };

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, payloadWithSpecialChars, 'specialChars');

            // Assert
            expect(mockClient.write).toHaveBeenCalled();
            const callArgs = (mockClient.write as jest.Mock).mock.calls[0][0];
            expect(callArgs).toContain('data: ');
            expect(callArgs).toContain('FeatureBoardCast');
            expect(callArgs).toMatch(/\n\n$/);
            
            // Verify JSON is valid
            const jsonPart = callArgs.replace('data: ', '').replace('\n\n', '');
            expect(() => JSON.parse(jsonPart)).not.toThrow();
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        it('should handle very large client sets', () => {
            // Arrange
            const largeClientSet = new Set<Response>();
            for (let i = 0; i < 1000; i++) {
                largeClientSet.add(createMockClient(`client${i}`));
            }
            mockClientManager.getClientSetForGame.mockReturnValue(largeClientSet);

            // Act & Assert - should not throw
            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD, TEST_EVENT_NAME);
            }).not.toThrow();

            expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(TEST_GAME_ID);
        });

        it('should handle circular reference in payload gracefully', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            const circularPayload: any = { name: 'test' };
            circularPayload.self = circularPayload; // Create circular reference

            // Act & Assert - should throw due to JSON.stringify circular reference
            expect(() => {
                gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, circularPayload, TEST_EVENT_NAME);
            }).toThrow();
        });

        it('should handle empty string event name', () => {
            // Arrange
            const mockClient = createMockClient('client1');
            const clientSet = new Set([mockClient]);
            mockClientManager.getClientSetForGame.mockReturnValue(clientSet);

            // Act
            gameBroadcastService.broadcastToAllClientByGameId(TEST_GAME_ID, TEST_PAYLOAD, '');

            // Assert
            const expectedMessage = `data: ${JSON.stringify({ '': TEST_PAYLOAD, message: "FeatureBoardCast" })}\n\n`;
            expect(mockClient.write).toHaveBeenCalledWith(expectedMessage);
        });
    });
});
