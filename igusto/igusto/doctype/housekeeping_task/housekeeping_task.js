frappe.ui.form.on("Housekeeping Task", {
  room: function(frm) {
    if (frm.doc.room) {
      frappe.db.get_value("Room", frm.doc.room, ["room_type"], (r) => {
        if (r && r.room_type) {
          frm.set_value("room_type", r.room_type);
        }
      });
    }
  },
    verified_by: function(frm) {
        update_task_status(frm);
    },
    task_status(frm) {
        if (["Completed", "Verified"].includes(frm.doc.task_status)) {
            console.log(`✅ Task marked as ${frm.doc.task_status}. Creating Room Status Log...`);

            // Server-side API call to create Room Status Log
            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "Room Status Log",
                        room: frm.doc.room,
                        linked_task: frm.doc.name,
                        current_status: "Vacant Clean",
                        changed_by: frm.doc.verified_by || frappe.session.user,
                        date: frappe.datetime.now_date(),
                        remarks: frm.doc.task_remarks || `Marked as ${frm.doc.task_status} in Housekeeping Task`
                    }
                },
                callback: function(r) {
                    if (!r.exc) {
                         console.log(`🏠 Room Status Log created for Room ${frm.doc.room}`);
                    } else {
                         console.log("⚠️ Error creating Room Status Log.");
                    }
                }
            });
        }
    },
    after_save: function (frm) {
        // Run only if Maintenance Required is checked
        if (frm.doc.maintenance_required && !frm.doc.maintenance_request) {

            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "Maintenance Request",
                        reported_by: frappe.session.user,
                        room: frm.doc.room,
                        priority: frm.doc.priority || "Medium",
                        issue_description: frm.doc.issue_description || `Issue found during housekeeping task ${frm.doc.name}`,
                        assigned_to: frm.doc.assigned_to,
                        status: "Open",
                        verified_by: frm.doc.verified_by,
                        resolution_notes: frm.doc.task_remarks
                    }
                },
                callback: function (r) {
                    if (!r.exc && r.message) {
                        frappe.msgprint(`🛠️ Maintenance Request <b>${r.message.name}</b> created.`);

                        // Save linked maintenance request ID into the field
                        frappe.db.set_value("Housekeeping Task", frm.doc.name, {
                            maintenance_request: r.message.name
                        }).then(() => {
                            frm.reload_doc();
                        });
                    } else {
                        frappe.msgprint("⚠️ Could not create Maintenance Request. Check logs.");
                    }
                }
            });
        }
    }
});

frappe.ui.form.on('Housekeeping Task Detail', {
    task: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        
        if (row.task) {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'ToDo',
                    filters: {
                        reference_type: 'Task',
                        reference_name: row.task
                    },
                    fields: ['allocated_to'],
                    limit: 1
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0 && r.message[0].allocated_to) {
                        frappe.model.set_value(cdt, cdn, 'assigned_to', r.message[0].allocated_to);
                    }
                }
            });
        }
    },
    status: function(frm) {
        update_task_status(frm);
    }
});


function update_task_status(frm) {
    if (!frm.doc.housekeeping_task_detail || frm.doc.housekeeping_task_detail.length === 0) {
        frm.set_value("task_status", "Pending");
        return;
    }

    let total = frm.doc.housekeeping_task_detail.length;
    let completed = frm.doc.housekeeping_task_detail.filter(row => row.status === "Completed").length;

    if (completed === total) {
        if (frm.doc.verified_by) {
            frm.set_value("task_status", "Verified");
        } else {
            frm.set_value("task_status", "Completed");
        }
    } else if (completed > 0) {
        frm.set_value("task_status", "In Progress");
    } else {
        frm.set_value("task_status", "Pending");
    }
}
