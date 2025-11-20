import { NextResponse } from "next/server";

type PublishRequest = {
  pageId?: string;
  accessToken?: string;
  message?: string;
  link?: string;
  imageUrl?: string;
  scheduledTime?: string;
  mode?: "now" | "schedule";
};

const META_API_VERSION = "v19.0";

export async function POST(request: Request) {
  let payload: PublishRequest;
  try {
    payload = (await request.json()) as PublishRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const { pageId, accessToken, message, link, imageUrl, scheduledTime, mode } =
    payload;

  if (!pageId?.trim() || !accessToken?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: "Missing required pageId, accessToken, or message." },
      { status: 400 },
    );
  }

  if (mode && mode !== "now" && mode !== "schedule") {
    return NextResponse.json({ error: "Invalid mode provided." }, { status: 400 });
  }

  let scheduleTimestamp: number | undefined;
  if (scheduledTime) {
    const parsed = Date.parse(scheduledTime);
    if (Number.isNaN(parsed)) {
      return NextResponse.json(
        { error: "scheduledTime must be an ISO date." },
        { status: 400 },
      );
    }
    scheduleTimestamp = Math.floor(parsed / 1000);
    if (scheduleTimestamp <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "scheduledTime must be in the future." },
        { status: 400 },
      );
    }
  }

  const isPhoto = Boolean(imageUrl);
  const endpoint = isPhoto ? "photos" : "feed";
  const targetUrl = new URL(
    `https://graph.facebook.com/${META_API_VERSION}/${pageId}/${endpoint}`,
  );

  const bodyParams: Record<string, string> = {
    access_token: accessToken.trim(),
    message: message.trim(),
  };

  if (link && !isPhoto) {
    bodyParams.link = link.trim();
  }

  if (isPhoto && imageUrl) {
    bodyParams.url = imageUrl.trim();
  }

  if (scheduleTimestamp) {
    bodyParams.scheduled_publish_time = String(scheduleTimestamp);
    bodyParams.published = "false";
  } else if (isPhoto) {
    // For photo posts, Meta requires explicit boolean in some use cases.
    bodyParams.published = "true";
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(bodyParams).toString(),
    });

    const json = (await response.json().catch(() => ({}))) as GraphPublishResponse;

    if (!response.ok || !json.id) {
      const graphError =
        typeof json.error === "string"
          ? json.error
          : json.error?.message ?? "Meta API error.";
      return NextResponse.json(
        { error: graphError },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({ id: json.id }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type GraphPublishResponse =
  | { id: string; error?: undefined }
  | { id?: undefined; error: { message?: string } | string };
