import { createEventId, extractGameId, extractRoundId } from "../../../src/helpers/id-helper";

describe("id-helper", () => {
  describe("createEventId", () => {
    it("should create event ID from valid gameId and roundId", () => {
      const gameId = 2001;
      const roundId = 1;
      const eventId = createEventId(gameId, roundId);

      expect(eventId).toBe(8594229559297);
    });

    it("should throw error when gameId is out of range (>= 2^16)", () => {
      const gameId = 65536; // 2^16
      const roundId = 1;

      expect(() => createEventId(gameId, roundId)).toThrow("gameId out of range");
    });

    it("should throw error when roundId is out of range (>= 2^32)", () => {
      const gameId = 12345;
      const roundId = 4294967296; // 2^32

      expect(() => createEventId(gameId, roundId)).toThrow("roundId out of range");
    });
  });

  describe("extractGameId", () => {
    it("should extract gameId from eventId", () => {
      const gameId = 2001;
      const roundId = 1;
      const eventId = createEventId(gameId, roundId);

      const extractedGameId = extractGameId(eventId);
      expect(extractedGameId).toBe("2001");
    });

    it("should return string type", () => {
      const gameId = 12345;
      const roundId = 67890;
      const eventId = createEventId(gameId, roundId);

      const extractedGameId = extractGameId(eventId);
      expect(typeof extractedGameId).toBe("string");
    });
  });

  describe("extractRoundId", () => {
    it("should extract roundId from eventId", () => {
      const gameId = 2001;
      const roundId = 137;
      const eventId = createEventId(gameId, roundId);

      const extractedRoundId = extractRoundId(eventId);
      expect(extractedRoundId).toBe(137);
    });

    it("should return number type", () => {
      const gameId = 12345;
      const roundId = 67890;
      const eventId = createEventId(gameId, roundId);

      const extractedRoundId = extractRoundId(eventId);
      expect(typeof extractedRoundId).toBe("number");
    });
  });
});
