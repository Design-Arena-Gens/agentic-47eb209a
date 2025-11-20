// Client dashboard for Meta post automation. Handles credentials, scheduling, and API interactions.
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isFuture, parseISO } from "date-fns";

type PublishMode = "now" | "schedule";

type PostTemplate = {
  id: string;
  name: string;
  message: string;
  link?: string;
  imageUrl?: string;
};

type QueuedPost = {
  id: string;
  message: string;
  link?: string;
  imageUrl?: string;
  mode: PublishMode;
  scheduledTime?: string;
  createdAt: string;
  status: "pending" | "success" | "error";
  response?: { id?: string; error?: string };
};

type PublishPayload = {
  pageId: string;
  accessToken: string;
  message: string;
  link?: string;
  imageUrl?: string;
  scheduledTime?: string;
  mode: PublishMode;
};

const toLocalDateTimeInput = (date: Date) => {
  const offsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - offsetMilliseconds);
  return localDate.toISOString().slice(0, 16);
};

const nowIso = () => toLocalDateTimeInput(new Date());

const defaultScheduledIso = () =>
  toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));

const uuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

export function MetaAutomationDashboard() {
  const [pageId, setPageId] = usePersistentState("metaPageId", "");
  const [accessToken, setAccessToken] = usePersistentState(
    "metaAccessToken",
    "",
  );
  const [mode, setMode] = useState<PublishMode>("now");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledTime, setScheduledTime] = useState(defaultScheduledIso());
  const [templates, setTemplates] = usePersistentState<PostTemplate[]>(
    "metaTemplates",
    [],
  );
  const [templateName, setTemplateName] = useState("");
  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSchedule = useMemo(() => {
    if (mode === "now") return true;
    return isFuture(parseISO(scheduledTime));
  }, [mode, scheduledTime]);

  const handleTemplateSave = () => {
    if (!templateName.trim() || !message.trim()) {
      setError("Template needs a name and message.");
      return;
    }
    const newTemplate: PostTemplate = {
      id: uuid(),
      name: templateName.trim(),
      message,
      link: link.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
    };
    setTemplates([...templates.filter((tpl) => tpl.name !== newTemplate.name), newTemplate]);
    setTemplateName("");
    setSuccess("Template saved.");
    setError(null);
  };

  const applyTemplate = (template: PostTemplate) => {
    setMessage(template.message);
    setLink(template.link ?? "");
    setImageUrl(template.imageUrl ?? "");
    setSuccess(`Loaded template "${template.name}".`);
    setError(null);
  };

  const enqueuePost = () => {
    if (!pageId.trim() || !accessToken.trim() || !message.trim()) {
      setError("Page ID, access token, and message are required.");
      return;
    }
    if (mode === "schedule" && !canSchedule) {
      setError("Scheduled time must be in the future.");
      return;
    }

    const payload: PublishPayload = {
      pageId: pageId.trim(),
      accessToken: accessToken.trim(),
      message: message.trim(),
      link: link.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      scheduledTime: mode === "schedule" ? scheduledTime : undefined,
      mode,
    };

    const queued: QueuedPost = {
      id: uuid(),
      message: payload.message,
      link: payload.link,
      imageUrl: payload.imageUrl,
      mode,
      scheduledTime: payload.scheduledTime,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setQueue((prev) => [queued, ...prev]);
    setError(null);
    setSuccess(
      mode === "schedule"
        ? "Scheduled post queued."
        : "Immediate post queued.",
    );

    startTransition(async () => {
      const result = await publishToMeta(payload);
      setQueue((prev) =>
        prev.map((post) =>
          post.id === queued.id
            ? {
                ...post,
                status: result.ok ? "success" : "error",
                response: result.data,
              }
            : post,
        ),
      );
      setError(result.ok ? null : result.data.error ?? "Meta API error.");
    });
  };

  const handleTemplateDelete = (id: string) => {
    setTemplates(templates.filter((tpl) => tpl.id !== id));
  };

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900">Meta Post Automation</h1>
        <p className="text-sm text-zinc-600">
          Automate Facebook Page publishing with scheduling, reusable templates, and live status
          tracking. Provide a Page access token with `pages_manage_posts` permissions.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <CredentialsCard
          pageId={pageId}
          setPageId={setPageId}
          accessToken={accessToken}
          setAccessToken={setAccessToken}
          onFocus={resetFeedback}
        />
        <AutomationTips />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ComposerCard
          mode={mode}
          setMode={setMode}
          message={message}
          setMessage={setMessage}
          link={link}
          setLink={setLink}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          scheduledTime={scheduledTime}
          setScheduledTime={setScheduledTime}
          canSchedule={canSchedule}
          onSubmit={enqueuePost}
          isPending={isPending}
          onFocus={resetFeedback}
        />
        <TemplatesCard
          templates={templates}
          templateName={templateName}
          setTemplateName={setTemplateName}
          onSave={handleTemplateSave}
          onApply={applyTemplate}
          onDelete={handleTemplateDelete}
          isPending={isPending}
          onFocus={resetFeedback}
        />
      </section>

      <QueueCard queue={queue} />

      <FeedbackBanner error={error} success={success} />
    </div>
  );
}

