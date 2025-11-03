import { useEffect } from 'react';

/**
 * useBlockUnloadOnActiveRequest
 * - Registers a beforeunload handler while a service request is active (accepted/on-way/in-progress)
 * - Writes a localStorage lock `lock:request:<id>` so other tabs know a request is active
 * - Removes lock and listener when the request completes or component unmounts
 *
 * Note: beforeunload behavior is browser-dependent (mobile browsers often ignore it).
 */
export default function useBlockUnloadOnActiveRequest(request, options = {}) {
  useEffect(() => {
    const requestId = request && request._id ? String(request._id) : null;
    const status = request ? String(request.status || '') : '';
    const role = options.role || 'unknown';

    const lockKey = requestId ? `lock:request:${requestId}` : null;
  // Default active statuses. For users we include 'pending' so they are warned after creating a request
  const defaultActive = options.activeStatuses || (role === 'user' ? ['pending', 'accepted', 'on-way', 'in-progress'] : ['accepted', 'on-way', 'in-progress']);
  const activeStatuses = new Set(defaultActive);

    const beforeUnloadHandler = (e) => {
      // Standard message is ignored by some browsers but required for legacy support
      const message = 'You have an active service in progress. Leaving or reloading the page may interrupt the service.';
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = message;
      return message;
    };

    // Only enable the lock if we have a valid request id and the status is active
    if (requestId && activeStatuses.has(status)) {
      try {
        localStorage.setItem(lockKey, JSON.stringify({ role, ts: Date.now() }));
      } catch (err) {
        // ignore localStorage errors (e.g., private mode)
        console.warn('Could not set request lock in localStorage', err);
      }
      window.addEventListener('beforeunload', beforeUnloadHandler);
    }

    return () => {
      // Remove lock and listener when request ends or on unmount
      try {
        if (lockKey) localStorage.removeItem(lockKey);
      } catch (err) {
        console.warn('Could not remove request lock from localStorage', err);
      }
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
    // We intentionally depend on requestId and status only
  }, [request && request._id, request && request.status, options.role]);
}
