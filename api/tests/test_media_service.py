"""Sprint 31 — Security & Robustness Hardening. Unit tests for the two new
pure helpers in `app/media/service.py` (`_sniff_content_type`,
`_sanitize_filename`); route-level coverage for the mismatch-rejection
behavior already lives in `test_media.py`/`test_destination_media.py`
alongside the rest of the upload route's validation tests.
"""

from app.media.service import _sanitize_filename, _sniff_content_type


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
