"""Sprint 31 — Security & Robustness Hardening. Unit tests for the pure
helpers in `app/media/service.py` (`_sniff_content_type`,
`_sanitize_filename`, `reject_if_declared_too_large`); route-level
coverage for the mismatch-rejection behavior already lives in
`test_media.py`/`test_destination_media.py` alongside the rest of the
upload route's validation tests.
"""

import pytest
from fastapi import HTTPException

from app.media.service import (
    MAX_UPLOAD_BYTES,
    _sanitize_filename,
    _sniff_content_type,
    reject_if_declared_too_large,
)


class TestSniffContentType:
    def test_detects_jpeg_by_magic_bytes(self):
        assert _sniff_content_type(b"\xff\xd8\xffrest-of-file") == "image/jpeg"

    def test_detects_png_by_magic_bytes(self):
        assert _sniff_content_type(b"\x89PNG\r\n\x1a\nrest-of-file") == "image/png"

    def test_detects_webp_by_riff_container(self):
        assert _sniff_content_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"

    def test_returns_none_for_unrecognized_bytes(self):
        assert _sniff_content_type(b"not an image") is None

    def test_returns_none_for_a_spoofed_text_file(self):
        # A `.jpg`-named, `Content-Type: image/jpeg`-declared upload whose
        # actual bytes are plain text — the exact case Content-Type-only
        # validation would have missed.
        assert _sniff_content_type(b"<script>alert(1)</script>") is None


class TestSanitizeFilename:
    def test_keeps_a_normal_filename_unchanged(self):
        assert _sanitize_filename("cover.jpg") == "cover.jpg"

    def test_strips_directory_components(self):
        assert _sanitize_filename("../../etc/passwd") == "passwd"

    def test_strips_absolute_path_components(self):
        assert _sanitize_filename("/etc/passwd") == "passwd"

    def test_replaces_unsafe_characters(self):
        assert _sanitize_filename("my photo!@#.jpg") == "my_photo___.jpg"

    def test_falls_back_to_upload_for_an_empty_result(self):
        assert _sanitize_filename("...") == "upload"


class TestRejectIfDeclaredTooLarge:
    """Security hardening — early rejection based on the request's
    `Content-Length` header, called by route code before `await
    file.read()` buffers the upload. `upload_image()`'s own post-read
    check (already covered by `test_media.py`'s
    `test_rejects_file_over_the_size_limit`) remains the authoritative
    fallback for whatever this can't catch.
    """

    def test_does_nothing_when_header_is_absent(self):
        reject_if_declared_too_large(None)  # must not raise

    def test_does_nothing_for_a_size_within_the_limit(self):
        reject_if_declared_too_large(str(MAX_UPLOAD_BYTES))  # must not raise

    def test_raises_for_a_declared_size_over_the_limit(self):
        with pytest.raises(HTTPException) as exc_info:
            reject_if_declared_too_large(str(MAX_UPLOAD_BYTES + 1))

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "file_too_large"

    def test_does_nothing_for_an_unparseable_header(self):
        # Falls through to the post-read check instead of crashing on a
        # malformed header value.
        reject_if_declared_too_large("not-a-number")