function CredentialsCard(props: {
  pageId: string;
  setPageId: (value: string) => void;
  accessToken: string;
  setAccessToken: (value: string) => void;
  onFocus: () => void;
}) {
  const { pageId, setPageId, accessToken, setAccessToken, onFocus } = props;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">Credentials</h2>
        <p className="text-sm text-zinc-600">
          Store locally in this browser. Use a long-lived Page access token.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800">Page ID</span>
          <input
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            placeholder="123456789"
            onFocus={onFocus}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800">Page Access Token</span>
          <textarea
            className="h-24 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="EAAG..."
            onFocus={onFocus}
            autoComplete="off"
          />
        </label>
      </div>
    </div>
  );
}

function AutomationTips() {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-6 shadow-sm ring-1 ring-sky-600/10">
      <h2 className="mb-3 text-lg font-semibold text-sky-800">Automation Playbook</h2>
      <ul className="space-y-3 text-sm text-sky-900">
        <li className="flex gap-2">
          <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          <div>
            <p className="font-medium">Plan your calendar</p>
            <p className="text-sky-800/80">
              Draft copy, creative links, and scheduled times in the composer. Meta will queue posts
              up to 75 days ahead.
            </p>
          </div>
        </li>
        <li className="flex gap-2">
          <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          <div>
            <p className="font-medium">Recycle winning templates</p>
            <p className="text-sky-800/80">
              Save high-performing copy as reusable templates. Apply, tweak, and schedule in seconds.
            </p>
          </div>
        </li>
        <li className="flex gap-2">
          <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          <div>
            <p className="font-medium">Test variations</p>
            <p className="text-sky-800/80">
              Ship creative variations by duplicating templates and staggering publish windows.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}

