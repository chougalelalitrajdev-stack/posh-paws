"""Pet pricing shapes: what Catalog › Pet pricing edits, what the customer app's pet form shows, and the extras on a bill."""

from typing import Annotated

from pydantic import AfterValidator, ConfigDict, Field, field_validator, model_validator

from app.core.schemas import CamelModel
from app.shared.customers.schemas import COAT_LABELS, CoatType

MAX_EXTRA = 1_000_000  # paise: ₹10,000, far above any real extra


def _extra(v: int) -> int:
    if v < 0 or v > MAX_EXTRA:
        raise ValueError("Enter each extra in whole rupees, from ₹0 to ₹10,000.")
    return v


Extra = Annotated[int, AfterValidator(_extra)]  # paise added to the price


class BillExtra(CamelModel):
    """One line a pet adds to a bill: "Golden Retriever +₹100", "25–40 kg +₹300", "Double coat +₹150"."""

    label: str
    amount_paise: int


class WeightBand(CamelModel):
    up_to_kg: float | None  # None: the last band, everything above the one before
    extra_paise: Extra = 0



class CoatPrice(CamelModel):
    type: CoatType
    label: str = ""  # filled in on the way out: "Double coat"
    note: str = Field(default="", max_length=300)  # shown to customers under the choice, to help them pick
    extra_paise: Extra = 0



class BreedPrice(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str | None = None  # None: a breed added on this save
    name: str = Field(max_length=60)
    extra_paise: Extra = 0


    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Name every breed, or remove the empty row.")
        return v


class PetTypePricing(CamelModel):
    """One pet type on Catalog › Pet pricing: the breed list with extras, the weight bands and the coats."""

    breeds: list[BreedPrice]
    weight_bands: list[WeightBand]
    coats: list[CoatPrice]

    @model_validator(mode="after")
    def check(self) -> "PetTypePricing":
        if not self.breeds:
            raise ValueError("Keep at least one breed, such as Other.")
        names = [b.name.lower() for b in self.breeds]
        if len(set(names)) != len(names):
            raise ValueError("Each breed can be listed once.")
        bands = self.weight_bands
        if not bands or bands[-1].up_to_kg is not None or any(b.up_to_kg is None for b in bands[:-1]):
            raise ValueError("Weight bands go up to a weight each, and the last one covers everything above.")
        limits = [b.up_to_kg for b in bands[:-1]]
        if any(kg <= 0 for kg in limits) or limits != sorted(set(limits)):
            raise ValueError("Each weight band must go higher than the one before.")
        if sorted(c.type for c in self.coats) != sorted(COAT_LABELS):
            raise ValueError("Set single, double and triple coats.")
        return self


class PetPricingDoc(CamelModel):
    """GET and PUT /admin/pet-pricing."""

    dog: PetTypePricing
    cat: PetTypePricing


class StoredPricing(CamelModel):
    """What a pet_pricing row keeps (breeds themselves live in the shared breed list)."""

    weight_bands: list[WeightBand]
    coats: dict[CoatType, CoatPrice]
    breed_extras: dict[str, int] = {}  # breed id → extra, only breeds that cost more


class PetTypeOptions(CamelModel):
    """What the customer app's pet form offers for one pet type: no prices, those come with the bill."""

    breeds: list[dict]  # {id, name}
    coats: list[dict]  # {type, label, note}


class PetOptionsOut(CamelModel):
    """GET /pet-options (no login): the breeds and coats to pick from."""

    dog: PetTypeOptions
    cat: PetTypeOptions
