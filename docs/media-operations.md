# Media Operations Guide

## Credential Rotation

- **WhatsApp access token / phone number ID**
  1. Update the persisted WhatsApp instance via the admin UI or `storage.setDefaultWhatsappInstance`.
  2. Redeploy/restart the server to pick up the credentials for background workers.
  3. Verify inbound webhooks with an image message; check logs for
     `message_media_updated` to confirm ingestion succeeds.

- **FILES_SIGNING_SECRET**
  - Rotate by setting a new value in the environment and restarting the server.
  - All previously signed URLs become invalid immediately; the UI will refresh
    links automatically on the next poll or WebSocket update.

## Clearing Cached Media

- **Disk clean-up**: media lives under `uploads/incoming` (WhatsApp) and
  `uploads/outbound` (operator uploads). Remove stale files only after ensuring
  corresponding `messages.media.storage` entries are no longer required.
- **Application cache**: clients always request fresh signed URLs, so no
  additional cache invalidation step is required.

## Handling Ingestion Failures

1. Inspect logs for `Failed to ingest WhatsApp media` errors. The output
   includes `conversationId`, `messageId`, and the provider response code.
2. The UI will display an "Attachment unavailable" pill with the error text.
3. To retry a failed download manually, set `messages.media.status='pending'`
   for the affected row and restart the server (or trigger a cold start); the
   ingestion worker will pick it up on the next webhook replay.

## Troubleshooting Steps

- **Expired WhatsApp URLs**: The ingestion worker refreshes metadata before
  every download. If that call returns 401, validate the access token.
- **Preview service offline**: If `sharp` fails, the worker marks the media as
  `failed` but keeps the original available for download. Monitor logs for the
  specific error and redeploy once resolved.
- **Large attachments**: Files larger than `MEDIA_MAX_ORIGINAL_BYTES` are
  skipped intentionally. The UI still offers the download card with a warning.
- **Signature errors on /media**: Ensure the client is using the latest signed
  URL. Check that server time is correct and `FILES_SIGNING_SECRET` matches the
  deployed value.
