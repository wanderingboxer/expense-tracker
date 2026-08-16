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

export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export function buildFinancialSearchQuery(): string {
  return "bank OR payment OR transaction OR receipt OR invoice OR UPI OR credited OR debited OR purchase OR order OR subscription OR refund OR transfer OR statement OR bill OR EMI";
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
