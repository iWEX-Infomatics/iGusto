
// igusto/igusto/page/guest_onboard/guest_onboard.js

frappe.pages['guest-onboard'].on_page_load = function (wrapper) {
	new GuestOnboarding(wrapper);
};

class GuestOnboarding {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
		this.make();
		this.load_company_details();
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
    let me = this;

    let html = frappe.render_template("guest_onboard", {});
    $(html).appendTo(this.page.body);

    // Load company header AFTER HTML loads
    setTimeout(() => {
        me.load_company_details();
    }, 300);

    // Create Nationality Link field
    setTimeout(() => {
        me.create_nationality_field();
    }, 200);

    setTimeout(() => {
        me.prefill_guest_and_fields();
    }, 300);

    this.page.body.find("#btn_submit_onboard").on("click", function () {
        me.submit_onboarding();
    });

    // Setup visibility logic for passport and visa fields
    this.setup_passport_visa_visibility();
}

create_nationality_field() {
    let me = this;
    setTimeout(() => {
        me.nationality_field = frappe.ui.form.make_control({
            df: {
                fieldtype: "Link",
                fieldname: "nationality",
                options: "Country",
                // label: "Nationality",
                placeholder: "Nationality"
            },
            parent: $("#nationality"),
            render_input: true
        });
        if (me.nationality_field) {
            me.nationality_field.refresh();
        }
    }, 100);
}

