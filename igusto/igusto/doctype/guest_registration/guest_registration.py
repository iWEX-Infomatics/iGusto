# Copyright (c) 2025, madhu and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class GuestRegistration(Document):
	pass
def on_submit(self):
    #  Create ERPNext Customer
    if not frappe.db.exists("Customer", self.guest):
        cust = frappe.new_doc("Customer")
        cust.customer_name = self.guest
        cust.save()

