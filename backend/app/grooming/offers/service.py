"""Offers: unique codes, pausing, and the status worked out from dates, limits and flags."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dates import today
from app.grooming.catalog.service import known_service_ids
from app.grooming.offers.models import Offer
from app.grooming.offers.schemas import OfferIn, OfferOut

# The order the Offers list shows them in (then the newest start date first).
STATUS_ORDER = ["live", "scheduled", "paused", "draft", "used_up", "expired"]


def status_of(o: Offer) -> str:
    t = today()
    if o.draft:
        return "draft"
    if o.ends_on and o.ends_on < t:
        return "expired"
    if o.total_uses is not None and o.used >= o.total_uses:
        return "used_up"
    if o.paused:
        return "paused"
    if o.starts_on > t:
        return "scheduled"
    return "live"


def out(o: Offer) -> OfferOut:
    return OfferOut.model_validate(o).model_copy(update={"status": status_of(o)})


def list_offers(db: Session) -> list[OfferOut]:
    offers = [out(o) for o in db.scalars(select(Offer))]
    return sorted(offers, key=lambda o: (STATUS_ORDER.index(o.status), -o.starts_on.toordinal()))


def find_offer(db: Session, offer_id: str) -> Offer:
    o = db.get(Offer, offer_id)
    if not o:
        raise HTTPException(status_code=404, detail="Offer not found.")
    return o


def _checked(db: Session, body: OfferIn, offer_id: str | None = None) -> dict:
    if body.code and db.scalar(select(Offer.id).where(Offer.code == body.code, Offer.id != offer_id)):
        raise HTTPException(status_code=409, detail=f"The code {body.code} is already used by another offer.")
    service_ids = known_service_ids(db, body.service_ids)
    if body.applies_to == "some_services" and not service_ids:
        raise HTTPException(status_code=400, detail="Pick at least one service.")
    return body.model_dump() | {"service_ids": service_ids}


def create_offer(db: Session, body: OfferIn) -> OfferOut:
    o = Offer(**_checked(db, body), paused=False, used=0)
    db.add(o)
    db.commit()
    return out(o)


def update_offer(db: Session, o: Offer, body: OfferIn) -> OfferOut:
    for field, value in _checked(db, body, o.id).items():
        setattr(o, field, value)
    db.commit()
    return out(o)


def set_paused(db: Session, o: Offer, paused: bool) -> OfferOut:
    if o.draft:
        raise HTTPException(status_code=409, detail="Drafts aren't running yet. Schedule the offer instead.")
    o.paused = paused
    db.commit()
    return out(o)
