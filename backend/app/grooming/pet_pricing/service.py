"""Pet pricing: what a pet's breed, weight and coat add to a service's price (root CLAUDE.md › The bill), set on Catalog › Pet pricing.

Every extra is a ₹ amount set once per pet type and added to every service that has pet_pricing on. A fresh shop has no extras.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.grooming.catalog.models import Service
from app.grooming.pet_pricing.models import PetPricing
from app.grooming.pet_pricing.schemas import (
    BillExtra, BreedPrice, CoatPrice, PetOptionsOut, PetPricingDoc, PetTypeOptions, PetTypePricing, StoredPricing, WeightBand,
)
from app.shared.customers.models import Breed, Pet
from app.shared.customers.schemas import COAT_LABELS
from app.shared.customers.service import list_breeds

PET_TYPES = ("dog", "cat")

COAT_NOTES = {
    "dog": {
        "single": "One layer of hair, often silky or curly, that sheds little. For example Poodle, Maltese, Yorkshire Terrier.",
        "double": "A soft, fluffy undercoat under the outer hair; sheds a lot, more in some seasons. For example Labrador, "
                  "Golden Retriever, German Shepherd, Pomeranian, Husky.",
        "triple": "An extra-thick, heavy coat in layers that mats easily and takes long to dry. For example Samoyed, Chow Chow.",
    },
    "cat": {
        "single": "Short, sleek hair with little or no undercoat. For example Siamese, Bengal.",
        "double": "A dense undercoat under the outer hair. For example British Shorthair, Persian.",
        "triple": "A long, heavy coat in layers. For example Siberian, Maine Coon.",
    },
}
BANDS = {"dog": [10, 25, 40, None], "cat": [4, 7, None]}


def _defaults(pet_type: str) -> StoredPricing:
    """A fresh shop: the usual bands and coats, all at ₹0, so prices stay as the services say until extras are set."""
    return StoredPricing(
        weight_bands=[WeightBand(up_to_kg=kg) for kg in BANDS[pet_type]],
        coats={t: CoatPrice(type=t, note=COAT_NOTES[pet_type][t]) for t in COAT_LABELS},
    )


def stored(db: Session, pet_type: str) -> StoredPricing:
    row = db.get(PetPricing, pet_type)
    return StoredPricing.model_validate(row.value) if row else _defaults(pet_type)


def _kg(kg: float) -> str:
    return f"{kg:g}"


def band_label(bands: list[WeightBand], i: int) -> str:
    """"Up to 10 kg", "10–25 kg", "Over 40 kg"."""
    if i == 0:
        return f"Up to {_kg(bands[0].up_to_kg)} kg" if bands[0].up_to_kg is not None else "Any weight"
    if bands[i].up_to_kg is None:
        return f"Over {_kg(bands[i - 1].up_to_kg)} kg"
    return f"{_kg(bands[i - 1].up_to_kg)}–{_kg(bands[i].up_to_kg)} kg"


# ── On a bill ──


def extras_for(db: Session, pet: Pet, service: Service) -> list[BillExtra]:
    """What this pet adds to this service: its breed, weight band and coat, each only when it costs more than ₹0."""
    if not service.pet_pricing:
        return []
    if not pet.priced:
        raise HTTPException(status_code=400, detail=f"Add {pet.name}'s breed, weight and coat first. They set the price.")
    p = stored(db, pet.type)
    extras = []
    if breed_extra := p.breed_extras.get(pet.breed_id, 0):
        extras.append(BillExtra(label=pet.breed, amount_paise=breed_extra))
    i = next(i for i, b in enumerate(p.weight_bands) if b.up_to_kg is None or pet.weight_kg <= b.up_to_kg)
    if p.weight_bands[i].extra_paise:
        extras.append(BillExtra(label=band_label(p.weight_bands, i), amount_paise=p.weight_bands[i].extra_paise))
    if coat_extra := p.coats[pet.coat_type].extra_paise:
        extras.append(BillExtra(label=COAT_LABELS[pet.coat_type], amount_paise=coat_extra))
    return extras


# ── Catalog › Pet pricing ──


def _type_pricing(db: Session, pet_type: str) -> PetTypePricing:
    p = stored(db, pet_type)
    return PetTypePricing(
        breeds=[BreedPrice(id=b.id, name=b.name, extra_paise=p.breed_extras.get(b.id, 0)) for b in list_breeds(db, pet_type)],
        weight_bands=p.weight_bands,
        coats=[p.coats[t].model_copy(update={"label": COAT_LABELS[t]}) for t in COAT_LABELS],  # single, double, triple (JSONB doesn't keep key order)
    )


def pricing(db: Session) -> PetPricingDoc:
    return PetPricingDoc(dog=_type_pricing(db, "dog"), cat=_type_pricing(db, "cat"))


def save_pricing(db: Session, body: PetPricingDoc, by: str) -> PetPricingDoc:
    """Saves both pet types. Breeds keep their ids; a breed left out is archived, so pets that have it keep it.
    New prices apply to new bookings (and to a pet's upcoming bookings when its details change)."""
    for pet_type in PET_TYPES:
        doc: PetTypePricing = getattr(body, pet_type)
        current = {b.id: b for b in list_breeds(db, pet_type, archived=True)}
        kept, extras = set(), {}
        for i, item in enumerate(doc.breeds):
            breed = current.get(item.id) if item.id else None
            if breed is None:
                breed = Breed(pet_type=pet_type, name=item.name, sort_order=i)
                db.add(breed)
                db.flush()  # gives it its id
            breed.name, breed.sort_order, breed.archived = item.name, i, False
            kept.add(breed.id)
            if item.extra_paise:
                extras[breed.id] = item.extra_paise
        for breed in current.values():
            if breed.id not in kept:
                breed.archived = True
        value = StoredPricing(weight_bands=doc.weight_bands, coats={c.type: c.model_copy(update={"label": ""}) for c in doc.coats},
                              breed_extras=extras)
        row = db.get(PetPricing, pet_type) or PetPricing(pet_type=pet_type)
        row.value, row.updated_by = value.model_dump(mode="json"), by
        db.add(row)
    db.commit()
    return pricing(db)


# ── The customer app's pet form ──


def pet_options(db: Session) -> PetOptionsOut:
    def options(pet_type: str) -> PetTypeOptions:
        p = stored(db, pet_type)
        return PetTypeOptions(breeds=[{"id": b.id, "name": b.name} for b in list_breeds(db, pet_type)],
                              coats=[{"type": t, "label": COAT_LABELS[t], "note": p.coats[t].note} for t in COAT_LABELS])

    return PetOptionsOut(dog=options("dog"), cat=options("cat"))
