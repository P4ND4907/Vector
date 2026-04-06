import { useEffect } from "react";

function useAutoReconnect(socket: WebSocket | null) {
  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let currentSocket = socket;

    const handleReconnect = () => {
      if (currentSocket.readyState !== WebSocket.CLOSED) {
        return;
      }

      retryAttempt += 1;
      const timeout = Math.min(10_000, 2 ** retryAttempt * 1_000);
      reconnectTimeout = setTimeout(() => {
        console.info("Attempting to reconnect WebSocket...");
        currentSocket = new WebSocket(currentSocket.url);
      }, timeout);
    };

    currentSocket.addEventListener("close", handleReconnect);

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      currentSocket.removeEventListener("close", handleReconnect);
    };
  }, [socket]);
}

export default useAutoReconnect;
