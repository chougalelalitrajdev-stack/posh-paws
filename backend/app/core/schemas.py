"""The base for every request and response shape, and the page shape every long list uses."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")


class CamelModel(BaseModel):
    """Python names are snake_case (price_paise); the JSON the apps send and receive is camelCase (pricePaise).

    from_attributes lets a shape be filled straight from a database row.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Paged(CamelModel, Generic[T]):
    """One page of a long list (customers, pets, later bookings): the rows, how many there are in all, and which page this is."""

    items: list[T]
    total: int
    page: int
    page_size: int
