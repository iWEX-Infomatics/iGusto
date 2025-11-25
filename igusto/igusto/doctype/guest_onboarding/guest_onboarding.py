# Copyright (c) 2025, madhu and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime
from igusto.igusto.api.hotel_lock_integration import get_lock_settings, call_lock_api  # ✅ Import added


class GuestOnboarding(Document):

    def before_save(self):
        # Validate check-in and check-out times
        if self.check_in_time and self.check_out_time:
            check_in = datetime.strptime(self.check_in_time, "%H:%M:%S")
            check_out = datetime.strptime(self.check_out_time, "%H:%M:%S")
            late_checkout = datetime.strptime("11:00:00", "%H:%M:%S")

            # If checkout after 11 AM → add 1 day
            if check_out > late_checkout:
                frappe.msgprint("Checkout after 11 AM — 1 extra day will be charged.")
        
        # Validate passport and visa requirement for non-Indian guests with Passport as ID proof
        # Only require passport/visa if nationality is not India AND ID Proof Type is Passport
        if self.nationality and self.nationality.lower() != "india" and self.nationality.lower() != "indian":
            if self.id_proof_type == "Passport":
                if not self.passport_number or not self.visa_number:
                    frappe.throw("For Non-Indian Guests, Passport and Visa details are mandatory when ID Proof Type is Passport.")

    # def on_submit(self):
    #     self.create_room_key()

    # def create_room_key(self):
    #     settings = get_lock_settings()
    #     payload = {
    #         "requestType": "new",
    #         "encoder": settings["encoder"],
    #         "hotelID": settings["hotel_id"],
    #         "roomNumber": self.room_number,
    #         "oldRoomNumber": "",
    #         "guestName": self.guest or self.guest,
    #         "arrivalDate": self.from_date,
    #         "departureDate": self.to_date,
    #         "noOfCards": 1,
    #         "isCommonAreaAccess": True
    #     }

    #     endpoint = f"/Keys?requestType=new&HotelID={settings['hotel_id']}"
    #     result = call_lock_api(endpoint, method="POST", data=payload)

    #     # Save transaction ID for reference
    #     if result and isinstance(result, dict) and result.get("transactionID"):
    #         self.db_set("key_transaction_id", result.get("transactionID"))
    #         frappe.msgprint(f"Room key generated successfully (Txn ID: {result.get('transactionID')})")
    #     else:
    #         frappe.msgpr
