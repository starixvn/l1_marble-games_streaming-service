const SHIFT_BITS = 32n;
const MASK_32_BITS = 0xffffffffn;

export const createEventId = (gameId: number, roundId: number) => {
  if (gameId >= 2 ** 16) {
    throw new Error("gameId out of range");
  }

  if (roundId >= 2 ** 32) {
    throw new Error("roundId out of range");
  }

  return Number((BigInt(gameId) << SHIFT_BITS) + BigInt(roundId));
};

export const extractGameId = (eventId: number): string => {
  return Number(BigInt(eventId) >> SHIFT_BITS).toString();
};

export const extractRoundId = (eventId: number): number => {
  return Number(BigInt(eventId) & MASK_32_BITS);
};
