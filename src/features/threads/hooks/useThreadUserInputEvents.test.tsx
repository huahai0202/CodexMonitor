// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";

describe("useThreadUserInputEvents", () => {
  it("clears thread processing state when input is requested", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const markReviewing = vi.fn();
    const setActiveTurnId = vi.fn();

    const { result } = renderHook(() =>
      useThreadUserInputEvents({
        dispatch,
        markProcessing,
        markReviewing,
        setActiveTurnId,
      }),
    );

    const request = {
      workspace_id: "ws-1",
      request_id: "req-1",
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "item-1",
        questions: [],
      },
    };

    act(() => {
      result.current(request);
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(dispatch).toHaveBeenCalledWith({ type: "addUserInputRequest", request });
  });

  it("only queues the request when thread id is blank", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const markReviewing = vi.fn();
    const setActiveTurnId = vi.fn();

    const { result } = renderHook(() =>
      useThreadUserInputEvents({
        dispatch,
        markProcessing,
        markReviewing,
        setActiveTurnId,
      }),
    );

    const request = {
      workspace_id: "ws-1",
      request_id: "req-1",
      params: {
        thread_id: "   ",
        turn_id: "turn-1",
        item_id: "item-1",
        questions: [],
      },
    };

    act(() => {
      result.current(request);
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(markReviewing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "addUserInputRequest", request });
  });
});