setup_passport_visa_visibility() {
    let me = this;
    
    const updatePassportVisaVisibility = () => {
        const nationality = (me.nationality_field && me.nationality_field.get_value()) || "";
        const idProofType = $("#id_proof_type").val() || "";
        
        // Check if country is not India (case-insensitive)
        const isNotIndia = nationality && nationality.toLowerCase() !== "india" && nationality.toLowerCase() !== "indian";
        
        // Show fields only if country is not India AND ID Proof Type is Passport
        const shouldShow = isNotIndia && idProofType === "Passport";
        
        if (shouldShow) {
            $("#passport_number_group").show();
            $("#visa_number_group").show();
        } else {
            $("#passport_number_group").hide();
            $("#visa_number_group").hide();
            // Clear values when hidden
            $("#passport_number").val("");
            $("#visa_number").val("");
        }
    };

    // Listen to changes in nationality field
    setTimeout(() => {
        if (me.nationality_field && me.nationality_field.$input) {
            $(me.nationality_field.$input).on("change", function () {
                updatePassportVisaVisibility();
            });
        }
    }, 300);

    // Listen to changes in ID Proof Type
    $(this.page.body).on("change", "#id_proof_type", function () {
        updatePassportVisaVisibility();
    });

    // Initial check after fields are loaded
    setTimeout(() => {
        updatePassportVisaVisibility();
    }, 500);
}


	async prefill_guest_and_fields() {
		let guestName = "";

		// Step 1: from route
		if (frappe.route_options && frappe.route_options.guest) {
			guestName = frappe.route_options.guest;
		}

		// Step 2: from localStorage
		if (!guestName) {
			const lastBooking = JSON.parse(localStorage.getItem("last_booking") || "{}");
			guestName = lastBooking.guest || "";
		}

		// Step 3: from latest Guest entry
		if (!guestName) {
			try {
				let res = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Guest",
						fields: ["name"],
						order_by: "creation desc",
						limit: 1
					}
				});
				if (res.message && res.message.length > 0) {
					guestName = res.message[0].name;
				}
			} catch (e) {
				console.error("Failed to fetch latest guest:", e);
			}
		}

		// Step 4: Prefill values
		let booking = JSON.parse(localStorage.getItem("last_booking") || "{}");

		$("#guest").val(guestName || booking.guest || "");
		$("#from_date").val(booking.from_date || "");
		$("#to_date").val(booking.to_date || "");
		$("#no_of_guests").val(booking.no_of_guests || "");
		$("#room_type").val(booking.room_type || "");
		
		// Set nationality using Link field
		if (booking.nationality && me.nationality_field) {
			let normalizedNat = booking.nationality;
			// Convert "Indian" or "india" to "India" for Country link
			if (normalizedNat.toLowerCase() === 'indian' || normalizedNat.toLowerCase() === 'india') {
				normalizedNat = 'India';
			}
			setTimeout(() => {
				if (me.nationality_field && me.nationality_field.set_value) {
					me.nationality_field.set_value(normalizedNat);
					if (me.nationality_field.$input) {
						me.nationality_field.$input.trigger("change");
					}
				}
			}, 300);
		}

		// Step 5: Fetch guest info
		if (guestName) {
			frappe.call({
				method: "frappe.client.get",
				args: { doctype: "Guest", name: guestName },
				callback: function (r) {
					if (r.message) {
						let g = r.message;
						// Set nationality using Link field
						if (g.nationality && me.nationality_field) {
							let normalizedNat = g.nationality;
							// Convert "Indian" or "india" to "India" for Country link
							if (normalizedNat.toLowerCase() === 'indian' || normalizedNat.toLowerCase() === 'india') {
								normalizedNat = 'India';
							}
							setTimeout(() => {
								if (me.nationality_field && me.nationality_field.set_value) {
									me.nationality_field.set_value(normalizedNat);
									if (me.nationality_field.$input) {
										me.nationality_field.$input.trigger("change");
									}
								}
							}, 200);
						}
					}
				}
			});
		}

		// Step 6: Load Room Types
		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room Type", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select Room Type</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type").html(options);
					if (booking.room_type) $("#room_type").val(booking.room_type);
				}
			}
		});

		// Step 7: Load Room Numbers
		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select Room Number</option>`;
					r.message.forEach(room => {
						options += `<option value="${room.name}">${room.name}</option>`;
					});
					$("#room_number").html(options);
				}
			}
		});
	}

	submit_onboarding() {
		let data = {
			guest: $("#guest").val(),
			from_date: $("#from_date").val(),
			to_date: $("#to_date").val(),
			no_of_guests: $("#no_of_guests").val(),
			nationality: (this.nationality_field && this.nationality_field.get_value()) || "",
			passport_number: $("#passport_number").val(),
			visa_number: $("#visa_number").val(),
			id_proof_type: $("#id_proof_type").val(),
			id_proof_number: $("#id_proof_number").val(),
			room_type: $("#room_type").val(),
			room_number: $("#room_number").val(),
			rfid_card_no: $("#rfid_card_no").val(),
			check_in_time: $("#check_in_time").val(),
			check_out_time: $("#check_out_time").val()
		};

		let file_input = $("#guest_photo")[0];
		let file = file_input.files[0];

		let upload_and_save = () => {
			frappe.call({
				method: "igusto.igusto.page.guest_onboard.guest_onboard.create_guest_onboarding",
				args: { data },
				callback: function (r) {
					if (!r.exc) {
						frappe.msgprint({
							title: __("Success"),
							message: __("Guest Onboarding Done Successfully"),
							indicator: "green"
						});
						frappe.set_route("Form", "Guest Onboarding", r.message);
					}
				}
			});
		};

		if (file) {
			let formData = new FormData();
			formData.append("file", file);
			formData.append("is_private", 0);
			formData.append("doctype", "File");
			formData.append("docname", $("#guest").val());

			$.ajax({
				url: "/api/method/upload_file",
				type: "POST",
				data: formData,
				processData: false,
				contentType: false,
				headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
				success: function (response) {
					if (response.message && response.message.file_url) {
						data.guest_photo = response.message.file_url;
					}
					upload_and_save();
				},
				error: function (xhr) {
					console.error("File upload failed:", xhr);
					frappe.msgprint("File upload failed. Please try again.");
				}
			});
		} else {
			upload_and_save();
		}
	}
}
