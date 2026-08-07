"""Root conftest — test-database isolation, and nothing else.

This file exists for one reason: pytest loads the rootdir's `conftest.py`
*before* `tests/conftest.py`, which makes it the only place a guard can
run before `tests/conftest.py`'s own `from app...` imports build the
SQLAlchemy engine from `DATABASE_URL`.

`enforce_isolated_test_database()` resolves a disposable test database,
refuses to proceed if it isn't provably isolated, and installs it into
the process environment. See `tests/database_guard.py` for the rules and
the incident that motivated them. Nothing in `app/` is imported here, and
no application behavior is affected — this only changes which database a
`pytest` process talks to.
"""

from tests.database_guard import enforce_isolated_test_database

enforce_isolated_test_database()
