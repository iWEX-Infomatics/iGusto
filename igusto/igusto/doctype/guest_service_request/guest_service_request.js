frappe.ui.form.on("Guest Service Request", {
    after_save: function (frm) {
        if (!frm.doc.housekeeping_task_created) {

            // Step 1️⃣ — Get the last created Task ID
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Task",
                    fields: ["name"],
                    order_by: "creation desc",
                    limit: 1
                },
                callback: function (res) {
                    let new_task_name = "TASK-2025-00001"; // default if no task found

                    if (res.message && res.message.length > 0) {
                        let last_task = res.message[0].name; // e.g. TASK-2025-00004
                        let match = last_task.match(/(\d+)$/);

                        if (match) {
                            let next_num = String(parseInt(match[1]) + 1).padStart(5, "0");
                            new_task_name = `TASK-2025-${next_num}`;
                        }
                    }

                    // Step 2️⃣ — Create the new Task record
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Task",
                                subject: frm.doc.request_type || "Guest Service Task",
                                priority: "Medium",
                                status: "Open",
                                // project: "Test", // optional: set default project if needed
                                type: "Housekeeping",
                            },
                        },
                        callback: function (task_res) {
                            if (task_res.message) {
                                const new_task_id = task_res.message.name;

                                // Step 3️⃣ — Create Housekeeping Task linked to that Task
                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            doctype: "Housekeeping Task",
                                            room: frm.doc.room,
                                            task_type: frm.doc.request_type,
                                            task_description:
                                                frm.doc.description ||
                                                `Guest request from ${frm.doc.guest}`,
                                            task_priority: "Medium",
                                            // task_status: "Pending",
                                            start_time: frappe.datetime.now_datetime(),
                                            remarks: `Auto-generated from Guest Service Request: ${frm.doc.name}`,
                                            housekeeping_task_detail: [
                                                {
                                                    task: new_task_id, // link Task ID here
                                                    task_type: frm.doc.request_type,
                                                    notes:
                                                        frm.doc.description ||
                                                        "Auto-generated task from guest request",
                                                    source_request: frm.doc.name,
                                                },
                                            ],
                                        },
                                    },
                                    callback: function (hk_res) {
                                        if (!hk_res.exc) {
                                            frappe.msgprint(
                                                `✅ <b>Housekeeping Task ${hk_res.message.name}</b> created and linked with <b>${new_task_id}</b>`
                                            );

                                            // Step 4️⃣ — Update Guest Service Request
                                            frappe.db.set_value("Guest Service Request", frm.doc.name, {
                                                housekeeping_task_created: 1,
                                                status: "Accepted",
                                            });

                                            frm.reload_doc();
                                        } else {
                                            frappe.msgprint("⚠️ Could not create Housekeeping Task.");
                                        }
                                    },
                                });
                            } else {
                                frappe.msgprint("⚠️ Could not create Task record.");
                            }
                        },
                    });
                },
            });
        }
    },
});
