import * as corsModule from "../../../src/middlewares/cors";
import { Response, NextFunction } from "express";
import cors from "cors";

// Mock dependencies
jest.mock("cors");

const mockCors = cors as jest.MockedFunction<typeof cors>;

// Mock Express objects
const createMockRequest = (path: string = "/test", headers: any = {}): any => {
  return {
    path,
    headers,
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

const createMockNextFunction = (): jest.Mocked<NextFunction> => {
  return jest.fn() as any;
};

describe("CORS Middleware", () => {
  let mockReq: any;
  let mockRes: jest.Mocked<Response>;
  let mockNext: jest.Mocked<NextFunction>;
  let mockCorsMiddleware: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the cors middleware function
    mockCorsMiddleware = jest.fn();
    mockCors.mockReturnValue(mockCorsMiddleware);

    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNextFunction();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe("validateOrigin", () => {
    const mockHost = "api.example.com";

    describe("null/undefined origin", () => {
      it("should return false for null origin", () => {
        expect(corsModule.validateOrigin(null, mockHost)).toBe(true);
      });

      it("should return false for undefined origin", () => {
        expect(corsModule.validateOrigin(undefined, mockHost)).toBe(true);
      });

      it("should return false for empty string origin", () => {
        expect(corsModule.validateOrigin("", mockHost)).toBe(true);
      });
    });

    describe("localhost ports", () => {
      it("should allow http://localhost:7456", () => {
        expect(corsModule.validateOrigin("http://localhost:7456", mockHost)).toBe(true);
      });

      it("should allow https://localhost:7457", () => {
        expect(corsModule.validateOrigin("https://localhost:7457", mockHost)).toBe(true);
      });

      it("should allow http://localhost:7458", () => {
        expect(corsModule.validateOrigin("http://localhost:7458", mockHost)).toBe(true);
      });

      it("should allow https://localhost:7459", () => {
        expect(corsModule.validateOrigin("https://localhost:7459", mockHost)).toBe(true);
      });

      it("should reject http://localhost:7455", () => {
        expect(corsModule.validateOrigin("http://localhost:7455", mockHost)).toBe(false);
      });

      it("should reject http://localhost:7460", () => {
        expect(corsModule.validateOrigin("http://localhost:7460", mockHost)).toBe(false);
      });

      it("should reject http://localhost:745", () => {
        expect(corsModule.validateOrigin("http://localhost:745", mockHost)).toBe(false);
      });

      it("should reject http://localhost:74566", () => {
        expect(corsModule.validateOrigin("http://localhost:74566", mockHost)).toBe(false);
      });
    });

    describe("same domain validation", () => {
      it("should allow same domain origin and host", () => {
        expect(corsModule.validateOrigin("https://api.example.com", "api.example.com")).toBe(true);
      });

      it("should reject different domains", () => {
        expect(corsModule.validateOrigin("https://evil.com", "api.example.com")).toBe(false);
      });

      it("should allow subdomain mismatch", () => {
        expect(corsModule.validateOrigin("https://mgtv.lumigame.com", "mgstreaming.lumigame.com")).toBe(true);
      });

      it("should allow subdomain mismatch", () => {
        expect(corsModule.validateOrigin("https://mgtv.aws.sgamesuat.com", "mgstreaming.aws.sgamesuat.com")).toBe(true);
      });
    });

    describe("invalid origins", () => {
      it("should reject https://evil.com", () => {
        expect(corsModule.validateOrigin("https://evil.com", mockHost)).toBe(false);
      });

      it("should reject http://malicious-site.com", () => {
        expect(corsModule.validateOrigin("http://malicious-site.com", mockHost)).toBe(false);
      });

      it("should reject https://localhost:3000", () => {
        expect(corsModule.validateOrigin("https://localhost:3000", mockHost)).toBe(false);
      });

      it("should reject ftp://localhost:7456", () => {
        expect(corsModule.validateOrigin("ftp://localhost:7456", mockHost)).toBe(false);
      });

      it("should reject invalid URL format", () => {
        expect(corsModule.validateOrigin("not-a-url", mockHost)).toBe(false);
      });
    });
  });

  describe("corsMiddleware", () => {
    it("should call next() directly when path is root", () => {
      // Arrange
      mockReq = createMockRequest("/");

      // Act
      corsModule.corsMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockCors).not.toHaveBeenCalled();
    });

    it("should call applyCors middleware for non-root paths", () => {
      // Arrange
      mockReq = createMockRequest("/live/2001");

      // Act
      corsModule.corsMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCors).toHaveBeenCalled();
      expect(mockCorsMiddleware).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });
  });
});
