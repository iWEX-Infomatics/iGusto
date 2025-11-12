import frappe
from frappe.model.document import Document

class HousekeepingTask(Document):
    def after_insert(self):
        """When a new housekeeping task is created, assign a ToDo to the user"""
        if self.assigned_to:
            self.create_todo_for_assigned_user()

    def before_save(self):
        """Set assigned_to from ToDo allocated_to for child table tasks"""
        for row in self.housekeeping_task_detail:
            if row.task:  # Agar task field mein value hai
                allocated_user = self.get_allocated_user_from_task(row.task)
                if allocated_user:
                    row.assigned_to = allocated_user

    def create_todo_for_assigned_user(self):
        """Create ToDo record linked to this task"""
        todo = frappe.get_doc({
            "doctype": "ToDo",
            "allocated_to": self.assigned_to,
            "description": f"Housekeeping Task for Room {self.room} ({self.task_type})",
            "reference_type": "Housekeeping Task",
            "reference_name": self.name,
            "date": frappe.utils.nowdate(),
            "assigned_by": frappe.session.user
        })
        todo.insert(ignore_permissions=True)
        frappe.msgprint(f"Task assigned to {self.assigned_to}")

    def get_allocated_user_from_task(self, task_name):
        """
        Task ID (reference_name) se ToDo find karo
        aur allocated_to (User ID) return karo
        """
        # ToDo table mein query - jahan reference_name = task_name
        todo = frappe.db.get_value(
            'ToDo',
            {
                'reference_type': 'Task',
                'reference_name': task_name  # Yeh Task ID hai
            },
            'allocated_to'  # Yeh User ID return hogi
        )
        
        return todo if todo else None