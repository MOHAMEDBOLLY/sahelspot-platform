"""Security hardening PR 4 — `allow_headers` narrowed from `["*"]` to
exactly the two headers either frontend ever sends (`Authorization`,
`Content-Type`). See `app/main.py`'s CORS middleware comment for why.
"""

from app.core.config import settings

ALLOWED_ORIGIN = settings.allowed_origins_list[0]


class TestCorsPreflight:
    def test_preflight_allows_authorization_and_content_type(self, client):
        response = client.options(
            "/editor/venues",
            headers={
                "Origin": ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

        assert response.status_code == 200
        allowed = response.headers["access-control-allow-headers"].lower()
        assert "authorization" in allowed
        assert "content-type" in allowed

    def test_preflight_rejects_a_header_not_on_the_allowlist(self, client):
        response = client.options(
            "/editor/venues",
            headers={
                "Origin": ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,x-not-a-real-header",
            },
        )

        # Starlette's CORSMiddleware rejects the preflight itself (400)
        # when a requested header isn't in the allowlist — the browser
        # never gets an Access-Control-Allow-Headers response, so the
        # real request never fires. This is the actual, intended effect
        # of narrowing `allow_headers` away from `"*"`.
        assert response.status_code == 400

    def test_allow_headers_is_not_wildcard(self, client):
        response = client.options(
            "/editor/venues",
            headers={
                "Origin": ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization",
            },
        )

        assert response.headers["access-control-allow-headers"] != "*"

    def test_get_preflight_for_venues_list_succeeds(self, client):
        # Bulk/list endpoints only ever need `authorization` (no body, no
        # Content-Type) — confirms the narrower allowlist still covers
        # the read path, not just the write path above.
        response = client.options(
            "/editor/venues",
            headers={
                "Origin": ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )

        assert response.status_code == 200


class TestCorsActualRequests:
    def test_actual_request_with_authorization_header_still_works(self, client):
        # Not a preflight — a real GET with an Origin header, same as a
        # browser would send on the actual (post-preflight) request.
        # `Authorization` here is whatever the test suite's default admin
        # override already provides via `client`; CORS middleware doesn't
        # validate the token, only decides whether to attach CORS
        # response headers for this Origin.
        response = client.get(
            "/editor/venues",
            headers={"Origin": ALLOWED_ORIGIN, "Authorization": "Bearer irrelevant-to-cors"},
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    def test_content_type_json_request_still_works(self, client, make_venue):
        venue = make_venue(status="draft")

        response = client.patch(
            f"/editor/venues/{venue.id}",
            json={"name": "Updated via CORS-narrowed headers"},
            headers={"Origin": ALLOWED_ORIGIN},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated via CORS-narrowed headers"

    def test_disallowed_origin_gets_no_cors_headers(self, client):
        response = client.get(
            "/editor/venues",
            headers={"Origin": "https://not-an-allowed-origin.example.com"},
        )

        # The request itself still succeeds (CORS is enforced by the
        # browser reading response headers, not the server refusing the
        # request) — but no Access-Control-Allow-Origin is present, so a
        # real browser would block the response from untrusted JS.
        assert response.status_code == 200
        assert "access-control-allow-origin" not in response.headers
