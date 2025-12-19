frappe.pages['room-booking'].on_page_load = function (wrapper) {
    new RoomBooking(wrapper);
};

class RoomBooking {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: '',
            single_column: true
        });
        this.serviceItems = [];
        this.itemsList = [];
        this.make();
    }
load_company_details() {
  frappe.call({
    method: "igusto.igusto.page.room_order.room_order.get_company_details",
    callback: (r) => {
      const data = r.message;
      if (!data) return;

      const logo_html = data.logo
        ? `<img src="${data.logo}" class="company-logo">`
        : `<div class="company-logo-placeholder">No Logo</div>`;

      // HARD CODED ADDRESS ONLY
      const address_line = "Munnar";

      // Dynamic phone + email
      const contact_line = ` ${data.phone_no || ""} | ${data.email || ""}`;

      const header_html = `
        <div class="company-header-inner">
          <div class="company-left">${logo_html}</div>
          <div class="company-right">
            <h2 class="company-name">${data.company_name}</h2>
            <div class="company-details">
              <div>${address_line} | ${contact_line}</div>
            </div>
          </div>
        </div>
      `;

      $(".company-header").html(header_html);
    }
  });
}
    make() {
        $(frappe.render_template("room_booking")).appendTo(this.page.main);
        frappe.after_ajax(() => {
            this.load_guest_data();
            this.load_room_types();
            this.load_company_details();
            this.load_items();
            this.setup_events();
            this.setup_date_validation();
            // Add default service item row
            setTimeout(() => {
                this.addServiceItemRow();
            }, 500);
        });
    }

    load_guest_data() {
        let storedGuest = localStorage.getItem("guest_data");
        
        if (!storedGuest) {
            frappe.msgprint("⚠️ No guest data found. Please sign up first.");
            setTimeout(() => frappe.set_route("guest-signup"), 1500);
            return;
        }

        try {
            const guestData = JSON.parse(storedGuest);
            console.log("📦 Loaded guest data from localStorage:", guestData);

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Guest",
                    filters: { name: guestData.guest },
                    fieldname: ["full_name", "nationality"]
                },
                callback: (r) => {
                    if (r.message) {
                        console.log("📦 Fetched from Guest doctype:", r.message);

                        let nationality = r.message.nationality || guestData.nationality || "-";
                        if (nationality.toLowerCase() === 'indian') {
                            nationality = 'India';
                        }
                        
                        const formattedText = `${guestData.guest}: ${r.message.full_name || "-"}, ${nationality}`;
                        $("#guest_full_info").text(formattedText);

                        this.guestData = {
                            ...guestData,
                            full_name: r.message.full_name,
                            nationality: r.message.nationality || guestData.nationality
                        };

                        console.log("✅ Guest data loaded successfully");
                    } else {
                        frappe.msgprint("⚠️ Guest not found in system.");
                        setTimeout(() => frappe.set_route("guest-signup"), 1500);
                    }
                }
            });

        } catch (e) {
            console.error("❌ Failed to parse guest data:", e);
            frappe.msgprint("⚠️ Invalid guest data. Please sign up again.");
            setTimeout(() => frappe.set_route("guest-signup"), 1500);
        }
    }

    load_items() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Item",
                filters: { is_sales_item: 1 },
                fields: ["name", "item_name", "stock_uom", "standard_rate"]
            },
            callback: (r) => {
                if (r.message) {
                    this.itemsList = r.message;
                    console.log("✅ Items loaded:", this.itemsList.length);
                }
            }
        });
    }

    setup_date_validation() {
        const $form = $(".booking-card");
        const today = frappe.datetime.get_today();
        let me = this;

        $form.find("#check_in").attr("min", today);
        
        $form.find("#check_in").on("change", function() {
            const checkIn = $(this).val();
            
            if (checkIn && checkIn < today) {
                frappe.msgprint("⚠️ Start date cannot be in the past.");
                $(this).val("");
                return;
            }

            if (checkIn) {
                $form.find("#check_out").attr("min", checkIn);
                
                const checkOut = $form.find("#check_out").val();
                if (checkOut && checkOut < checkIn) {
                    $form.find("#check_out").val("");
                }
            }

            // Update qty for all service items
            me.updateServiceItemsQty();
        });

        $form.find("#check_out").on("change", function() {
            const checkOut = $(this).val();
            const checkIn = $form.find("#check_in").val();

            if (checkOut && checkOut < today) {
                frappe.msgprint("⚠️ End date cannot be in the past.");
                $(this).val("");
                return;
            }

            if (checkIn && checkOut && checkOut < checkIn) {
                frappe.msgprint("⚠️ End date must be same or after start date.");
                $(this).val("");
                return;
            }

            // Update qty for all service items
            me.updateServiceItemsQty();
        });
    }

    updateServiceItemsQty() {
        const checkIn = $("#check_in").val();
        const checkOut = $("#check_out").val();

        if (!checkIn || !checkOut) return;

        const days = this.calculateDays(checkIn, checkOut);

        // Update qty for each service item row
        $("#service_items_body tr").each(function() {
            const $row = $(this);
            const $qtyInput = $row.find(".item-qty");
            $qtyInput.val(days);
            
            // Recalculate amount
            const rate = parseFloat($row.find(".item-rate").val()) || 0;
            const amount = days * rate;
            $row.find(".item-amount").val(amount.toFixed(2));
        });
    }

    calculateDays(checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays || 1;
    }

    setup_events() {
        const $form = $(".booking-card");
        let me = this;

        // Room type change - auto-fetch rate plan and description
        $form.on("change", "#room_type", function() {
            const roomType = $(this).val();
            if (!roomType) {
                $form.find("#rate_plan").val("");
                $("#description_row").hide();
                return;
            }

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Room Type",
                    filters: { name: roomType },
                    fieldname: ["base_rate", "description"]
                },
                callback: function(r) {
                    if (r.message) {
                        if (r.message.base_rate) {
                            $form.find("#rate_plan").val(r.message.base_rate);
                            console.log("✅ Room rate fetched:", r.message.base_rate);
                        } else {
                            $form.find("#rate_plan").val("");
                            frappe.msgprint("⚠️ No base rate found for this room type.");
                        }
                        
                        if (r.message.description) {
                            $("#description_text").text(r.message.description);
                            $("#description_row").slideDown(300);
                        } else {
                            $("#description_row").hide();
                        }
                    } else {
                        $form.find("#rate_plan").val("");
                        $("#description_row").hide();
                    }
                }
            });
        });

        // Add Service Item button
        $form.on("click", "#add_service_item", function(e) {
            e.preventDefault();
            me.addServiceItemRow();
        });

        // Item selection change
        $form.on("change", ".item-select", function() {
            const $row = $(this).closest("tr");
            const itemCode = $(this).val();
            
            if (!itemCode) return;

            const item = me.itemsList.find(i => i.name === itemCode);
            if (item) {
                $row.find(".item-uom").val(item.stock_uom || "");
                $row.find(".item-rate").val(item.standard_rate || 0);

                // Calculate qty based on dates
                const checkIn = $("#check_in").val();
                const checkOut = $("#check_out").val();
                
                if (checkIn && checkOut) {
                    const days = me.calculateDays(checkIn, checkOut);
                    $row.find(".item-qty").val(days);
                    
                    const amount = days * (item.standard_rate || 0);
                    $row.find(".item-amount").val(amount.toFixed(2));
                } else {
                    $row.find(".item-qty").val(1);
                    $row.find(".item-amount").val((item.standard_rate || 0).toFixed(2));
                }
            }
        });

        // Qty change
        $form.on("input", ".item-qty", function() {
            const $row = $(this).closest("tr");
            const qty = parseFloat($(this).val()) || 0;
            const rate = parseFloat($row.find(".item-rate").val()) || 0;
            const amount = qty * rate;
            $row.find(".item-amount").val(amount.toFixed(2));
        });

        // Remove item
        $form.on("click", ".remove-item-btn", function() {
            $(this).closest("tr").remove();
            me.reindexServiceItems();
        });

        // Reserve Booking Button
        $form.on("click", "#create_booking_btn", function (e) {
            e.preventDefault();

            if (!me.guestData) {
                frappe.msgprint("⚠️ Guest data not loaded. Please go back and sign up.");
                return;
            }

            const bookingData = {
                guest: me.guestData.guest,
                mobile: me.guestData.mobile,
                email: me.guestData.email,
                nationality: me.guestData.nationality,
                check_in: $form.find("#check_in").val() || "",
                check_out: $form.find("#check_out").val() || "",
                total_adults: $form.find("#total_adults_input").val() || "1",
                total_children: $form.find("#total_children_input").val() || "0",
                room_type: $form.find("#room_type").val() || "",
                rate_plan: $form.find("#rate_plan").val() || ""
            };

            // Validation
            if (!bookingData.check_in || !bookingData.check_out) {
                frappe.msgprint("⚠️ Start date and End date are required.");
                return;
            }
            if (!bookingData.total_adults || parseInt(bookingData.total_adults) < 1) {
                frappe.msgprint("⚠️ Total adults must be at least 1.");
                $form.find("#total_adults_input").focus();
                return;
            }
            if (!bookingData.room_type) {
                frappe.msgprint("⚠️ Room type is required.");
                return;
            }
            if (!bookingData.rate_plan) {
                frappe.msgprint("⚠️ Room rate is required.");
                return;
            }

            // Collect service items
            const serviceItems = [];
            $("#service_items_body tr").each(function() {
                const $row = $(this);
                const itemCode = $row.find(".item-select").val();
                
                if (itemCode) {
                    serviceItems.push({
                        item_code: itemCode,
                        qty: parseFloat($row.find(".item-qty").val()) || 0,
                        uom: $row.find(".item-uom").val() || "",
                        rate: parseFloat($row.find(".item-rate").val()) || 0,
                        amount: parseFloat($row.find(".item-amount").val()) || 0
                    });
                }
            });

            const no_of_guests = parseInt(bookingData.total_adults) + parseInt(bookingData.total_children);

            console.log("📤 Sending booking data:", {
                ...bookingData,
                no_of_guests,
                service_items: serviceItems
            });

            frappe.call({
                method: "igusto.igusto.page.room_booking.room_booking.create_booking",
                args: {
                    guest: bookingData.guest,
                    mobile: bookingData.mobile,
                    email: bookingData.email,
                    nationality: bookingData.nationality,
                    check_in: bookingData.check_in,
                    check_out: bookingData.check_out,
                    no_of_guests: no_of_guests,
                    total_adults: bookingData.total_adults,
                    total_children: bookingData.total_children,
                    room_type: bookingData.room_type,
                    rate_plan: bookingData.rate_plan,
                    service_items: JSON.stringify(serviceItems)
                },
                callback: function (r) {
                    if (r.message) {
                        frappe.msgprint({
                            title: "✅ Success",
                            message: `Room Booking Reserved Successfully!<br>Sales Order: ${r.message.sales_order}`,
                            indicator: "green"
                        });
                        
                        localStorage.removeItem("guest_data");
                        console.log("🗑️ Cleared guest_data from localStorage");
                        
                        // setTimeout(() => {
                        //     frappe.set_route("guest-signup");
                        // }, 2000);
                    }
                },
                error: function (err) {
                    console.error("❌ Booking Error:", err);
                    frappe.msgprint("❌ Failed to create booking.");
                }
            });
        });

        // Cancel button
        $form.on("click", "#back_btn", function () {
            frappe.set_route("guest-signup");
        });
    }

    addServiceItemRow() {
        const rowIndex = $("#service_items_body tr").length + 1;
        
        let itemOptions = '<option value="">Select Item</option>';
        this.itemsList.forEach(item => {
            itemOptions += `<option value="${item.name}">${item.item_name || item.name}</option>`;
        });

        const row = `
            <tr>
                <td class="sr-no">${rowIndex}</td>
                <td>
                    <select class="service-item-select item-select">
                        ${itemOptions}
                    </select>
                </td>
                <td>
                    <input type="number" class="service-item-input item-qty" value="1" min="0" step="0.01">
                </td>
                <td>
                    <input type="text" class="service-item-input item-uom" readonly>
                </td>
                <td>
                    <input type="number" class="service-item-input item-rate" value="0" min="0" step="0.01" readonly>
                </td>
                <td>
                    <input type="number" class="service-item-input item-amount" value="0" readonly>
                </td>
                <td>
                    <button type="button" class="remove-item-btn">×</button>
                </td>
            </tr>
        `;

        $("#service_items_body").append(row);
    }

    reindexServiceItems() {
        $("#service_items_body tr").each(function(index) {
            $(this).find(".sr-no").text(index + 1);
        });
    }

    load_room_types() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Room Type",
                fields: ["name"]
            },
            callback: function (r) {
                if (r.message && r.message.length > 0) {
                    let options = `<option value="">Room Type</option>`;
                    r.message.forEach(function (rt) {
                        options += `<option value="${rt.name}">${rt.name}</option>`;
                    });
                    $("#room_type_wrapper").html(`
                        <select class="form-control" id="room_type">
                            ${options}
                        </select>
                    `);
                    console.log("✅ Room types loaded:", r.message.length);
                }
            }
        });
    }
}