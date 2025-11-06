frappe.ui.form.on("Room Check Items", {
    qty: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        row.amount = (row.qty || 0) * (row.rate || 0);
        frm.refresh_field("room_check_items");
    },
    rate: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        row.amount = (row.qty || 0) * (row.rate || 0);
        frm.refresh_field("room_check_items");
    }
});

frappe.ui.form.on("Room Check", {
    refresh(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button("Create Sales Invoice", function () {
                frappe.call({
                    method: "igusto.igusto.doctype.room_check.room_check.create_sales_invoice",
                    args: { doc: frm.doc },
                    freeze: true,
                    freeze_message: "Creating Sales Invoice...",
                    callback: function (r) {
                        if (r.message) {
                            const encoded = encodeURIComponent(r.message);
                            const link = `
                                <a href="/app/sales-invoice/${encoded}" 
                                   style="color: var(--blue-600); font-weight:600; text-decoration: underline;">
                                   ${r.message}
                                </a>`;
                            frappe.msgprint({
                                title: __("Success"),
                                indicator: "green",
                                message: __(
                                    `Sales Invoice ${link} created successfully (in Draft).`
                                )
                            });
                        }
                    },
                    error: function (err) {
                        frappe.msgprint({
                            title: __("Error"),
                            indicator: "red",
                            message: __("Failed to create Sales Invoice. Check console for details.")
                        });
                        console.error(err);
                    }
                });
            }).addClass("btn-primary");
        }
    }
});
