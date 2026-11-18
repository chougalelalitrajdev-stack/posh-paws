"""Message templates: the starting texts, triggers that follow the notification settings, and the editing rules."""

TEMPLATES = "/api/admin/templates"


def test_templates(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    listed = client.get(TEMPLATES, headers=staff).json()
    assert len(listed) == 8 and [t["key"] for t in listed][:3] == ["payment_link", "booking_confirmed", "booking_reminder"]
    reminder = next(t for t in listed if t["key"] == "booking_reminder")
    assert reminder["trigger"] == "At 18:00 the day before" and reminder["approval"] == "approved" and reminder["autoSend"] is True

    # The trigger follows Settings › Notifications.
    client.put("/api/admin/settings/notifications", json={"reminderTime": "19:30", "unpaidNudgeHours": 6, "staffAlerts": "admins"}, headers=admin)
    assert next(t for t in client.get(TEMPLATES, headers=staff).json() if t["key"] == "booking_reminder")["trigger"] == "At 19:30 the day before"

    body = {"body": "See you tomorrow, {customer_name}! Bring {pet_name}'s favourite treat.", "autoSend": True}
    assert client.put(f"{TEMPLATES}/booking_reminder", json=body, headers=staff).status_code == 403
    edited = client.put(f"{TEMPLATES}/booking_reminder", json=body, headers=admin).json()
    assert edited["approval"] == "pending" and edited["updatedBy"] == "Meera K." and edited["autoSend"] is True  # back to WhatsApp

    by_hand = client.put(f"{TEMPLATES}/payment_link", json={"body": "Pay {amount} here: {payment_link}", "autoSend": True}, headers=admin).json()
    assert by_hand["autoSend"] is False  # staff send this one from a screen

    def detail(text):
        return client.put(f"{TEMPLATES}/booking_reminder", json={"body": text}, headers=admin).json()["detail"]

    assert detail("Hi {customer}!") == "{customer} isn't a field. Use the Insert buttons to add one."
    assert detail("   ") == "Write the message."
    assert detail("x" * 1001) == "Keep the message under 1000 characters."
    assert client.put(f"{TEMPLATES}/nope", json=body, headers=admin).status_code == 404
