# Media QA Checklist

Run the following manual scenarios against a fresh build. Confirm expected
behaviour in both desktop (Chrome) and a mobile-form-factor emulator.

1. **Inbound image (JPG/PNG/WEBP)**
   - Send an image to the WhatsApp number.
   - Expect: chat bubble shows a thumbnail within ~2s, lazy-loads, and opens the
     full-size asset in a new tab when clicked.

2. **Inbound PDF (≤10 MB)**
   - Send a short PDF.
   - Expect: first-page preview appears, overlay displays filename + size, and
     clicking opens the PDF viewer/download in a new tab.

3. **Inbound DOCX / XLSX / TXT / ZIP**
   - Send one sample of each type.
   - Expect: bubble renders a file-type icon, filename, and formatted size; the
     download button fetches the file successfully.

4. **Expired media URL**
   - Replay a webhook after manually deleting the stored file or expiring the
     signature.
   - Expect: ingestion re-requests a fresh Graph URL, regenerates the asset, and
     emits `message_media_updated` without user intervention.

5. **Thumbnail service unavailable**
   - Temporarily rename `sharp` binary or set `MEDIA_THUMBNAIL_MAX_WIDTH=0` and
     restart.
   - Expect: UI shows "Attachment unavailable" but the download card remains
     functional; logs contain an actionable error.

6. **Mobile responsiveness**
   - Resize the viewport to ≤420px.
   - Expect: thumbnails scale to container width, tap targets remain ≥44px, and
     screen reader labels describe image/document attachments.
