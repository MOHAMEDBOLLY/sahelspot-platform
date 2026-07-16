"""Minimal seed for the Sprint 4 smoke test: one destination, one venue.

Run with: python scripts/seed.py
Safe to re-run — uses session.merge() (insert-or-update by primary key).
"""

from app.db.models import Destination, Venue
from app.db.session import SessionLocal


def seed() -> None:
    db = SessionLocal()
    try:
        db.merge(
            Destination(
                id="marassi",
                name="Marassi",
                region="Sidi Abdelrahman Area",
                status="approved",
                notes="Flagship Emaar development on the Sidi Abdelrahman corridor, North Coast.",
            )
        )

        db.merge(
            Venue(
                id="v00001",
                name="The Smokery",
                slug="the-smokery",
                destination_id="marassi",
                district="Marina",
                category="Restaurant",
                status="approved",
                is_featured=True,
                is_verified=True,
                latitude="30.821785",
                longitude="28.977455",
                phone="01001234567",
                whatsapp="01001234567",
                website="https://thesmokery-marassi.com",
                maps_url="https://www.google.com/maps/place/The+Smokery+Marassi",
                instagram_handle="thesmokerymarassi",
                short_description="Wood-fired smokehouse and grill on the Marina waterfront in Marassi.",
                opening_hours={
                    "mon": [["12:00", "23:00"]],
                    "tue": [["12:00", "23:00"]],
                    "wed": [["12:00", "23:00"]],
                    "thu": [["12:00", "23:00"]],
                    "fri": [["12:00", "23:59"]],
                    "sat": [["12:00", "23:59"]],
                    "sun": [["12:00", "23:00"]],
                },
                source="sprint-4-seed",
            )
        )

        db.commit()
        print("Seeded 1 destination (marassi) and 1 venue (v00001 — The Smokery).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
