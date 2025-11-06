import frappe
from frappe.model.document import Document

class HousekeepingTask(Document):
    def after_insert(self):
        """When a new housekeeping task is created, assign a ToDo to the user"""
        if self.assigned_to:
            self.create_todo_for_assigned_user()

    def create_todo_for_assigned_user(self):
        """Create ToDo record linked to this task"""
        todo = frappe.get_doc({
            "doctype": "ToDo",
            "allocated_to": self.assigned_to,
            "description": f"Housekeeping Task for Room {self.room} ({self.task_type})",
            "reference_type": "Housekeeping Task",
            "reference_name": self.name,
            "date": self.task_date,
            "assigned_by": frappe.session.user
        })
        todo.insert(ignore_permissions=True)
        frappe.msgprint(f"Task assigned to {self.assigned_to}")
