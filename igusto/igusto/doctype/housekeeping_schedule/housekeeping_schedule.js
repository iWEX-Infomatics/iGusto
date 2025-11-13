frappe.ui.form.on('Housekeeping Schedule', {
    refresh: function(frm) {
        frm.add_custom_button(__('Fetch Available Rooms'), function() {
            frappe.call({
                method: "igusto.igusto.doctype.housekeeping_schedule.housekeeping_schedule.fetch_available_rooms",
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        frm.clear_table("room_list");
                        r.message.forEach(function(room) {
                            let row = frm.add_child("room_list");
                            row.room = room.name;
                            row.room_type = room.room_type;
                            row.status = room.status;
                            row.remarks = room.notes;
                        });
                        frm.refresh_field("room_list");
                        frappe.msgprint(__('Fetched {0} available rooms', [r.message.length]));
                    } else {
                        frappe.msgprint(__('No available rooms found.'));
                    }
                }
            });
        });
    },
    from_template: function(frm) {
        if (frm.doc.from_template) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Project Template",
                    name: frm.doc.from_template
                },
                callback: function(r) {
                    if (r.message) {
                        const project_template = r.message;

                        // Clear existing rows first
                        frm.clear_table("task_schedule");

                        // Copy tasks from Project Template
                        if (project_template.tasks && project_template.tasks.length > 0) {
                            project_template.tasks.forEach((t) => {
                                const row = frm.add_child("task_schedule");
                                row.task = t.task || "";
                                row.subject = t.subject || t.title || ""; // agar tumhare childtable me subject field hai
                            });
                        }

                        frm.refresh_field("task_schedule");
                    }
                }
            });
        } else {
            frm.clear_table("task_schedule");
            frm.refresh_field("task_schedule");
        }
    },
    department: function(frm) {
        if (frm.doc.department) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Employee",
                    fields: ["name", "employee_name", "department"],
                    filters: {
                        department: frm.doc.department,
                        status: "Active"
                    },
                    limit_page_length: 1000
                },
                callback: function(r) {
                    if (r.message) {
                        // Clear existing rows
                        frm.clear_table("assigned_staff");

                        r.message.forEach(function(emp) {
                            let row = frm.add_child("assigned_staff");
                            row.employee = emp.name;
                            row.employee_name = emp.employee_name;
                            row.department = emp.department;
                        });

                        frm.refresh_field("assigned_staff");
                    }
                }
            });
        } else {
            frm.clear_table("assigned_staff");
            frm.refresh_field("assigned_staff");
        }
    }
});
