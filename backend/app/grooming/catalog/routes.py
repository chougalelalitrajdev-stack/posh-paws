"""Services (/admin/services) and stations (/admin/stations). Every staff member reads them; Admin and Super Admin change them."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.grooming.catalog import service
from app.grooming.catalog.models import Service, Station
from app.grooming.catalog.schemas import ServiceIn, ServiceOrderIn, ServiceOut, StationIn, StationOut
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, SETTINGS_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/services", tags=["services"])
station_router = APIRouter(prefix="/admin/stations", tags=["stations"])

editors = require_roles(*CATALOG_EDIT_ROLES)
admins = require_roles(*SETTINGS_ROLES)  # stations are shop setup


@router.get("", response_model=list[ServiceOut])
def services(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[Service]:
    return service.list_services(db)


@router.post("", response_model=ServiceOut)
def add_service(body: ServiceIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Service:
    return service.create_service(db, body)


# Before /{service_id}, or "order" would be read as a service id.
@router.put("/order", response_model=list[ServiceOut])
def reorder(body: ServiceOrderIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> list[Service]:
    return service.reorder(db, body.pet_type, body.ids)


@router.put("/{service_id}", response_model=ServiceOut)
def edit_service(service_id: str, body: ServiceIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Service:
    return service.update_service(db, service.find_service(db, service_id), body)


@router.post("/{service_id}/archive", response_model=ServiceOut)
def archive(service_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Service:
    return service.set_archived(db, service.find_service(db, service_id), True)


@router.post("/{service_id}/restore", response_model=ServiceOut)
def restore(service_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Service:
    return service.set_archived(db, service.find_service(db, service_id), False)


@station_router.get("", response_model=list[StationOut])
def stations(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[Station]:
    return service.list_stations(db)


@station_router.post("", response_model=StationOut)
def add_station(body: StationIn, db: Session = Depends(get_db), _: StaffUser = Depends(admins)) -> Station:
    return service.create_station(db, body)


@station_router.put("/{station_id}", response_model=StationOut)
def edit_station(station_id: str, body: StationIn, db: Session = Depends(get_db), _: StaffUser = Depends(admins)) -> Station:
    return service.update_station(db, service.find_station(db, station_id), body)


@station_router.delete("/{station_id}", status_code=204)
def remove_station(station_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(admins)) -> Response:
    service.remove_station(db, service.find_station(db, station_id))
    return Response(status_code=204)
