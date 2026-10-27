import { applyNotePageDiff, EMPTY_NOTE_PAGE, mergeNoteDiffs, WATCHED_THRESHOLD, type SyncOp } from "@unicoach/shared";
import { enqueue, getChildren, getRow, putRow, readOutbox, deleteRows, type Tx } from "./db";

/**
 * Telefonda yapılan bir değişikliğin yerel kopyaya etkisi. Değişiklik yapılınca bir kez, sonra her çekmeden sonra
 * (henüz gönderilmediyse) yeniden uygulanır; bu yüzden tekrar uygulansa da aynı sonucu verir. Kurallar sunucudakiyle
 * aynıdır (izlendi eşiği, sayfa sırası, son sayfa silinmez); sunucu yine de kendi kurallarıyla uygular.
 */
export async function applyLocally(tx: Tx, op: SyncOp, at: string): Promise<void> {
  switch (op.type) {
    case "sourceProgress": {
      const item = await getRow(tx, "sourceItems", op.itemId);
      if (!item) return;
      const durationSec = op.durationSec ?? item.durationSec;
      const reachedEnd = durationSec ? op.positionSec >= durationSec * WATCHED_THRESHOLD : false;
      let watchedAt = item.watchedAt;
      if (op.watched === false) watchedAt = null;
      else if (!watchedAt && (op.watched || reachedEnd)) watchedAt = at;
      await putRow(tx, "sourceItems", { ...item, positionSec: op.positionSec, durationSec, watchedAt, updatedAt: at });
      return;
    }
    case "bookProgress": {
      const book = await getRow(tx, "books", op.bookId);
      if (!book) return;
      const pageCount = op.pageCount ?? book.pageCount;
      await putRow(tx, "books", { ...book, pageCount, lastPage: pageCount ? Math.min(op.page, pageCount) : op.page, updatedAt: at });
      return;
    }
    case "bookUpdate": {
      const book = await getRow(tx, "books", op.bookId);
      if (!book) return;
      const { title, subject, topic, detectMethod, keyMethod } = op.patch;
      await putRow(tx, "books", {
        ...book,
        ...(title !== undefined && { title }),
        ...(subject !== undefined && { subject }),
        ...(topic !== undefined && { topic }),
        ...(detectMethod !== undefined && { detectMethod }),
        ...(keyMethod !== undefined && { keyMethod }),
        updatedAt: at,
      });
      return;
    }
    case "bookQuestions": {
      if (!(await getRow(tx, "books", op.bookId))) return;
      const existing = new Map((await getChildren(tx, "bookQuestions", op.bookId)).map((q) => [q.id, q]));
      const keep = new Set(op.input.questions.map((q) => q.id));
      await deleteRows(
        tx,
        "bookQuestions",
        [...existing.keys()].filter((id) => !keep.has(id)),
      );
      for (const [position, q] of op.input.questions.entries()) {
        if (!q.id) continue;
        await putRow(tx, "bookQuestions", {
          id: q.id,
          bookId: op.bookId,
          section: q.section,
          number: q.number,
          page: q.page,
          x: q.x,
          y: q.y,
          w: q.w,
          h: q.h,
          choiceCount: q.choiceCount,
          answer: q.answer ?? null,
          choices: q.choices.slice(0, q.choiceCount),
          position,
          syncVersion: existing.get(q.id)?.syncVersion ?? 0,
        });
      }
      return;
    }
    case "notebookCreate": {
      if (await getRow(tx, "notebooks", op.id)) return;
      await putRow(tx, "notebooks", { id: op.id, title: op.title, createdAt: at, updatedAt: at, syncVersion: 0 });
      await putRow(tx, "notebookPages", { id: op.pageId, notebookId: op.id, position: 1, content: EMPTY_NOTE_PAGE, updatedAt: at, syncVersion: 0 });
      return;
    }
    case "notebookRename": {
      const notebook = await getRow(tx, "notebooks", op.id);
      if (notebook) await putRow(tx, "notebooks", { ...notebook, title: op.title, updatedAt: at });
      return;
    }
    case "notebookDelete":
      await deleteRows(tx, "notebooks", [op.id]);
      return;
    case "pageAdd": {
      const notebook = await getRow(tx, "notebooks", op.notebookId);
      if (!notebook || (await getRow(tx, "notebookPages", op.id))) return;
      const pages = await getChildren(tx, "notebookPages", op.notebookId);
      const after = op.afterPageId ? pages.find((p) => p.id === op.afterPageId) : null;
      const position = after ? after.position + 1 : pages.length + 1;
      for (const p of pages) if (p.position >= position) await putRow(tx, "notebookPages", { ...p, position: p.position + 1 });
      await putRow(tx, "notebookPages", { id: op.id, notebookId: op.notebookId, position, content: EMPTY_NOTE_PAGE, updatedAt: at, syncVersion: 0 });
      await putRow(tx, "notebooks", { ...notebook, updatedAt: at });
      return;
    }
    case "pageDelete": {
      const page = await getRow(tx, "notebookPages", op.pageId);
      const notebook = await getRow(tx, "notebooks", op.notebookId);
      if (!page || !notebook) return;
      const pages = await getChildren(tx, "notebookPages", op.notebookId);
      if (pages.length < 2) return;
      await deleteRows(tx, "notebookPages", [op.pageId]);
      for (const p of pages) if (p.position > page.position) await putRow(tx, "notebookPages", { ...p, position: p.position - 1 });
      await putRow(tx, "notebooks", { ...notebook, updatedAt: at });
      return;
    }
    case "pageEdit": {
      const page = await getRow(tx, "notebookPages", op.pageId);
      const notebook = await getRow(tx, "notebooks", op.notebookId);
      if (!page || !notebook) return;
      await putRow(tx, "notebookPages", { ...page, content: applyNotePageDiff(page.content, op.diff), updatedAt: at });
      await putRow(tx, "notebooks", { ...notebook, updatedAt: at });
      return;
    }
  }
}

/** Aynı satıra ait bekleyen değişiklikler birleşir: kuyruk kısa kalır, sunucuya son hâl gider. */
function outboxKey(op: SyncOp): string | undefined {
  switch (op.type) {
    case "sourceProgress":
      return `sourceProgress:${op.itemId}`;
    case "bookProgress":
      return `bookProgress:${op.bookId}`;
    case "bookUpdate":
      return `bookUpdate:${op.bookId}`;
    case "bookQuestions":
      return `bookQuestions:${op.bookId}`;
    case "notebookRename":
      return `notebookRename:${op.id}`;
    case "pageEdit":
      return `pageEdit:${op.pageId}`;
    default:
      return undefined;
  }
}

function mergeOps(previous: SyncOp, next: SyncOp): SyncOp {
  if (previous.type === "pageEdit" && next.type === "pageEdit") return { ...next, diff: mergeNoteDiffs(previous.diff, next.diff) };
  if (previous.type === "bookUpdate" && next.type === "bookUpdate") return { ...next, patch: { ...previous.patch, ...next.patch } };
  return next;
}

/** Değişikliği yerel kopyaya uygular ve kuyruğa yazar (tek işlemde). */
export async function record(tx: Tx, op: SyncOp, at: string) {
  await applyLocally(tx, op, at);
  await enqueue(tx, op, at, outboxKey(op), mergeOps);
}

/** Çekmeden sonra: gönderilmemiş değişiklikler sunucudan gelen satırların üstüne yeniden uygulanır. */
export async function replayOutbox(tx: Tx) {
  for (const entry of await readOutbox(tx, 100_000)) await applyLocally(tx, entry.op, entry.at);
}
