"""Money is integer paise everywhere (120000 = ₹1,200); this only turns it into text for messages."""


def inr(paise: int) -> str:
    """120000 → "₹1,200"; 12000000 → "₹1,20,000" (Indian grouping); 120050 → "₹1,200.50"."""
    rupees, rest = divmod(paise, 100)
    digits = str(rupees)
    groups, head = [digits[-3:]], digits[:-3]
    while head:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return f"₹{','.join(groups)}{f'.{rest:02d}' if rest else ''}"
