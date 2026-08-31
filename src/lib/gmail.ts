import { google, gmail_v1 } from "googleapis";

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  snippet: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
  mimeType: string
): string {
  if (!payload) return "";

  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part, mimeType);
      if (result) return result;
    }
  }

  return "";
}

export interface GmailClientResult {
  gmail: gmail_v1.Gmail;
  auth: InstanceType<typeof google.auth.OAuth2>;
}

/**
 * Creates a Gmail client with proper OAuth2 credentials for automatic token refresh.
 * After using the client, call `getUpdatedAccessToken` to check if the token was refreshed.
 */
export function getGmailClient(
  accessToken: string,
  refreshToken: string
): GmailClientResult {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { gmail: google.gmail({ version: "v1", auth }), auth };
}

/**
 * Returns the current access token from the OAuth2 client.
 * If a refresh occurred, this will differ from the original token.
 */
export function getUpdatedAccessToken(
  auth: InstanceType<typeof google.auth.OAuth2>
): string | null {
  return auth.credentials.access_token ?? null;
}

export function buildFinancialSearchQuery(afterDays?: number): string {
  const query = "from:alerts@hdfcbank.bank.in";
  if (afterDays) {
    const d = new Date();
    d.setDate(d.getDate() - afterDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${query} after:${yyyy}/${mm}/${dd}`;
  }
  return query;
}

export async function searchFinancialEmails(
  gmail: gmail_v1.Gmail,
  query?: string,
  pageToken?: string
): Promise<{ messageIds: string[]; nextPageToken?: string }> {
  const q = query ?? buildFinancialSearchQuery();

  const response = await gmail.users.messages.list({
    userId: "me",
    q,
    pageToken: pageToken || undefined,
    maxResults: 100,
  });

  const messageIds =
    response.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];

  return {
    messageIds,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

export async function getMessage(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<ParsedMessage> {
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = response.data;
  const headers = msg.payload?.headers ?? [];

  const getHeader = (name: string): string =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    "";

  const bodyText = extractBody(msg.payload, "text/plain");
  const bodyHtml = extractBody(msg.payload, "text/html");

  return {
    id: msg.id ?? messageId,
    threadId: msg.threadId ?? "",
    from: getHeader("From"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    bodyText,
    bodyHtml,
    snippet: msg.snippet ?? "",
  };
}

export async function getHistoryChanges(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<{ addedMessageIds: string[] }> {
  const addedMessageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
    });

    const histories = response.data.history ?? [];
    for (const history of histories) {
      const added = history.messagesAdded ?? [];
      for (const item of added) {
        if (item.message?.id) {
          addedMessageIds.push(item.message.id);
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { addedMessageIds };
}
