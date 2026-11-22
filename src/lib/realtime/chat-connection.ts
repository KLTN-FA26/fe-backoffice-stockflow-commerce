/**
 * The back office's ONE chat socket (STOMP over BE `/ws`): presence and the chat's events share it.
 *
 * - Presence (BE-12): being connected makes the agent online; a heartbeat every 30 s keeps them so.
 * - Events (`ChatBroadcaster`, `ChatTopics`): screens `subscribe(destination, listener)` at any time. The connection
 *   keeps the list and (re)subscribes each destination once per socket, however many listeners share it, so a
 *   reconnect needs nothing from the screens.
 * - `isConnected()` / `onStatus()` let screens slow their polling while events arrive, and catch up after a drop.
 *
 * Every CONNECT (first and each reconnect) carries a fresh ticket. `WS_TICKET_INVALID` earns one new ticket and one
 * retry, then we stop quietly. Any other failure (`Authentication is not available`, network, ticket endpoint
 * errors) is transient: reconnect with exponential backoff so the ticket endpoint (30/min) is never hammered.
 * A SUBSCRIBE the BE refuses ends the whole session (Spring answers with an ERROR frame and closes it): that
 * destination is dropped before reconnecting, or every reconnect would be refused again.
 */

import { ApiError } from "@/lib/api/error";

import { fetchSocketTicket } from "./socket-ticket";
import { createStompSocket } from "./stomp-socket";

import type { SocketSubscription, StompSocket, StompSocketFactory } from "./stomp-socket";

export const PRESENCE_HEARTBEAT_DESTINATION = "/app/chat.presence.heartbeat";
export const PRESENCE_HEARTBEAT_MS = 30_000;
export const WS_TICKET_INVALID = "WS_TICKET_INVALID";
/** `StompAuthenticationInterceptor`: the ERROR frame's message when a SUBSCRIBE is refused. */
export const SUBSCRIBE_REFUSED_PREFIX = "Not allowed to subscribe to ";
export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 60_000;

/** A chat event as it arrives: the parsed JSON body; the subscriber narrows it. */
export type SocketListener = (event: unknown) => void;

interface Options {
  url: string;
  socketFactory?: StompSocketFactory;
  ticketFetcher?: (signal?: AbortSignal) => Promise<string>;
}

/** Ticket endpoint answers that mean "stop": not signed in / not allowed. Everything else is retried. */
function isFinalTicketFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function parse(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

export class ChatConnection {
  private readonly url: string;
  private readonly socketFactory: StompSocketFactory;
  private readonly ticketFetcher: (signal?: AbortSignal) => Promise<string>;

  private stopped = true;
  private socket: StompSocket | null = null;
  private connected = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private invalidStreak = 0;
  private transientFailures = 0;
  /** destination → its listeners; `live` = its STOMP subscription on the current socket. */
  private readonly routes = new Map<string, Set<SocketListener>>();
  private readonly live = new Map<string, SocketSubscription>();
  private readonly statusListeners = new Set<(connected: boolean) => void>();

  constructor(options: Options) {
    this.url = options.url;
    this.socketFactory = options.socketFactory ?? createStompSocket;
    this.ticketFetcher = options.ticketFetcher ?? fetchSocketTicket;
  }

  start(): void {
    if (!this.stopped || !this.url) return;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    this.abort?.abort();
    this.abort = null;
    this.clearTimers();
    this.closeSocket();
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Called with the new state each time the socket comes up or goes down. Returns the unsubscribe. */
  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Listens to `destination` now and across reconnects, until the returned function is called. */
  subscribe(destination: string, listener: SocketListener): () => void {
    let listeners = this.routes.get(destination);
    if (!listeners) {
      listeners = new Set();
      this.routes.set(destination, listeners);
    }
    listeners.add(listener);
    if (this.connected) this.follow(destination);
    return () => {
      const current = this.routes.get(destination);
      if (!current?.delete(listener) || current.size > 0) return;
      this.routes.delete(destination);
      const subscription = this.live.get(destination);
      this.live.delete(destination);
      try {
        subscription?.unsubscribe();
      } catch {
        // The socket is already gone: nothing left to unsubscribe from.
      }
    };
  }

  private follow(destination: string): void {
    if (!this.socket || this.live.has(destination)) return;
    const subscription = this.socket.subscribe(destination, (body) => {
      const event = parse(body);
      if (event === undefined) return;
      for (const listener of [...(this.routes.get(destination) ?? [])]) {
        try {
          listener(event);
        } catch {
          // One screen's failing handler must not keep the event from the others.
        }
      }
    });
    this.live.set(destination, subscription);
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    for (const listener of [...this.statusListeners]) listener(connected);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.abort = new AbortController();
    let ticket: string;
    try {
      ticket = await this.ticketFetcher(this.abort.signal);
    } catch (error) {
      if (generation !== this.generation) return;
      if (isFinalTicketFailure(error)) this.stop();
      else this.retryLater();
      return;
    }
    if (generation !== this.generation) return;

    let failed = false;
    const fail = (kind: "invalid" | "transient") => {
      if (failed || generation !== this.generation) return;
      failed = true;
      this.clearHeartbeat();
      this.closeSocket();
      if (kind === "invalid") {
        this.invalidStreak += 1;
        // One fresh ticket, one retry; a second refusal in a row ends it.
        if (this.invalidStreak > 1) this.stop();
        else void this.connect();
      } else {
        this.retryLater();
      }
    };

    this.socket = this.socketFactory(this.url, ticket, {
      onConnect: () => {
        if (generation !== this.generation) return;
        // The ticket worked. The backoff resets only once the socket has stayed up (first heartbeat below): a socket
        // that connects then drops at once must keep backing off, or it spends the 30/min ticket budget.
        this.invalidStreak = 0;
        this.startHeartbeat(() => fail("transient"));
        for (const destination of this.routes.keys()) this.follow(destination);
        this.setConnected(true);
      },
      onStompError: (frame) => {
        const message = frame.headers.message ?? "";
        if (message.startsWith(SUBSCRIBE_REFUSED_PREFIX)) {
          this.routes.delete(message.slice(SUBSCRIBE_REFUSED_PREFIX.length).trim());
        }
        fail(message === WS_TICKET_INVALID ? "invalid" : "transient");
      },
      onWebSocketClose: () => fail("transient"),
    });
    this.socket.activate();
  }

  private retryLater(): void {
    if (this.stopped) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.transientFailures, RECONNECT_MAX_MS);
    this.transientFailures += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private startHeartbeat(onBroken: () => void): void {
    this.clearHeartbeat();
    this.heartbeat = setInterval(() => {
      try {
        this.socket?.publish({ destination: PRESENCE_HEARTBEAT_DESTINATION });
      } catch {
        // stompjs throws when the connection is already gone: treat it as the drop it is.
        onBroken();
        return;
      }
      this.transientFailures = 0;
    }, PRESENCE_HEARTBEAT_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** The socket is gone with its subscriptions; the routes stay for the next one. */
  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.live.clear();
    this.setConnected(false);
    if (socket) void socket.deactivate().catch(() => undefined);
  }
}
