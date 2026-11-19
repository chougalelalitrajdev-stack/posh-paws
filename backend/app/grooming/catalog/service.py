"""Services (Catalog › Services) and stations (Availability › Stations): ordering, archiving, and the station rules."""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dates import today
from app.grooming.bookings.models import Booking
from app.grooming.catalog.models import Service, Station
from app.grooming.catalog.schemas import ICONS, PublicServiceOut, ServiceIn, StationIn

# ── Services ──


def list_services(db: Session) -> list[Service]:
    """Every service, archived ones included: cats then dogs, each in its display order."""
    return list(db.scalars(select(Service).order_by(Service.pet_type, Service.sort_order, Service.name)))


def public_services(db: Session) -> list[PublicServiceOut]:
    """What the customer app lists: visible, not archived, in display order."""
    shown = [s for s in list_services(db) if s.visible and not s.archived]
    return [PublicServiceOut.model_validate(s).model_copy(update={"icon": ICONS.get(s.category, "🐾")}) for s in shown]


def find_service(db: Session, service_id: str) -> Service:
    s = db.get(Service, service_id)
    if not s:
        raise HTTPException(status_code=404, detail="Service not found.")
    return s


def known_service_ids(db: Session, ids: list[str]) -> list[str]:
    """The ids that are real services, without repeats, in the order given."""
    known = set(db.scalars(select(Service.id).where(Service.id.in_(ids))))
    return [i for i in dict.fromkeys(ids) if i in known]


def _last_place(db: Session, pet_type: str) -> int:
    """The position after the last service of a pet type."""
    last = db.scalar(select(func.max(Service.sort_order)).where(Service.pet_type == pet_type))
    return 0 if last is None else last + 1


def create_service(db: Session, body: ServiceIn) -> Service:
    s = Service(**body.model_dump(), sort_order=_last_place(db, body.pet_type))
    db.add(s)
    db.commit()
    return s


def update_service(db: Session, s: Service, body: ServiceIn) -> Service:
    if body.pet_type != s.pet_type:
        s.sort_order = _last_place(db, body.pet_type)  # moving between dogs and cats puts it last in the new list
    for field, value in body.model_dump().items():
        setattr(s, field, value)
    db.commit()
    return s


def reorder(db: Session, pet_type: str, ids: list[str]) -> list[Service]:
    """Puts one pet type's services in the order given; ids of other pet types are ignored."""
    by_id = {s.id: s for s in db.scalars(select(Service).where(Service.pet_type == pet_type))}
    for position, service_id in enumerate(ids):
        if service_id in by_id:
            by_id[service_id].sort_order = position
    db.commit()
    return list_services(db)


def set_archived(db: Session, s: Service, archived: bool) -> Service:
    """Archived services leave the app and new bookings; bookings already made keep them."""
    s.archived = archived
    if archived:
        s.visible = False
    db.commit()
    return s


# ── Stations ──


def list_stations(db: Session) -> list[Station]:
    """In calendar column order. A fresh database starts with one all-round station, so there's always somewhere to book."""
    stations = list(db.scalars(select(Station).order_by(Station.sort_order)))
    if not stations:
        stations = [Station(name="Station 1", active=True, can_do="all", service_ids=[], sort_order=0)]
        db.add(stations[0])
        db.commit()
    return stations


def find_station(db: Session, station_id: str) -> Station:
    st = db.get(Station, station_id)
    if not st:
        raise HTTPException(status_code=404, detail="Station not found.")
    return st


def _checked(db: Session, body: StationIn, station_id: str | None = None) -> dict:
    """The station's fields, once the rules that need the database pass: a name of its own, and real services."""
    taken = db.scalar(select(Station.id).where(func.lower(Station.name) == body.name.lower(), Station.id != station_id))
    if taken:
        raise HTTPException(status_code=409, detail=f"There's already a station called {body.name}.")
    service_ids = known_service_ids(db, body.service_ids) if body.can_do == "some" else []
    if body.can_do == "some" and not service_ids:
        raise HTTPException(status_code=400, detail="Pick at least one service it can do.")
    return {"name": body.name, "active": body.active, "can_do": body.can_do, "service_ids": service_ids}


def _keep_one_in_use(db: Session, changing_id: str, active: bool) -> None:
    """At least one station stays in use, or nobody could book."""
    if not active and not db.scalar(select(Station.id).where(Station.active, Station.id != changing_id).limit(1)):
        raise HTTPException(status_code=409, detail="Keep at least one station in use.")


def create_station(db: Session, body: StationIn) -> Station:
    last = db.scalar(select(func.max(Station.sort_order)))
    st = Station(**_checked(db, body), sort_order=0 if last is None else last + 1)
    db.add(st)
    db.commit()
    return st


def update_station(db: Session, st: Station, body: StationIn) -> Station:
    """Bookings already on the station stay, even if it's switched off or can no longer do their service."""
    fields = _checked(db, body, st.id)
    _keep_one_in_use(db, st.id, fields["active"])
    for field, value in fields.items():
        setattr(st, field, value)
    db.commit()
    return st


def remove_station(db: Session, st: Station) -> None:
    """Only a station with no upcoming bookings can go; otherwise switch it off. Its blocks go with it; past bookings keep no station."""
    _keep_one_in_use(db, st.id, False)
    upcoming = db.scalar(select(func.count()).select_from(Booking).where(
        Booking.station_id == st.id, Booking.date >= today(), Booking.stage.in_(("awaiting_payment", "confirmed"))))
    if upcoming:
        them = "it" if upcoming == 1 else "them"
        raise HTTPException(status_code=409, detail=f"{upcoming} upcoming booking{' is' if upcoming == 1 else 's are'} on {st.name}. "
                                                    f"Move {them} first, or switch the station off instead.")
    db.delete(st)
    db.commit()
