import frappe
from frappe.model.document import Document

class Guest(Document):
    def validate(self):
        # Convert name fields to title case
        if self.first_name:
            self.first_name = self.first_name.strip().title()
        if self.middle_name:
            self.middle_name = self.middle_name.strip().title()
        if self.last_name:
            self.last_name = self.last_name.strip().title()
