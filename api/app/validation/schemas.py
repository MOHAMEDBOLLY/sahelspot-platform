from pydantic import BaseModel

# Deliberately generic — not Venue-specific — so a future validate_destination()
# (or any other entity's validator) returns the exact same shape. One reusable
# response contract for "is this row valid," not one per entity.


class FieldError(BaseModel):
    field: str
    message: str


class ValidationResult(BaseModel):
    valid: bool
    errors: list[FieldError]
