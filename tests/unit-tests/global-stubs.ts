import { logger } from "sc-common";
import { AppContainer } from "../../src/types";

// Mock logger
const mockLogService: typeof logger = {
  log: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarning: jest.fn(),
} as unknown as typeof logger;

const mockContainer: AppContainer = {
  logService: mockLogService,
} as AppContainer;

export { mockContainer };
