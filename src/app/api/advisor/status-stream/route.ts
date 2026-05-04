import { NextRequest } from 'next/server';
import { requireAdvisorRole, getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import { getClientPipeline } from '@/lib/pipeline/queries';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the advisor
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const encoder = new TextEncoder();

    // UnderlyingSource.cancel receives (reason), not the controller — interval must live in this closure.
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connected event
        const connectedEvent = `event: connected
data: {"timestamp": "${new Date().toISOString()}"}

`;
        controller.enqueue(encoder.encode(connectedEvent));

        intervalId = setInterval(async () => {
          try {
            const clients = await getClientPipeline(profile.id);
            const updateEvent = `event: pipeline_update
data: ${JSON.stringify({ clients, timestamp: new Date().toISOString() })}

`;
            try {
              controller.enqueue(encoder.encode(updateEvent));
            } catch {
              if (intervalId !== undefined) {
                clearInterval(intervalId);
                intervalId = undefined;
              }
            }
          } catch (error) {
            console.error('Error fetching pipeline update:', error);
            const errorEvent = `event: error
data: {"message": "Failed to fetch pipeline update", "timestamp": "${new Date().toISOString()}"}

`;
            try {
              controller.enqueue(encoder.encode(errorEvent));
            } catch {
              if (intervalId !== undefined) {
                clearInterval(intervalId);
                intervalId = undefined;
              }
            }
          }
        }, 30000);
      },
      cancel() {
        if (intervalId !== undefined) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      },
    });

    // No CORS headers — same-origin EventSource doesn't preflight, and
    // cross-origin EventSource without credentials would fail the
    // requireAdvisorRole() check at the top of this handler anyway.
    // The previous wildcard `Access-Control-Allow-Origin: '*'` matched
    // the dead OPTIONS handlers stripped in round 5 (commit 068095b).
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Status stream authentication failed:', error);
    return new Response('Unauthorized', { status: 401 });
  }
}