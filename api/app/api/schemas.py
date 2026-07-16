from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    region: str
    status: str
    aliases: list[str] | None = None
    boundary: dict | None = None
    notes: str | None = None
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    destination_id: str
    district: str | None = None
    category: str
    status: str
    is_featured: bool
    is_verified: bool
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    maps_url: str | None = None
    instagram_handle: str | None = None
    facebook_handle: str | None = None
    tiktok_handle: str | None = None
    short_description: str | None = None
    cover_image_url: str | None = None
    gallery_image_urls: list[str] | None = None
    opening_hours: dict | None = None
    beach_details: dict | None = None
    internal_notes: str | None = None
    source: str | None = None
    last_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
