import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { CameraEmailBatchResult, CameraSnapshotRecord } from "../robot/types.js";

export interface PhotoEmailBatchConfig {
  to: string;
  from: string;
  batchSize: number;
  deleteRemote: boolean;
  outboxDirectory: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

const safeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

const decodeDataUrl = (dataUrl: string) => {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    return undefined;
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
};

const isConfigured = (config: PhotoEmailBatchConfig) =>
  Boolean(
    config.to.trim() &&
      config.from.trim() &&
      config.smtp.host.trim() &&
      config.smtp.user.trim() &&
      config.smtp.pass.trim()
  );

const writeOutboxBatch = (
  config: PhotoEmailBatchConfig,
  snapshots: CameraSnapshotRecord[]
) => {
  const batchId = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(config.outboxDirectory, `vector-photos-${batchId}`);
  mkdirSync(directory, { recursive: true });

  const manifest = snapshots.map((snapshot, index) => {
    const image = decodeDataUrl(snapshot.dataUrl);
    const remote = snapshot.remoteId ?? snapshot.id;
    const fileName = `${String(index + 1).padStart(2, "0")}-${safeFilePart(remote)}-${safeFilePart(snapshot.label)}.jpg`;
    if (image) {
      writeFileSync(path.join(directory, fileName), image.buffer);
    }

    return {
      id: snapshot.id,
      remoteId: snapshot.remoteId,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      fileName: image ? fileName : undefined
    };
  });

  writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return directory;
};

export const createPhotoEmailBatchService = (config: PhotoEmailBatchConfig) => {
  const batchSize = Math.max(1, Number.isFinite(config.batchSize) ? Math.floor(config.batchSize) : 10);

  return {
    batchSize,
    deleteRemote: config.deleteRemote,
    async processBatch(snapshots: CameraSnapshotRecord[]): Promise<CameraEmailBatchResult> {
      const batch = snapshots.slice(0, batchSize);
      if (batch.length < batchSize) {
        return {
          attempted: false,
          configured: isConfigured(config),
          sent: false,
          exported: false,
          deletedLocal: false,
          deletedRemote: false,
          count: batch.length,
          message: `Waiting for ${batchSize - batch.length} more Vector photo${batchSize - batch.length === 1 ? "" : "s"} before sending.`
        };
      }

      const exportPath = writeOutboxBatch(config, batch);
      if (!isConfigured(config)) {
        return {
          attempted: true,
          configured: false,
          sent: false,
          exported: true,
          deletedLocal: false,
          deletedRemote: false,
          count: batch.length,
          exportPath,
          message: "Photo email is not configured yet. The batch was exported safely and local photos were kept."
        };
      }

      const attachments = batch.flatMap((snapshot, index) => {
        const image = decodeDataUrl(snapshot.dataUrl);
        if (!image) {
          return [];
        }

        const remote = snapshot.remoteId ?? snapshot.id;
        return [
          {
            filename: `${String(index + 1).padStart(2, "0")}-${safeFilePart(remote)}-${safeFilePart(snapshot.label)}.jpg`,
            content: image.buffer,
            contentType: image.contentType
          }
        ];
      });

      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      await transporter.sendMail({
        from: config.from,
        to: config.to,
        subject: `Vector photos batch (${batch.length})`,
        text: [
          `Attached are ${batch.length} photos from Vector.`,
          "",
          "The app will clear the sent local copies after this email succeeds.",
          config.deleteRemote
            ? "Remote robot photo deletion is enabled for this install."
            : "Remote robot photos are kept unless PHOTO_EMAIL_DELETE_REMOTE=true is enabled."
        ].join("\n"),
        attachments
      });

      return {
        attempted: true,
        configured: true,
        sent: true,
        exported: true,
        deletedLocal: true,
        deletedRemote: config.deleteRemote,
        count: batch.length,
        exportPath,
        message: `Emailed ${batch.length} Vector photos to ${config.to}.`
      };
    }
  };
};
