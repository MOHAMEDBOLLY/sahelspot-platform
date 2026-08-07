"""Regression fence for Fix C — `_clean_global_tables` must restore the
previous current publish revision.

Why this file exists: `publish()` flips the existing current revision to
`is_current=False` and inserts a new current one. The cleanup fixture used
to delete only the inserted row, which undid half the operation and left
the database with **no current revision at all** — `get_current_revision()`
returns `None` and every `/public/*` route serves nothing. That is the
state the production incident left behind, so it gets a test.

The two tests below are deliberately ordered and interdependent, which is
unusual for this suite but unavoidable: the fixture under test does its
work in *teardown*, so proving it worked requires a later test to observe
the result. `_baseline_current_revision` is module-scoped so that it is
created before the function-scoped `_clean_global_tables` takes its
watermark — otherwise the baseline row would itself be above the
watermark and deleted.
"""

import pytest

from app.db.models import PublishRevision
from app.db.session import SessionLocal

EMPTY_SNAPSHOT = {"destinations": [], "venues": [], "events": []}


@pytest.fixture(scope="module")
def _baseline_current_revision():
    """The revision that must still be current after every test in this
    module. Reuses whatever is already current if there is one (a local
    database reused across runs); otherwise creates one and removes it
    again at the end, so a fresh CI database is left as it was found.
    """
    session = SessionLocal()
    created_id = None
    try:
        current = (
            session.query(PublishRevision)
            .filter(PublishRevision.is_current.is_(True))
            .one_or_none()
        )
        if current is None:
            revision = PublishRevision(snapshot=EMPTY_SNAPSHOT, is_current=True)
            session.add(revision)
            session.commit()
            created_id = revision.id
        yield created_id if current is None else current.id
    finally:
        if created_id is not None:
            session.query(PublishRevision).filter(PublishRevision.id == created_id).delete()
            session.commit()
        session.close()


def test_a_publish_supersedes_the_baseline_revision(
    client, make_venue, preserve_seed_state, _baseline_current_revision
):
    """Sets up the condition Fix C has to undo — after this test's
    teardown, the baseline must be current again."""
    make_venue(status="approved")

    response = client.post("/editor/publish")

    assert response.status_code == 200
    assert response.json()["id"] != _baseline_current_revision


def test_b_baseline_revision_is_current_again_after_cleanup(db, _baseline_current_revision):
    current = (
        db.query(PublishRevision).filter(PublishRevision.is_current.is_(True)).one_or_none()
    )

    assert current is not None, (
        "cleanup left the database with NO current publish revision — this is the "
        "production incident: /public/* would serve nothing"
    )
    assert current.id == _baseline_current_revision
