from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    BigInteger,
    Identity,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Shared by destinations and venues alike — see docs/DATABASE.md's "Editorial
# status" decision: this is deliberately one vocabulary, not two that happen
# to match today. Keeping a single constant makes that impossible to miss.
CONTENT_STATUSES = ("draft", "review", "approved", "archived")
VENUE_CATEGORIES = (
    "Restaurant",
    "Cafe",
    "Hotel",
    "Beach",
    "Nightlife",
    "Shopping",
    "Services",
    "Entertainment",
    "Other",
)


class Destination(Base):
    """A named compound/resort/development along the North Coast."""

    __tablename__ = "destinations"
    __table_args__ = (
        CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_destinations_status"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    region: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    aliases: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    boundary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    venues: Mapped[list["Venue"]] = relationship(back_populates="destination")


class Venue(Base):
    """A specific place (restaurant, hotel, shop, activity, beach...) within a destination."""

    __tablename__ = "venues"
    __table_args__ = (
        CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_venues_status"),
        CheckConstraint(f"category IN {VENUE_CATEGORIES}", name="ck_venues_category"),
        UniqueConstraint("destination_id", "slug", name="uq_venues_destination_id_slug"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    destination_id: Mapped[str] = mapped_column(
        ForeignKey("destinations.id", ondelete="RESTRICT"), nullable=False
    )
    destination: Mapped["Destination"] = relationship(back_populates="venues")
    district: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    is_featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    maps_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    instagram_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    facebook_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    gallery_image_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    opening_hours: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    beach_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PublishRevision(Base):
    """An immutable, whole-dataset snapshot created each time content is published."""

    __tablename__ = "publish_revisions"
    __table_args__ = (
        Index(
            "uq_publish_revisions_is_current",
            "is_current",
            unique=True,
            postgresql_where=text("is_current"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    destination_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    venue_count: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ActivityLogEntry(Base):
    """A single recorded editorial action — Submit for Review, Approve,
    Publish, Republish, and any future workflow/publishing action. Purely
    an observability record: nothing in the codebase ever reads this table
    to decide behavior, and nothing here ever mutates `destinations`,
    `venues`, or `publish_revisions`. See app/activity/service.py for the
    one function that ever inserts a row here.
    """

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'system'"))
    # Python attribute deliberately not named `metadata` — that name is
    # reserved on every declarative model (it's `Base.metadata`, the
    # schema's MetaData instance). Mapped to the actual DB/JSON field name
    # "metadata" via the explicit column-name argument below.
    activity_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
