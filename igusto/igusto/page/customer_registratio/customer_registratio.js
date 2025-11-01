// file: your_app/your_app/page/customer_registration/customer_registration.js

frappe.pages['customer-registratio'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Customer Registration',
        single_column: true
    });

    $(frappe.render_template("customer_registratio", {})).appendTo(page.body);

    // Fetch dropdown options
    load_dropdowns();

    // Handle form submission
    $('#customer-form').on('submit', function(e) {
        e.preventDefault();

        const data = {
            doctype: "Customer",
            customer_name: $('#customer_name').val(),
            email_id: $('#email_id').val(),
            mobile_no: $('#mobile_no').val(),
            customer_type: $('#customer_type').val(),
            customer_group: $('#customer_group').val()
        };

        frappe.call({
            method: "frappe.client.insert",
            args: { doc: data },
            freeze: true,
            freeze_message: "Creating Customer...",
            callback: function(r) {
                if (!r.exc) {
                    $('#success-msg').fadeIn();
                    $('#customer-form')[0].reset();

                    setTimeout(() => {
                        $('#success-msg').fadeOut();
                    }, 4000);
                } else {
                    frappe.msgprint("❌ Error while creating customer.");
                }
            }
        });
    });
};


// 🔹 Load Customer Type & Customer Group
function load_dropdowns() {
    // Customer Type (Static)
    const customerTypes = [ "Company", "Individual","Partnership"];
    customerTypes.forEach(type => {
        $('#customer_type').append(`<option value="${type}">${type}</option>`);
    });

    // Customer Group (Dynamic from ERPNext)
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Customer Group",
            fields: ["name"],
            limit_page_length: 50
        },
        callback: function(r) {
            if (r.message) {
                r.message.forEach(group => {
                    $('#customer_group').append(`<option value="${group.name}">${group.name}</option>`);
                });
            }
        }
    });
}
