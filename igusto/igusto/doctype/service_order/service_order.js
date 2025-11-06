frappe.ui.form.on("Service Order", {
    refresh: function (frm) {
        if (!frm.is_new()) {
            frm.add_custom_button("Create Sales Invoice", function () {
                frappe.call({
                    method: "igusto.igusto.doctype.service_order.service_order.create_sales_invoice",
                    args: {
                        service_order_name: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: "Creating Sales Invoice...",
                    callback: function (r) {
                        if (!r.exc) {
                            const invoice = r.message;
                            const encoded_invoice = encodeURIComponent(invoice);

                            const link = `
                                <a href="/app/sales-invoice/${encoded_invoice}" 
                                   style="color: var(--blue-600); font-weight:600; text-decoration: underline;">
                                   ${invoice}
                                </a>`;

                            frappe.msgprint({
                                title: "Success",
                                message: `Sales Invoice ${link} created successfully.`,
                                indicator: "green"
                            });
                        }
                    }
                });
            }).addClass("btn-success");
        }
    }
});
