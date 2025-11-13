# Copyright (c) 2025, madhu and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class HousekeepingSchedule(Document):
	pass
import frappe

@frappe.whitelist()
def fetch_available_rooms():
    """Fetch all Room records not already used in any Housekeeping Schedule"""
    # get rooms already linked in any housekeeping schedule
    used_rooms = frappe.get_all(
        "Housekeeping Room List",
        fields=["room"],
        filters={"room": ["is", "set"]},
        pluck="room"
    )

    # get rooms that are not used
    available_rooms = frappe.get_all(
        "Room",
        fields=["name", "room_number", "room_type", "status", "notes"],
        filters={
            "name": ["not in", used_rooms or []]
        }
    )

    return available_rooms

