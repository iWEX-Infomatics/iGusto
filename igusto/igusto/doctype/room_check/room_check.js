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
    },
        amount: function(frm, cdt, cdn) {
        calculate_total(frm);
    },
    room_check_items_remove: function(frm) {
        calculate_total(frm);
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
         calculate_total(frm);
         calculate_grand_totals(frm);
    },
    room_rent: function(frm) {
        calculate_grand_totals(frm);
    },
    damages_total: function(frm) {
        calculate_grand_totals(frm);
    }
});
function calculate_total(frm) {
    let total = 0;
    (frm.doc.room_check_items || []).forEach(row => {
        total += flt(row.amount);
    });
    frm.set_value("items_total", total);
}

function calculate_grand_totals(frm) {
    let items_total = 0;
    (frm.doc.room_check_items || []).forEach(row => {
        items_total += flt(row.amount);
    });

    frm.set_value("items_total", items_total);

    const room_rent = flt(frm.doc.room_rent);
    const damages_total = flt(frm.doc.damages_total);
    const grand_total = room_rent + items_total + damages_total;

    frm.set_value("grand_total", grand_total);
}
