# Copyright (c) 2025, madhu and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime

class GuestOnboarding(Document):
	pass

class GuestOnboarding(Document):
    def before_save(self):
        # Validate check-in and check-out times
        if self.check_in_time and self.check_out_time:
            check_in = datetime.strptime(self.check_in_time, "%H:%M:%S")
            check_out = datetime.strptime(self.check_out_time, "%H:%M:%S")
            late_checkout = datetime.strptime("11:00:00", "%H:%M:%S")

            # If checkout after 11 AM → add 1 day
            if check_out > late_checkout:
                frappe.msgprint(" Checkout after 11 AM — 1 extra day will be charged.")
        
        # Validate nationality requirement
        if self.nationality and self.nationality.lower() != "indian":
            if not self.passport_number or not self.visa_number:
                frappe.throw("For Non-Indian Guests, Passport and Visa details are mandatory.")
