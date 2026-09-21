// Custom entry point so the Notifee background event handler and the
// heartbeat background task are both defined before anything else runs —
// both need to exist before the JS bundle finishes initializing, in case
// the OS invokes them in a headless context. See
// src/scheduling/notificationEvents.ts and
// src/scheduling/backgroundHeartbeat.ts.
import "@/scheduling/backgroundHeartbeat";
import { registerNotificationEventHandlers } from "@/scheduling/notificationEvents";

registerNotificationEventHandlers();

import "expo-router/entry";
