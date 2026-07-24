"""Editorial Activity Log — every workflow/publishing action under test
elsewhere in this suite should also produce exactly the activity entry it
claims to. This file only asserts the logging side effect; the action's
own success/rejection behavior is covered in test_workflow.py /
test_publishing.py.
"""

from tests.conftest import latest_activity


def test_submit_for_review_logs_activity(client, make_venue, db):
    venue = make_venue(status="draft")

    client.post(f"/venues/{venue.id}/submit-for-review")

    entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="submit_for_review")
    assert entry is not None
    assert entry.actor == "system"


def test_rejected_submit_for_review_does_not_log_activity(client, make_venue, db):
    venue = make_venue(status="review")  # already in review -> 409, no transition happens

    client.post(f"/venues/{venue.id}/submit-for-review")

    entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="submit_for_review")
    assert entry is None


def test_approve_logs_activity(client, make_venue, db):
    venue = make_venue(status="review")

    client.post(f"/venues/{venue.id}/approve")

    entry = latest_activity(db, entity_type="venue", entity_id=venue.id, action="approve")
    assert entry is not None
    assert entry.actor == "system"


def test_publish_logs_activity_with_counts(client, make_venue, db, preserve_seed_state):
    make_venue(status="approved")

    revision = client.post("/publish").json()

    entry = latest_activity(db, entity_type="publish_revision", entity_id=str(revision["id"]), action="publish")
    assert entry is not None
    assert entry.activity_metadata is not None
    assert "venue_count" in entry.activity_metadata
    assert "destination_count" in entry.activity_metadata


def test_republish_logs_activity(client, make_venue, db, preserve_seed_state):
    make_venue(status="approved")
    first = client.post("/publish").json()
    make_venue(status="approved")
    client.post("/publish")

    client.post(f"/publish/revisions/{first['id']}/republish")

    entry = latest_activity(
        db, entity_type="publish_revision", entity_id=str(first["id"]), action="republish"
    )
    assert entry is not None


def test_activity_endpoint_returns_entries_newest_first(client, make_venue):
    venue = make_venue(status="draft")

    client.post(f"/venues/{venue.id}/submit-for-review")
    client.post(f"/venues/{venue.id}/approve")

    response = client.get("/activity")

    assert response.status_code == 200
    entries = response.json()
    timestamps = [entry["timestamp"] for entry in entries]
    assert timestamps == sorted(timestamps, reverse=True)
    actions_for_venue = [e["action"] for e in entries if e["entity_id"] == venue.id]
    # Newest first: approve was logged after submit_for_review.
    assert actions_for_venue[:2] == ["approve", "submit_for_review"]
