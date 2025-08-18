// retry.test.ts
import { retry } from "../../../src/helpers/retry-helper";
describe("retry", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should resolve immediately if the function succeeds on the first attempt", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");

    const result = await retry(mockFn);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should resolve after a retry if the function succeeds on the second attempt", async () => {
    const mockFn = jest.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("success");

    const result = await retry(mockFn, 3, 10);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("should reject after the maximum number of retries", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));

    await expect(retry(mockFn, 3, 10)).rejects.toThrow("fail");
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should wait for the specified delay between retries", async () => {
    const mockFn = jest.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("success");

    const promise = retry(mockFn, 2, 10);

    await expect(promise).resolves.toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
