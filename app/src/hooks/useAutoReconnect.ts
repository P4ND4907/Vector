import { useEffect } from 'react';

function useAutoReconnect(socket) {
    useEffect(() => {
        let reconnectInterval;
        let retryAttempt = 0;

        const handleReconnect = () => {
            if (socket.readyState === WebSocket.CLOSED) {
                retryAttempt += 1;
                const timeout = Math.min(10000, Math.pow(2, retryAttempt) * 1000); // Exponential backoff, max 10 seconds
                reconnectInterval = setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    socket = new WebSocket(socket.url);
                }, timeout);
            }
        };

        socket.addEventListener('close', handleReconnect);

        return () => {
            clearTimeout(reconnectInterval);
            socket.removeEventListener('close', handleReconnect);
        };
    }, [socket]);
}

export default useAutoReconnect;