function ComposerCard(props: {
  mode: PublishMode;
  setMode: (mode: PublishMode) => void;
  message: string;
  setMessage: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  imageUrl: string;
  setImageUrl: (value: string) => void;
  scheduledTime: string;
  setScheduledTime: (value: string) => void;
  canSchedule: boolean;
  onSubmit: () => void;
  isPending: boolean;
  onFocus: () => void;
}) {
  const {
    mode,
    setMode,
    message,
    setMessage,
    link,
    setLink,
    imageUrl,
    setImageUrl,
    scheduledTime,
    setScheduledTime,
    canSchedule,
    onSubmit,
    isPending,
    onFocus,
  } = props;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Post Composer</h2>
          <p className="text-sm text-zinc-600">
            Write content, attach media, and choose immediate publishing or scheduling.
          </p>
        </div>
        <div className="flex gap-2 rounded-full bg-zinc-100 p-1 text-xs font-medium text-zinc-600">
          <button
            className={`rounded-full px-3 py-1 transition ${mode === "now" ? "bg-zinc-900 text-white shadow-sm" : ""}`}
            onClick={() => {
              onFocus();
              setMode("now");
            }}
          >
            Post now
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${mode === "schedule" ? "bg-zinc-900 text-white shadow-sm" : ""}`}
            onClick={() => {
              onFocus();
              setMode("schedule");
              setScheduledTime(defaultScheduledIso());
            }}
          >
            Schedule
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800">Message</span>
          <textarea
            className="h-40 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Share your update..."
            onFocus={onFocus}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-800">Link (optional)</span>
            <input
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://example.com/blog"
              onFocus={onFocus}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-800">Image URL (optional)</span>
            <input
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://cdn..."
              onFocus={onFocus}
            />
          </label>
        </div>

        {mode === "schedule" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-800">Publish at</span>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(event) => {
                onFocus();
                setScheduledTime(event.target.value);
              }}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
              min={nowIso()}
            />
          </label>
        ) : null}
      </div>

      <button
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        onClick={() => {
          onFocus();
          onSubmit();
        }}
        disabled={isPending || (mode === "schedule" && !canSchedule)}
      >
        {isPending ? "Publishing..." : mode === "schedule" ? "Schedule post" : "Publish now"}
      </button>

      <p className="mt-4 text-xs text-zinc-500">
        Scheduling requires `published=false` + `scheduled_publish_time`. If you include both a link and
        image URL, Meta prioritizes the image (photo post). Remove the link for pure photo updates.
      </p>
    </div>
  );
}

function TemplatesCard(props: {
  templates: PostTemplate[];
  templateName: string;
  setTemplateName: (value: string) => void;
  onSave: () => void;
  onApply: (template: PostTemplate) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  onFocus: () => void;
}) {
  const {
    templates,
    templateName,
    setTemplateName,
    onSave,
    onApply,
    onDelete,
    isPending,
    onFocus,
  } = props;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">Templates</h2>
        <p className="text-sm text-zinc-600">
          Save winning copy variations to reuse and accelerate your monthly calendar.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800">Template Name</span>
          <input
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-zinc-400 focus:outline-none"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Launch day teaser"
            onFocus={onFocus}
          />
        </label>
        <button
          className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
          onClick={() => {
            onFocus();
            onSave();
          }}
          disabled={isPending}
        >
          Save template
        </button>
      </div>

      <hr className="my-5 border-zinc-200" />

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
        {templates.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No templates yet. Create one from the composer to seed your content library.
          </p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-700 shadow-inner"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-zinc-900">{template.name}</p>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                    onClick={() => {
                      onFocus();
                      onApply(template);
                    }}
                  >
                    Apply
                  </button>
                  <button
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(template.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-zinc-700">{template.message}</p>
              {template.link ? (
                <p className="mt-2 text-xs text-zinc-500">Link: {template.link}</p>
              ) : null}
              {template.imageUrl ? (
                <p className="mt-1 text-xs text-zinc-500">Image: {template.imageUrl}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function QueueCard(props: { queue: QueuedPost[] }) {
  const { queue } = props;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Activity Feed</h2>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
          {queue.length} {queue.length === 1 ? "submission" : "submissions"}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {queue.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Scheduled and published posts will appear here with their Meta response.
          </div>
        ) : (
          queue.map((post) => (
            <article
              key={post.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-700 shadow-inner"
            >
              <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      post.status === "success"
                        ? "bg-emerald-500"
                        : post.status === "error"
                          ? "bg-red-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <p className="font-semibold text-zinc-900">
                    {post.mode === "schedule" ? "Scheduled" : "Immediate"} ·{" "}
                    {format(parseISO(post.createdAt), "MMM d, HH:mm")}
                  </p>
                </div>
                {post.scheduledTime ? (
                  <p className="text-xs text-zinc-500">
                    Publishes {format(parseISO(post.scheduledTime), "MMM d, HH:mm")}
                  </p>
                ) : null}
              </header>
              <p className="whitespace-pre-wrap text-zinc-700">{post.message}</p>
              {post.link ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Link: <span className="font-medium text-zinc-700">{post.link}</span>
                </p>
              ) : null}
              {post.imageUrl ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Image: <span className="font-medium text-zinc-700">{post.imageUrl}</span>
                </p>
              ) : null}
              <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span>Status: {post.status}</span>
                {post.response?.id ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                    Meta ID: {post.response.id}
                  </span>
                ) : null}
                {post.response?.error ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
                    {post.response.error}
                  </span>
                ) : null}
              </footer>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function FeedbackBanner(props: { error: string | null; success: string | null }) {
  const { error, success } = props;
  if (!error && !success) return null;
  return (
    <div
      className={`${error ? "bg-red-100 text-red-700 ring-red-600/20" : "bg-emerald-100 text-emerald-700 ring-emerald-600/20"} rounded-xl border border-black/5 px-5 py-4 text-sm font-medium shadow-sm ring-1`}
    >
      {error ?? success}
    </div>
  );
}

function publishToMeta(payload: PublishPayload): Promise<
  { ok: true; data: { id: string } } | { ok: false; data: { error?: string } }
> {
  return fetch("/api/meta/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      if (response.ok) {
        const data = (await response.json()) as { id: string };
        return { ok: true as const, data };
      }
      const errorJson = await response.json().catch(() => null);
      return { ok: false as const, data: { error: errorJson?.error ?? response.statusText } };
    })
    .catch((cause: Error) => ({ ok: false as const, data: { error: cause.message } }));
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const serialized = window.localStorage.getItem(key);
    if (serialized) {
      try {
        setValue(JSON.parse(serialized) as T);
      } catch {
        window.localStorage.removeItem(key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore persistence errors */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
